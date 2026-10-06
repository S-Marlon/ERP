import { lerDescricao, MarcaModulo, medidasDoCodigo, montarNome, montarSku } from './rolamentos';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const marcas: MarcaModulo[] = [
  { id: 6, nome: 'GTOP-GBR', codigo: null, linha: 2, apelidos: ['GTOP', 'GBR'] },
  { id: 12, nome: 'Peer', codigo: 'PEER', linha: 2, apelidos: ['PEER/SKF'] },
  { id: 13, nome: 'SKF', codigo: 'SKF', linha: 1, apelidos: [] },
];

// As 7 linhas da nota de exemplo
const casos: Array<[string, string, string, string, string | null, string | null, [number, number, number] | null]> = [
  ['ROLAMENTO PER.6802-2RSU PEER/SKF', 'RIGIDO_ESFERAS', '6802', '2RS', null, 'Peer', [15, 24, 5]],
  ['ROLAMENTO UC 208-24 GTOP-GBR', 'INSERCAO_UC', 'UC208-24', 'ABERTO', null, 'GTOP-GBR', [38.1, 80, 49.2]],
  ['ROLAMENTO 607 2RS B GTOP-GBR', 'RIGIDO_ESFERAS', '607', '2RS', null, 'GTOP-GBR', [7, 19, 6]],
  ['ROLAMENTO UC 206-18 GTOP-GBR', 'INSERCAO_UC', 'UC206-18', 'ABERTO', null, 'GTOP-GBR', [28.575, 62, 38.1]],
  ['ROLAMENTO 6200 2RS GTOP-GBR', 'RIGIDO_ESFERAS', '6200', '2RS', null, 'GTOP-GBR', [10, 30, 9]],
  ['ROLAMENTO 6005 ZZ GTOP-GBR', 'RIGIDO_ESFERAS', '6005', 'ZZ', null, 'GTOP-GBR', [25, 47, 12]],
  ['ROLAMENTO HK2220F NTN', 'AGULHAS', 'HK2220', '', null, null, [22, 28, 20]],
];
for (const [desc, tipo, codigo, vedacao, folga, marca, medidas] of casos) {
  const l = lerDescricao(desc, marcas);
  assert(l.ehRolamento && l.tipo === tipo && l.codigo === codigo, `${desc}: tipo/código ${JSON.stringify(l)}`);
  if (vedacao) assert(l.vedacao === vedacao, `${desc}: vedação ${l.vedacao}`);
  assert(l.folga === folga, `${desc}: folga ${l.folga}`);
  assert((l.marca?.nome ?? null) === marca, `${desc}: marca ${l.marca?.nome}`);
  const m = medidasDoCodigo(l.tipo, l.codigo!);
  assert(JSON.stringify(m && [m.d, m.D, m.B]) === JSON.stringify(medidas), `${desc}: medidas ${JSON.stringify(m)}`);
}
// Marca não cadastrada sugerida pela palavra depois do código
assert(lerDescricao('ROLAMENTO HK2220F NTN', marcas).marcaTexto === 'NTN', 'sugere NTN');
assert(lerDescricao('ROLAMENTO PER.6802-2RSU PEER/SKF', []).marcaTexto === 'PEER', 'sugere PEER');
// HK2220F: o "F" colado fica como sufixo; vedação de agulha sem sufixo = aberto
assert(lerDescricao('ROLAMENTO HK2220F NTN', marcas).sufixos[0] === 'F', 'sufixo F');

// Outros formatos comuns
let l = lerDescricao('ROL 6205-2RS/C3 SKF', marcas);
assert(l.codigo === '6205' && l.vedacao === '2RS' && l.folga === 'C3' && l.marca?.nome === 'SKF', `6205 C3 ${JSON.stringify(l)}`);
l = lerDescricao('ROLAMENTO 6305 ZZ C3 NSK', marcas);
assert(l.codigo === '6305' && l.vedacao === 'ZZ' && l.folga === 'C3' && l.marcaTexto === 'NSK', `6305 ${JSON.stringify(l)}`);
l = lerDescricao('ROLAMENTO 30205 KOYO', marcas);
assert(l.tipo === 'ROLOS_CONICOS' && medidasDoCodigo(l.tipo, l.codigo!)?.B === 16.25, `cônico ${JSON.stringify(l)}`);
l = lerDescricao('ROLAMENTO NU 205 FAG', marcas);
assert(l.tipo === 'ROLOS_CILINDRICOS' && l.codigo === 'NU205' && medidasDoCodigo(l.tipo, l.codigo)?.D === 52, `NU205 ${JSON.stringify(l)}`);
l = lerDescricao('ROLAMENTO 6204 GTOP', marcas);
assert(l.vedacao === 'ABERTO' && l.marca?.nome === 'GTOP-GBR', `aberto ${JSON.stringify(l)}`);
assert(!lerDescricao('PARAFUSO SEXTAVADO M8 X 30', marcas).ehRolamento, 'não é rolamento');
assert(medidasDoCodigo('RIGIDO_ESFERAS', '6299') === null, 'fora da tabela');

// SKU e nome
assert(montarSku({ codigo: '6205', vedacao: '2RS', folga: null, linha: 1, marca: { nome: 'SKF', codigo: 'SKF' } }) === '6205-2RS-SKF', 'sku 1ª');
assert(montarSku({ codigo: '6205', vedacao: '2RS', folga: 'C3', linha: 2, marca: { nome: 'GTOP-GBR', codigo: null } }) === '6205-2RS-C3-2L', 'sku 2ª');
assert(montarSku({ codigo: 'UC208-24', vedacao: 'ABERTO', folga: null, linha: 2, marca: null }) === 'UC208-24-2L', 'sku UC');
assert(montarSku({ codigo: 'HK2220', vedacao: 'ABERTO', folga: null, linha: 1, marca: { nome: 'NTN', codigo: null } }) === 'HK2220-NTN', 'sku HK');
assert(montarNome({ tipo: 'RIGIDO_ESFERAS', codigo: '6005', vedacao: 'ZZ', folga: null, linha: 2, marca: null }) === 'Rolamento 6005 ZZ 2ª linha', 'nome 2ª');
assert(montarNome({ tipo: 'AGULHAS', codigo: 'HK2220', vedacao: 'ABERTO', folga: null, linha: 1, marca: { nome: 'NTN' } }) === 'Rolamento de agulha HK2220 NTN', 'nome HK');

console.log('rolamentos: ok');
