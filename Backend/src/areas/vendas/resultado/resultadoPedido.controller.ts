// Vendas › resultado do pedido: GET /api/vendas/pedidos/:idVenda/resultado — o fechamento de um orçamento, venda ou
// pedido faturado (receita, custo, taxas, lucro, margem e a avaliação). Só lê: não muda nada do pedido.
// Venda: as taxas lançadas nos pagamentos. Orçamento: as taxas estimadas pela condição combinada (e o desconto da forma).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { carregarConfigTaxas } from '../taxas/taxas.controller';
import { taxaPara } from '../taxas/taxas';
import { carregarMargensNegociacao } from '../regras/regrasVenda.controller';
import { condicaoDaLinha, custoDaCondicao, lerCondicao, pagamentosDaCondicao, textoDaCondicao, totalComDesconto } from '../negociacao/condicaoPagamento';
import { resultadoDoPedido } from './resultadoPedido';

const tenantDe = (req: Request) => Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
const n = (v: unknown) => Number(v) || 0;

export const resultadoPedido = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idVenda = Number(req.params.idVenda);
  try {
    if (!Number.isInteger(idVenda) || idVenda <= 0) return res.status(400).json({ error: 'Pedido inválido.' });
    const [[p]]: any = await pool.execute(
      `SELECT id_venda, status, cliente_nome, operador, autorizado_por, motivo_autorizacao, total_bruto, total_desconto, total_frete, total_liquido,
              total_custo, total_taxas, total_devolvido, margem_alvo, condicao_pagamento, condicao_forma, condicao_parcelas, condicao_intervalo_dias,
              condicao_entrada, condicao_desconto_pct, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS data
       FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ?`, [idVenda, tenant]);
    if (!p) return res.status(404).json({ error: 'Pedido não encontrado.' });
    const [itens]: any = await pool.execute(
      `SELECT nome_snapshot, sku_snapshot, quantidade, unidade_sigla, preco_tabela, total_item, custo_total
       FROM vendas_pedidos_itens WHERE id_venda = ? AND tenant_id = ? AND quantidade > 0 ORDER BY id_venda_item`, [idVenda, tenant]);
    const [pagos]: any = await pool.execute(
      `SELECT forma, valor, parcelas, troco, taxa_valor, id_adiantamento FROM vendas_pedidos_pagamentos WHERE id_venda = ? AND tenant_id = ? ORDER BY id_pagamento`, [idVenda, tenant]);
    const margens = await carregarMargensNegociacao(pool as any, tenant);
    const ehOrcamento = p.status === 'ORCAMENTO';

    // orçamento: a condição combinada dá o desconto da forma, as taxas estimadas e os pagamentos previstos
    let condicao: ReturnType<typeof lerCondicao> = null;
    try { condicao = lerCondicao(condicaoDaLinha(p)); } catch { condicao = null; }
    const totalItens = itens.reduce((s: number, i: any) => s + n(i.total_item), 0);
    let taxas = n(p.total_taxas) || pagos.reduce((s: number, x: any) => s + n(x.taxa_valor), 0);
    let previstos: Array<{ forma: string; valor: number; quando: string }> = [];
    if (ehOrcamento && condicao) {
      const cfg = await carregarConfigTaxas(pool as any, tenant);
      const aPagar = totalComDesconto(condicao, totalItens);
      taxas = custoDaCondicao((f, k) => taxaPara(cfg.taxas, f, k), condicao, aPagar).taxa;
      const lista = pagamentosDaCondicao(condicao, aPagar);
      const aVista = condicao.forma === 'PIX' || condicao.forma === 'DINHEIRO';
      previstos = lista.map((x, i) => ({
        forma: x.forma, valor: x.valor,
        quando: lista.length > 1 && i === 0 ? (aVista ? 'antecipado' : 'entrada') : aVista && lista.length > 1 ? 'na conclusão e entrega'
          : x.forma === 'PRAZO' ? `${x.parcelas}x a cada ${x.intervaloDias || 30} dias` : x.forma === 'CREDITO' && (x.parcelas || 1) > 1 ? `${x.parcelas}x no cartão` : 'no fechamento',
      }));
    }

    const resultado = resultadoDoPedido({
      itens: itens.map((i: any) => ({
        nome: i.nome_snapshot, sku: i.sku_snapshot, quantidade: n(i.quantidade), unidade: i.unidade_sigla || 'UN',
        precoTabela: n(i.preco_tabela), totalItem: n(i.total_item), custoTotal: n(i.custo_total),
      })),
      frete: n(p.total_frete), devolvido: n(p.total_devolvido), taxas, taxasEstimadas: ehOrcamento,
      descontoFormaPct: ehOrcamento ? n(condicao?.descontoPct) : 0,
      // proposta negociada: o alvo é o da negociação; senão o padrão da loja
      margemAlvo: p.margem_alvo !== null && p.margem_alvo !== undefined ? n(p.margem_alvo) : margens.margemAlvoPadrao,
      margemMinima: margens.margemMinimaNegociacao,
    });
    return res.json({
      pedido: {
        idVenda, status: p.status, cliente: p.cliente_nome, operador: p.operador, data: p.data,
        condicao: condicao ? textoDaCondicao(condicao, totalItens) : p.condicao_pagamento || null,
        autorizadoPor: p.autorizado_por || null, motivoAutorizacao: p.motivo_autorizacao || null, negociado: p.margem_alvo !== null,
      },
      resultado,
      pagamentos: ehOrcamento
        ? previstos.map(x => ({ ...x, taxa: null, previsto: true }))
        : pagos.map((x: any) => ({ forma: x.id_adiantamento ? 'SINAL' : x.forma, valor: Math.round((n(x.valor) - n(x.troco)) * 100) / 100, quando: (Number(x.parcelas) || 1) > 1 ? `${x.parcelas}x` : '', taxa: n(x.taxa_valor), previsto: false })),
    });
  } catch (e: any) {
    console.error('Erro no resultado do pedido', e);
    return res.status(500).json({ error: 'Erro ao calcular o resultado do pedido.', details: e?.message });
  }
};
