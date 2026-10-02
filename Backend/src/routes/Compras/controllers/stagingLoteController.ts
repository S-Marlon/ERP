import { Request, Response } from 'express';
import db from '../../Estoque/db.config';
import { obterOuCriarUnidade, gravarConfigVendas, FaixaPayload, UnidadePayload } from '../../Catalogo/Vendas/configVendas.controller';
import { recalcularFaixas } from '../../Catalogo/Vendas/precificacao';
import { validarGtin } from '../staging/gtin';
import { lancarMovimentoEstoque } from '../../EstoqueItens/depositos';
import { gravarAtributosItemNovo } from '../../Catalogo/Produtos/produtoDetalhe.controller';
import { destinosDoItem, prefixoSkuSequencial, skuCustomizadoPlanejado, skuSequencial } from '../staging/penteFino';
import { canonizar, carregarResolvedor } from '../staging/unidadesEntrada';
import {
  avaliarPenteFino,
  calcularCustoMedio,
  gtinDoItem,
  isItemNovo,
  lerConversaoCompra,
  lerMapeamento,
  LoteRow,
  PenteFinoContexto,
  StagingItemRow,
  STATUS_LOTE_FINALIZADO,
} from '../staging/penteFino';

// Conexão do pool (mysql2/promise): usada tanto fora quanto dentro de transação
type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const ORIGEM_NFE = 'ENTRADA_NFE';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.body?.tenant_id || 1);

// vNF vem do JSON salvo na sincronização do XML
const SELECT_LOTE = `
  SELECT l.*,
         CAST(JSON_UNQUOTE(JSON_EXTRACT(l.dados_nota_fiscal, '$.totais.icmsTot.vNF')) AS DECIMAL(15,2)) AS valor_total_nf_xml,
         COALESCE(NULLIF(l.razao_social_fornecedor, ''),
                  JSON_UNQUOTE(JSON_EXTRACT(l.dados_nota_fiscal, '$.emitente.nome'))) AS emitente_nome
  FROM importacoes_lotes l
  WHERE l.id = ? AND l.tenant_id = ?`;

const carregarLote = async (conn: Conn, loteId: number, tenant: number, forUpdate = false) => {
  const [rows] = await conn.execute(SELECT_LOTE + (forUpdate ? ' FOR UPDATE' : ''), [loteId, tenant]);
  return rows[0] || null;
};

const carregarItens = async (conn: Conn, loteId: number, tenant: number, forUpdate = false): Promise<StagingItemRow[]> => {
  const [rows] = await conn.execute(
    `SELECT * FROM importacao_produtos_staging
     WHERE lote_importacao_id = ? AND tenant_id = ?
     ORDER BY CAST(item_nfe_seq AS UNSIGNED), id` + (forUpdate ? ' FOR UPDATE' : ''),
    [loteId, tenant]
  );
  return rows;
};

// Fornecedor (pessoa com papel FORNECEDOR) pelo CNPJ da nota — mesma regra do verificarFornecedorPorCnpj
export const buscarFornecedorId = async (conn: Conn, cnpj: string | null, tenant: number): Promise<number | null> => {
  const digitos = String(cnpj || '').replace(/\D/g, '');
  if (!digitos) return null;
  const [rows] = await conn.execute(
    `SELECT pj.id_cliente AS id
     FROM pessoas_pj pj
     INNER JOIN pessoas_core c ON c.id_pessoa = pj.id_cliente
     INNER JOIN pessoas_papeis_atribuido pa ON pa.id_cliente = c.id_pessoa
     INNER JOIN pessoas_papeis_definicao pd ON pd.id_cliente_papel = pa.id_cliente_papel
     WHERE REPLACE(REPLACE(REPLACE(pj.cnpj, '.', ''), '/', ''), '-', '') = ? AND c.tenant_id = ? AND pd.codigo = 'FORNECEDOR'
     LIMIT 1`,
    [digitos, tenant]
  );
  return rows[0]?.id ?? null;
};

const montarContexto = async (conn: Conn, tenant: number, lote: any, itens: StagingItemRow[]) => {
  const ids = [...new Set(itens.filter(i => !isItemNovo(i)).map(i => Number(i.produto_id_sistema)))];
  const skus = [...new Set(itens.filter(isItemNovo).map(i => skuCustomizadoPlanejado(i)).filter((s): s is string => !!s))];

  const idsItensExistentes = new Set<number>();
  if (ids.length > 0) {
    const [rows] = await conn.execute(
      `SELECT id_item FROM itens_core WHERE tenant_id = ? AND id_item IN (${ids.map(() => '?').join(',')})`,
      [tenant, ...ids]
    );
    rows.forEach((r: any) => idsItensExistentes.add(Number(r.id_item)));
  }

  const skusExistentes = new Set<string>();
  if (skus.length > 0) {
    const [rows] = await conn.execute(
      `SELECT sku FROM itens_core WHERE tenant_id = ? AND sku IN (${skus.map(() => '?').join(',')})`,
      [tenant, ...skus]
    );
    rows.forEach((r: any) => skusExistentes.add(String(r.sku).toUpperCase()));
    const [customizados] = await conn.execute(
      `SELECT sku_customizado FROM comercial_produtos_dados WHERE tenant_id = ? AND sku_customizado IN (${skus.map(() => '?').join(',')})`,
      [tenant, ...skus]
    );
    customizados.forEach((r: any) => skusExistentes.add(String(r.sku_customizado).toUpperCase()));
  }

  const gtinsEmUso = new Map<string, number>();
  const gtins = [...new Set(itens.map(gtinDoItem).filter((g): g is string => g !== null && validarGtin(g)))];
  if (gtins.length > 0) {
    const [rows] = await conn.execute(
      `SELECT gtin, id_item FROM comercial_unidades_venda WHERE tenant_id = ? AND gtin IN (${gtins.map(() => '?').join(',')})`,
      [tenant, ...gtins]
    );
    rows.forEach((r: any) => gtinsEmUso.set(String(r.gtin), Number(r.id_item)));
  }

  const idFornecedor = await buscarFornecedorId(conn, lote.cnpj_fornecedor, tenant);
  const unidades = await carregarResolvedor(conn, tenant, idFornecedor);
  const ctx: PenteFinoContexto = { idsItensExistentes, skusExistentes, fornecedorCadastrado: idFornecedor !== null, gtinsEmUso, unidades };
  return { ctx, idFornecedor };
};

const loteParaPenteFino = (lote: any): LoteRow => ({
  id: lote.id,
  status: lote.status,
  valor_total_nf_xml: lote.valor_total_nf_xml,
  frete_adicional_valor: lote.frete_adicional_valor,
});

/**
 * GET /compras/lotes/:loteId — cabeçalho da NF do lote
 */
export const getCabecalhoLote = async (req: Request, res: Response): Promise<Response> => {
  try {
    const lote = await carregarLote(db, Number(req.params.loteId), tenantDe(req));
    if (!lote) return res.status(404).json({ success: false, error: 'Lote não encontrado.' });

    const { xml_conteudo, ...semXml } = lote;
    return res.json({ success: true, lote: semXml });
  } catch (error: any) {
    console.error('Erro ao buscar cabeçalho do lote:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /compras/lotes/:loteId/estado e GET /compras/lotes/chave/:chave/estado
 * Estado salvo do lote para retomar a conferência na tela de entrada (inclui o XML)
 */
export const getEstadoLote = async (req: Request, res: Response): Promise<Response> => {
  try {
    const tenant = tenantDe(req);
    let loteId = Number(req.params.loteId) || null;

    if (!loteId && req.params.chave) {
      const [rows]: any = await db.execute(
        `SELECT id FROM importacoes_lotes WHERE chave_acesso = ? AND tenant_id = ? LIMIT 1`,
        [req.params.chave, tenant]
      );
      loteId = rows[0]?.id ?? null;
    }
    if (!loteId) return res.json({ success: true, lote: null, itens: [] });

    const lote = await carregarLote(db, loteId, tenant);
    if (!lote) return res.json({ success: true, lote: null, itens: [] });

    const itens = await carregarItens(db, loteId, tenant);
    return res.json({
      success: true,
      lote: {
        id: lote.id,
        status: lote.status,
        chave_acesso: lote.chave_acesso,
        xml_conteudo: lote.xml_conteudo,
        frete_adicional: lote.frete_adicional,
      },
      itens,
    });
  } catch (error: any) {
    console.error('Erro ao buscar estado do lote:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /compras/lotes/:loteId/analise — pente-fino sem alterar nada
 */
export const analisarLote = async (req: Request, res: Response): Promise<Response> => {
  try {
    const tenant = tenantDe(req);
    const loteId = Number(req.params.loteId);
    const lote = await carregarLote(db, loteId, tenant);
    if (!lote) return res.status(404).json({ success: false, error: 'Lote não encontrado.' });

    const itens = await carregarItens(db, loteId, tenant);
    const { ctx } = await montarContexto(db, tenant, lote, itens);
    return res.json({ success: true, analise: avaliarPenteFino(loteParaPenteFino(lote), itens, ctx) });
  } catch (error: any) {
    console.error('Erro ao analisar lote:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /compras/lotes/:loteId/aprovar — entrada definitiva no estoque (transação única)
 */
export const aprovarLote = async (req: Request, res: Response): Promise<Response> => {
  const tenant = tenantDe(req);
  const loteId = Number(req.params.loteId);
  const connection: any = await db.getConnection();

  try {
    await connection.beginTransaction();

    const lote = await carregarLote(connection, loteId, tenant, true);
    if (!lote) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Lote não encontrado.' });
    }

    const itens = await carregarItens(connection, loteId, tenant, true);
    const { ctx, idFornecedor } = await montarContexto(connection, tenant, lote, itens);
    const analise = avaliarPenteFino(loteParaPenteFino(lote), itens, ctx);

    if (!analise.aprovavel) {
      await connection.rollback();
      return res.status(422).json({ success: false, error: 'Lote não passou no pente-fino.', analise });
    }

    const itensCriadosPorSku = new Map<string, number>();
    const itensVinculados = new Set<number>();
    let movimentos = 0;

    for (const item of itens) {
      const mapeamento = lerMapeamento(item);
      const tipoRecurso = String(mapeamento.tipo_recurso || 'PRODUTO').toUpperCase();
      // Siglas já traduzidas para a unidade interna (dicionário de unidades de entrada: M -> MT)
      const canon = canonizar(ctx.unidades);
      const conversao = lerConversaoCompra(item, canon);

      // Quantidade e custo convertidos para a unidade base do item (saldo e custo médio sempre na base)
      const quantidadeDocumento = Number(item.quantidade_recebida) || 0;
      const custoDocumento = Number(item.custo_unitario_final || item.preco_custo_unitario) || 0;
      const quantidade = quantidadeDocumento * conversao.fator;
      const custoUnitario = custoDocumento / conversao.fator;

      // 1. Item do catálogo: vinculado ou criado agora a partir do mapeamento
      let idItem = item.produto_id_sistema ? Number(item.produto_id_sistema) : null;
      let tipoDoItem = tipoRecurso;
      if (!idItem) {
        const sku = String(item.sku_sugerido).trim();
        idItem = itensCriadosPorSku.get(sku.toUpperCase()) ?? null;

        if (!idItem) {
          const idUnidadeBase = await obterOuCriarUnidade(connection, tenant, conversao.unidadeBase);
          // SKU raiz: provisório único e, com o id, o sequencial definitivo (IT-000123)
          const [novo] = await connection.execute(
            `INSERT INTO itens_core (tenant_id, sku, nome_item, tipo_recurso, status, id_unidade)
             VALUES (?, ?, ?, ?, 'ATIVO', ?)`,
            [tenant, `TMP-${loteId}-${item.id}`, String(item.nome_item_sugerido).trim(), tipoRecurso, idUnidadeBase]
          );
          idItem = Number(novo.insertId);
          await connection.execute(`UPDATE itens_core SET sku = ? WHERE id_item = ?`, [skuSequencial('IT', idItem), idItem]);
          itensCriadosPorSku.set(sku.toUpperCase(), idItem);

          // Item novo: o custo desta entrada já nasce como custo gerencial (base do preço de venda)
          const draft = mapeamento.draftIdentity || {};

          // Família escolhida no mapeamento (ignorada se tiver sido excluída depois)
          let familiaId: number | null = null;
          let categoriaId: number | null = null;
          let marcaId: number | null = null;
          if (draft.familia_id) {
            const [famRows] = await connection.execute(
              `SELECT f.id, f.categoria_id, f.comportamento_marca, f.id_marca, m.nome AS nome_marca
               FROM comercial_familias f
               LEFT JOIN comercial_marcas m ON m.id = f.id_marca AND m.tenant_id = f.tenant_id
               WHERE f.id = ? AND f.tenant_id = ?`,
              [draft.familia_id, tenant]
            );
            const fam = famRows[0];
            if (fam) {
              familiaId = Number(fam.id);
              categoriaId = fam.categoria_id ? Number(fam.categoria_id) : null;
              // Marca como DNA da família: o item já nasce com a marca da família
              const marcaReal = fam.nome_marca && String(fam.nome_marca).trim().toLowerCase() !== 'sem marca';
              if (fam.comportamento_marca === 'dna' && fam.id_marca && marcaReal) marcaId = Number(fam.id_marca);
            }
          }
          // Sem família: categoria escolhida direto (a família, quando há, manda na categoria)
          if (!familiaId && Number(draft.categoria_id) > 0) {
            const [catRows] = await connection.execute(
              `SELECT id FROM comercial_categorias WHERE id = ? AND tenant_id = ?`, [draft.categoria_id, tenant]
            );
            if (catRows[0]) categoriaId = Number(catRows[0].id);
          }
          // SKU customizado (o que o operador vê): digitado, código do fornecedor ou sequencial (consumo/patrimônio)
          const skuCustomizado = skuCustomizadoPlanejado(item) || skuSequencial(prefixoSkuSequencial(tipoRecurso), idItem);
          await connection.execute(
            `INSERT INTO comercial_produtos_dados (tenant_id, id_item, sku_customizado, nome_comercial, custo_gerencial, familia_id, categoria_id, id_marca)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tenant, idItem,
              skuCustomizado,
              String(draft.nome_comercial || '').trim() || null,
              custoUnitario > 0 ? custoUnitario.toFixed(4) : null,
              familiaId,
              categoriaId,
              marcaId
            ]
          );

          // Valores de atributos preenchidos na entrada (opcional): só os que valem para a família/categoria
          if (draft.atributos && (familiaId || categoriaId)) {
            try {
              await gravarAtributosItemNovo(connection, tenant, idItem, familiaId, categoriaId, draft.atributos);
            } catch (e: any) {
              if (String(e.message || '').startsWith('Atributo')) {
                const erro: any = new Error(`Item "${String(item.nome_item_sugerido).trim()}": ${e.message}`);
                erro.negocio = true;
                throw erro;
              }
              throw e;
            }
          }

          // Configuração de vendas montada no mapeamento (rascunho): faixas recalculadas pelo custo final
          // desta aprovação (após frete/ajustes), mantendo os markups definidos
          const configVendas = mapeamento.configVendas;
          if (configVendas && Array.isArray(configVendas.unidades) && configVendas.unidades.length > 0) {
            const unidadesVenda: UnidadePayload[] = configVendas.unidades.map((u: UnidadePayload) => ({ ...u, sigla: canon(u.sigla) }));
            const fatorPorSigla = new Map<string, number>(
              unidadesVenda.map(u => [String(u.sigla).toUpperCase(), u.is_base ? 1 : Number(u.fator)])
            );
            const faixas = recalcularFaixas(
              (configVendas.faixas || []).map((f: FaixaPayload) => ({ ...f, sigla: canon(f.sigla) })),
              custoUnitario,
              fatorPorSigla
            ) as FaixaPayload[];
            await gravarConfigVendas(connection, tenant, idItem, unidadesVenda, faixas, custoUnitario > 0 ? custoUnitario : null);
          }
        }
      } else {
        itensVinculados.add(idItem);
        // Item vinculado ainda sem unidade base: assume a unidade base informada no mapeamento
        const [baseRows] = await connection.execute(`SELECT id_unidade, tipo_recurso FROM itens_core WHERE id_item = ?`, [idItem]);
        tipoDoItem = String(baseRows[0]?.tipo_recurso || tipoRecurso).toUpperCase();
        if (!baseRows[0]?.id_unidade) {
          const idUnidadeBase = await obterOuCriarUnidade(connection, tenant, conversao.unidadeBase);
          await connection.execute(`UPDATE itens_core SET id_unidade = ? WHERE id_item = ?`, [idUnidadeBase, idItem]);
        }
      }

      // Dados fiscais da NF (NCM/CEST): preenche o item sem sobrescrever o que já foi cadastrado/corrigido
      if (item.ncm_original || item.cest_original) {
        await connection.execute(
          `INSERT INTO itens_dados_fiscais (id_item, tenant_id, ncm, cest)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE ncm = COALESCE(NULLIF(ncm, ''), VALUES(ncm)),
                                   cest = COALESCE(NULLIF(cest, ''), VALUES(cest))`,
          [idItem, tenant, item.ncm_original || null, item.cest_original || null]
        );
      }

      // Embalagem de compra diferente da base vira unidade derivada do item (ex: 1 CX = 50 UN)
      if (conversao.fator !== 1 && conversao.unidadeCompra !== conversao.unidadeBase) {
        const idUnidadeCompra = await obterOuCriarUnidade(connection, tenant, conversao.unidadeCompra);
        await connection.execute(
          `INSERT INTO itens_unidades_conversao (tenant_id, id_item, id_unidade_derivada, fator_conversao)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE fator_conversao = VALUES(fator_conversao)`,
          [tenant, idItem, idUnidadeCompra, conversao.fator]
        );
      }

      // GTIN válido (manual ou do XML) vai para a unidade de compra do item, se não estiver em outro item/unidade
      const gtin = gtinDoItem(item);
      if (gtin && validarGtin(gtin)) {
        const idUnidadeCompra = await obterOuCriarUnidade(connection, tenant, conversao.unidadeCompra);
        const [uso] = await connection.execute(
          `SELECT id_item, id_unidade FROM comercial_unidades_venda WHERE tenant_id = ? AND gtin = ?`,
          [tenant, gtin]
        );
        const usadoEmOutro = uso.some((u: any) => Number(u.id_item) !== idItem || Number(u.id_unidade) !== idUnidadeCompra);
        if (!usadoEmOutro) {
          const compraEhBase = conversao.unidadeCompra === conversao.unidadeBase ? 1 : 0;
          await connection.execute(
            `INSERT INTO comercial_unidades_venda
             (tenant_id, id_item, id_unidade, gtin, permite_venda, permite_atacado, markup_varejo, padrao_pdv)
             VALUES (?, ?, ?, ?, ?, 0, 1.8, ?)
             ON DUPLICATE KEY UPDATE gtin = COALESCE(gtin, VALUES(gtin))`,
            [tenant, idItem, idUnidadeCompra, gtin, compraEhBase, compraEhBase]
          );
        }
      }

      // 2. Movimento + saldo por depósito de destino (ex.: 20 VENDA + 10 ALMOXARIFADO), na unidade base,
      //    todos pelo custo da nota (frete e IPI já rateados)
      if (quantidade > 0) {
        for (const destino of destinosDoItem(item, tipoDoItem)) {
          await lancarMovimentoEstoque(connection, {
            tenant, idItem, deposito: destino.deposito, tipo: 'ENTRADA', origem: ORIGEM_NFE,
            idOrigem: loteId, idOrigemItem: item.id, documento: lote.chave_acesso, tipoRecurso: tipoDoItem,
            quantidade: destino.quantidade * conversao.fator,
            quantidadeDocumento: destino.quantidade, unidadeDocumento: conversao.unidadeCompra, fatorConversao: conversao.fator,
            custoUnitario,
            observacao: `NF ${lote.numero_nf || ''} item ${item.item_nfe_seq || ''}`.trim(),
            recalcularCustoMedio: true,
            registrarUltimoCusto: true,
          });
          movimentos++;
        }
      }

      // 3. Vínculo item x fornecedor (código do fornecedor e último preço)
      if (idFornecedor) {
        await connection.execute(
          `INSERT INTO comercial_fornecedores_produtos
           (tenant_id, id_item, id_fornecedor, codigo_produto_fornecedor, unidade_compra, fator_compra, preco_ultima_compra)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE codigo_produto_fornecedor = VALUES(codigo_produto_fornecedor),
                                   unidade_compra = VALUES(unidade_compra),
                                   fator_compra = VALUES(fator_compra),
                                   preco_ultima_compra = VALUES(preco_ultima_compra)`,
          [tenant, idItem, idFornecedor, item.codigo_fornecedor || null, conversao.unidadeCompra, conversao.fator.toFixed(6), custoDocumento.toFixed(4)]
        );
      }

      // 4. Item da staging finalizado
      await connection.execute(
        `UPDATE importacao_produtos_staging
         SET status = 'IMPORTADO', produto_id_sistema = ?, analisado_em = NOW(),
             sku_sistema = COALESCE(NULLIF(sku_sistema, ''), (
               SELECT COALESCE(NULLIF(cpd.sku_customizado, ''), ic.sku)
               FROM itens_core ic
               LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
               WHERE ic.id_item = ?))
         WHERE id = ?`,
        [idItem, idItem, item.id]
      );
    }

    // Itens vinculados cujo custo gerencial ficou defasado com esta entrada (o gestor decide se atualiza)
    let custosDefasados = 0;
    if (itensVinculados.size > 0) {
      const ids = [...itensVinculados];
      const [rows] = await connection.execute(
        `SELECT COUNT(*) AS total
         FROM estoque_saldos_itens es
         LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = es.id_item AND cpd.tenant_id = es.tenant_id
         WHERE es.tenant_id = ? AND es.deposito = 'VENDA' AND es.id_item IN (${ids.map(() => '?').join(',')})
           AND (cpd.custo_gerencial IS NULL OR cpd.custo_gerencial <= 0
                OR ABS(es.ultimo_custo - cpd.custo_gerencial) / cpd.custo_gerencial > 0.005)`,
        [tenant, ...ids]
      );
      custosDefasados = Number(rows[0]?.total) || 0;
    }

    await connection.execute(
      `UPDATE importacoes_lotes SET status = 'IMPORTADO', resumo_conferencia = ? WHERE id = ? AND tenant_id = ?`,
      [JSON.stringify({ ...analise.resumo, avisos: analise.avisos, aprovado_em: new Date().toISOString() }), loteId, tenant]
    );

    await connection.commit();
    return res.json({
      success: true,
      message: `Lote #${loteId} aprovado: ${movimentos} movimento(s) de estoque, ${itensCriadosPorSku.size} item(ns) novo(s) no catálogo.`
        + (custosDefasados > 0 ? ` ${custosDefasados} item(ns) com custo desatualizado para revisão de preço.` : ''),
      custosDefasados,
      analise,
    });
  } catch (error: any) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'SKU ou GTIN de um item novo já existe no catálogo. Ajuste o mapeamento e tente de novo.' });
    }
    if (error.negocio) return res.status(400).json({ success: false, error: error.message });
    console.error('Erro ao aprovar lote:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * DELETE /compras/lotes/:loteId — descarta o lote (exclusão lógica, mantém histórico da NF)
 */
export const descartarLote = async (req: Request, res: Response): Promise<Response> => {
  const tenant = tenantDe(req);
  const loteId = Number(req.params.loteId);
  const connection: any = await db.getConnection();

  try {
    await connection.beginTransaction();
    const lote = await carregarLote(connection, loteId, tenant, true);
    if (!lote) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Lote não encontrado.' });
    }
    if (STATUS_LOTE_FINALIZADO.includes(lote.status)) {
      await connection.rollback();
      return res.status(409).json({ success: false, error: `Lote já está ${lote.status} e não pode ser descartado.` });
    }

    await connection.execute(`UPDATE importacoes_lotes SET status = 'DESCARTADO' WHERE id = ? AND tenant_id = ?`, [loteId, tenant]);
    await connection.execute(
      `UPDATE importacao_produtos_staging SET status = 'REJEITADO', analisado_em = NOW()
       WHERE lote_importacao_id = ? AND tenant_id = ?`,
      [loteId, tenant]
    );
    await connection.commit();
    return res.json({ success: true, message: `Lote #${loteId} descartado.` });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao descartar lote:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};
