import assert from 'assert';
import { gradeDoKit } from './fotoPixels';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('foto de kit: grade quase quadrada, última linha no meio', () => {
  const g2 = gradeDoKit(2, 1);
  assert.deepStrictEqual([g2.colunas, g2.linhas], [2, 1]);                    // par: lado a lado
  const g10 = gradeDoKit(10, 1);
  assert.deepStrictEqual([g10.colunas, g10.linhas], [4, 3]);                  // 4 + 4 + 2
  assert.deepStrictEqual(g10.posicoes.slice(8), [{ x: 1.5, y: 2.5 }, { x: 2.5, y: 2.5 }]);   // os 2 do fim centralizados
  const g4 = gradeDoKit(4, 1);
  assert.deepStrictEqual([g4.colunas, g4.linhas], [2, 2]);
  const comprido = gradeDoKit(4, 4);                                          // produto 4× mais largo que alto: empilha
  assert.deepStrictEqual([comprido.colunas, comprido.linhas], [1, 4]);
  assert.strictEqual(gradeDoKit(1, 1).posicoes.length, 1);
});
