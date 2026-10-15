import { ehImagemDeMedidas, lerIds, lerPosicao, ordemComNovaNaPosicao, ordemFinalDasImagens } from './ordemAnexos';

const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(`ordemAnexos: ${msg}`); };

export const runOrdemAnexosTests = () => {
  assert(ordemComNovaNaPosicao([10, 11, 12], 99, 2).join(',') === '10,99,11,12', 'nova como 2ª');
  assert(ordemComNovaNaPosicao([10], 99, 2).join(',') === '10,99', 'só a principal: vira a 2ª');
  assert(ordemComNovaNaPosicao([], 99, 2).join(',') === '99', 'sem fotos: fica sozinha');
  assert(ordemComNovaNaPosicao([10, 11], 99, 9).join(',') === '10,11,99', 'posição além do fim vai para o fim');
  assert(ordemComNovaNaPosicao([10, 99, 11], 99, 3).join(',') === '10,11,99', 'a nova já na lista não repete');
  assert(lerPosicao('2') === 2 && lerPosicao(2) === 2, 'lê número e texto');
  assert(lerPosicao(undefined) === null && lerPosicao('') === null && lerPosicao(0) === null && lerPosicao(1.5) === null, 'inválida vira null');

  assert(ehImagemDeMedidas('ABR-3.6-100-editada.jpg') && ehImagemDeMedidas('6204-ZZ-medida.jpg'), 'imagens geradas');
  assert(!ehImagemDeMedidas('Img_ftr_rp_300601-1160x1160.PNG') && !ehImagemDeMedidas('editada.jpg') && !ehImagemDeMedidas(null), 'fotos comuns');

  const fotos = [{ id: 1, medidas: false }, { id: 2, medidas: false }, { id: 3, medidas: true }, { id: 4, medidas: false }];
  assert(ordemFinalDasImagens(fotos).join(',') === '1,3,2,4', 'medidas sobe para 2ª');
  assert(ordemFinalDasImagens(fotos, [4, 2, 1, 3]).join(',') === '4,3,2,1', 'ordem pedida, medidas logo depois da principal');
  assert(ordemFinalDasImagens(fotos, [3, 1]).join(',') === '3,1,2,4', 'medidas como principal fica principal; faltantes no fim');
  assert(ordemFinalDasImagens(fotos, [2, 99, 2]).join(',') === '2,3,1,4', 'id de fora e repetido saem');
  assert(ordemFinalDasImagens([]).length === 0, 'sem fotos');

  assert(lerIds('3,1,3,x,-2,0').join(',') === '3,1', 'ids em texto');
  assert(lerIds([5, '6', 6.5]).join(',') === '5,6', 'ids em lista');
  console.log('ordemAnexos: ok');
};

if (require.main === module) runOrdemAnexosTests();
