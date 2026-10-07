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
assert(lerDescricao('ROLAMENTO HK2220F NTN', marcas).sufixos[0]?.codigo === 'F', 'sufixo F');

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
assert(montarSku({ codigo: '6205', vedacao: '2RS', folga: null, linha: 1, marca: { nome: 'SKF', codigo: 'SKF' } }) === '6205-2RS/SKF', 'sku 1ª');
assert(montarSku({ codigo: '6205', vedacao: '2RS', folga: 'C3', linha: 2, marca: { nome: 'GTOP-GBR', codigo: null }, mesclada: true }) === '6205-2RS-C3/2L', 'sku 2ª juntada');
assert(montarSku({ codigo: '6205', vedacao: 'ZZ', folga: null, linha: 2, marca: { nome: 'GTOP-GBR', codigo: 'GTOP' } }) === '6205-ZZ/GTOP', 'sku 2ª com marca');
assert(montarSku({ codigo: 'UC208-24', vedacao: 'ABERTO', folga: null, linha: 2, marca: null, mesclada: true }) === 'UC208-24/2L', 'sku UC');
assert(montarSku({ codigo: 'HK2220', vedacao: 'ABERTO', folga: null, linha: 1, marca: { nome: 'NTN', codigo: null } }) === 'HK2220/NTN', 'sku HK');
assert(montarNome({ codigo: '6205', vedacao: '2RS', folga: 'C3', linha: 1, marca: { nome: 'SKF' }, medidas: { d: 25, D: 52, B: 15 } })
  === 'ROLAMENTO 6205-2RS/C3 | 25 mm x 52 mm x 15 mm | SKF', 'nome 1ª');
assert(montarNome({ codigo: 'UC207-20', vedacao: 'ABERTO', folga: null, linha: 2, marca: { nome: 'GTOP-GBR' }, medidas: { d: 31.75, D: 72, B: 42.9 } })
  === 'ROLAMENTO UC207-20 | 31,75 mm x 72 mm x 42,9 mm | GTOP-GBR', 'nome UC 2ª');
assert(montarNome({ codigo: '6205', vedacao: 'ZZ', folga: null, linha: 2, marca: { nome: 'GTOP-GBR' }, medidas: null, mesclada: true }) === 'ROLAMENTO 6205-ZZ | 2ª LINHA', 'nome 2ª juntada');
assert(montarNome({ codigo: 'HK2220', vedacao: 'ABERTO', folga: null, linha: 1, marca: { nome: 'ntn' }, medidas: null }) === 'ROLAMENTO HK2220 | NTN', 'nome sem medidas');
assert(montarNome({ codigo: '6204', vedacao: 'ABERTO', folga: 'C3', linha: 1, marca: { nome: 'FAG' }, medidas: { d: 20, D: 47, B: 14 } })
  === 'ROLAMENTO 6204/C3 | 20 mm x 47 mm x 14 mm | FAG', 'nome aberto com folga');

// Nomenclaturas de fabricante (FAG, NTN, SKF, Timken): vedação, folga, prefixo inox e códigos sem significado conhecido
const comFab: MarcaModulo[] = [...marcas, { id: 20, nome: 'FAG', codigo: 'FAG', linha: 1, apelidos: [] }, { id: 21, nome: 'NTN', codigo: 'NTN', linha: 1, apelidos: [] }];
const fab: Array<[string, string, string, string, string | null, string, string[], string | null]> = [
  // descrição, tipo, código, vedação, folga, código completo, desconhecidos, marca (nome ou texto)
  ['ROLAMENTO 6201-2RSR-CO7-C3#N1 FAG', 'RIGIDO_ESFERAS', '6201', '2RS', 'C3', '6201-2RSR-CO7-C3#N1', ['CO7', '#N1'], 'FAG'],
  ['ROLAMENTO 6300-B-2DRS-L278-C3-SNZ1#O FAG', 'RIGIDO_ESFERAS', '6300', '2RS', 'C3', '6300-B-2DRS-L278-C3-SNZ1#O', ['B', 'SNZ1', '#O'], 'FAG'],
  ['ROLAMENTO 607-2RSR-HLN#N10 FAG', 'RIGIDO_ESFERAS', '607', '2RS', null, '607-2RSR-HLN#N10', ['HLN', '#N10'], 'FAG'],
  ['ROLAMENTO 6206-2RSR-CO7-C3#N1 FAG', 'RIGIDO_ESFERAS', '6206', '2RS', 'C3', '6206-2RSR-CO7-C3#N1', ['CO7', '#N1'], 'FAG'],
  ['ROLAMENTO 6205-2RS-C3 TIMKEN NCZADO', 'RIGIDO_ESFERAS', '6205', '2RS', 'C3', '6205-2RS-C3', [], 'TIMKEN'],
  ['ROLAMENTO 6004-2RSR-CO7#N1 FAG', 'RIGIDO_ESFERAS', '6004', '2RS', null, '6004-2RSR-CO7#N1', ['CO7', '#N1'], 'FAG'],
  ['ROLAMENTO SS 608 2RS GTOP-GBR', 'RIGIDO_ESFERAS', 'SS608', '2RS', null, 'SS608', [], 'GTOP-GBR'],
  ['ROLAMENTO 30204-A-J42B-W136#N1 FAG', 'ROLOS_CONICOS', '30204', 'ABERTO', null, '30204-A-J42B-W136#N1', ['A', 'J42B', 'W136', '#N1'], 'FAG'],
  ['ROLAMENTO 6902LLU/2AS NTN', 'RIGIDO_ESFERAS', '6902', '2RS', null, '6902LLU/2AS', ['2AS'], 'NTN'],
  ['ROLAMENTO 30206.J42A4 FAG', 'ROLOS_CONICOS', '30206', 'ABERTO', null, '30206.J42A4', ['J42A4'], 'FAG'],
  ['ROLAMENTO 6301-C-2HRS-C3#N1&gt;V FAG', 'RIGIDO_ESFERAS', '6301', '2RS', 'C3', '6301-C-2HRS-C3#N1>V', ['C', '#N1>V'], 'FAG'],
  ['ROLAMENTO 6204-2RSH/AEM3/C3 SKF', 'RIGIDO_ESFERAS', '6204', '2RS', 'C3', '6204-2RSH/AEM3/C3', ['AEM3'], 'SKF'],
  ['ROLAMENTO 30205AA3 FAG', 'ROLOS_CONICOS', '30205', 'ABERTO', null, '30205AA3', ['AA3'], 'FAG'],
];
for (const [desc, tipo, codigo, vedacao, folga, completo, desconhecidos, marca] of fab) {
  const l = lerDescricao(desc, comFab);
  const naoSei = l.sufixos.filter(x => !x.significado).map(x => x.codigo);
  assert(l.tipo === tipo && l.codigo === codigo && l.vedacao === vedacao && l.folga === folga, `${desc}: ${JSON.stringify({ t: l.tipo, c: l.codigo, v: l.vedacao, f: l.folga })}`);
  assert(l.codigoCompleto === completo, `${desc}: código completo ${l.codigoCompleto}`);
  assert(JSON.stringify(naoSei) === JSON.stringify(desconhecidos), `${desc}: desconhecidos ${JSON.stringify(naoSei)}`);
  assert((l.marca?.nome ?? l.marcaTexto) === marca, `${desc}: marca ${l.marca?.nome ?? l.marcaTexto}`);
  assert(medidasDoCodigo(l.tipo, l.codigo!) !== null, `${desc}: medidas`);
}
// Significados: NCZADO informativo, inox no prefixo, L278 provável graxa, dicionário do operador vale primeiro
let s1 = lerDescricao('ROLAMENTO 6205-2RS-C3 TIMKEN NCZADO', comFab);
assert(s1.sufixos.some(x => x.codigo === 'NCZADO' && x.significado === 'importado e nacionalizado'), 'NCZADO');
assert(lerDescricao('ROLAMENTO SS 608 2RS GTOP-GBR', comFab).sufixos[0].significado === 'aço inoxidável', 'inox');
assert(Boolean(lerDescricao('ROLAMENTO 6300-B-2DRS-L278-C3-SNZ1#O FAG', comFab).sufixos.find(x => x.codigo === 'L278')?.provavel), 'graxa provável');
s1 = lerDescricao('ROLAMENTO 6201-2RSR-CO7-C3#N1 FAG', comFab, { co7: 'código de lubrificação FAG' });
assert(s1.sufixos.find(x => x.codigo === 'CO7')?.significado === 'código de lubrificação FAG', 'dicionário do operador');
assert(montarSku({ codigo: 'SS608', vedacao: '2RS', folga: null, linha: 2, marca: null, mesclada: true }) === 'SS608-2RS/2L', 'sku inox');
assert(montarSku({ codigo: 'UC207-20', vedacao: '2RS', folga: 'C3', linha: 1, marca: { nome: 'SKF', codigo: 'SKF' } }) === 'UC207-20-2RS-C3/SKF', 'sku UC completo');
assert(montarSku({ codigo: 'UC207-20', vedacao: 'ABERTO', folga: null, linha: 1, marca: { nome: 'FAG', codigo: null } }) === 'UC207-20/FAG', 'sku UC simples');
const uc = lerDescricao('ROLAMENTO UC207-20 2RS C3 INA', []);
assert(uc.codigo === 'UC207-20' && uc.vedacao === '2RS' && uc.folga === 'C3', `UC com vedação ${JSON.stringify(uc)}`);

console.log('rolamentos: ok');

// Busca por medidas: só anel interno (furo e largura), margem e ordem por proximidade
{
  const { filtrarPorMedidas, padroesComMedidas } = require('./rolamentos');
  const lista = [
    { cod: '6003', medidas: { d: 17, D: 35, B: 10 } },
    { cod: '6203', medidas: { d: 17, D: 40, B: 12 } },
    { cod: '16003', medidas: { d: 17, D: 35, B: 8 } },
    { cod: 'sem', medidas: null },
  ];
  const r1 = filtrarPorMedidas({ d: 17, B: 10 }, 0, lista);
  assert(r1.length === 1 && r1[0].cod === '6003', `exato ${JSON.stringify(r1)}`);
  const r2 = filtrarPorMedidas({ d: 17.2, B: 9.8 }, 0.5, lista);
  assert(r2.length === 1 && r2[0].cod === '6003' && r2[0].desvio === 0.4, `margem ${JSON.stringify(r2)}`);
  const r3 = filtrarPorMedidas({ d: 17 }, 0, lista);
  assert(r3.length === 3, 'só furo');
  const r4 = filtrarPorMedidas({ d: 17, B: 8.8 }, 1.5, lista);
  assert(r4.map((x: any) => x.cod).join() === '16003,6003', `ordem por proximidade ${r4.map((x: any) => x.cod).join()}`);
  assert(filtrarPorMedidas({}, 1, lista).length === 0, 'sem medida não busca');
  const padroes = padroesComMedidas();
  assert(padroes.some((p: any) => p.codigo === '6003') && padroes.some((p: any) => p.codigo === 'UC207-20' && p.medidas.d === 31.75), 'padrões');
  const p17 = filtrarPorMedidas({ d: 17, B: 10 }, 0, padroes).map((p: any) => p.codigo);
  assert(p17.includes('6003'), `padrões 17x?x10 ${p17.join()}`);
  console.log('busca por medidas: ok');
}

// Fornecedor que põe a descrição útil no código do produto e uma descrição genérica igual em todas as linhas
{
  const { lerLinhaNota } = require('./rolamentos');
  const generica = 'ROLAMENTOS DE ACO CARBONO DE ESFERAS DE CARGA RADIAL';
  const l = lerLinhaNota(generica, '608 2RS CS ABEC 13 - AMARELA', []);
  assert(l.origem === 'CODIGO_FORNECEDOR' && l.ehRolamento && l.codigo === '608' && l.vedacao === '2RS', `cProd ${JSON.stringify(l)}`);
  assert(l.marcaTexto === null && l.codigoCompleto === '608 2RS CS ABEC 13 - AMARELA', `sem marca inventada ${JSON.stringify(l)}`);
  const naoSei = l.sufixos.filter((x: any) => !x.significado).map((x: any) => x.codigo).join(',');
  assert(naoSei === 'CS,13', `desconhecidos ${naoSei}`);
  // Descrição boa continua mandando; código numérico do fornecedor não atrapalha
  const boa = lerLinhaNota('ROLAMENTO 6200 2RS GTOP-GBR', '000000021956A', []);
  assert(boa.origem === 'DESCRICAO' && boa.codigo === '6200', 'descrição normal');
  console.log('código do fornecedor: ok');
}
