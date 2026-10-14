import assert from 'assert';
import { acaoDoStatus, exigeNota, ligarItensDoPedido, liquidoDoPedido, lerPedidoMl, percentualComissao, resultadoPorAnuncio, tipoDocumento, vencimentoDoRecebivel } from './pedidos';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const pedido = {
  id: 2000009876543210, status: 'paid', date_created: '2026-10-13T15:00:00.000-04:00', date_closed: '2026-10-13T15:01:00.000-04:00',
  total_amount: 72.9, pack_id: null, shipping: { id: 44556677 },
  buyer: { id: 1, nickname: 'COMPRADOR123', first_name: 'Maria', last_name: 'Silva' },
  order_items: [
    { item: { id: 'MLB7804962608', title: 'Abraçadeira 3.6x100', seller_sku: 'ABR-3.6-100' }, quantity: 2, unit_price: 15, sale_fee: 1.8 },
    { item: { id: 'MLB5384283051', title: 'Disco c/12', seller_sku: '1460' }, quantity: 1, unit_price: 42.9, sale_fee: 5.15 },
  ],
};

teste('pedido do ML no formato do ERP', () => {
  const p = lerPedidoMl(pedido);
  assert.strictEqual(p.comprador, 'Maria Silva (COMPRADOR123)');
  assert.strictEqual(p.total, 72.9);
  assert.strictEqual(p.comissao, 8.75);           // 1.80×2 + 5.15
  assert.strictEqual(p.itens[0].comissao, 3.6);
  assert.strictEqual(p.data, '2026-10-13T15:01:00.000-04:00');
  assert.strictEqual(p.envioId, 44556677);
  assert.strictEqual(lerPedidoMl({ ...pedido, buyer: { nickname: 'XYZ' } }).comprador, 'XYZ');
});

teste('o que cada status vira', () => {
  assert.strictEqual(acaoDoStatus('paid'), 'VENDER');
  assert.strictEqual(acaoDoStatus('cancelled'), 'CANCELAR');
  assert.strictEqual(acaoDoStatus('payment_required'), 'AGUARDAR');
  assert.strictEqual(acaoDoStatus('confirmed'), 'AGUARDAR');
});

teste('itens ligados pelo anúncio e, sem anúncio, pelo SKU', () => {
  const p = lerPedidoMl(pedido);
  const porMlb = new Map([['MLB5384283051', { idItem: 799, idUnidade: 9 }]]);
  const porSku = new Map([['ABR-3.6-100', 16]]);
  const r = ligarItensDoPedido(p, porMlb, porSku);
  assert.deepStrictEqual(r.linhas.map(l => [l.idItem, l.idUnidade, l.quantidade, l.precoUnitario]), [[16, null, 2, 15], [799, 9, 1, 42.9]]);
  assert.strictEqual(r.semItem.length, 0);
  const sem = ligarItensDoPedido(p, new Map(), new Map());
  assert.strictEqual(sem.semItem.length, 2);
});

teste('líquido e percentual da comissão', () => {
  assert.strictEqual(liquidoDoPedido({ total: 72.9, comissao: 8.75, freteVendedor: 10 }), 54.15);
  assert.strictEqual(percentualComissao({ total: 100, comissao: 12 }), 12);
  assert.strictEqual(percentualComissao({ total: 0, comissao: 0 }), 0);
});

teste('liberação do dinheiro e vencimento do título', () => {
  const p = lerPedidoMl({ ...pedido, payments: [{ money_release_date: '2026-11-02T10:00:00.000-04:00' }, { money_release_date: null }] });
  assert.strictEqual(p.liberacaoEm, '2026-11-02');
  assert.deepStrictEqual(vencimentoDoRecebivel(p), { data: '2026-11-02', estimado: false });
  const sem = vencimentoDoRecebivel({ liberacaoEm: null, data: '2026-10-13T15:01:00.000-03:00' });
  assert.deepStrictEqual(sem, { data: '2026-11-10', estimado: true });
});

teste('comprador CNPJ exige nota (MEI)', () => {
  assert.strictEqual(tipoDocumento({ billing_info: { doc_type: 'CNPJ', doc_number: '12345678000199' } }), 'CNPJ');
  assert.strictEqual(tipoDocumento({ billing_info: { doc_number: '123.456.789-09' } }), 'CPF');
  assert.strictEqual(tipoDocumento({}), null);
  assert.ok(exigeNota('CNPJ') && !exigeNota('CPF') && !exigeNota(null));
});

teste('resultado real por anúncio (frete e custo divididos pelo valor da linha)', () => {
  const r = resultadoPorAnuncio([
    { total: 42.9, comissao: 7.29, frete: 14.45, custo: 23.88, itens: [{ mlbId: 'MLB1', titulo: 'Disco c/12', quantidade: 1, precoUnitario: 42.9, comissao: 7.29 }] },
    { total: 72.9, comissao: 8.75, frete: 10, custo: 34.88, itens: [
      { mlbId: 'MLB1', titulo: 'Disco c/12', quantidade: 1, precoUnitario: 42.9, comissao: 7.29 },
      { mlbId: 'MLB2', titulo: 'Abraçadeira', quantidade: 2, precoUnitario: 15, comissao: 1.46 },
    ] },
  ]);
  const disco = r.find(x => x.mlbId === 'MLB1')!;
  assert.deepStrictEqual([disco.pedidos, disco.unidades, disco.receita, disco.comissao, disco.frete, disco.custo, disco.recebido, disco.lucro], [2, 2, 85.8, 14.58, 20.33, 44.41, 50.89, 6.48]);
  assert.strictEqual(disco.fretePorPedido, 10.16);
  const abr = r.find(x => x.mlbId === 'MLB2')!;
  assert.deepStrictEqual([abr.receita, abr.frete, abr.custo, abr.lucro], [30, 4.12, 14.35, 10.07]);
  assert.strictEqual(r[0].mlbId, 'MLB1');
});
