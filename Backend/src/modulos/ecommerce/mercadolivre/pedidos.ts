// Regras puras dos pedidos do Mercado Livre: o que o pedido vira no ERP (venda, pendência ou cancelamento).

/** Linha do pedido como o ML manda (order_items). */
export interface ItemPedidoMl { mlbId: string; titulo: string; sku: string | null; quantidade: number; precoUnitario: number; comissao: number }

export interface PedidoMl {
  id: number;
  status: string;                 // paid, confirmed, cancelled, invalid, partially_refunded...
  data: string | null;            // date_closed ou date_created (ISO)
  comprador: string;
  total: number;                  // valor dos itens pago pelo comprador
  comissao: number;               // soma das tarifas de venda do ML
  freteVendedor: number;          // parte do frete que o vendedor paga (quando houver)
  itens: ItemPedidoMl[];
  packId: number | null;
  envioId: number | null;
  liberacaoEm: string | null;     // quando o ML libera o dinheiro (AAAA-MM-DD), se já informado
  documentoTipo: string | null;   // CPF ou CNPJ do comprador (dados de faturamento)
}

const ultimaData = (datas: any[]) => {
  const validas = datas.filter(Boolean).map(d => String(d).slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return validas.length ? validas[validas.length - 1] : null;
};

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Converte o JSON de /orders/:id para o formato do ERP. */
export const lerPedidoMl = (o: any): PedidoMl => {
  const itens: ItemPedidoMl[] = (o?.order_items || []).map((i: any) => ({
    mlbId: String(i?.item?.id || ''),
    titulo: String(i?.item?.title || ''),
    sku: i?.item?.seller_sku ? String(i.item.seller_sku) : null,
    quantidade: num(i?.quantity),
    precoUnitario: num(i?.unit_price),
    // sale_fee vem por unidade
    comissao: r2(num(i?.sale_fee) * num(i?.quantity)),
  }));
  const b = o?.buyer || {};
  const nome = [b.first_name, b.last_name].filter(Boolean).join(' ').trim();
  return {
    id: Number(o?.id),
    status: String(o?.status || ''),
    data: o?.date_closed || o?.date_created || null,
    comprador: (nome ? `${nome}${b.nickname ? ` (${b.nickname})` : ''}` : b.nickname || 'Comprador do Mercado Livre').slice(0, 150),
    total: r2(num(o?.total_amount) || itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0)),
    comissao: r2(itens.reduce((s, i) => s + i.comissao, 0)),
    freteVendedor: 0,
    itens,
    packId: o?.pack_id ? Number(o.pack_id) : null,
    envioId: o?.shipping?.id ? Number(o.shipping.id) : null,
    liberacaoEm: ultimaData((o?.payments || []).map((pg: any) => pg?.money_release_date)),
    documentoTipo: null,
  };
};

/** O que fazer com o pedido conforme o status no ML. */
export const acaoDoStatus = (status: string): 'VENDER' | 'CANCELAR' | 'AGUARDAR' => {
  if (status === 'paid' || status === 'partially_paid' || status === 'partially_refunded') return 'VENDER';
  if (status === 'cancelled' || status === 'invalid') return 'CANCELAR';
  return 'AGUARDAR';   // confirmed, payment_required, payment_in_process...: ainda não pago
};

export interface LigacaoAnuncio { idItem: number; idUnidade: number | null }

/**
 * Item do ERP de cada linha: pelo anúncio ligado (MLB) e, se não houver, pelo SKU do anúncio.
 * Devolve as linhas prontas e as que não acharam item.
 */
export const ligarItensDoPedido = (
  p: PedidoMl, porMlb: Map<string, LigacaoAnuncio>, porSku: Map<string, number>
) => {
  const linhas: Array<{ idItem: number; idUnidade: number | null; quantidade: number; precoUnitario: number; mlbId: string; titulo: string }> = [];
  const semItem: ItemPedidoMl[] = [];
  for (const i of p.itens) {
    const lig = porMlb.get(i.mlbId) || (i.sku && porSku.has(i.sku.trim().toUpperCase()) ? { idItem: porSku.get(i.sku.trim().toUpperCase())!, idUnidade: null } : null);
    if (!lig) { semItem.push(i); continue; }
    linhas.push({ idItem: lig.idItem, idUnidade: lig.idUnidade, quantidade: i.quantidade, precoUnitario: i.precoUnitario, mlbId: i.mlbId, titulo: i.titulo });
  }
  return { linhas, semItem };
};

/** Valor que o ML repassa: itens menos comissão e frete pago pelo vendedor. */
export const liquidoDoPedido = (p: Pick<PedidoMl, 'total' | 'comissao' | 'freteVendedor'>) => r2(p.total - p.comissao - p.freteVendedor);

/** Percentual da comissão sobre o total (para o pagamento da venda). */
export const percentualComissao = (p: Pick<PedidoMl, 'total' | 'comissao'>) => (p.total > 0 ? Math.round((p.comissao / p.total) * 1000000) / 10000 : 0);

/** Tipo do documento do comprador nos dados de faturamento do ML (/orders/:id/billing_info). */
export const tipoDocumento = (b: any): string | null => {
  const info = b?.billing_info || b;
  const tipo = String(info?.doc_type || info?.identification?.type || '').toUpperCase();
  if (tipo === 'CPF' || tipo === 'CNPJ') return tipo;
  const digitos = String(info?.doc_number || info?.identification?.number || '').replace(/\D/g, '');
  return digitos.length === 14 ? 'CNPJ' : digitos.length === 11 ? 'CPF' : null;
};

/** MEI: nota obrigatória quando o comprador é empresa (CNPJ). */
export const exigeNota = (documentoTipo: string | null | undefined) => documentoTipo === 'CNPJ';

/** Vencimento do título a receber: a data de liberação do ML ou, sem ela ainda, 28 dias depois da venda (estimativa). */
export const vencimentoDoRecebivel = (p: Pick<PedidoMl, 'liberacaoEm' | 'data'>) => {
  if (p.liberacaoEm) return { data: p.liberacaoEm, estimado: false };
  const base = p.data ? new Date(p.data) : new Date();
  const d = new Date(base.getTime() + 28 * 24 * 3600 * 1000);
  const dois = (n: number) => String(n).padStart(2, '0');
  return { data: `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`, estimado: true };
};

/** Pedido já virado venda, com o custo do ERP gravado na venda (para o resultado real). */
export interface PedidoComCusto { total: number; comissao: number; frete: number; custo: number; itens: Pick<ItemPedidoMl, 'mlbId' | 'titulo' | 'quantidade' | 'precoUnitario' | 'comissao'>[] }

export interface ResultadoAnuncio {
  mlbId: string; titulo: string; pedidos: number; unidades: number; receita: number; comissao: number; frete: number;
  custo: number; recebido: number; lucro: number; lucroSobreCustoPct: number | null; fretePorPedido: number;
}

/**
 * Resultado real por anúncio (MLB): o que foi vendido, a tarifa e o frete cobrados de verdade, o custo do ERP e o lucro.
 * Pedido com vários anúncios: frete e custo divididos pelo valor de cada linha; a comissão é a da própria linha.
 */
export const resultadoPorAnuncio = (pedidos: PedidoComCusto[]): ResultadoAnuncio[] => {
  const grupos = new Map<string, ResultadoAnuncio>();
  for (const p of pedidos) {
    const totalLinhas = p.itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
    for (const i of p.itens) {
      const valor = i.precoUnitario * i.quantidade;
      const parte = totalLinhas > 0 ? valor / totalLinhas : 1 / p.itens.length;
      const g = grupos.get(i.mlbId) || {
        mlbId: i.mlbId, titulo: i.titulo, pedidos: 0, unidades: 0, receita: 0, comissao: 0, frete: 0, custo: 0, recebido: 0, lucro: 0, lucroSobreCustoPct: null, fretePorPedido: 0,
      };
      g.pedidos += 1;
      g.unidades += i.quantidade;
      g.receita += valor;
      g.comissao += i.comissao || p.comissao * parte;
      g.frete += p.frete * parte;
      g.custo += p.custo * parte;
      grupos.set(i.mlbId, g);
    }
  }
  return [...grupos.values()].map(g => {
    const receita = r2(g.receita), comissao = r2(g.comissao), frete = r2(g.frete), custo = r2(g.custo);
    const recebido = r2(receita - comissao - frete);
    const lucro = r2(recebido - custo);
    return {
      ...g, receita, comissao, frete, custo, recebido, lucro,
      lucroSobreCustoPct: custo > 0 ? r2((lucro / custo) * 100) : null, fretePorPedido: g.pedidos ? r2(frete / g.pedidos) : 0,
    };
  }).sort((a, b) => a.lucro - b.lucro);
};
