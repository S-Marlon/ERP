import assert from 'assert';
import { csvPedido, situacaoMinimo, textoPedido, totalPedido } from './pedidoCompra';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const linhas = [
  { codigoFornecedor: 'F-100', nome: 'MANGUEIRA WAP', quantidade: 2, unidadeCompra: 'RL', precoCompra: 100.005 },
  { codigoFornecedor: null, nome: 'ABRAÇADEIRA; 1/2', quantidade: 1.5, unidadeCompra: 'CX', precoCompra: 40 },
  { codigoFornecedor: 'F-300', nome: 'X', quantidade: 0, unidadeCompra: 'UN', precoCompra: 9 },
];

teste('total arredonda por linha', () => assert.strictEqual(totalPedido(linhas), 260.01));

teste('pedido mínimo', () => {
  assert.deepStrictEqual(situacaoMinimo(200, 600), { falta: 400, percentual: 33, atinge: false });
  assert.deepStrictEqual(situacaoMinimo(650, 600), { falta: 0, percentual: 100, atinge: true });
  assert.deepStrictEqual(situacaoMinimo(10, 0), { falta: 0, percentual: 100, atinge: true });
});

teste('texto e CSV só com o que tem quantidade', () => {
  const t = textoPedido('Hilik', linhas);
  assert.ok(t.includes('F-100 - 2 RL'));
  assert.ok(t.includes('(sem código) ABRAÇADEIRA; 1/2 - 1,5 CX'));
  assert.ok(!t.includes('F-300'));
  const csv = csvPedido(linhas).split('\r\n');
  assert.strictEqual(csv.length, 3);
  assert.strictEqual(csv[1], 'F-100;2;RL;MANGUEIRA WAP');
  assert.strictEqual(csv[2], ';1,5;CX;"ABRAÇADEIRA; 1/2"');
});
