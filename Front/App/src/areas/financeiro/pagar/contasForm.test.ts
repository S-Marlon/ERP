import assert from 'assert';
import { opcoesDeCategoria, primeiroMesSugerido } from './contasForm';
import type { CategoriaConta } from './pagarApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('contas: primeiro mês sugerido', () => {
  assert.strictEqual(primeiroMesSugerido('2026-10-20', 25), '2026-10');   // ainda vai vencer neste mês
  assert.strictEqual(primeiroMesSugerido('2026-10-20', 20), '2026-10');   // vence hoje
  assert.strictEqual(primeiroMesSugerido('2026-10-20', 10), '2026-11');   // já passou
  assert.strictEqual(primeiroMesSugerido('2026-12-20', 5), '2027-01');
  assert.strictEqual(primeiroMesSugerido('2026-02-28', 31), '2026-02');   // dia 31 em fevereiro vence dia 28
});

teste('contas: opções de categoria por grupo', () => {
  const c = (idCategoria: number, grupo: string, nome: string, ativo = true, tipo: CategoriaConta['tipo'] = 'DESPESA'): CategoriaConta =>
    ({ idCategoria, grupo, nome, ativo, tipo, uso: 0 });
  const lista = [c(1, 'Consumo', 'Água'), c(2, 'Ocupação', 'Aluguel'), c(3, 'Consumo', 'Gás', false), c(4, 'Outras', 'Outras receitas', true, 'RECEITA')];
  assert.deepStrictEqual(opcoesDeCategoria(lista), [
    { label: 'Consumo', options: [{ value: 1, label: 'Água' }] }, { label: 'Ocupação', options: [{ value: 2, label: 'Aluguel' }] },
  ]);
  assert.strictEqual(opcoesDeCategoria(lista, 'DESPESA', 3)[0].options.length, 2);   // a desativada já escolhida aparece
});
