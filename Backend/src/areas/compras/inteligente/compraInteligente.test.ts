import assert from 'assert';
import { completarPedidoMinimo, coberturaDias, embalagens, ItemDoFornecedor, sugerirItem, textoDoPedido, totalDoPedido } from './compraInteligente';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const base: ItemDoFornecedor = {
  idItem: 1, sku: 'WAP-1', nome: 'MANGUEIRA WAP', unidade: 'M', saldo: 10, minimo: null, maximo: null, vendido: 90,
  codigoFornecedor: 'F-100', unidadeCompra: 'RL', fatorCompra: 50, precoCompra: 200,
};
const p = { dias: 90, coberturaDias: 30, prazoEntregaDias: 5 };

teste('embalagens inteiras e cobertura', () => {
  assert.strictEqual(embalagens(51, 50), 2);
  assert.strictEqual(embalagens(50, 50), 1);
  assert.strictEqual(embalagens(0, 50), 0);
  assert.strictEqual(embalagens(3, 0), 3); // fator inválido vira 1
  assert.strictEqual(coberturaDias(10, 1), 10);
  assert.strictEqual(coberturaDias(10, 0), null);
});

teste('sugestão pelo giro', () => {
  // 1 m/dia; alvo 35 m; saldo 10 → falta 25 m → 1 rolo de 50 m
  const s = sugerirItem(base, p);
  assert.strictEqual(s.consumoDia, 1);
  assert.strictEqual(s.coberturaAtual, 10);
  assert.strictEqual(s.necessidadeBase, 25);
  assert.strictEqual(s.quantidade, 1);
  assert.strictEqual(s.valor, 200);
  assert.strictEqual(s.motivo, 'COBERTURA');
  // sem giro e sem mínimo: não sugere
  assert.strictEqual(sugerirItem({ ...base, vendido: 0 }, p).quantidade, 0);
});

teste('abaixo do mínimo repõe até o máximo', () => {
  const s = sugerirItem({ ...base, vendido: 0, saldo: 2, minimo: 20, maximo: 120 }, p);
  assert.strictEqual(s.motivo, 'ABAIXO_MINIMO');
  assert.strictEqual(s.necessidadeBase, 118);
  assert.strictEqual(s.quantidade, 3);
});

teste('completa o pedido mínimo pelo item que acaba primeiro', () => {
  const itens = [
    sugerirItem(base, p),                                                                   // 1 rolo, R$ 200
    sugerirItem({ ...base, idItem: 2, codigoFornecedor: 'F-200', saldo: 5, vendido: 45, fatorCompra: 10, precoCompra: 50 }, p), // 0,5/dia
    sugerirItem({ ...base, idItem: 3, codigoFornecedor: 'F-300', saldo: 100, vendido: 0, fatorCompra: 1, precoCompra: 10 }, p),  // parado
  ];
  const atuais = new Map(itens.map(i => [i.idItem, i.quantidade]));
  assert.strictEqual(totalDoPedido(itens.map(i => ({ quantidade: atuais.get(i.idItem)!, precoCompra: i.precoCompra }))), 300);
  const r = completarPedidoMinimo(itens, atuais, 600);
  assert.ok(r.total >= 600, String(r.total));
  assert.strictEqual(r.falta, 0);
  assert.ok(!r.acrescentados.has(3), 'item parado não entra');
  // limite de cobertura impede comprar demais: com limite baixo não chega
  const curto = completarPedidoMinimo(itens, atuais, 5000, 60);
  assert.ok(curto.falta > 0);
});

teste('texto só com código e quantidade', () => {
  const t = textoDoPedido('Hilik', [
    { codigoFornecedor: 'F-100', nome: 'X', quantidade: 2, unidadeCompra: 'RL' },
    { codigoFornecedor: null, nome: 'ABRAÇADEIRA 1/2', quantidade: 1.5, unidadeCompra: 'CX' },
    { codigoFornecedor: 'F-300', nome: 'Y', quantidade: 0, unidadeCompra: 'UN' },
  ]);
  assert.ok(t.includes('F-100 - 2 RL'));
  assert.ok(t.includes('(sem código) ABRAÇADEIRA 1/2 - 1,5 CX'));
  assert.ok(!t.includes('F-300'));
  assert.ok(t.includes('2 item(ns).'));
});
