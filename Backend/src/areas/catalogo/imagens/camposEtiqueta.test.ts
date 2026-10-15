import { camposQueVariam, modeloPadraoDosCampos } from './camposEtiqueta';

const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(`camposEtiqueta: ${msg}`); };

export const runCamposEtiquetaTests = () => {
  const item = (comp: string, larg = '3,6 mm', cor = 'Preta') => ({ campos: [{ chave: 'Comprimento', nome: 'Comprimento', valor: comp }, { chave: 'Largura', nome: 'Largura', valor: larg }, { chave: 'Cor', nome: 'Cor', valor: cor }] });
  assert(camposQueVariam([item('100 mm'), item('150 mm'), item('200 mm')]).join() === 'Comprimento', 'só o comprimento varia');
  assert(camposQueVariam([item('100 mm'), item('200 mm', '7,2 mm')]).join() === 'Comprimento,Largura', 'dois variam');
  assert(camposQueVariam([item('100 mm')]).length === 0, 'um item só não varia');
  assert(camposQueVariam([item('100 mm'), { campos: [{ chave: 'comprimento', nome: 'comprimento', valor: '100 mm' }, { chave: 'Largura', nome: 'Largura', valor: '3,6 mm' }, { chave: 'Cor', nome: 'Cor', valor: 'Preta' }] }]).length === 0, 'nome sem diferença de maiúscula');
  assert(modeloPadraoDosCampos(['Comprimento', 'Largura', 'Cor']) === '{Comprimento} · {Largura}', 'modelo com até dois campos');
  assert(modeloPadraoDosCampos(['Cor', 'Largura', 'Quantidade', 'Tamanho']) === '{Tamanho} · {Largura}', 'medidas antes da cor');
  console.log('camposEtiqueta: ok');
};

if (require.main === module) runCamposEtiquetaTests();
