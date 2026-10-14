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
import {
  acaoDoStatus, exigeNota, LigacaoAnuncio, ligarItensDoPedido, liquidoDoPedido, lerPedidoMl, PedidoMl, percentualComissao, tipoDocumento,
  vencimentoDoRecebivel, PedidoComCusto, ResultadoAnuncio, resultadoPorAnuncio,
} from './pedidos';
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

// ---------------------------------------------------------------------------
// Configuração do módulo (não some ao reconectar a conta) e títulos a receber
// ---------------------------------------------------------------------------

export const carregarConfig = async (conn: Conn, tenant: number) => {
  const [[c]] = await conn.execute(
    `SELECT c.id_cliente_recebiveis, DATE_FORMAT(c.pedidos_desde, '%Y-%m-%d %H:%i:%s') AS desde,
            COALESCE(pj.razao_social, pj.nome_fantasia, pf.nome) AS cliente_nome
     FROM modulo_ecommerce_mercadolivre_config c
     LEFT JOIN pessoas_pj pj ON pj.id_cliente = c.id_cliente_recebiveis
     LEFT JOIN pessoas_pf pf ON pf.id_cliente = c.id_cliente_recebiveis
     WHERE c.tenant_id = ?`,
    [tenant]
  );
  return { idClienteRecebiveis: c?.id_cliente_recebiveis ? Number(c.id_cliente_recebiveis) : null, clienteNome: c?.cliente_nome || null, pedidosDesde: c?.desde || null };
};

/**
 * Título a receber da venda do ML: o líquido (itens - comissão - frete do vendedor) no cliente escolhido (ex.: "Mercado Livre"),
 * vencendo na liberação do dinheiro. Sem cliente configurado, não faz nada. Atualiza o vencimento quando o ML informar.
 */
const garantirRecebivel = async (conn: Conn, tenant: number, idVenda: number, p: PedidoMl, idCliente: number | null) => {
  if (!idCliente) return;
  const [[venda]] = await conn.execute(`SELECT status FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ?`, [idVenda, tenant]);
  if (!venda || venda.status !== 'CONCLUIDA') return;
  const venc = vencimentoDoRecebivel(p);
  const valor = liquidoDoPedido(p);
  const [[titulo]] = await conn.execute(
    `SELECT id_titulo, status, vencimento FROM financeiro_contas_receber WHERE tenant_id = ? AND id_venda = ? AND status <> 'CANCELADO' LIMIT 1`,
    [tenant, idVenda]
  );
  const descricao = `Mercado Livre pedido ${p.id}${venc.estimado ? ' (vencimento estimado)' : ''}`.slice(0, 150);
  if (!titulo) {
    if (!(valor > 0)) return;
    await conn.execute(
      `INSERT INTO financeiro_contas_receber (tenant_id, id_cliente, id_venda, parcela, total_parcelas, descricao, vencimento, valor, operador)
       VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?)`,
      [tenant, idCliente, idVenda, descricao, venc.data, f4(valor), OPERADOR]
    );
  } else if (titulo.status === 'ABERTO' && !venc.estimado) {
    await conn.execute(`UPDATE financeiro_contas_receber SET vencimento = ?, descricao = ?, valor = ? WHERE id_titulo = ?`,
      [venc.data, descricao, f4(valor), titulo.id_titulo]);
  }
};

/** CPF ou CNPJ do comprador (dados de faturamento do pedido); sem acesso, null. */
const documentoDoComprador = async (tenant: number, idPedido: number) => {
  try { return tipoDocumento(await ml(tenant, 'GET', `/orders/${idPedido}/billing_info`)); } catch { return null; }
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
  const [[existe]]: any = await pool.execute(
    `SELECT id, id_venda, status, detalhes FROM modulo_ecommerce_mercadolivre_pedidos WHERE tenant_id = ? AND ml_order_id = ?`, [tenant, p.id]
  );
  // CPF/CNPJ do comprador: lido uma vez (comprador CNPJ = MEI precisa emitir nota)
  let anterior: any = {};
  try { anterior = JSON.parse(existe?.detalhes || '{}'); } catch { /* sem detalhes */ }
  p.documentoTipo = anterior.documentoTipo || (acao === 'VENDER' ? await documentoDoComprador(tenant, p.id) : null);
  const resumo = JSON.stringify({ ...p, itens: p.itens });
  const { idClienteRecebiveis } = await carregarConfig(pool as any, tenant);
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
    if (acao === 'VENDER') await garantirRecebivel(pool as any, tenant, Number(existe.id_venda), p, idClienteRecebiveis);
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
    await garantirRecebivel(connection as any, tenant, idVenda, p, idClienteRecebiveis);
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
  // A primeira conexão define desde quando os pedidos entram; reconectar não muda (senão pularia pedidos)
  await pool.execute(
    `INSERT INTO modulo_ecommerce_mercadolivre_config (tenant_id, pedidos_desde) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE pedidos_desde = COALESCE(pedidos_desde, VALUES(pedidos_desde))`,
    [tenant, conta.conectado_em]
  );
  const [[cfg]]: any = await pool.execute(`SELECT pedidos_desde FROM modulo_ecommerce_mercadolivre_config WHERE tenant_id = ?`, [tenant]);
  const desde = new Date(cfg.pedidos_desde).toISOString();
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
              DATE_FORMAT(p.data_pedido, '%Y-%m-%d %H:%i') AS data_fmt, v.status AS status_venda, v.total_custo,
              t.status AS titulo_status, DATE_FORMAT(t.vencimento, '%Y-%m-%d') AS titulo_vencimento
       FROM modulo_ecommerce_mercadolivre_pedidos p
       LEFT JOIN vendas_pedidos v ON v.id_venda = p.id_venda AND v.tenant_id = p.tenant_id
       LEFT JOIN financeiro_contas_receber t ON t.id_titulo = (
         SELECT MAX(x.id_titulo) FROM financeiro_contas_receber x WHERE x.tenant_id = p.tenant_id AND x.id_venda = p.id_venda AND p.id_venda IS NOT NULL)
       WHERE p.tenant_id = ?
       ORDER BY p.data_pedido DESC, p.id DESC
       LIMIT 300`,
      [tenant]
    );
    return res.json(rows.map((r: any) => {
      let det: any = {};
      try { det = JSON.parse(r.detalhes || '{}'); } catch { /* sem detalhes */ }
      const itens: any[] = det.itens || [];
      const total = Number(r.total) || 0, comissao = Number(r.comissao) || 0, frete = Number(r.frete) || 0;
      const situacao = r.id_venda
        ? (r.status_venda === 'CANCELADA' ? 'VENDA_CANCELADA' : acaoDoStatus(r.status) === 'CANCELAR' ? 'CANCELADO_NO_ML' : 'VENDA')
        : acaoDoStatus(r.status) === 'CANCELAR' ? 'CANCELADO' : r.erro ? 'PENDENTE' : 'AGUARDANDO';
      return {
        id: Number(r.id), mlOrderId: String(r.ml_order_id), idVenda: r.id_venda ? Number(r.id_venda) : null, statusMl: r.status,
        comprador: r.comprador, total, comissao, frete, liquido: liquidoDoPedido({ total, comissao, freteVendedor: frete }),
        custo: r.id_venda && r.status_venda !== 'CANCELADA' ? Number(r.total_custo) || 0 : null,
        lucro: r.id_venda && r.status_venda !== 'CANCELADA' ? Math.round((liquidoDoPedido({ total, comissao, freteVendedor: frete }) - (Number(r.total_custo) || 0)) * 100) / 100 : null,
        data: r.data_fmt, erro: r.erro, situacao,
        documentoTipo: det.documentoTipo || null, exigeNota: exigeNota(det.documentoTipo), liberacaoEm: det.liberacaoEm || null,
        titulo: r.titulo_status ? { status: r.titulo_status, vencimento: r.titulo_vencimento } : null,
        itens: itens.map(i => ({ mlbId: i.mlbId, titulo: i.titulo, sku: i.sku, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
      };
    }));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar os pedidos.');
  }
};

/** GET /pedidos/resultado?dias=30 — resultado real por anúncio: tarifa e frete cobrados pelo ML, custo do ERP e lucro */
export const resultadoPedidos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const dias = Math.min(365, Math.max(1, Number(req.query.dias) || 30));
  try {
    const [rows]: any = await pool.execute(
      `SELECT p.total, p.comissao, p.frete, p.detalhes, v.total_custo
       FROM modulo_ecommerce_mercadolivre_pedidos p
       JOIN vendas_pedidos v ON v.id_venda = p.id_venda AND v.tenant_id = p.tenant_id AND v.status <> 'CANCELADA'
       WHERE p.tenant_id = ? AND p.data_pedido >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [tenant, dias]
    );
    const pedidos: PedidoComCusto[] = rows.map((r: any) => {
      let det: any = {};
      try { det = JSON.parse(r.detalhes || '{}'); } catch { /* sem detalhes */ }
      return {
        total: Number(r.total) || 0, comissao: Number(r.comissao) || 0, frete: Number(r.frete) || 0, custo: Number(r.total_custo) || 0,
        itens: (det.itens || []).map((i: any) => ({ mlbId: String(i.mlbId || ''), titulo: String(i.titulo || ''), quantidade: Number(i.quantidade) || 0, precoUnitario: Number(i.precoUnitario) || 0, comissao: Number(i.comissao) || 0 })),
      };
    });
    const anuncios = resultadoPorAnuncio(pedidos);
    const soma = (k: keyof ResultadoAnuncio) => Math.round(anuncios.reduce((s, a) => s + (Number(a[k]) || 0), 0) * 100) / 100;
    const custo = soma('custo'), lucro = soma('lucro');
    return res.json({
      dias, pedidos: pedidos.length, anuncios,
      total: { receita: soma('receita'), comissao: soma('comissao'), frete: soma('frete'), recebido: soma('recebido'), custo, lucro, lucroSobreCustoPct: custo > 0 ? Math.round((lucro / custo) * 10000) / 100 : null },
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao calcular o resultado das vendas.');
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

/** GET /config — cliente dos títulos a receber e desde quando os pedidos entram */
export const obterConfig = async (req: Request, res: Response) => {
  try { return res.json(await carregarConfig(pool as any, tenantDe(req))); }
  catch (error) { return responderErro(res, error, 'Erro ao ler a configuração.'); }
};

/** PUT /config { idClienteRecebiveis } — e cria os títulos das vendas do ML que ainda não têm */
export const salvarConfig = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const idCliente = req.body?.idClienteRecebiveis ? Number(req.body.idClienteRecebiveis) : null;
    if (idCliente) {
      const [[pessoa]]: any = await pool.execute(`SELECT id_pessoa FROM pessoas_core WHERE id_pessoa = ? AND tenant_id = ? AND deleted_at IS NULL`, [idCliente, tenant]);
      if (!pessoa) throw new ErroML('Cliente não encontrado no cadastro.', 404);
    }
    await pool.execute(
      `INSERT INTO modulo_ecommerce_mercadolivre_config (tenant_id, id_cliente_recebiveis) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE id_cliente_recebiveis = VALUES(id_cliente_recebiveis)`,
      [tenant, idCliente]
    );
    let criados = 0;
    if (idCliente) {
      const [semTitulo]: any = await pool.execute(
        `SELECT p.id_venda, p.detalhes FROM modulo_ecommerce_mercadolivre_pedidos p
         INNER JOIN vendas_pedidos v ON v.id_venda = p.id_venda AND v.status = 'CONCLUIDA'
         WHERE p.tenant_id = ? AND NOT EXISTS (
           SELECT 1 FROM financeiro_contas_receber t WHERE t.tenant_id = p.tenant_id AND t.id_venda = p.id_venda AND t.status <> 'CANCELADO')`,
        [tenant]
      );
      for (const v of semTitulo) {
        let det: any = null;
        try { det = JSON.parse(v.detalhes || 'null'); } catch { /* sem detalhes */ }
        if (!det) continue;
        await garantirRecebivel(pool as any, tenant, Number(v.id_venda), det as PedidoMl, idCliente);
        criados++;
      }
    }
    return res.json({ ...(await carregarConfig(pool as any, tenant)), titulosCriados: criados });
  } catch (error) {
    return responderErro(res, error, 'Erro ao salvar a configuração.');
  }
};

/** GET /clientes?busca= — pessoas do cadastro para escolher quem recebe os títulos (ex.: "Mercado Livre") */
export const buscarClientes = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const busca = `%${String(req.query.busca || '').trim()}%`;
  try {
    const [rows]: any = await pool.execute(
      `SELECT c.id_pessoa, COALESCE(pj.razao_social, pj.nome_fantasia, pf.nome) AS nome, pj.nome_fantasia, COALESCE(pj.cnpj, pf.cpf) AS documento
       FROM pessoas_core c
       LEFT JOIN pessoas_pj pj ON pj.id_cliente = c.id_pessoa
       LEFT JOIN pessoas_pf pf ON pf.id_cliente = c.id_pessoa
       WHERE c.tenant_id = ? AND c.deleted_at IS NULL
         AND (pj.razao_social LIKE ? OR pj.nome_fantasia LIKE ? OR pf.nome LIKE ? OR pj.cnpj LIKE ? OR pf.cpf LIKE ?)
       ORDER BY nome LIMIT 30`,
      [tenant, busca, busca, busca, busca, busca]
    );
    return res.json(rows.map((r: any) => ({ id: Number(r.id_pessoa), nome: r.nome || `#${r.id_pessoa}`, fantasia: r.nome_fantasia || null, documento: r.documento || null })));
  } catch (error) {
    return responderErro(res, error, 'Erro ao buscar clientes.');
  }
};
