import assert from 'assert';
import { codigoCliente, embalagem, precoPorBase, secoesDaProposta } from './propostaNegociacao';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('proposta: embalagem e preço por unidade base', () => {
  assert.strictEqual(embalagem('CX', 24, 'L'), 'CX (24 L)');
  assert.strictEqual(embalagem('UN', 1, 'UN'), 'UN');
  assert.strictEqual(precoPorBase(429.12, 24, 'L'), 'R$ 17,88/L');
  assert.strictEqual(precoPorBase(10, 1, 'UN'), null);
  assert.strictEqual(codigoCliente(43835), 'C43835');
  assert.strictEqual(codigoCliente(7), 'C00007');
  assert.strictEqual(codigoCliente(null), null);
});

teste('proposta: seções por categoria e faixas', () => {
  const item = (x: any) => ({ idItem: 1, sku: 'S', nome: 'N', idUnidade: 1, unidade: 'CX', quantidade: 1, precoTabela: 0, precoUnitario: 480, desconto: 0, total: 480, fator: 24, siglaBase: 'L', ...x });
  const s = secoesDaProposta({ itens: [
    item({ categoria: '🛢️ Óleos', faixas: [{ quantidadeMinima: 10, precoUnitario: 456 }] }),
    item({ categoria: null, sku: 'X' }),
    item({ categoria: 'Graxas', sku: 'G' }),
    item({ categoria: '🛢️ Óleos', sku: 'O2' }),
  ] });
  assert.deepStrictEqual(s.map(x => [x.titulo, x.itens.length]), [['Óleos', 2], ['Graxas', 1], ['Outros itens', 1]]);
  assert.deepStrictEqual(s[0].itens[0].faixas, ['A partir de 10 CX: R$ 456,00 (R$ 19,00/L)']);
  assert.strictEqual(s[0].itens[0].valorBase, 'R$ 20,00/L');
  assert.strictEqual(s[0].itens[0].embalagem, 'CX (24 L)');
});
