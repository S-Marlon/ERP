// Pedidos do Mercado Livre: cada pedido pago vira uma venda no ERP (origem MERCADO_LIVRE, sem caixa: o dinheiro
// entra pelo ML) com a baixa de estoque igual à do PDV (kit sai por componente). Cancelamento no ML só avisa:
// o operador cancela a venda no ERP (devolve o estoque) quando a mercadoria não saiu ou voltou.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { calcularItensDoPedido } from '../../../areas/vendas/pdv/vendas.controller';
import { ErroVenda, fecharVenda } from '../../../areas/vendas/pdv/vendaPdv';
import { carregarDadosComponentes } from '../../../areas/catalogo/kits/kitsBanco';
import { nomeComTrocas, saidaDosComponentes } from '../../../areas/catalogo/kits/kits';
import { gravarEscolhasKit } from '../../../areas/catalogo/kits/kitsVenda';
import { lista, responderErro, tenantDe } from './anuncios.controller';
import { acaoDoStatus, LigacaoAnuncio, ligarItensDoPedido, liquidoDoPedido, lerPedidoMl, PedidoMl, percentualComissao } from './pedidos';
import { ErroML, ml } from './mercadolivreApi';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const ORIGEM_ESTOQUE = 'VENDA_PDV';   // a mesma da venda do balcão: cancelamento, devolução e giro de compras enxergam
const OPERADOR = 'MERCADO LIVRE';
const f4 = (v: number) => Number(v || 0).toFixed(4);

/** ISO do ML ("2026-10-13T15:01:00.000-04:00") para DATETIME no horário do servidor. */
const dataHora = (iso: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** Grava a venda do pedido (cabeçalho, itens, saída de estoque e o pagamento "Mercado Livre"). */
const criarVenda = async (conn: Conn, tenant: number, p: PedidoMl, linhasPedido: ReturnType<typeof ligarItensDoPedido>['linhas']) => {
  const { itensBanco, linhas } = await calcularItensDoPedido(conn as any, tenant,
    linhasPedido.map(l => ({ idItem: l.idItem, quantidade: l.quantidade, idUnidade: l.idUnidade, precoUnitario: l.precoUnitario })));
  // o preço do ML é o preço deste canal: não conta como desconto nem acréscimo sobre a tabela da loja
  for (const l of linhas) l.precoTabela = l.precoPraticado;
  const venda = fecharVenda(linhas, 0, 0);

  const componentes = await carregarDadosComponentes(conn as any, tenant, venda.linhas.flatMap(l => (l.kit?.componentes || []).map(c => c.idItem)));
  const tipoDe = (id: number) => String(itensBanco.get(id)?.tipo_recurso ?? componentes.get(id)?.tipoRecurso ?? 'PRODUTO').toUpperCase();
  const ehServico = (id: number) => tipoDe(id) === 'SERVICO';
  const saidasDaLinha = (l: (typeof venda.linhas)[number]) => (l.kit
    ? saidaDosComponentes(l.kit.componentes, l.quantidadeBase).filter(c => !ehServico(c.idItem)).map(c => ({ idItem: c.idItem, quantidadeBase: c.quantidade }))
    : ehServico(l.idItem) ? [] : [{ idItem: l.idItem, quantidadeBase: l.quantidadeBase }]);
  const idsEstoque = [...new Set(venda.linhas.flatMap(saidasDaLinha).map(s => s.idItem))].sort((a, b) => a - b);

  // Trava os saldos. A venda já aconteceu no ML: entra mesmo sem saldo (o saldo pode ficar negativo)
  const [saldoRows] = idsEstoque.length ? await conn.execute(
    `SELECT id_item, quantidade_atual, custo_medio FROM estoque_saldos_itens
     WHERE tenant_id = ? AND deposito = 'VENDA' AND id_item IN (${lista(idsEstoque)}) ORDER BY id_item FOR UPDATE`,
    [tenant, ...idsEstoque]
  ) : [[]];
  const saldos = new Map<number, number>();
  const custos = new Map<number, number>();
  for (const s of saldoRows as any[]) { saldos.set(Number(s.id_item), Number(s.quantidade_atual) || 0); custos.set(Number(s.id_item), Number(s.custo_medio) || 0); }
  const custoItem = (id: number) => {
    const medio = custos.get(id) || 0;
    return medio > 0 ? medio : Number(itensBanco.get(id)?.custo_gerencial ?? componentes.get(id)?.custoGerencial) || 0;
  };
  const custoDaLinha = (l: (typeof venda.linhas)[number]) => (l.kit
    ? l.kit.componentes.reduce((a, c) => a + Math.round(custoItem(c.idItem) * c.quantidade * 10000) / 10000, 0)
    : custoItem(l.idItem));
  const totalCusto = venda.linhas.reduce((a, l) => a + custoDaLinha(l) * l.quantidadeBase, 0);
  const custosCanal = Math.round((p.comissao + p.freteVendedor) * 100) / 100;
  const quando = dataHora(p.data);

  const [cab] = await conn.execute(
    `INSERT INTO vendas_pedidos
       (tenant_id, origem, status, id_caixa, operador, cliente_nome, total_bruto, total_desconto, total_liquido, total_custo, total_taxas, observacao, created_at)
     VALUES (?, 'MERCADO_LIVRE', 'CONCLUIDA', NULL, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))`,
    [tenant, OPERADOR, p.comprador, f4(venda.totalBruto), f4(venda.totalDesconto), f4(venda.totalLiquido), f4(totalCusto), f4(custosCanal),
      `Mercado Livre pedido ${p.id}${p.packId ? ` (carrinho ${p.packId})` : ''}`.slice(0, 255), quando]
  );
  const idVenda = Number((cab as any).insertId);

  for (const l of venda.linhas) {
    const item = itensBanco.get(l.idItem);
    const custo = custoDaLinha(l);
    const [ins] = await conn.execute(
      `INSERT INTO vendas_pedidos_itens
         (tenant_id, id_venda, id_item, sku_snapshot, nome_snapshot, id_unidade, unidade_sigla, fator_conversao,
          quantidade, quantidade_base, preco_tabela, preco_unitario, desconto_valor, total_item, custo_unitario_base, custo_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, idVenda, l.idItem, item.sku_customizado || item.sku_core, nomeComTrocas(item.nome_comercial || item.nome_item, l.kit),
        l.idUnidade, l.sigla, Number(l.fator).toFixed(6), f4(l.quantidade), f4(l.quantidadeBase),
        f4(l.precoTabela), f4(l.precoUnitarioFinal), f4(l.descontoValor), f4(l.totalItem), f4(custo), f4(custo * l.quantidadeBase)]
    );
    const idVendaItem = Number((ins as any).insertId);
    await gravarEscolhasKit(conn as any, tenant, idVenda, idVendaItem, l.kit ?? null);
    for (const s of saidasDaLinha(l)) {
      const doKit = s.idItem !== l.idItem;
      const custoSaida = custoItem(s.idItem);
      const anterior = saldos.get(s.idItem) || 0;
      const posterior = anterior - s.quantidadeBase;
      saldos.set(s.idItem, posterior);
      await conn.execute(
        `INSERT INTO estoque_movimentos
           (tenant_id, id_item, deposito, tipo_movimento, origem, id_origem, id_origem_item, documento_origem, tipo_recurso,
            quantidade, quantidade_documento, unidade_documento, fator_conversao, custo_unitario, custo_total, saldo_anterior, saldo_posterior, observacao)
         VALUES (?, ?, 'VENDA', 'SAIDA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenant, s.idItem, ORIGEM_ESTOQUE, idVenda, idVendaItem, `VENDA ${idVenda}`, tipoDe(s.idItem),
          f4(s.quantidadeBase), f4(doKit ? s.quantidadeBase : l.quantidade), doKit ? componentes.get(s.idItem)?.sigla || null : l.sigla,
          doKit ? '1.000000' : Number(l.fator).toFixed(6), f4(custoSaida), f4(custoSaida * s.quantidadeBase), f4(anterior), f4(posterior),
          `Venda Mercado Livre ${p.id}${doKit ? ` (kit ${item.sku_customizado || item.sku_core})` : ''}`.slice(0, 255)]
      );
    }
  }
  for (const id of idsEstoque) {
    await conn.execute(
      `INSERT INTO estoque_saldos_itens (tenant_id, id_item, deposito, quantidade_atual, custo_medio) VALUES (?, ?, 'VENDA', ?, ?)
       ON DUPLICATE KEY UPDATE quantidade_atual = VALUES(quantidade_atual)`,
      [tenant, id, f4(saldos.get(id) || 0), f4(custos.get(id) || 0)]
    );
  }
  await conn.execute(
    `INSERT INTO vendas_pedidos_pagamentos (tenant_id, id_venda, forma, valor, parcelas, troco, taxa_percentual, taxa_valor)
     VALUES (?, ?, 'MERCADO_LIVRE', ?, 1, 0, ?, ?)`,
    [tenant, idVenda, f4(venda.totalLiquido), f4(percentualComissao({ total: venda.totalLiquido, comissao: custosCanal })), f4(custosCanal)]
  );
  const negativos = idsEstoque.filter(id => (saldos.get(id) || 0) < 0);
  return { idVenda, negativos };
};

/** Frete que o vendedor paga no envio (Mercado Envios com frete grátis); sem acesso, 0. */
const freteDoVendedor = async (tenant: number, envioId: number | null) => {
  if (!envioId) return 0;
  try {
    const c: any = await ml(tenant, 'GET', `/shipments/${envioId}/costs`);
    return Math.round((Number(c?.senders?.[0]?.cost) || 0) * 100) / 100;
  } catch { return 0; }
};

/** Ligações dos itens do pedido: anúncio (MLB) e, sem anúncio, SKU do catálogo. */
const carregarLigacoes = async (conn: Conn, tenant: number, p: PedidoMl) => {
  const mlbs = [...new Set(p.itens.map(i => i.mlbId).filter(Boolean))];
  const porMlb = new Map<string, LigacaoAnuncio>();
  if (mlbs.length) {
    const [rows] = await conn.execute(
      `SELECT mlb_id, id_item, id_unidade FROM modulo_ecommerce_mercadolivre_anuncios_itens WHERE tenant_id = ? AND mlb_id IN (${mlbs.map(() => '?').join(',')})`,
      [tenant, ...mlbs]
    );
    for (const r of rows) porMlb.set(String(r.mlb_id), { idItem: Number(r.id_item), idUnidade: r.id_unidade ? Number(r.id_unidade) : null });
  }
  const skus = [...new Set(p.itens.map(i => (i.sku || '').trim().toUpperCase()).filter(Boolean))];
  const porSku = new Map<string, number>();
  if (skus.length) {
    const [rows] = await conn.execute(
      `SELECT ic.id_item, UPPER(COALESCE(cpd.sku_customizado, '')) AS sku, UPPER(ic.sku) AS sku_raiz
       FROM itens_core ic LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       WHERE ic.tenant_id = ? AND (UPPER(cpd.sku_customizado) IN (${skus.map(() => '?').join(',')}) OR UPPER(ic.sku) IN (${skus.map(() => '?').join(',')}))`,
      [tenant, ...skus, ...skus]
    );
    for (const r of rows) { if (r.sku) porSku.set(r.sku, Number(r.id_item)); porSku.set(r.sku_raiz, Number(r.id_item)); }
  }
  return { porMlb, porSku };
};

export interface ResultadoPedido { mlOrderId: number; acao: 'VENDA_CRIADA' | 'ATUALIZADO' | 'PENDENTE' | 'AGUARDANDO' | 'CANCELADO_NO_ML'; idVenda: number | null; erro: string | null }

/** Registra (ou atualiza) um pedido do ML e cria a venda quando ele está pago. */
export const processarPedido = async (tenant: number, bruto: any): Promise<ResultadoPedido> => {
  const p = lerPedidoMl(bruto);
  p.freteVendedor = await freteDoVendedor(tenant, p.envioId);
  const acao = acaoDoStatus(p.status);
  const resumo = JSON.stringify({ ...p, itens: p.itens });
  const [[existe]]: any = await pool.execute(
    `SELECT id, id_venda, status FROM modulo_ecommerce_mercadolivre_pedidos WHERE tenant_id = ? AND ml_order_id = ?`, [tenant, p.id]
  );
  const gravar = async (idVenda: number | null, erro: string | null) => {
    await pool.execute(
      `INSERT INTO modulo_ecommerce_mercadolivre_pedidos (tenant_id, ml_order_id, id_venda, status, comprador, total, comissao, frete, data_pedido, detalhes, erro)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id_venda = COALESCE(VALUES(id_venda), id_venda), status = VALUES(status), comprador = VALUES(comprador),
         total = VALUES(total), comissao = VALUES(comissao), frete = VALUES(frete), data_pedido = VALUES(data_pedido),
         detalhes = VALUES(detalhes), erro = VALUES(erro)`,
      [tenant, p.id, idVenda, p.status.slice(0, 30), p.comprador, f4(p.total), f4(p.comissao), f4(p.freteVendedor), dataHora(p.data), resumo, erro ? erro.slice(0, 500) : null]
    );
  };

  // Já virou venda: só acompanha o status (cancelado no ML fica marcado para o operador decidir)
  if (existe?.id_venda) {
    await gravar(null, acao === 'CANCELAR' ? 'Cancelado no Mercado Livre: cancele a venda no ERP se a mercadoria não saiu (devolve o estoque).' : null);
    return { mlOrderId: p.id, acao: acao === 'CANCELAR' ? 'CANCELADO_NO_ML' : 'ATUALIZADO', idVenda: Number(existe.id_venda), erro: null };
  }
  if (acao !== 'VENDER') {
    await gravar(null, null);
    return { mlOrderId: p.id, acao: acao === 'CANCELAR' ? 'CANCELADO_NO_ML' : 'AGUARDANDO', idVenda: null, erro: null };
  }

  const { porMlb, porSku } = await carregarLigacoes(pool as any, tenant, p);
  const { linhas, semItem } = ligarItensDoPedido(p, porMlb, porSku);
  if (semItem.length) {
    const erro = `Sem item do ERP para: ${semItem.map(i => `${i.mlbId}${i.sku ? ` (SKU ${i.sku})` : ''} "${i.titulo}"`).join('; ')}. Ligue o anúncio ao item (Anúncios › Importar do Mercado Livre) e tente de novo.`;
    await gravar(null, erro);
    return { mlOrderId: p.id, acao: 'PENDENTE', idVenda: null, erro };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // trava o pedido: duas rodadas ao mesmo tempo não criam duas vendas
    await connection.execute(
      `INSERT INTO modulo_ecommerce_mercadolivre_pedidos (tenant_id, ml_order_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = status`,
      [tenant, p.id, p.status.slice(0, 30)]
    );
    const [[trava]]: any = await connection.execute(
      `SELECT id_venda FROM modulo_ecommerce_mercadolivre_pedidos WHERE tenant_id = ? AND ml_order_id = ? FOR UPDATE`, [tenant, p.id]
    );
    if (trava?.id_venda) { await connection.rollback(); return { mlOrderId: p.id, acao: 'ATUALIZADO', idVenda: Number(trava.id_venda), erro: null }; }
    const { idVenda, negativos } = await criarVenda(connection as any, tenant, p, linhas);
    await connection.execute(`UPDATE modulo_ecommerce_mercadolivre_pedidos SET id_venda = ? WHERE tenant_id = ? AND ml_order_id = ?`, [idVenda, tenant, p.id]);
    await connection.commit();
    await gravar(idVenda, negativos.length ? `Venda criada, mas ${negativos.length} item(ns) ficaram com estoque negativo no ERP: confira o saldo.` : null);
    return { mlOrderId: p.id, acao: 'VENDA_CRIADA', idVenda, erro: null };
  } catch (e: any) {
    await connection.rollback().catch(() => null);
    const erro = e instanceof ErroVenda || e instanceof ErroML ? e.message : `Erro ao criar a venda: ${e?.message || e}`;
    await gravar(null, erro);
    return { mlOrderId: p.id, acao: 'PENDENTE', idVenda: null, erro };
  } finally {
    connection.release();
  }
};

/**
 * Busca no ML os pedidos criados depois da conexão da conta e mexidos nos últimos dias (novos, pagos, cancelados)
 * e processa cada um. Usado pela rodada automática e pelo botão.
 */
export const importarPedidos = async (tenant: number) => {
  const [[conta]]: any = await pool.execute(`SELECT ml_user_id, conectado_em FROM modulo_ecommerce_mercadolivre_contas WHERE tenant_id = ?`, [tenant]);
  if (!conta) throw new ErroML('Conecte a conta do Mercado Livre primeiro.', 412);
  const desde = new Date(conta.conectado_em).toISOString();
  const mexidos = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const resultado: ResultadoPedido[] = [];
  for (let offset = 0; offset < 200; offset += 50) {
    const r: any = await ml(tenant, 'GET',
      `/orders/search?seller=${conta.ml_user_id}&order.date_created.from=${encodeURIComponent(desde)}&order.date_last_updated.from=${encodeURIComponent(mexidos)}&sort=date_asc&limit=50&offset=${offset}`);
    for (const o of r.results || []) resultado.push(await processarPedido(tenant, o));
    if (offset + 50 >= Number(r.paging?.total || 0)) break;
  }
  return resultado;
};

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

/** GET /pedidos — pedidos do ML com a venda do ERP de cada um */
export const listarPedidos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [rows]: any = await pool.execute(
      `SELECT p.id, p.ml_order_id, p.id_venda, p.status, p.comprador, p.total, p.comissao, p.frete, p.erro, p.detalhes,
              DATE_FORMAT(p.data_pedido, '%Y-%m-%d %H:%i') AS data_fmt, v.status AS status_venda
       FROM modulo_ecommerce_mercadolivre_pedidos p
       LEFT JOIN vendas_pedidos v ON v.id_venda = p.id_venda AND v.tenant_id = p.tenant_id
       WHERE p.tenant_id = ?
       ORDER BY p.data_pedido DESC, p.id DESC
       LIMIT 300`,
      [tenant]
    );
    return res.json(rows.map((r: any) => {
      let itens: any[] = [];
      try { itens = JSON.parse(r.detalhes || '{}').itens || []; } catch { /* sem detalhes */ }
      const total = Number(r.total) || 0, comissao = Number(r.comissao) || 0, frete = Number(r.frete) || 0;
      const situacao = r.id_venda
        ? (r.status_venda === 'CANCELADA' ? 'VENDA_CANCELADA' : acaoDoStatus(r.status) === 'CANCELAR' ? 'CANCELADO_NO_ML' : 'VENDA')
        : acaoDoStatus(r.status) === 'CANCELAR' ? 'CANCELADO' : r.erro ? 'PENDENTE' : 'AGUARDANDO';
      return {
        id: Number(r.id), mlOrderId: String(r.ml_order_id), idVenda: r.id_venda ? Number(r.id_venda) : null, statusMl: r.status,
        comprador: r.comprador, total, comissao, frete, liquido: liquidoDoPedido({ total, comissao, freteVendedor: frete }),
        data: r.data_fmt, erro: r.erro, situacao,
        itens: itens.map(i => ({ mlbId: i.mlbId, titulo: i.titulo, sku: i.sku, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
      };
    }));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar os pedidos.');
  }
};

/** POST /pedidos/buscar — busca agora os pedidos novos no ML */
export const buscarPedidos = async (req: Request, res: Response) => {
  try {
    const r = await importarPedidos(tenantDe(req));
    return res.json({
      vendas: r.filter(x => x.acao === 'VENDA_CRIADA').length,
      pendentes: r.filter(x => x.acao === 'PENDENTE').length,
      canceladosNoMl: r.filter(x => x.acao === 'CANCELADO_NO_ML').length,
      lidos: r.length,
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao buscar os pedidos do Mercado Livre.');
  }
};

/** POST /pedidos/:id/processar — tenta de novo um pedido pendente (ex.: depois de ligar o anúncio ao item) */
export const reprocessarPedido = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [[p]]: any = await pool.execute(`SELECT ml_order_id FROM modulo_ecommerce_mercadolivre_pedidos WHERE id = ? AND tenant_id = ?`, [Number(req.params.id), tenant]);
    if (!p) throw new ErroML('Pedido não encontrado.', 404);
    const o = await ml(tenant, 'GET', `/orders/${p.ml_order_id}`);
    return res.json(await processarPedido(tenant, o));
  } catch (error) {
    return responderErro(res, error, 'Erro ao processar o pedido.');
  }
};
