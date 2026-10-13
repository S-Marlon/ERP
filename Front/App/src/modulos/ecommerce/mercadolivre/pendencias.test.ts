import assert from 'assert';
import { agruparPendencias } from './pendencias';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('pendências iguais por item viram uma linha', () => {
  const skus = new Map([[1, 'A-1'], [2, 'A-2']]);
  const g = agruparPendencias([
    { nivel: 'aviso', area: 'itens', texto: 'A-1: sem estoque.', idItem: 1 },
    { nivel: 'erro', area: 'itens', texto: 'A-1: sem foto.', idItem: 1 },
    { nivel: 'erro', area: 'itens', texto: 'A-2: sem foto.', idItem: 2 },
    { nivel: 'erro', area: 'dados', texto: 'Escolha a categoria.' },
    { nivel: 'erro', area: 'atributos', texto: 'A-1 e A-2 ficam iguais.', idItem: 2 },
  ], skus);
  assert.deepStrictEqual(g.map(x => [x.nivel, x.texto, x.skus.join(',')]), [
    ['erro', 'sem foto.', 'A-1,A-2'],
    ['erro', 'Escolha a categoria.', ''],
    ['erro', 'A-1 e A-2 ficam iguais.', ''],
    ['aviso', 'sem estoque.', 'A-1'],
  ]);
});
