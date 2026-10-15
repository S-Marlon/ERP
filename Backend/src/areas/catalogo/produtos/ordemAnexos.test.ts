import { lerPosicao, ordemComNovaNaPosicao } from './ordemAnexos';

const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(`ordemAnexos: ${msg}`); };

export const runOrdemAnexosTests = () => {
  assert(ordemComNovaNaPosicao([10, 11, 12], 99, 2).join(',') === '10,99,11,12', 'nova como 2ª');
  assert(ordemComNovaNaPosicao([10], 99, 2).join(',') === '10,99', 'só a principal: vira a 2ª');
  assert(ordemComNovaNaPosicao([], 99, 2).join(',') === '99', 'sem fotos: fica sozinha');
  assert(ordemComNovaNaPosicao([10, 11], 99, 9).join(',') === '10,11,99', 'posição além do fim vai para o fim');
  assert(ordemComNovaNaPosicao([10, 99, 11], 99, 3).join(',') === '10,11,99', 'a nova já na lista não repete');
  assert(lerPosicao('2') === 2 && lerPosicao(2) === 2, 'lê número e texto');
  assert(lerPosicao(undefined) === null && lerPosicao('') === null && lerPosicao(0) === null && lerPosicao(1.5) === null, 'inválida vira null');
  console.log('ordemAnexos: ok');
};

if (require.main === module) runOrdemAnexosTests();
