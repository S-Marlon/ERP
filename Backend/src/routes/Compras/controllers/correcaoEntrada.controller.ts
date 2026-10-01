// Correção de uma linha de NF já aprovada: vínculo com o item errado ou conversão (fator) errada.
// Estorna o que a linha deixou no estoque e lança no item certo, pelo custo da nota; move o vínculo do fornecedor
// e o GTIN; registra tudo em importacao_correcoes. simular = executa e desfaz (mostra o plano antes de confirmar).
import { Request, Response } from 'express';
import db from '../../Estoque/db.config';
import { lancarMovimentoEstoque } from '../../EstoqueItens/depositos';
import { obterOuCriarUnidade } from '../../Catalogo/Vendas/configVendas.controller';
import { buscarFornecedorId } from './stagingLoteController';
import { gtinDoItem, lerConversaoCompra, lerMapeamento } from '../staging/penteFino';
import { validarGtin } from '../staging/gtin';
import { ORIGEM_CORRECAO_ENTRADA, ORIGEM_CORRECAO_ESTORNO, planejarCorrecao, posicaoAtualDaLinha } from '../staging/correcaoEntrada';

const tenantDe = (req: Request) => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const n = (v: unknown) => Number(v) || 0;

class ErroNegocio extends Error {
  constructor(message: string, public status = 400, public extra?: unknown) { super(message); }
}

const SKU_DO_ITEM = `COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku)`;

/**
 * POST /compras/notas/:loteId/itens/:idStaging/correcao
 * { idItemNovo, fator, motivo, inativarAnterior?, simular? }
 */
export const corrigirLinhaNota = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const loteId = Number(req.params.loteId);
  const idStaging = Number(req.params.idStaging);
  const idItemNovo = Number(req.body?.idItemNovo);
  const fator = Number(req.body?.fator);
  const motivo = String(req.body?.motivo || '').trim();
  const simular = Boolean(req.body?.simular);
  const inativarAnterior = Boolean(req.body?.inativarAnterior);

  if (!(idItemNovo > 0)) return res.status(400).json({ error: 'Informe o item correto.' });
  if (!(fator > 0)) return res.status(400).json({ error: 'Fator de conversão precisa ser maior que zero.' });
  if (!simular && motivo.length < 3) return res.status(400).json({ error: 'Informe o motivo da correção.' });

  const conn: any = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[linha]]: any = await conn.execute(
      `SELECT * FROM importacao_produtos_staging WHERE id = ? AND lote_importacao_id = ? AND tenant_id = ? FOR UPDATE`,
      [idStaging, loteId, tenant]
    );
    if (!linha) throw new ErroNegocio('Linha da nota não encontrada.', 404);
    if (linha.status !== 'IMPORTADO' || !linha.produto_id_sistema) {
      throw new ErroNegocio('Só dá para corrigir linhas de nota já aprovada. Antes da aprovação, ajuste pela conferência.', 409);
    }
    const [[lote]]: any = await conn.execute(
      `SELECT id, numero_nf, chave_acesso, cnpj_fornecedor FROM importacoes_lotes WHERE id = ? AND tenant_id = ?`,
      [loteId, tenant]
    );

    const [[novo]]: any = await conn.execute(
      `SELECT ic.id_item, ic.status, UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) AS tipo_recurso, ic.nome_item,
              um.sigla AS unidade_base, ${SKU_DO_ITEM} AS sku
       FROM itens_core ic
       LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       WHERE ic.id_item = ? AND ic.tenant_id = ?`,
      [idItemNovo, tenant]
    );
    if (!novo) throw new ErroNegocio('Item correto não encontrado no catálogo.', 404);
    if (String(novo.status).toUpperCase() === 'INATIVO') throw new ErroNegocio(`O item ${novo.sku} está inativo.`);

    const idAnterior = Number(linha.produto_id_sistema);
    const fatorAnterior = lerConversaoCompra(linha).fator;
    if (idAnterior === Number(novo.id_item) && Math.abs(fatorAnterior - fator) < 0.000001) {
      throw new ErroNegocio('Nada a corrigir: mesmo item e mesmo fator.');
    }

    // O que a linha tem hoje no estoque (entrada da NF + correções anteriores)
    const [corrs]: any = await conn.execute(
      `SELECT id FROM importacao_correcoes WHERE tenant_id = ? AND staging_id = ?`, [tenant, idStaging]
    );
    const idsCorrecoes: number[] = corrs.map((c: any) => Number(c.id));
    const [movs]: any = await conn.execute(
      `SELECT id_item, deposito, tipo_movimento, quantidade, quantidade_documento, custo_total
       FROM estoque_movimentos
       WHERE tenant_id = ? AND (
         (origem = 'ENTRADA_NFE' AND id_origem = ? AND id_origem_item = ?)
         OR (origem IN (?, ?) AND id_origem = ? AND id_origem_item IN (${idsCorrecoes.length ? idsCorrecoes.map(() => '?').join(',') : '-1'})))`,
      [tenant, loteId, idStaging, ORIGEM_CORRECAO_ENTRADA, ORIGEM_CORRECAO_ESTORNO, loteId, ...idsCorrecoes]
    );
    const atual = posicaoAtualDaLinha(movs.map((m: any) => ({
      idItem: Number(m.id_item), deposito: m.deposito, tipo: m.tipo_movimento,
      quantidade: n(m.quantidade), quantidadeDocumento: n(m.quantidade_documento), custoTotal: n(m.custo_total),
    })));
    if (atual.length === 0) throw new ErroNegocio('Esta linha não deixou estoque para corrigir (recebida zerada).', 409);

    const custoDocumento = n(linha.custo_unitario_final || linha.preco_custo_unitario);
    const plano = planejarCorrecao(atual, { idItem: Number(novo.id_item), tipoRecurso: novo.tipo_recurso }, fator, custoDocumento);

    // SKUs para as mensagens e o retorno
    const idsEnvolvidos = [...new Set([idAnterior, Number(novo.id_item), ...atual.map(a => a.idItem)])];
    const [skus]: any = await conn.execute(
      `SELECT ic.id_item, ${SKU_DO_ITEM} AS sku, COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome
       FROM itens_core ic LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       WHERE ic.tenant_id = ? AND ic.id_item IN (${idsEnvolvidos.map(() => '?').join(',')})`,
      [tenant, ...idsEnvolvidos]
    );
    const skuDe = new Map<number, { sku: string; nome: string }>(skus.map((s: any) => [Number(s.id_item), { sku: s.sku, nome: s.nome }]));

    const [registro]: any = await conn.execute(
      `INSERT INTO importacao_correcoes
       (tenant_id, lote_importacao_id, staging_id, id_item_anterior, id_item_novo, fator_anterior, fator_novo, motivo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, loteId, idStaging, idAnterior, novo.id_item, fatorAnterior.toFixed(6), fator.toFixed(6), (motivo || 'simulação').slice(0, 255)]
    );
    const correcaoId = Number(registro.insertId);
    const unidadeNf = String(linha.unidade_original || 'UN').trim().toUpperCase();
    const observacao = `Correção NF ${lote?.numero_nf || ''} item ${linha.item_nfe_seq || ''}: ${motivo}`.slice(0, 255);
    const movimentos: any[] = [];

    // 1. Entra no item certo (antes do estorno: corrigir só o fator do mesmo item nunca deixa o saldo negativo no meio)
    for (const e of plano.entradas) {
      const r = await lancarMovimentoEstoque(conn, {
        tenant, idItem: e.idItem, deposito: e.deposito, tipo: 'ENTRADA', origem: ORIGEM_CORRECAO_ENTRADA,
        idOrigem: loteId, idOrigemItem: correcaoId, documento: lote?.chave_acesso, tipoRecurso: novo.tipo_recurso,
        quantidade: e.quantidade, quantidadeDocumento: e.quantidadeDocumento, unidadeDocumento: unidadeNf, fatorConversao: fator,
        custoUnitario: e.custoUnitario, observacao, recalcularCustoMedio: true, registrarUltimoCusto: true,
      });
      movimentos.push({ tipo: 'ENTRADA', idItem: e.idItem, sku: skuDe.get(e.idItem)?.sku, deposito: e.deposito, quantidade: e.quantidade, custoUnitario: e.custoUnitario, ...r });
    }

    // 2. Estorna do item errado; sem saldo (já vendido/consumido) a correção não fecha
    const semSaldo: string[] = [];
    for (const s of plano.estornos) {
      const [[saldo]]: any = await conn.execute(
        `SELECT quantidade_atual FROM estoque_saldos_itens WHERE tenant_id = ? AND id_item = ? AND deposito = ? FOR UPDATE`,
        [tenant, s.idItem, s.deposito]
      );
      const disponivel = n(saldo?.quantidade_atual);
      if (disponivel + 0.000001 < s.quantidade) {
        semSaldo.push(`${skuDe.get(s.idItem)?.sku || s.idItem} em ${s.deposito}: precisa estornar ${s.quantidade}, saldo ${disponivel}`);
        continue;
      }
      const r = await lancarMovimentoEstoque(conn, {
        tenant, idItem: s.idItem, deposito: s.deposito, tipo: 'SAIDA', origem: ORIGEM_CORRECAO_ESTORNO,
        idOrigem: loteId, idOrigemItem: correcaoId, documento: lote?.chave_acesso, tipoRecurso: novo.tipo_recurso,
        quantidade: s.quantidade, quantidadeDocumento: s.quantidadeDocumento, unidadeDocumento: unidadeNf,
        fatorConversao: s.quantidadeDocumento > 0 ? s.quantidade / s.quantidadeDocumento : 1,
        custoUnitario: s.custoUnitario, observacao, estornoDeEntrada: true,
      });
      movimentos.push({ tipo: 'SAIDA', idItem: s.idItem, sku: skuDe.get(s.idItem)?.sku, deposito: s.deposito, quantidade: s.quantidade, custoUnitario: s.custoUnitario, ...r });
    }
    if (semSaldo.length > 0) {
      throw new ErroNegocio(
        'O item errado não tem saldo para estornar (parte já foi vendida ou consumida). Ajuste o saldo dele (inventário) e tente de novo.',
        409, semSaldo
      );
    }

    // 3. Vínculo do fornecedor passa para o item certo (o código dele volta a sugerir o item certo nas próximas notas)
    const idFornecedor = lote ? await buscarFornecedorId(conn, lote.cnpj_fornecedor, tenant) : null;
    if (idFornecedor) {
      await conn.execute(
        `INSERT INTO comercial_fornecedores_produtos
         (tenant_id, id_item, id_fornecedor, codigo_produto_fornecedor, unidade_compra, fator_compra, preco_ultima_compra)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE codigo_produto_fornecedor = VALUES(codigo_produto_fornecedor), unidade_compra = VALUES(unidade_compra),
                                 fator_compra = VALUES(fator_compra), preco_ultima_compra = VALUES(preco_ultima_compra)`,
        [tenant, novo.id_item, idFornecedor, linha.codigo_fornecedor || null, unidadeNf, fator.toFixed(6), custoDocumento.toFixed(4)]
      );
      if (idAnterior !== Number(novo.id_item)) {
        // Só desfaz o vínculo antigo se nenhuma outra nota deste fornecedor usou o código no item errado
        const [[outras]]: any = await conn.execute(
          `SELECT COUNT(*) AS total FROM importacao_produtos_staging s
           INNER JOIN importacoes_lotes l ON l.id = s.lote_importacao_id AND l.tenant_id = s.tenant_id
           WHERE s.tenant_id = ? AND s.id <> ? AND s.status = 'IMPORTADO' AND s.produto_id_sistema = ?
             AND l.cnpj_fornecedor = ? AND s.codigo_fornecedor <=> ?`,
          [tenant, idStaging, idAnterior, lote?.cnpj_fornecedor, linha.codigo_fornecedor]
        );
        if (n(outras.total) === 0) {
          await conn.execute(
            `DELETE FROM comercial_fornecedores_produtos
             WHERE tenant_id = ? AND id_item = ? AND id_fornecedor = ? AND codigo_produto_fornecedor <=> ?`,
            [tenant, idAnterior, idFornecedor, linha.codigo_fornecedor || null]
          );
        }
      }
    }

    // 4. Embalagem de compra como unidade derivada do item certo (ex.: 1 CX = 12 UN)
    const unidadeBaseNovo = String(novo.unidade_base || unidadeNf).toUpperCase();
    if (fator !== 1 && unidadeNf !== unidadeBaseNovo) {
      const idUnidadeCompra = await obterOuCriarUnidade(conn, tenant, unidadeNf);
      await conn.execute(
        `INSERT INTO itens_unidades_conversao (tenant_id, id_item, id_unidade_derivada, fator_conversao)
         VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE fator_conversao = VALUES(fator_conversao)`,
        [tenant, novo.id_item, idUnidadeCompra, fator]
      );
    }

    // 5. GTIN da nota sai do item errado e vai para o certo (se não estiver em outro item)
    let gtinMovido = false;
    const gtin = gtinDoItem(linha);
    if (gtin && validarGtin(gtin) && idAnterior !== Number(novo.id_item)) {
      await conn.execute(
        `UPDATE comercial_unidades_venda SET gtin = NULL WHERE tenant_id = ? AND id_item = ? AND gtin = ?`,
        [tenant, idAnterior, gtin]
      );
      const [uso]: any = await conn.execute(
        `SELECT id_item FROM comercial_unidades_venda WHERE tenant_id = ? AND gtin = ?`, [tenant, gtin]
      );
      if (uso.length === 0) {
        const idUnidadeCompra = await obterOuCriarUnidade(conn, tenant, unidadeNf);
        const compraEhBase = unidadeNf === unidadeBaseNovo ? 1 : 0;
        await conn.execute(
          `INSERT INTO comercial_unidades_venda
           (tenant_id, id_item, id_unidade, gtin, permite_venda, permite_atacado, markup_varejo, padrao_pdv)
           VALUES (?, ?, ?, ?, ?, 0, 1.8, ?)
           ON DUPLICATE KEY UPDATE gtin = COALESCE(gtin, VALUES(gtin))`,
          [tenant, novo.id_item, idUnidadeCompra, gtin, compraEhBase, compraEhBase]
        );
        gtinMovido = true;
      }
    }

    // 6. A linha da nota passa a apontar para o item certo
    const mapeamento = lerMapeamento(linha);
    const novoMapeamento = {
      ...mapeamento,
      mode: 'EXISTING_DIRECT',
      existingProductId: Number(novo.id_item),
      existingProduct: { sku: novo.sku, nome: skuDe.get(Number(novo.id_item))?.nome || novo.nome_item, tipo_recurso: novo.tipo_recurso },
      draftIdentity: null,
      configVendas: null,
      tipo_recurso: novo.tipo_recurso,
      conversaoCompra: { unidade_compra: unidadeNf, unidade_base: unidadeBaseNovo, fator },
      destinos: plano.entradas.length > 1 ? plano.entradas.map(e => ({ deposito: e.deposito, quantidade: e.quantidadeDocumento })) : undefined,
    };
    await conn.execute(
      `UPDATE importacao_produtos_staging SET produto_id_sistema = ?, sku_sistema = ?, mapeamento_json = ? WHERE id = ?`,
      [novo.id_item, novo.sku, JSON.stringify(novoMapeamento), idStaging]
    );

    // 7. Item errado sem saldo e sem outro uso pode ser inativado (ex.: item criado por engano nesta nota)
    let podeInativar = false;
    let anteriorInativado = false;
    if (idAnterior !== Number(novo.id_item)) {
      const [[saldoTotal]]: any = await conn.execute(
        `SELECT COALESCE(SUM(quantidade_atual), 0) AS total FROM estoque_saldos_itens WHERE tenant_id = ? AND id_item = ?`,
        [tenant, idAnterior]
      );
      const ligados = [...idsCorrecoes, correcaoId];
      const [[outrosMovs]]: any = await conn.execute(
        `SELECT COUNT(*) AS total FROM estoque_movimentos
         WHERE tenant_id = ? AND id_item = ?
           AND NOT (origem = 'ENTRADA_NFE' AND id_origem = ? AND id_origem_item = ?)
           AND NOT (origem IN (?, ?) AND id_origem = ? AND id_origem_item IN (${ligados.map(() => '?').join(',')}))`,
        [tenant, idAnterior, loteId, idStaging, ORIGEM_CORRECAO_ENTRADA, ORIGEM_CORRECAO_ESTORNO, loteId, ...ligados]
      );
      podeInativar = Math.abs(n(saldoTotal.total)) < 0.000001 && n(outrosMovs.total) === 0;
      if (inativarAnterior && podeInativar) {
        await conn.execute(`UPDATE itens_core SET status = 'INATIVO' WHERE id_item = ? AND tenant_id = ?`, [idAnterior, tenant]);
        anteriorInativado = true;
      }
    }

    const detalhes = {
      antes: { idItem: idAnterior, fator: fatorAnterior, posicao: atual },
      depois: { idItem: Number(novo.id_item), fator, posicao: plano.entradas },
      fornecedorVinculado: Boolean(idFornecedor),
      gtinMovido,
      anteriorInativado,
    };
    await conn.execute(`UPDATE importacao_correcoes SET detalhes_json = ? WHERE id = ?`, [JSON.stringify(detalhes), correcaoId]);

    if (simular) await conn.rollback();
    else await conn.commit();

    return res.json({
      simulacao: simular,
      correcaoId: simular ? null : correcaoId,
      message: simular ? 'Simulação: nada foi gravado.' : 'Linha corrigida.',
      itemAnterior: { idItem: idAnterior, ...skuDe.get(idAnterior), podeInativar, inativado: anteriorInativado },
      itemNovo: { idItem: Number(novo.id_item), sku: novo.sku, nome: skuDe.get(Number(novo.id_item))?.nome, tipoRecurso: novo.tipo_recurso, unidadeBase: unidadeBaseNovo },
      fatorAnterior,
      fatorNovo: fator,
      movimentos,
      fornecedorVinculado: Boolean(idFornecedor),
      gtinMovido,
    });
  } catch (error: any) {
    await conn.rollback();
    if (error instanceof ErroNegocio) return res.status(error.status).json({ error: error.message, detalhes: error.extra });
    console.error('Erro ao corrigir linha da nota:', error);
    return res.status(500).json({ error: 'Erro ao corrigir a linha da nota.', details: error.message });
  } finally {
    conn.release();
  }
};

/**
 * GET /compras/notas/:loteId/correcoes — histórico de correções da nota
 */
export const listarCorrecoesNota = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const [rows]: any = await db.execute(
      `SELECT c.id, c.staging_id, c.id_item_anterior, c.id_item_novo, c.fator_anterior, c.fator_novo, c.motivo, c.created_at,
              COALESCE(NULLIF(TRIM(ca.sku_customizado), ''), ia.sku) AS sku_anterior,
              COALESCE(NULLIF(TRIM(cn.sku_customizado), ''), inn.sku) AS sku_novo
       FROM importacao_correcoes c
       LEFT JOIN itens_core ia ON ia.id_item = c.id_item_anterior
       LEFT JOIN comercial_produtos_dados ca ON ca.id_item = c.id_item_anterior AND ca.tenant_id = c.tenant_id
       LEFT JOIN itens_core inn ON inn.id_item = c.id_item_novo
       LEFT JOIN comercial_produtos_dados cn ON cn.id_item = c.id_item_novo AND cn.tenant_id = c.tenant_id
       WHERE c.tenant_id = ? AND c.lote_importacao_id = ?
       ORDER BY c.id DESC`,
      [tenant, Number(req.params.loteId)]
    );
    return res.json({
      data: rows.map((r: any) => ({
        id: Number(r.id),
        idStaging: Number(r.staging_id),
        skuAnterior: r.sku_anterior,
        skuNovo: r.sku_novo,
        fatorAnterior: n(r.fator_anterior),
        fatorNovo: n(r.fator_novo),
        motivo: r.motivo,
        criadoEm: r.created_at,
      })),
    });
  } catch (error: any) {
    console.error('Erro ao listar correções da nota:', error);
    return res.status(500).json({ error: error.message });
  }
};
