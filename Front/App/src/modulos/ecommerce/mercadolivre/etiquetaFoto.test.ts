import assert from 'assert';
import { camposDoItem, converterMedidas, modeloPadrao, textoDoModelo } from './etiquetaFoto';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const det: any = {
  eixos: ['LENGTH'],
  atributosCategoria: [{ id: 'LENGTH', nome: 'Comprimento' }, { id: 'WIDTH', nome: 'Largura' }],
  atributosErp: [{ id: 7, nome: 'Largura' }, { id: 9, nome: 'Material' }, { id: 11, nome: 'Comprimento' }],
};
const item: any = { valores: { LENGTH: { valor: '200', unidade: 'mm', valorId: null } }, valoresErp: { 7: '3,6 mm', 9: 'Nylon', 11: '200 mm' } };

teste('campos do item: o que varia no anúncio e o cadastro, sem repetir', () => {
  assert.deepStrictEqual(camposDoItem(det, item), [
    { chave: 'Comprimento', nome: 'Comprimento', valor: '200 mm' },
    { chave: 'Largura', nome: 'Largura', valor: '3,6 mm' },
    { chave: 'Material', nome: 'Material', valor: 'Nylon' },
  ]);
});

teste('modelo com {Campo}', () => {
  const campos = camposDoItem(det, item);
  assert.strictEqual(modeloPadrao(det), '{Comprimento}');
  assert.strictEqual(textoDoModelo('{comprimento}', campos), '200 mm');
  assert.strictEqual(textoDoModelo('{Comprimento} x {Largura} · {Cor}', campos), '200 mm x 3,6 mm');
  assert.strictEqual(textoDoModelo('{Cor} · {Comprimento}', campos), '200 mm');
  assert.strictEqual(textoDoModelo('Abraçadeira {Material}', campos), 'Abraçadeira Nylon');
});

teste('converte medidas de unidade', () => {
  assert.strictEqual(converterMedidas('200 mm', 'cm'), '20 cm');
  assert.strictEqual(converterMedidas('200 mm x 3,6 mm', 'cm'), '20 cm x 0,36 cm');
  assert.strictEqual(converterMedidas('1,5 m', 'cm'), '150 cm');
  assert.strictEqual(converterMedidas('12cm', 'mm'), '120 mm');
  assert.strictEqual(converterMedidas('3/8" JIC', 'cm'), '3/8" JIC');
  assert.strictEqual(converterMedidas('200 mm', 'original'), '200 mm');
});
