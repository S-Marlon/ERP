import assert from 'assert';
import type { ItemLogistica } from './logisticaApi';
import { alteracoes, aplicarNosMarcados, valoresDaLinha } from './logisticaTela';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const item = (idItem: number, pesoKg: number | null, medidas: ItemLogistica['medidas'] = null) =>
  ({ idItem, pesoKg, medidas, sku: `S${idItem}`, nome: '', idFamilia: 1, familia: null, marca: null, fotos: 0, fotoFamilia: false, embalagens: { origem: null, regras: [] }, faltas: [] }) as ItemLogistica;

teste('logística: rascunho por cima do gravado e só o que mudou', () => {
  const itens = [item(1, 0.02, { altura: 1, largura: 2, comprimento: 3 }), item(2, null), item(3, null)];
  let r = aplicarNosMarcados({}, [2, 3], { pesoKg: 0.05, altura: null });
  r = { ...r, 1: { pesoKg: 0.02 } };                                    // digitou o mesmo valor: não conta
  assert.deepStrictEqual(valoresDaLinha(itens[1], r), { pesoKg: 0.05, altura: null, largura: null, comprimento: null });
  assert.deepStrictEqual(alteracoes(itens, r).map(a => a.idItem), [2, 3]);
  r = aplicarNosMarcados(r, [1], { altura: 4, largura: 2, comprimento: 3 });
  assert.deepStrictEqual(alteracoes(itens, r)[0], { idItem: 1, pesoKg: 0.02, altura: 4, largura: 2, comprimento: 3 });
});
