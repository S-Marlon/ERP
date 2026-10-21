import assert from 'assert';
import { arvoreCategorias, resumoPrevia } from './politicaPrecoTela';
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

teste('varejo e atacado: resumo da prévia', () => {
  const item = (situacao: ItemPrevia['plano']['situacao'], avisos: string[] = []) =>
    ({ plano: { situacao, avisos, erro: null, faixas: [], mexeNoAtacado: true } }) as unknown as ItemPrevia;
  assert.deepStrictEqual(resumoPrevia([item('ALTERA'), item('ALTERA', ['x']), item('IGUAL'), item('ERRO', ['y'])]),
    { total: 4, altera: 2, igual: 1, erro: 1, avisos: 1 });
});
