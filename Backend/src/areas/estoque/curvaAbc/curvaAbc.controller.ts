// Curva ABC (Estoque › Curva ABC): venda, lucro e estoque parado por item no período, frequência (XYZ), classes P/N,
// curva dentro da categoria e recomendação. Venda = vendas concluídas (balcão e pedidos faturados entregues) menos
// devoluções. Regras em curvaAbc.ts; o inventário rotativo usa a curva de venda daqui.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { categoriaDoTopo } from '../inventario/inventarioRotativo';
import { Classe, classificarItens, ItemCurva } from './curvaAbc';

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

/** GET /api/estoque/curva-abc?dias=90 — itens classificados nas três curvas + período/histórico disponível. */
export const curvaAbcItens = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const dias = PERIODOS.includes(Number(req.query.dias)) ? Number(req.query.dias) : 90;
    const [[itensRows], vendas, [cats], [[hist]]]: any = await Promise.all([
      pool.execute(
        `SELECT ic.id_item, COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku, COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome,
                um.sigla AS unidade, COALESCE(f.categoria_id, cpd.categoria_id) AS categoria_id, cat.nome AS categoria,
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
    const base: Array<ItemCurva & { sku: string; nome: string; unidade: string | null; categoria: string | null; categoriaTopoNome: string | null }> = itensRows.map((r: any) => {
      const v = vendas.get(Number(r.id_item));
      const topo = categoriaDoTopo(r.categoria_id !== null ? Number(r.categoria_id) : null, pais);
      return {
        idItem: Number(r.id_item), sku: r.sku, nome: r.nome, unidade: r.unidade, categoria: limpo(r.categoria),
        categoriaTopo: topo, categoriaTopoNome: topo !== null ? nomeCat.get(topo) || null : null,
        receita: v?.receita || 0, lucro: v?.lucro || 0, quantidade: v?.qtd || 0, vendas: v?.vendas || 0, semanasComVenda: v?.semanas || 0,
        estoque: n(r.estoque), custoUnitario: n(r.custo), diasDesdeEntrada: r.dias_entrada !== null ? Number(r.dias_entrada) : null, ultimaVenda: v?.ultima || null,
      };
    });
    const extras = new Map(base.map(b => [b.idItem, b]));
    const diasDeHistorico = hist?.dias !== null && hist?.dias !== undefined ? Number(hist.dias) + 1 : 0;
    const classificados = classificarItens(base, dias, undefined, diasDeHistorico).map(c => {
      const e = extras.get(c.idItem)!;
      return { ...c, sku: e.sku, nome: e.nome, unidade: e.unidade, categoria: e.categoria, categoriaTopoNome: e.categoriaTopoNome };
    });
    return res.json({
      dias, historicoDesde: hist?.desde || null, diasDeHistorico,
      itens: classificados,
    });
  } catch (error: any) {
    console.error('Erro na curva ABC:', error);
    return res.status(500).json({ error: 'Erro ao calcular a curva ABC.', details: error?.message });
  }
};
