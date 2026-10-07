import { marcaEfetiva, marcaReal, papelMarca, pendenciaMarca, resolverMarcaInformada } from './marcaFamilia';
import { avaliarSaudeFamilia } from './saudeFamilia';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runMarcaFamiliaTests = (): void => {
  assert(papelMarca('grade') === 'grade' && papelMarca('') === 'ficha' && papelMarca('core') === 'ficha', 'Papel inválido vira ficha.');
  assert(!marcaReal('Sem Marca') && !marcaReal('') && marcaReal('Ebara'), '"Sem Marca" não conta como marca.');

  assert(marcaEfetiva('dna', 'Ebara', 'Schneider') === 'Ebara', 'DNA: vale a marca da família.');
  assert(marcaEfetiva('grade', 'Ebara', 'Schneider') === 'Schneider', 'Grade: vale a marca do item.');
  assert(marcaEfetiva('grade', 'Ebara', 'Sem Marca') === '', 'Grade sem marca no item fica vazia (não usa a da família).');
  assert(marcaEfetiva('ficha', 'Ebara', '') === 'Ebara' && marcaEfetiva('ficha', 'Ebara', 'Gadan') === 'Gadan', 'Ficha: a do item, senão a da família.');

  assert(pendenciaMarca('grade', 'Ebara', 'Sem Marca', false)?.motivo.includes('gera variação') === true, 'Grade exige marca no item.');
  assert(pendenciaMarca('grade', null, 'Ebara', true) === null, 'Grade com marca no item está ok.');
  assert(pendenciaMarca('dna', 'Sem Marca', 'Ebara', false)?.motivo.includes('DNA') === true, 'DNA exige marca na família.');
  assert(pendenciaMarca('ficha', null, null, false) === null, 'Ficha sem marca e sem {MARCA} não pendura.');
  assert(pendenciaMarca('ficha', null, null, true)?.motivo.includes('código/nome') === true, 'Template com {MARCA} exige alguma marca.');

  const marcas = [{ id: 1, nome: 'Sem Marca' }, { id: 5, nome: 'Ebara' }];
  const r1 = resolverMarcaInformada('ebara', marcas);
  assert(r1.ok && r1.marca?.id === 5, 'Resolve a marca pelo nome, sem diferenciar maiúsculas.');
  const r2 = resolverMarcaInformada('5', marcas);
  assert(r2.ok && r2.marca?.nome === 'Ebara', 'Resolve a marca pelo id.');
  const r3 = resolverMarcaInformada('Schneider', marcas);
  assert(!r3.ok && r3.erro.includes('não cadastrada'), 'Marca inexistente é recusada.');
  const r4 = resolverMarcaInformada('  ', marcas);
  assert(r4.ok && r4.marca === null, 'Vazio não altera a marca.');

  // Saúde: DNA sem marca bloqueia; grade sem {MARCA} no código avisa
  const grade = [{ id: '1', nome: 'Potência', classificacao: 'grade', obrigatorio: true }];
  const dna = avaliarSaudeFamilia({ status: 'ATIVO', comportamentoMarca: 'dna', nomeMarca: 'Sem Marca', templateSku: '{Potência}' }, grade);
  assert(dna.bloqueios.some(b => b.codigo === 'MARCA_DNA_SEM_VALOR'), 'Marca DNA sem marca definida bloqueia a família.');
  const g = avaliarSaudeFamilia({ status: 'ATIVO', comportamentoMarca: 'grade', templateSku: '{Potência}' }, grade);
  assert(g.saudavel && g.avisos.some(a => a.codigo === 'MARCA_FORA_DO_CODIGO'), 'Marca grade fora do SKU gera aviso.');
  const g2 = avaliarSaudeFamilia({ status: 'ATIVO', comportamentoMarca: 'grade', templateSku: '{Potência}-{MARCA}' }, grade);
  assert(!g2.avisos.some(a => a.codigo === 'MARCA_FORA_DO_CODIGO'), 'Com {MARCA} no SKU, sem aviso.');
};
