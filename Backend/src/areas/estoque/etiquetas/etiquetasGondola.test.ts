import { CategoriaRegra, lerImpressas, motivoDesatualizada, regraDaCategoria } from './etiquetasGondola';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`etiquetasGondola: ${msg}`); };

// Árvore: Transmissão (1, nunca) > Rolamentos (2) > Esferas (3); Hidráulica (4, automático) > Conexões (5, sempre)
const mapa = new Map<number, CategoriaRegra>([
  [1, { id: 1, pai: null, etiqueta: 0 }],
  [2, { id: 2, pai: 1, etiqueta: null }],
  [3, { id: 3, pai: 2, etiqueta: null }],
  [4, { id: 4, pai: null, etiqueta: null }],
  [5, { id: 5, pai: 4, etiqueta: 1 }],
]);
ok(regraDaCategoria(3, mapa) === 'NUNCA', 'subcategoria herda o "nunca" do avô');
ok(regraDaCategoria(5, mapa) === 'SEMPRE', 'regra da própria categoria');
ok(regraDaCategoria(4, mapa) === 'AUTO' && regraDaCategoria(null, mapa) === 'AUTO', 'sem regra: automático');
ok(regraDaCategoria(99, mapa) === 'AUTO', 'categoria desconhecida: automático');
const ciclo = new Map<number, CategoriaRegra>([[7, { id: 7, pai: 8, etiqueta: null }], [8, { id: 8, pai: 7, etiqueta: null }]]);
ok(regraDaCategoria(7, ciclo) === 'AUTO', 'ciclo na árvore não trava');
console.log('regra: ok');

const impressa = { unidade: 'PC', preco: 66.5, impressoEm: '2026-10-01T10:00:00' };
ok(motivoDesatualizada('AUTO', impressa, { preco: 75.77, unidade: 'PC' }) === 'PRECO_MUDOU', 'preço mudou depois da etiqueta');
ok(motivoDesatualizada('AUTO', impressa, { preco: 66.5, unidade: 'pc' }) === null, 'mesmo preço e unidade: etiqueta certa');
ok(motivoDesatualizada('AUTO', impressa, { preco: 66.5, unidade: 'UN' }) === 'UNIDADE_MUDOU', 'unidade da etiqueta mudou');
ok(motivoDesatualizada('NUNCA', impressa, { preco: 99, unidade: 'PC' }) === null, 'categoria sem etiqueta nunca avisa');
ok(motivoDesatualizada('AUTO', null, { preco: 10, unidade: 'PC' }) === null, 'automático sem etiqueta impressa: não acompanha');
ok(motivoDesatualizada('SEMPRE', null, { preco: 10, unidade: 'PC' }) === 'SEM_ETIQUETA', 'sempre: item sem etiqueta precisa de uma');
ok(motivoDesatualizada('SEMPRE', null, { preco: 0, unidade: 'PC' }) === null, 'sem preço não pede etiqueta');
console.log('motivo: ok');

const lidas = lerImpressas({ itens: [
  { idItem: 5, unidade: ' pc ', preco: 10.123456 },
  { idItem: 5, unidade: 'PC', preco: 11 },
  { idItem: 0, unidade: 'UN', preco: 1 },
  { idItem: 6, unidade: 'UN', preco: -1 },
  { idItem: 7, unidade: null, preco: '3.5' },
] });
ok(lidas.length === 2, 'descarta inválidas e repete o item uma vez');
ok(lidas[0].unidade === 'PC' && lidas[0].preco === 11, 'mesma unidade fica a última');
ok(lidas[1].idItem === 7 && lidas[1].unidade === '' && lidas[1].preco === 3.5, 'sem unidade e preço em texto');
ok(lerImpressas(null).length === 0, 'corpo vazio');
console.log('leitura: ok');
