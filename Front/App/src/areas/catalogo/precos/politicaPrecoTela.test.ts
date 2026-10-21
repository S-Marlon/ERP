import assert from 'assert';
import { arvoreCategorias, familiasDaCategoria, resumoPrevia } from './politicaPrecoTela';
import type { ItemPrevia } from './politicaPrecoApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('varejo e atacado: árvore de categorias', () => {
  const a = arvoreCategorias([
    { id: 1, nome: 'Transmissão', idPai: null }, { id: 2, nome: 'Rolamentos', idPai: 1 }, { id: 3, nome: 'Correias', idPai: 1 },
    { id: 4, nome: 'Hidráulica', idPai: null }, { id: 5, nome: 'Órfã', idPai: 99 },
  ]);
  assert.deepStrictEqual(a.map(n => n.title), ['Hidráulica', 'Órfã', 'Transmissão']);   // pai que não existe vira raiz
  assert.deepStrictEqual(a[2].children?.map(n => n.title), ['Correias', 'Rolamentos']);
  assert.strictEqual(a[0].children, undefined);
});

teste('varejo e atacado: famílias da categoria e das subcategorias', () => {
  const opcoes = {
    categorias: [{ id: 1, nome: 'Transmissão', idPai: null }, { id: 2, nome: 'Rolamentos', idPai: 1 }, { id: 3, nome: 'Esferas', idPai: 2 }, { id: 4, nome: 'Hidráulica', idPai: null }],
    familias: [
      { id: 10, nome: 'Rolamento 608', itens: 11, categorias: [3] }, { id: 11, nome: 'Rolamento 6004', itens: 4, categorias: [2] },
      { id: 12, nome: 'Mangueira R2', itens: 9, categorias: [4] }, { id: 13, nome: 'Sem categoria', itens: 1, categorias: [] },
    ],
    marcas: [],
  };
  assert.deepStrictEqual(familiasDaCategoria(opcoes, 2).map(f => f.id), [10, 11]);   // Rolamentos + Esferas
  assert.deepStrictEqual(familiasDaCategoria(opcoes, 1).map(f => f.id), [10, 11]);   // Transmissão inteira
  assert.deepStrictEqual(familiasDaCategoria(opcoes, 3).map(f => f.id), [10]);
  assert.strictEqual(familiasDaCategoria(opcoes, null).length, 4);
});

teste('varejo e atacado: resumo da prévia', () => {
  const item = (situacao: ItemPrevia['plano']['situacao'], avisos: string[] = []) =>
    ({ plano: { situacao, avisos, erro: null, faixas: [], mexeNoAtacado: true } }) as unknown as ItemPrevia;
  assert.deepStrictEqual(resumoPrevia([item('ALTERA'), item('ALTERA', ['x']), item('IGUAL'), item('ERRO', ['y'])]),
    { total: 4, altera: 2, igual: 1, erro: 1, avisos: 1 });
});
