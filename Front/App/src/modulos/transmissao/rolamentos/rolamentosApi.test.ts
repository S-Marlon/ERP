import { montarDescricao, montarNome, montarSku } from './rolamentosApi';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

// Mesmas regras do backend (rolamentos.test.ts)
assert(montarSku({ codigo: '6205', vedacao: '2RS', folga: null, linha: 1, marca: { nome: 'SKF', codigo: 'SKF' } }) === '6205-2RS/SKF', 'sku 1ª');
assert(montarSku({ codigo: '6205', vedacao: '2RS', folga: 'C3', linha: 2, marca: { nome: 'GTOP-GBR', codigo: null }, mesclada: true }) === '6205-2RS-C3/2L', 'sku 2ª juntada');
assert(montarSku({ codigo: '6205', vedacao: 'ZZ', folga: null, linha: 2, marca: { nome: 'GTOP-GBR', codigo: 'GTOP' } }) === '6205-ZZ/GTOP', 'sku 2ª com marca');
assert(montarSku({ codigo: 'uc208-24', vedacao: 'ABERTO', folga: null, linha: 2, marca: null, mesclada: true }) === 'UC208-24/2L', 'sku UC');
assert(montarSku({ codigo: 'HK2220', vedacao: 'ABERTO', folga: null, linha: 1, marca: { nome: 'NTN', codigo: null } }) === 'HK2220/NTN', 'sku HK');
assert(montarSku({ codigo: '6802', vedacao: '2RS', folga: null, linha: 1, marca: { nome: 'Peer Bearing', codigo: null } }) === '6802-2RS/PEERBEARIN', 'sigla pelo nome (10)');
assert(montarSku({ codigo: 'UC207-20', vedacao: '2RS', folga: 'C3', linha: 1, marca: { nome: 'INA', codigo: null } }) === 'UC207-20-2RS-C3/INA', 'sku UC completo');
assert(montarNome({ codigo: '6205', vedacao: '2RS', folga: 'C3', linha: 1, marca: { nome: 'SKF' }, medidas: { d: 25, D: 52, B: 15 } })
  === 'ROLAMENTO 6205-2RS/C3 | 25 mm x 52 mm x 15 mm | SKF', 'nome 1ª');
assert(montarNome({ codigo: 'UC207-20', vedacao: 'ABERTO', folga: null, linha: 2, marca: { nome: 'GTOP-GBR' }, medidas: { d: 31.75, D: 72, B: 42.9 } })
  === 'ROLAMENTO UC207-20 | 31,75 mm x 72 mm x 42,9 mm | GTOP-GBR', 'nome UC 2ª');
assert(montarNome({ codigo: '6205', vedacao: 'ZZ', folga: null, linha: 2, marca: { nome: 'GTOP-GBR' }, medidas: null, mesclada: true }) === 'ROLAMENTO 6205-ZZ | 2ª LINHA', 'nome 2ª juntada');
assert(montarNome({ codigo: 'HK2220', vedacao: 'ABERTO', folga: null, linha: 1, marca: { nome: 'ntn' }, medidas: null }) === 'ROLAMENTO HK2220 | NTN', 'nome sem medidas');
assert(montarNome({ codigo: '6204', vedacao: 'ABERTO', folga: 'C3', linha: 1, marca: { nome: 'FAG' }, medidas: { d: 20, D: 47, B: 14 } })
  === 'ROLAMENTO 6204/C3 | 20 mm x 47 mm x 14 mm | FAG', 'nome aberto com folga');

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
  === 'Rolamento de inserção (UC) UC208-24 GTOP-GBR (2ª linha)\nMedidas: 38,1 x 80 x 49,2 mm (furo x diâmetro externo x largura)', 'descrição UC');

console.log('rolamentosApi: ok');
