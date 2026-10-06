import { montarNome, montarSku } from './rolamentosApi';

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

console.log('rolamentosApi: ok');
