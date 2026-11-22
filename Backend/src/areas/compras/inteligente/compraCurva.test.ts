import assert from 'assert';
import { coberturaDosFundos, CONTEXTO_VAZIO, ItemDoFornecedor, prioridadeDoFornecedor, sugerirComCurva, transferirDemanda } from './compraInteligente';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const item = (x: Partial<ItemDoFornecedor>): ItemDoFornecedor => ({
  idItem: 1, sku: 'S1', nome: 'Item', unidade: 'UN', saldo: 10, minimo: null, maximo: null, vendido: 90,
  codigoFornecedor: 'F1', unidadeCompra: 'UN', fatorCompra: 1, precoCompra: 10, ...x,
});
const p = { dias: 90, coberturaDias: 30, prazoEntregaDias: 0 };

teste('compra com curva: segurança da classe e saldo livre', () => {
  // 1/dia; sem curva: 30 dias − 10 = 20; classe A: 45 − 10 = 35
  assert.strictEqual(sugerirComCurva(item({}), p, CONTEXTO_VAZIO).quantidade, 20);
  const a = sugerirComCurva(item({}), p, { ...CONTEXTO_VAZIO, classe: 'A' });
  assert.deepStrictEqual([a.quantidade, a.seguranca, a.urgencia], [35, 15, 'ACABANDO']);
  // 8 reservados para pedido faturado: livre 2 → 43
  const r = sugerirComCurva(item({}), p, { ...CONTEXTO_VAZIO, classe: 'A', reservado: 8 });
  assert.deepStrictEqual([r.saldo, r.saldoLivre, r.quantidade, r.urgencia], [10, 2, 43, 'ACABANDO']);
  // reservado maior que o saldo: falta para o pedido
  const f = sugerirComCurva(item({ vendido: 0, saldo: 3 }), p, { ...CONTEXTO_VAZIO, classe: 'P', reservado: 8 });
  assert.deepStrictEqual([f.quantidade, f.faltaPedido, f.urgencia], [5, 5, 'FALTA_PEDIDO']);
  assert.strictEqual(sugerirComCurva(item({ saldo: 0 }), p, { ...CONTEXTO_VAZIO, classe: 'B' }).urgencia, 'SEM_ESTOQUE');
});

teste('compra com curva: não recomprar e demanda do equivalente', () => {
  const nr = sugerirComCurva(item({ saldo: 0 }), p, { ...CONTEXTO_VAZIO, classe: 'C', naoRecomprar: true });
  assert.deepStrictEqual([nr.quantidade, nr.urgencia], [0, null]);
  const nrPedido = sugerirComCurva(item({ saldo: 1 }), p, { ...CONTEXTO_VAZIO, naoRecomprar: true, reservado: 4 });
  assert.deepStrictEqual([nrPedido.quantidade, nrPedido.urgencia], [3, 'FALTA_PEDIDO']);
  const extra = transferirDemanda([
    { idItem: 808, sku: 'TETIS', vendido: 3, naoRecomprar: true },
    { idItem: 53, sku: 'EBARA', vendido: 9, naoRecomprar: false },
    { idItem: 900, sku: 'SEM-VENDA', vendido: 0, naoRecomprar: true },
  ], new Map([[808, 53], [900, 53]]));
  assert.deepStrictEqual([...extra.entries()], [[53, { quantidade: 3, de: ['TETIS'] }]]);
  const eb = sugerirComCurva(item({ vendido: 9, saldo: 2 }), p, { ...CONTEXTO_VAZIO, classe: 'A', demandaExtra: 3, substitui: ['TETIS'] });
  assert.strictEqual(eb.quantidade, 4);   // (9+3)/90 × 45 = 6 − 2
});

teste('compra com curva: prioridade do fornecedor e fundos', () => {
  const pr = prioridadeDoFornecedor([
    { urgencia: 'SEM_ESTOQUE', classe: 'A' }, { urgencia: 'FALTA_PEDIDO', classe: 'P' }, { urgencia: 'REPOR', classe: 'C' }, { urgencia: null, classe: 'A' },
  ]);
  assert.deepStrictEqual(pr, { pontos: 18 + 10 + 1, motivo: '1 falta para pedido faturado · 1 item(ns) A sem estoque ou acabando · 1 sem estoque', urgentes: 2 });
  assert.deepStrictEqual(prioridadeDoFornecedor([]), { pontos: 0, motivo: '', urgentes: 0 });
  assert.deepStrictEqual(coberturaDosFundos([{ fundo: { id: 1, nome: 'Bombas' }, valor: 930 }, { fundo: null, valor: 50 }], new Map([[1, 500]])),
    [{ id: 1, nome: 'Bombas', valor: 930, saldo: 500, cobre: 500, falta: 430 }]);
});
