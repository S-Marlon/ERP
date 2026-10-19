import assert from 'assert';
import type { CartItem } from '../types/cart.types';
import { faltaNaLinha, linhasSemEstoque } from './estoqueCarrinho';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const linha = (c: Partial<CartItem>) => ({ id: 1, name: 'Rolamento 6200', type: 'product', quantity: 1, price: 10, stock: 0, ...c }) as CartItem;

teste('estoque no carrinho: quanto falta por linha', () => {
  assert.strictEqual(faltaNaLinha(linha({ stock: 0, quantity: 2 })), 2);
  assert.strictEqual(faltaNaLinha(linha({ stock: 3, quantity: 5 })), 2);
  assert.strictEqual(faltaNaLinha(linha({ stock: 3, quantity: 3 })), 0);
  assert.strictEqual(faltaNaLinha(linha({ stock: -2, quantity: 1 })), 1);              // saldo negativo conta como zero
  assert.strictEqual(faltaNaLinha(linha({ stock: 1.5, quantity: 2.25 })), 0.75);       // fracionado (metro)
  assert.strictEqual(faltaNaLinha(linha({ podeVenderSemEstoque: true, quantity: 9 })), 0);
  assert.strictEqual(faltaNaLinha(linha({ type: 'service', quantity: 9 })), 0);
  assert.strictEqual(faltaNaLinha(linha({ stock: undefined, quantity: 9 })), 0);
  assert.deepStrictEqual(linhasSemEstoque([linha({ id: 1, stock: 5 }), linha({ id: 2, quantity: 2 })]).map(l => [l.item.id, l.falta]), [[2, 2]]);
});
