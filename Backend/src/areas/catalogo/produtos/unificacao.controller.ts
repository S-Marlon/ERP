// Itens duplicados: suspeitas (mesmo código de fornecedor, nomes iguais) e unificação de um item em outro.
// Unificar: o saldo de cada depósito passa para o item que fica (pelo custo médio, convertido pelo fator),
// vínculos de fornecedor e GTINs vão junto, o duplicado é inativado e tudo fica em itens_core_unificacoes.
// O histórico (vendas, notas antigas) continua no item original. simular = executa e desfaz.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { lancarMovimentoEstoque, Deposito, ehDeposito } from '../../estoque/depositos';
import { agruparDuplicados } from './duplicados';
import { avaliarPublicacaoItens } from './publicacaoProdutos';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const n = (v: unknown) => Number(v) || 0;

export const ORIGEM_UNIFICACAO_SAIDA = 'UNIFICACAO_SAIDA';
export const ORIGEM_UNIFICACAO_ENTRADA = 'UNIFICACAO_ENTRADA';

class ErroNegocio extends Error {
  constructor(message: string, public status = 400, public extra?: unknown) { super(message); }
}

const SELECT_ITEM = `
  SELECT ic.id_item, ic.status, UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) AS tipo_recurso, ic.created_at,
         COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku,
         COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome,
         um.sigla AS unidade_base, f.nome AS familia, cpd.familia_id, cpd.id_marca, f.comportamento_marca,
         (SELECT COALESCE(SUM(s.quantidade_atual), 0) FROM estoque_saldos_itens s WHERE s.tenant_id = ic.tenant_id AND s.id_item = ic.id_item) AS saldo,
         (SELECT COUNT(*) FROM estoque_movimentos m WHERE m.tenant_id = ic.tenant_id AND m.id_item = ic.id_item) AS movimentos
  FROM itens_core ic
  LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
  LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
  LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade`;

const itemParaResposta = (r: any) => ({
  idItem: Number(r.id_item), sku: r.sku, nome: r.nome, status: r.status, tipoRecurso: r.tipo_recurso,
  unidadeBase: r.unidade_base || null, familia: r.familia || null, saldo: n(r.saldo), movimentos: n(r.movimentos), criadoEm: r.created_at,
});

/**
 * GET /catalogo/itens/duplicados — grupos de itens ativos suspeitos de serem o mesmo produto
 */
export const listarDuplicados = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const [itens]: any = await pool.execute(
      `${SELECT_ITEM} WHERE ic.tenant_id = ? AND UPPER(COALESCE(ic.status, 'ATIVO')) <> 'INATIVO'`, [tenant]
    );
    const [codigos]: any = await pool.execute(
      `SELECT cfp.id_fornecedor, cfp.codigo_produto_fornecedor AS codigo, cfp.id_item,
              COALESCE(NULLIF(pj.nome_fantasia, ''), pj.razao_social) AS fornecedor
       FROM comercial_fornecedores_produtos cfp
       LEFT JOIN pessoas_pj pj ON pj.id_cliente = cfp.id_fornecedor
       WHERE cfp.tenant_id = ? AND NULLIF(TRIM(cfp.codigo_produto_fornecedor), '') IS NOT NULL`,
      [tenant]
    );
    // Assinatura da grade: valores dos atributos de grade do item (e a marca, quando a família usa a marca como grade).
    // Itens da mesma família com grades diferentes são SKUs diferentes, não duplicados (ex.: balde x galão).
    const ids = itens.map((i: any) => Number(i.id_item));
    const publicacao = ids.length > 0 ? await avaliarPublicacaoItens(pool as any, tenant, ids) : new Map();
    const valores = new Map<number, Map<string, string>>();
    if (ids.length > 0) {
      const [linhasValor]: any = await pool.execute(
        `SELECT v.id_entidade, v.atributo_id,
                COALESCE(o.valor, NULLIF(TRIM(v.valor_texto), ''), v.valor_numero, v.valor_decimal, v.valor_boolean, v.valor_data) AS valor
         FROM atributos_comercial_valores v
         LEFT JOIN atributos_comercial_opcoes o ON o.id = v.opcao_id
         WHERE v.tenant_id = ? AND v.tipo_entidade = 'produto' AND v.id_entidade IN (${ids.map(() => '?').join(',')})`,
        [tenant, ...ids]
      );
      for (const l of linhasValor) {
        if (l.valor === null || l.valor === undefined) continue;
        const id = Number(l.id_entidade);
        if (!valores.has(id)) valores.set(id, new Map());
        valores.get(id)!.set(String(l.atributo_id), String(l.valor).trim().toUpperCase());
      }
    }
    const assinaturaGrade = (i: any): string | null => {
      const id = Number(i.id_item);
      const partes = (publicacao.get(id)?.atributosGrade || [])
        .map((a: string) => (valores.get(id)?.has(a) ? `${a}=${valores.get(id)!.get(a)}` : null))
        .filter(Boolean) as string[];
      if (i.comportamento_marca === 'grade' && i.id_marca) partes.push(`marca=${i.id_marca}`);
      return partes.length > 0 ? partes.sort().join(';') : null;
    };

    const grupos = agruparDuplicados(
      itens.map((i: any) => ({
        idItem: Number(i.id_item),
        nome: String(i.nome || ''),
        familiaId: i.familia_id ? Number(i.familia_id) : null,
        assinaturaGrade: assinaturaGrade(i),
      })),
      codigos.map((c: any) => ({ idFornecedor: Number(c.id_fornecedor), fornecedor: c.fornecedor, codigo: String(c.codigo), idItem: Number(c.id_item) }))
    );
    const porId = new Map<number, any>(itens.map((i: any) => [Number(i.id_item), itemParaResposta(i)]));
    return res.json({
      grupos: grupos.map(g => ({ ...g, itens: g.idsItens.map(id => porId.get(id)).filter(Boolean) })),
    });
  } catch (error: any) {
    console.error('Erro ao listar itens duplicados:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /catalogo/itens/unificar  { idOrigem, idDestino, fator, motivo, simular? }
 * fator: 1 unidade base do item de origem = fator unidades base do item que fica.
 */
export const unificarItens = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idOrigem = Number(req.body?.idOrigem);
  const idDestino = Number(req.body?.idDestino);
  const fator = req.body?.fator === undefined ? 1 : Number(req.body.fator);
  const motivo = String(req.body?.motivo || '').trim();
  const simular = Boolean(req.body?.simular);

  if (!(idOrigem > 0) || !(idDestino > 0)) return res.status(400).json({ error: 'Informe o item duplicado e o item que fica.' });
  if (idOrigem === idDestino) return res.status(400).json({ error: 'Escolha dois itens diferentes.' });
  if (!(fator > 0)) return res.status(400).json({ error: 'Fator precisa ser maior que zero.' });
  if (!simular && motivo.length < 3) return res.status(400).json({ error: 'Informe o motivo da unificação.' });

  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [linhas]: any = await conn.execute(`${SELECT_ITEM} WHERE ic.tenant_id = ? AND ic.id_item IN (?, ?) FOR UPDATE`, [tenant, idOrigem, idDestino]);
    const origem = linhas.find((l: any) => Number(l.id_item) === idOrigem);
    const destino = linhas.find((l: any) => Number(l.id_item) === idDestino);
    if (!origem || !destino) throw new ErroNegocio('Item não encontrado.', 404);
    if (String(origem.status).toUpperCase() === 'INATIVO') throw new ErroNegocio(`${origem.sku} já está inativo.`);
    if (String(destino.status).toUpperCase() === 'INATIVO') throw new ErroNegocio(`${destino.sku} está inativo: escolha um item ativo para ficar.`);

    const [saldos]: any = await conn.execute(
      `SELECT deposito, quantidade_atual, custo_medio FROM estoque_saldos_itens WHERE tenant_id = ? AND id_item = ? FOR UPDATE`,
      [tenant, idOrigem]
    );
    const negativos = saldos.filter((s: any) => n(s.quantidade_atual) < -0.000001);
    if (negativos.length > 0) {
      throw new ErroNegocio(`${origem.sku} tem saldo negativo (${negativos.map((s: any) => `${s.deposito}: ${n(s.quantidade_atual)}`).join(', ')}). Ajuste o saldo antes de unificar.`, 409);
    }

    const [registro]: any = await conn.execute(
      `INSERT INTO itens_core_unificacoes (tenant_id, id_item_origem, id_item_destino, fator, motivo) VALUES (?, ?, ?, ?, ?)`,
      [tenant, idOrigem, idDestino, fator.toFixed(6), (motivo || 'simulação').slice(0, 255)]
    );
    const idUnificacao = Number(registro.insertId);
    const observacao = `Unificação de ${origem.sku} em ${destino.sku}: ${motivo}`.slice(0, 255);
    const movimentos: any[] = [];

    // 1. Saldo de cada depósito: entra no item que fica (custo médio convertido) e sai do duplicado
    for (const s of saldos) {
      const q = n(s.quantidade_atual);
      if (q <= 0.000001 || !ehDeposito(s.deposito)) continue;
      const deposito = String(s.deposito).toUpperCase() as Deposito;
      const custo = n(s.custo_medio);
      const entrada = await lancarMovimentoEstoque(conn, {
        tenant, idItem: idDestino, deposito, tipo: 'ENTRADA', origem: ORIGEM_UNIFICACAO_ENTRADA,
        idOrigem: idUnificacao, idOrigemItem: idUnificacao, documento: `UNIF-${idUnificacao}`, tipoRecurso: destino.tipo_recurso,
        quantidade: q * fator, quantidadeDocumento: q, unidadeDocumento: origem.unidade_base || null, fatorConversao: fator,
        custoUnitario: custo / fator, observacao, recalcularCustoMedio: true,
      });
      movimentos.push({ tipo: 'ENTRADA', sku: destino.sku, deposito, quantidade: q * fator, ...entrada });
      const saida = await lancarMovimentoEstoque(conn, {
        tenant, idItem: idOrigem, deposito, tipo: 'SAIDA', origem: ORIGEM_UNIFICACAO_SAIDA,
        idOrigem: idUnificacao, idOrigemItem: idUnificacao, documento: `UNIF-${idUnificacao}`, tipoRecurso: origem.tipo_recurso,
        quantidade: q, custoUnitario: custo, observacao,
      });
      movimentos.push({ tipo: 'SAIDA', sku: origem.sku, deposito, quantidade: q, ...saida });
    }

    // 2. Vínculos de fornecedor: os que o item que fica ainda não tem passam para ele (fator de compra convertido)
    const [vinculosMovidos]: any = await conn.execute(
      `UPDATE IGNORE comercial_fornecedores_produtos SET id_item = ?, fator_compra = fator_compra * ?, padrao = 0
       WHERE tenant_id = ? AND id_item = ?`,
      [idDestino, fator, tenant, idOrigem]
    );
    await conn.execute(`DELETE FROM comercial_fornecedores_produtos WHERE tenant_id = ? AND id_item = ?`, [tenant, idOrigem]);

    // 3. GTINs: saem do duplicado e vão para a mesma unidade do item que fica (se ela ainda não tiver)
    const [gtins]: any = await conn.execute(
      `SELECT id_unidade, gtin FROM comercial_unidades_venda WHERE tenant_id = ? AND id_item = ? AND NULLIF(TRIM(gtin), '') IS NOT NULL`,
      [tenant, idOrigem]
    );
    const gtinsMovidos: string[] = [];
    const gtinsNaoMovidos: string[] = [];
    for (const g of gtins) {
      await conn.execute(`UPDATE comercial_unidades_venda SET gtin = NULL WHERE tenant_id = ? AND id_item = ? AND id_unidade = ?`, [tenant, idOrigem, g.id_unidade]);
      await conn.execute(
        `INSERT INTO comercial_unidades_venda (tenant_id, id_item, id_unidade, gtin, permite_venda, permite_atacado, markup_varejo, padrao_pdv)
         VALUES (?, ?, ?, ?, 0, 0, 1.8, 0)
         ON DUPLICATE KEY UPDATE gtin = COALESCE(gtin, VALUES(gtin))`,
        [tenant, idDestino, g.id_unidade, g.gtin]
      );
      const [[ok]]: any = await conn.execute(
        `SELECT COUNT(*) AS total FROM comercial_unidades_venda WHERE tenant_id = ? AND id_item = ? AND gtin = ?`, [tenant, idDestino, g.gtin]
      );
      (n(ok.total) > 0 ? gtinsMovidos : gtinsNaoMovidos).push(String(g.gtin));
    }

    // 4. Duplicado inativado
    await conn.execute(`UPDATE itens_core SET status = 'INATIVO' WHERE tenant_id = ? AND id_item = ?`, [tenant, idOrigem]);

    const detalhes = {
      saldos: saldos.map((s: any) => ({ deposito: s.deposito, quantidade: n(s.quantidade_atual), custoMedio: n(s.custo_medio) })),
      vinculosFornecedorMovidos: n(vinculosMovidos.affectedRows),
      gtinsMovidos,
      gtinsNaoMovidos,
    };
    await conn.execute(`UPDATE itens_core_unificacoes SET detalhes_json = ? WHERE id = ?`, [JSON.stringify(detalhes), idUnificacao]);

    if (simular) await conn.rollback();
    else await conn.commit();

    return res.json({
      simulacao: simular,
      idUnificacao: simular ? null : idUnificacao,
      message: simular ? 'Simulação: nada foi gravado.' : `${origem.sku} unificado em ${destino.sku}.`,
      origem: itemParaResposta(origem),
      destino: itemParaResposta(destino),
      fator,
      movimentos,
      ...detalhes,
    });
  } catch (error: any) {
    await conn.rollback();
    if (error instanceof ErroNegocio) return res.status(error.status).json({ error: error.message, detalhes: error.extra });
    console.error('Erro ao unificar itens:', error);
    return res.status(500).json({ error: 'Erro ao unificar os itens.', details: error.message });
  } finally {
    conn.release();
  }
};
