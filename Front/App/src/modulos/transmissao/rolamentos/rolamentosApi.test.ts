import { montarDescricao, montarNome, montarSku } from './rolamentosApi';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

// Mesmas regras do backend (rolamentos.test.ts)
assert(montarSku({ codigo: '6205', vedacao: '2RS', folga: null, linha: 1, marca: { nome: 'SKF', codigo: 'SKF' } }) === '6205-2RS-SKF', 'sku 1ª');
assert(montarSku({ codigo: '6205', vedacao: '2RS', folga: 'C3', linha: 2, marca: { nome: 'GTOP-GBR', codigo: null } }) === '6205-2RS-C3-2L', 'sku 2ª');
assert(montarSku({ codigo: 'uc208-24', vedacao: 'ABERTO', folga: null, linha: 2, marca: null }) === 'UC208-24-2L', 'sku UC');
assert(montarSku({ codigo: 'HK2220', vedacao: 'ABERTO', folga: null, linha: 1, marca: { nome: 'NTN', codigo: null } }) === 'HK2220-NTN', 'sku HK');
assert(montarSku({ codigo: '6802', vedacao: '2RS', folga: null, linha: 1, marca: { nome: 'Peer Bearing', codigo: null } }) === '6802-2RS-PEERBEARIN', 'sigla pelo nome (10)');
assert(montarNome({ tipo: 'RIGIDO_ESFERAS', codigo: '6005', vedacao: 'ZZ', folga: null, linha: 2, marca: null }) === 'Rolamento 6005 ZZ 2ª linha', 'nome 2ª');
assert(montarNome({ tipo: 'AGULHAS', codigo: 'HK2220', vedacao: 'ABERTO', folga: null, linha: 1, marca: { nome: 'NTN' } }) === 'Rolamento de agulha HK2220 NTN', 'nome HK');

const desc = montarDescricao({
  tipo: 'RIGIDO_ESFERAS', codigo: '6201', codigoCompleto: '6201-2RSR-CO7-C3#N1', marca: 'FAG', linha: 1, medidas: { d: 12, D: 32, B: 10 },
  sufixos: [
    { codigo: '2RSR', categoria: 'VEDACAO', significado: 'vedação de borracha nos dois lados (FAG)' },
    { codigo: 'CO7', categoria: null, significado: null },
    { codigo: 'C3', categoria: 'FOLGA', significado: 'folga radial interna maior que a normal' },
    { codigo: '#N1', categoria: null, significado: null },
  ],
});
assert(desc === [
  'Rolamento rígido de esferas 6201 FAG',
  'Medidas: 12 x 32 x 10 mm (furo x diâmetro externo x largura)',
  'Código do fabricante: 6201-2RSR-CO7-C3#N1',
  '• 2RSR: vedação de borracha nos dois lados (FAG)',
  '• C3: folga radial interna maior que a normal',
  'Outros códigos do fabricante: CO7, #N1',
].join('\n'), desc);
assert(montarDescricao({ tipo: 'INSERCAO_UC', codigo: 'UC208-24', codigoCompleto: 'UC208-24', marca: 'GTOP-GBR', linha: 2, medidas: { d: 38.1, D: 80, B: 49.2 }, sufixos: [] })
  === 'Rolamento de inserção (UC) UC208-24 (2ª linha)\nMedidas: 38,1 x 80 x 49,2 mm (furo x diâmetro externo x largura)', 'descrição UC');

console.log('rolamentosApi: ok');
