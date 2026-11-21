// Curva ABC (Estoque › Curva ABC): venda, lucro e estoque parado por item no período, frequência (XYZ), classes P/N,
// curva dentro da categoria e recomendação. Venda = vendas concluídas (balcão e pedidos faturados entregues) menos
// devoluções. Regras em curvaAbc.ts; o inventário rotativo usa a curva de venda daqui.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { categoriaDoTopo } from '../inventario/inventarioRotativo';
import { Classe, ClasseExibida, classeExibida, classificarItens, ItemCurva } from './curvaAbc';
import { categoriasEmFoco, chamarizes, evolucao, ItemFoco, listaPropaganda, listasDeCompra } from './ondeFocar';
import { carregarMargensNegociacao } from '../../vendas/regras/regrasVenda.controller';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
const n = (v: unknown) => Number(v) || 0;
const limpo = (s: unknown) => (s ? String(s).replace(/^[^\p{L}\p{N}]+/u, '').trim() : null);
export const PERIODOS = [30, 90, 180, 365];

/** Venda, lucro, quantidade, nº de vendas e semanas com venda por item no período (devoluções descontadas). */
const vendasDoPeriodo = async (conn: any, tenant: number, dias: number) => {
  const [vendas]: any = await conn.execute(
    `SELECT i.id_item, SUM(i.total_item) AS receita, SUM(i.total_item - i.custo_total) AS lucro, SUM(i.quantidade_base) AS qtd,
            COUNT(DISTINCT i.id_venda) AS vendas, COUNT(DISTINCT YEARWEEK(COALESCE(v.entregue_em, v.created_at), 3)) AS semanas,
            DATE_FORMAT(MAX(COALESCE(v.entregue_em, v.created_at)), '%Y-%m-%d') AS ultima
     FROM vendas_pedidos_itens i INNER JOIN vendas_pedidos v ON v.id_venda = i.id_venda
     WHERE v.tenant_id = ? AND v.status = 'CONCLUIDA' AND COALESCE(v.entregue_em, v.created_at) >= CURDATE() - INTERVAL ? DAY
     GROUP BY i.id_item`, [tenant, dias]);
  const [devolucoes]: any = await conn.execute(
    `SELECT d.id_item, SUM(d.valor) AS valor, SUM(d.quantidade_base) AS qtd, SUM(d.quantidade_base * d.custo_unitario_base) AS custo
     FROM vendas_devolucoes_itens d INNER JOIN vendas_devolucoes dv ON dv.id_devolucao = d.id_devolucao
     WHERE dv.tenant_id = ? AND dv.created_at >= CURDATE() - INTERVAL ? DAY GROUP BY d.id_item`, [tenant, dias]);
  const dev = new Map<number, any>(devolucoes.map((d: any) => [Number(d.id_item), d]));
  return new Map<number, { receita: number; lucro: number; qtd: number; vendas: number; semanas: number; ultima: string | null }>(vendas.map((v: any) => {
    const d = dev.get(Number(v.id_item));
    return [Number(v.id_item), {
      receita: n(v.receita) - n(d?.valor), lucro: n(v.lucro) - (n(d?.valor) - n(d?.custo)), qtd: n(v.qtd) - n(d?.qtd),
      vendas: Number(v.vendas), semanas: Number(v.semanas), ultima: v.ultima,
    }];
  }));
};

/** Classe de venda (A/B/C) por item no período, para quem só precisa dela (ex.: inventário rotativo). Sem venda = C. */
export const classesDeVenda = async (conn: any, tenant: number, dias = 90): Promise<Map<number, Classe>> => {
  const vendas = await vendasDoPeriodo(conn, tenant, dias);
  const itens: ItemCurva[] = [...vendas.entries()].map(([idItem, v]) => ({
    idItem, categoriaTopo: null, receita: v.receita, lucro: v.lucro, quantidade: v.qtd, vendas: v.vendas, semanasComVenda: v.semanas,
    estoque: 0, custoUnitario: 0, diasDesdeEntrada: null, ultimaVenda: v.ultima,
  }));
  return new Map(classificarItens(itens, dias).map(i => [i.idItem, i.venda ?? 'C']));
};

/** Itens ativos classificados nas três curvas no período (com preço de venda e categoria do topo) + histórico disponível. */
export const carregarCurva = async (tenant: number, dias: number) => {
  const [[itensRows], vendas, [cats], [[hist]]]: any = await Promise.all([
    pool.execute(
      `SELECT ic.id_item, COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku, COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome,
              um.sigla AS unidade, COALESCE(f.categoria_id, cpd.categoria_id) AS categoria_id, cat.nome AS categoria, COALESCE(cpd.preco_venda, 0) AS preco_venda, cpd.decisao_compra,
              COALESCE(es.quantidade_atual, 0) AS estoque, COALESCE(NULLIF(es.custo_medio, 0), cpd.custo_gerencial, 0) AS custo,
              DATEDIFF(CURDATE(), COALESCE(
                (SELECT MIN(m.created_at) FROM estoque_movimentos m WHERE m.tenant_id = ic.tenant_id AND m.id_item = ic.id_item AND m.tipo_movimento = 'ENTRADA'),
                ic.created_at)) AS dias_entrada
       FROM itens_core ic
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       LEFT JOIN comercial_familias f ON f.id = cpd.familia_id
       LEFT JOIN comercial_categorias cat ON cat.id = COALESCE(f.categoria_id, cpd.categoria_id)
       LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
       LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'
       WHERE ic.tenant_id = ? AND ic.status = 'ATIVO' AND UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) = 'PRODUTO'`, [tenant]),
    vendasDoPeriodo(pool, tenant, dias),
    pool.execute(`SELECT id, nome, categoria_pai_id FROM comercial_categorias WHERE tenant_id = ?`, [tenant]),
    pool.execute(`SELECT DATE_FORMAT(MIN(created_at), '%Y-%m-%d') AS desde, DATEDIFF(CURDATE(), MIN(created_at)) AS dias FROM vendas_pedidos WHERE tenant_id = ? AND status = 'CONCLUIDA'`, [tenant]),
  ]);
  const pais = new Map<number, number | null>(cats.map((c: any) => [Number(c.id), c.categoria_pai_id !== null ? Number(c.categoria_pai_id) : null]));
  const nomeCat = new Map<number, string>(cats.map((c: any) => [Number(c.id), limpo(c.nome) as string]));
  const base = itensRows.map((r: any) => {
    const v = vendas.get(Number(r.id_item));
    const topo = categoriaDoTopo(r.categoria_id !== null ? Number(r.categoria_id) : null, pais);
    return {
      idItem: Number(r.id_item), sku: r.sku as string, nome: r.nome as string, unidade: (r.unidade || null) as string | null, categoria: limpo(r.categoria),
      categoriaTopo: topo, categoriaTopoNome: topo !== null ? nomeCat.get(topo) || null : null, precoVenda: n(r.preco_venda), decisaoCompra: (r.decisao_compra || null) as string | null,
      receita: v?.receita || 0, lucro: v?.lucro || 0, quantidade: v?.qtd || 0, vendas: v?.vendas || 0, semanasComVenda: v?.semanas || 0,
      estoque: n(r.estoque), custoUnitario: n(r.custo), diasDesdeEntrada: r.dias_entrada !== null ? Number(r.dias_entrada) : null, ultimaVenda: v?.ultima || null,
    };
  });
  const extras = new Map<number, any>(base.map((b: any) => [b.idItem, b]));
  const diasDeHistorico = hist?.dias !== null && hist?.dias !== undefined ? Number(hist.dias) + 1 : 0;
  const itens = classificarItens(base as ItemCurva[], dias, undefined, diasDeHistorico).map(c => {
    const e = extras.get(c.idItem);
    return { ...c, sku: e.sku, nome: e.nome, unidade: e.unidade, categoria: e.categoria, categoriaTopoNome: e.categoriaTopoNome, precoVenda: e.precoVenda, decisaoCompra: e.decisaoCompra };
  }) as Array<ItemFoco & { categoria: string | null }>;
  return { dias, historicoDesde: (hist?.desde || null) as string | null, diasDeHistorico, itens };
};

/**
 * Foto do mês (estoque_curva_abc_fotos): a curva de 90 dias de cada item, tirada uma vez por mês no primeiro acesso.
 * Serve para comparar com o mês anterior (quem subiu, quem caiu).
 */
export const tirarFotoDoMes = async (tenant: number) => {
  const [[ja]]: any = await pool.execute(
    `SELECT COUNT(*) AS n FROM estoque_curva_abc_fotos WHERE tenant_id = ? AND mes = DATE_FORMAT(CURDATE(), '%Y-%m-01')`, [tenant]);
  if (Number(ja?.n) > 0) return false;
  const { itens } = await carregarCurva(tenant, 90);
  for (let k = 0; k < itens.length; k += 200) {
    const lote = itens.slice(k, k + 200);
    await pool.query(
      `INSERT IGNORE INTO estoque_curva_abc_fotos
         (tenant_id, mes, id_item, classe_venda, classe_lucro, classe_estoque, frequencia, receita, lucro, quantidade, valor_estoque)
       VALUES ${lote.map(() => `(?, DATE_FORMAT(CURDATE(), '%Y-%m-01'), ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(', ')}`,
      lote.flatMap(i => [tenant, i.idItem, classeExibida(i, 'VENDA'), classeExibida(i, 'LUCRO'), i.estoqueClasse ?? '-', i.xyz,
        i.receita.toFixed(4), i.lucro.toFixed(4), i.quantidade.toFixed(4), i.valorEstoque.toFixed(4)]));
  }
  return true;
};
const fotoEmSegundoPlano = (tenant: number) => { tirarFotoDoMes(tenant).catch(e => console.error('Foto mensal da curva ABC:', e?.message)); };

/** GET /api/estoque/curva-abc?dias=90 — itens classificados nas três curvas + período/histórico disponível. */
export const curvaAbcItens = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const dias = PERIODOS.includes(Number(req.query.dias)) ? Number(req.query.dias) : 90;
    const curva = await carregarCurva(tenant, dias);
    fotoEmSegundoPlano(tenant);
    return res.json(curva);
  } catch (error: any) {
    console.error('Erro na curva ABC:', error);
    return res.status(500).json({ error: 'Erro ao calcular a curva ABC.', details: error?.message });
  }
};

/**
 * GET /api/estoque/curva-abc/onde-focar?dias=90 — categorias em quadrantes, propaganda, chamarizes, repor/não recomprar
 * e quem subiu/caiu desde a foto do mês anterior.
 */
export const ondeFocarRelatorio = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const dias = PERIODOS.includes(Number(req.query.dias)) ? Number(req.query.dias) : 90;
    const [curva, margens, [anteriores]]: any = await Promise.all([
      carregarCurva(tenant, dias),
      carregarMargensNegociacao(pool, tenant),
      pool.execute(
        `SELECT f.id_item, f.classe_venda, DATE_FORMAT(f.mes, '%Y-%m') AS mes FROM estoque_curva_abc_fotos f
         WHERE f.tenant_id = ? AND f.mes = (SELECT MAX(mes) FROM estoque_curva_abc_fotos WHERE tenant_id = ? AND mes < DATE_FORMAT(CURDATE(), '%Y-%m-01'))`, [tenant, tenant]),
    ]);
    fotoEmSegundoPlano(tenant);
    const itens: ItemFoco[] = curva.itens;
    const atual = new Map<number, ClasseExibida>(itens.map(i => [i.idItem, classeExibida(i, 'VENDA')]));
    const ev = evolucao(atual, new Map(anteriores.map((a: any) => [Number(a.id_item), a.classe_venda])), new Map(itens.map(i => [i.idItem, { sku: i.sku, nome: i.nome }])));
    const soma = (f: (i: ItemFoco) => number) => Math.round(itens.reduce((a, i) => a + f(i), 0) * 100) / 100;
    return res.json({
      dias, historicoDesde: curva.historicoDesde, diasDeHistorico: curva.diasDeHistorico,
      margemAlvo: margens.margemAlvoPadrao, margemMinima: margens.margemMinimaNegociacao,
      categorias: categoriasEmFoco(itens, margens.margemAlvoPadrao),
      propaganda: listaPropaganda(itens, margens.margemMinimaNegociacao),
      chamarizes: chamarizes(itens),
      ...listasDeCompra(itens, Math.min(dias, Math.max(1, curva.diasDeHistorico || dias))),
      evolucao: { mesAnterior: anteriores[0]?.mes || null, ...ev },
      totais: { receita: soma(i => i.receita), lucro: soma(i => i.lucro), estoque: soma(i => i.valorEstoque), parado: soma(i => (i.situacao === 'PARADO' ? i.valorEstoque : 0)) },
    });
  } catch (error: any) {
    console.error('Erro no Onde focar:', error);
    return res.status(500).json({ error: 'Erro ao montar o relatório.', details: error?.message });
  }
};
