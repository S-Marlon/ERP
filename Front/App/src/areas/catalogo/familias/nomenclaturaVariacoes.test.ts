import {
  atributosNosTemplates, avaliarVariacao, CHAVE_MARCA, FamiliaNomenclatura, montarTexto, skusRepetidos, valoresMudaram,
} from './nomenclaturaVariacoes';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const atributos = [
  { id: '10', nome: 'Rosca', classificacao: 'grade', tipoDado: 'lista', opcoesValidas: [{ valor: '1.1/16"-12' }, { valor: '3/4"-16' }] },
  { id: '11', nome: 'Mangueira', codigo: 'MANG', classificacao: 'grade', tipoDado: 'lista', opcoesValidas: ['1/2"', '3/4"'] },
  { id: '12', nome: 'Ângulo', classificacao: 'dna', tipoDado: 'texto', valorPadraoFamilia: '90°' },
  { id: '13', nome: 'Pressão', classificacao: 'ficha', tipoDado: 'decimal', obrigatorio: true },
];
const familia: FamiliaNomenclatura = {
  nome: 'TERMINAL PRENSÁVEL JIC 37°', siglaSku: '190FJ', separadorSku: '-',
  templateNomeComercial: '{FAMILIA} - FÊMEA GIRATÓRIA {Ângulo} - {Rosca} - {Mangueira}',
  templateSku: '{SIGLA}{S}{Rosca}{S}{MANG}', papelMarca: 'ficha', marca: 'Sem Marca',
};

const linha = (valores: Record<string, unknown>, skuAtual = '', nomeAtual = '') => ({ idItem: '1', skuAtual, nomeAtual, valores });

export const runNomenclaturaTests = (): void => {
  const v = { '10': '1.1/16"-12', '11': '1/2"', '13': '3000.000000' };
  assert(montarTexto(familia.templateNomeComercial, familia, atributos, v) === 'TERMINAL PRENSÁVEL JIC 37° - FÊMEA GIRATÓRIA 90° - 1.1/16"-12 - 1/2"',
    'Nome com o DNA padrão da família e a grade do item.');
  assert(montarTexto(familia.templateSku, familia, atributos, v) === '190FJ-1.1/16"-12-1/2"', 'SKU por nome e por código do atributo.');
  assert(montarTexto('{Rosca} {Pressão}', familia, atributos, { '10': '3/4"-16', '13': '3000.000000' }) === '3/4"-16 3000', 'Decimal sem zeros à direita.');
  assert(montarTexto('{Rosca}-{X}', familia, atributos, {}) === '[Rosca]-[X]', 'O que falta sai entre colchetes.');
  assert([...atributosNosTemplates(familia, atributos)].sort().join() === '10,11,12', 'Atributos usados nos modelos.');
  console.log('montagem: ok');

  const ok = avaliarVariacao(linha(v, 'ANTIGO', 'NOME ANTIGO'), familia, atributos);
  assert(ok.pronta && ok.mudaNome && ok.mudaSku && ok.pendencias.length === 0, 'Variação completa fica pronta.');
  const falta = avaliarVariacao(linha({ '10': '1.1/16"-12' }), familia, atributos);
  assert(!falta.pronta && falta.pendencias.some(p => p.startsWith('Mangueira')) && falta.pendencias.some(p => p.startsWith('Pressão')),
    'Pendências: usado no SKU e obrigatório.');
  const fora = avaliarVariacao(linha({ ...v, '11': '5/8"' }), familia, atributos);
  assert(fora.pendencias.some(p => p.includes('não está na lista')), 'Valor fora da lista.');
  const igual = avaliarVariacao(linha(v, ok.skuNovo, ok.nomeNovo), familia, atributos);
  assert(!igual.mudaNome && !igual.mudaSku, 'Nada muda quando já está certo.');
  console.log('pendências: ok');

  const grade = { ...familia, papelMarca: 'grade' as const, templateSku: '{SIGLA}{S}{MARCA}' };
  assert(avaliarVariacao(linha(v), grade, atributos).pendencias.some(p => p.startsWith('Marca')), 'Marca de grade é obrigatória.');
  assert(avaliarVariacao(linha({ ...v, [CHAVE_MARCA]: 'Parker' }), grade, atributos).skuNovo === '190FJ-Parker', 'Marca do item no SKU.');
  console.log('marca: ok');

  const a = avaliarVariacao(linha(v), familia, atributos);
  assert(skusRepetidos([a, { ...a }]).size === 1 && skusRepetidos([a]).size === 0, 'SKU repetido na família.');
  assert(valoresMudaram({ '10': 'A' }, { '10': 'A ' }) === false && valoresMudaram({}, { '11': 'B' }), 'Mudança de valores.');
  console.log('repetidos: ok');

  // {Atributo:cod}: texto no nome, código (bitola) no SKU
  const terminais = [
    { id: '20', nome: 'Rosca JIC', classificacao: 'grade', tipoDado: 'lista', opcoesValidas: [{ valor: '1.1/16"-12', codigo: '12' }] },
    { id: '21', nome: 'Mangueira', classificacao: 'grade', tipoDado: 'lista', opcoesValidas: [{ valor: '1"', codigo: '16' }, { valor: '1/2"', codigo: '' }] },
    { id: '22', nome: 'Ângulo', classificacao: 'grade', tipoDado: 'lista', opcoesValidas: [{ valor: '90°', codigo: '90' }] },
  ];
  const fj = { nome: 'TERMINAL JIC FÊMEA', siglaSku: 'FJ', separadorSku: '-', templateSku: '1{Ângulo:cod}{SIGLA}-{Rosca JIC:cod}-{Mangueira:cod}',
    templateNomeComercial: '{FAMILIA} - {Ângulo} - {Rosca JIC} - {Mangueira} - {Mangueira:cod}' };
  const t = avaliarVariacao(linha({ '20': '1.1/16"-12', '21': '1"', '22': '90°' }), fj, terminais);
  assert(t.skuNovo === '190FJ-12-16' && t.nomeNovo === 'TERMINAL JIC FÊMEA - 90° - 1.1/16"-12 - 1" - 16' && t.pronta, 'SKU com códigos e nome com textos.');
  assert(!avaliarVariacao(linha({ '20': '1.1/16"-12', '21': '1/2"', '22': '90°' }), fj, terminais).pronta, 'Opção sem código deixa o SKU pendente.');
  assert([...atributosNosTemplates(fj, terminais)].sort().join() === '20,21,22', ':cod conta como uso do atributo.');
  console.log('código da opção: ok');
};

runNomenclaturaTests();
