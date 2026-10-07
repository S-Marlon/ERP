// GET /api/vendas/painel?periodo=hoje|ontem|7dias|mes|30dias|personalizado&de=&ate=
// Central de Vendas: faturamento, margem líquida (custo + taxas), comparação com o período anterior,
// formas de pagamento, série por hora/dia, mais vendidos, operadores, clientes, a receber e caixa.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { carregarCaixaAberto, montarResumo } from '../caixa/caixa.controller';
import { intervaloPeriodo, margemLiquidaPct, preencherSerie, variacaoPct } from './painelVendas';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
const n = (v: unknown) => Number(v) || 0;

// Devoluções do período: valor devolvido e custo que voltou ao estoque (o que não voltou é perda)
const devolucoesDoPeriodo = async (tenant: number, de: string, ate: string) => {
  const [[d]]: any = await pool.execute(
    `SELECT COUNT(DISTINCT d.id_devolucao) AS qtd, COALESCE(SUM(di.valor), 0) AS valor,
            COALESCE(SUM(CASE WHEN di.voltou_estoque = 1 THEN di.custo_unitario_base * di.quantidade_base END), 0) AS custo_recuperado
     FROM vendas_devolucoes d INNER JOIN vendas_devolucoes_itens di ON di.id_devolucao = d.id_devolucao
     WHERE d.tenant_id = ? AND d.created_at >= ? AND d.created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
    [tenant, de, ate]
  );
  return { qtd: n(d?.qtd), valor: n(d?.valor), custoRecuperado: n(d?.custo_recuperado) };
};

const totaisDoPeriodo = async (tenant: number, de: string, ate: string) => {
  const [[t]]: any = await pool.execute(
    `SELECT SUM(status = 'CONCLUIDA') AS qtd,
            COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' THEN total_liquido END), 0) AS faturamento,
            COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' THEN total_bruto END), 0) AS bruto,
            COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' THEN total_desconto END), 0) AS descontos,
            COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' THEN total_custo END), 0) AS custo,
            COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' THEN total_taxas END), 0) AS taxas,
            SUM(status = 'CANCELADA') AS qtd_canceladas,
            COALESCE(SUM(CASE WHEN status = 'CANCELADA' THEN total_liquido END), 0) AS canceladas,
            SUM(status = 'CONCLUIDA' AND autorizado_por IS NOT NULL) AS autorizadas
     FROM vendas_pedidos
     WHERE tenant_id = ? AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
    [tenant, de, ate]
  );
  return {
    qtd: n(t?.qtd), faturamento: n(t?.faturamento), bruto: n(t?.bruto), descontos: n(t?.descontos), custo: n(t?.custo),
    taxas: n(t?.taxas), qtdCanceladas: n(t?.qtd_canceladas), canceladas: n(t?.canceladas), autorizadas: n(t?.autorizadas),
  };
};

export const painelVendas = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const intervalo = intervaloPeriodo(String(req.query.periodo || 'hoje'), new Date(), req.query.de as string, req.query.ate as string);
    const filtro = `v.tenant_id = ? AND v.created_at >= ? AND v.created_at < DATE_ADD(?, INTERVAL 1 DAY)`;
    const params = [tenant, intervalo.de, intervalo.ate];

    const [bruto, anteriorBruto, devolucoes, devolucoesAnt] = await Promise.all([
      totaisDoPeriodo(tenant, intervalo.de, intervalo.ate),
      totaisDoPeriodo(tenant, intervalo.anteriorDe, intervalo.anteriorAte),
      devolucoesDoPeriodo(tenant, intervalo.de, intervalo.ate),
      devolucoesDoPeriodo(tenant, intervalo.anteriorDe, intervalo.anteriorAte),
    ]);
    // Faturamento e custo líquidos de devolução (o item que voltou ao estoque devolve o custo)
    const atual = { ...bruto, faturamento: bruto.faturamento - devolucoes.valor, custo: bruto.custo - devolucoes.custoRecuperado };
    const anterior = { ...anteriorBruto, faturamento: anteriorBruto.faturamento - devolucoesAnt.valor, custo: anteriorBruto.custo - devolucoesAnt.custoRecuperado };

    const [formas]: any = await pool.execute(
      `SELECT p.forma, COALESCE(SUM(p.valor - p.troco), 0) AS total, COUNT(DISTINCT p.id_venda) AS qtd, COALESCE(SUM(p.taxa_valor), 0) AS taxas
       FROM vendas_pedidos_pagamentos p INNER JOIN vendas_pedidos v ON v.id_venda = p.id_venda
       WHERE ${filtro} AND v.status = 'CONCLUIDA' GROUP BY p.forma ORDER BY total DESC`,
      params
    );

    const chaveSerie = intervalo.agrupamento === 'hora' ? 'HOUR(v.created_at)' : `DATE_FORMAT(v.created_at, '%Y-%m-%d')`;
    const [serie]: any = await pool.execute(
      `SELECT ${chaveSerie} AS chave, COALESCE(SUM(v.total_liquido), 0) AS total, COUNT(*) AS qtd
       FROM vendas_pedidos v WHERE ${filtro} AND v.status = 'CONCLUIDA' GROUP BY chave`,
      params
    );

    const [itens]: any = await pool.execute(
      `SELECT i.id_item, MAX(i.sku_snapshot) AS sku, MAX(i.nome_snapshot) AS nome,
              SUM(i.quantidade_base) AS quantidade, MAX(um.sigla) AS unidade,
              SUM(i.total_item) AS total, SUM(i.custo_total) AS custo, COUNT(DISTINCT i.id_venda) AS vendas
       FROM vendas_pedidos_itens i
       INNER JOIN vendas_pedidos v ON v.id_venda = i.id_venda
       LEFT JOIN itens_core ic ON ic.id_item = i.id_item
       LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
       WHERE ${filtro} AND v.status = 'CONCLUIDA'
       GROUP BY i.id_item ORDER BY total DESC LIMIT 10`,
      params
    );

    const [operadores]: any = await pool.execute(
      `SELECT COALESCE(v.operador, 'ADM') AS operador, COUNT(*) AS qtd, COALESCE(SUM(v.total_liquido), 0) AS total
       FROM vendas_pedidos v WHERE ${filtro} AND v.status = 'CONCLUIDA' GROUP BY operador ORDER BY total DESC`,
      params
    );

    const [clientes]: any = await pool.execute(
      `SELECT v.id_cliente, MAX(v.cliente_nome) AS nome, COUNT(*) AS qtd, COALESCE(SUM(v.total_liquido), 0) AS total
       FROM vendas_pedidos v WHERE ${filtro} AND v.status = 'CONCLUIDA' AND v.id_cliente IS NOT NULL
       GROUP BY v.id_cliente ORDER BY total DESC LIMIT 5`,
      params
    );

    const [ultimas]: any = await pool.execute(
      `SELECT v.id_venda, v.status, v.cliente_nome, v.total_liquido, v.created_at, v.operador, v.autorizado_por,
              (SELECT GROUP_CONCAT(DISTINCT p.forma) FROM vendas_pedidos_pagamentos p WHERE p.id_venda = v.id_venda) AS formas
       FROM vendas_pedidos v WHERE v.tenant_id = ? AND v.status IN ('CONCLUIDA', 'CANCELADA') ORDER BY v.id_venda DESC LIMIT 8`,
      [tenant]
    );

    const [[receber]]: any = await pool.execute(
      `SELECT COALESCE(SUM(valor - valor_pago), 0) AS em_aberto,
              COALESCE(SUM(CASE WHEN vencimento < CURDATE() THEN valor - valor_pago END), 0) AS vencido,
              SUM(vencimento < CURDATE()) AS qtd_vencidos,
              COALESCE(SUM(CASE WHEN vencimento BETWEEN CURDATE() AND CURDATE() + INTERVAL 7 DAY THEN valor - valor_pago END), 0) AS proximos_7
       FROM financeiro_contas_receber WHERE tenant_id = ? AND status = 'ABERTO'`,
      [tenant]
    );

    const [[estoque]]: any = await pool.execute(
      `SELECT SUM(quantidade_atual < 0) AS negativos FROM estoque_saldos_itens WHERE tenant_id = ? AND deposito = 'VENDA'`,
      [tenant]
    );

    const caixaAberto = await carregarCaixaAberto(pool as any, tenant);
    const resumoCaixa = caixaAberto ? await montarResumo(pool as any, tenant, caixaAberto) : null;

    return res.json({
      intervalo,
      totais: {
        ...atual,
        faturamentoBruto: bruto.faturamento,
        devolucoes: devolucoes.valor,
        qtdDevolucoes: devolucoes.qtd,
        ticketMedio: atual.qtd > 0 ? Number((atual.faturamento / atual.qtd).toFixed(2)) : 0,
        lucroLiquido: Number((atual.faturamento - atual.custo - atual.taxas).toFixed(2)),
        margemLiquida: margemLiquidaPct(atual.faturamento, atual.custo, atual.taxas),
      },
      anterior: {
        faturamento: anterior.faturamento,
        qtd: anterior.qtd,
        ticketMedio: anterior.qtd > 0 ? Number((anterior.faturamento / anterior.qtd).toFixed(2)) : 0,
        margemLiquida: margemLiquidaPct(anterior.faturamento, anterior.custo, anterior.taxas),
      },
      variacao: {
        faturamento: variacaoPct(atual.faturamento, anterior.faturamento),
        qtd: variacaoPct(atual.qtd, anterior.qtd),
        ticketMedio: variacaoPct(atual.qtd ? atual.faturamento / atual.qtd : 0, anterior.qtd ? anterior.faturamento / anterior.qtd : 0),
      },
      formas: formas.map((f: any) => ({ forma: f.forma, total: n(f.total), qtd: n(f.qtd), taxas: n(f.taxas) })),
      serie: preencherSerie(serie.map((s: any) => ({ chave: String(s.chave), total: n(s.total), qtd: n(s.qtd) })), intervalo),
      maisVendidos: itens.map((i: any) => ({
        idItem: Number(i.id_item), sku: i.sku, nome: i.nome, quantidade: n(i.quantidade), unidade: i.unidade || '',
        total: n(i.total), custo: n(i.custo), vendas: n(i.vendas),
        margem: n(i.total) > 0 ? Number((((n(i.total) - n(i.custo)) / n(i.total)) * 100).toFixed(1)) : null,
      })),
      operadores: operadores.map((o: any) => ({ operador: o.operador, qtd: n(o.qtd), total: n(o.total) })),
      clientes: clientes.map((c: any) => ({ idCliente: Number(c.id_cliente), nome: c.nome, qtd: n(c.qtd), total: n(c.total) })),
      ultimasVendas: ultimas.map((v: any) => ({
        idVenda: Number(v.id_venda), status: v.status, cliente: v.cliente_nome, total: n(v.total_liquido), criadoEm: v.created_at,
        operador: v.operador, autorizado: Boolean(v.autorizado_por), formas: v.formas ? String(v.formas).split(',') : [],
      })),
      receber: { emAberto: n(receber?.em_aberto), vencido: n(receber?.vencido), qtdVencidos: n(receber?.qtd_vencidos), proximos7: n(receber?.proximos_7) },
      estoque: { negativos: n(estoque?.negativos) },
      caixa: caixaAberto ? {
        idCaixa: Number(caixaAberto.id_caixa), operador: caixaAberto.operador, abertoEm: caixaAberto.aberto_em,
        dinheiroEsperado: resumoCaixa?.dinheiroEsperado ?? 0, vendas: resumoCaixa?.vendas.total ?? 0,
      } : null,
    });
  } catch (error: any) {
    console.error('Erro no painel de vendas:', error);
    return res.status(500).json({ error: 'Erro ao carregar o painel de vendas.', details: error?.message });
  }
};
