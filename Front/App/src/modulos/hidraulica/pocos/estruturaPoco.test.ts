import assert from 'assert';
import { emPolegadas, formacaoNoTrecho, fundoDoPoco, resumoEstrutura, svgPerfil, temEstrutura, trechosSemRevestimento } from './estruturaPoco';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

// Poço do exemplo: perfurado em 8" até 48 m e 6" até 120 m; revestido com 6" até 48 m; o resto é rocha sã
const poco = {
  perfuracoes: [{ perfDe: 0, perfAte: 48, perfDiam: 8, perfDiamUnidade: '"' }, { perfDe: 48, perfAte: 120, perfDiam: 6, perfDiamUnidade: '"' }],
  revestimentos: [{ revDe: 0, revAte: 48, revDiam: 6, revDiamUnidade: '"', revMaterial: 'PVC geomecânico' }],
  perfilGeologico: [
    { geoDe: 0, geoAte: 6, geoTipo: 'Solo / aterro' }, { geoDe: 6, geoAte: 30, geoTipo: 'Argila' }, { geoDe: 30, geoAte: 48, geoTipo: 'Rocha alterada' },
    { geoDe: 48, geoAte: 120, geoTipo: 'Rocha sã' }, { geoDe: 87, geoAte: 88, geoTipo: 'Fratura com água' },
  ],
  bombaNivelEstatico: 18, bombaProfundidade: 72,
};

teste('estrutura: fundo, trechos sem revestimento e formação', () => {
  assert.strictEqual(fundoDoPoco(poco), 120);
  assert.deepStrictEqual(trechosSemRevestimento(poco), [{ de: 48, ate: 120 }]);
  assert.strictEqual(formacaoNoTrecho(poco, { de: 48, ate: 120 }), 'rocha sã e fratura com água');
  assert.strictEqual(formacaoNoTrecho(poco, { de: 0, ate: 10 }), 'solo / aterro e argila');
  assert.strictEqual(Math.round(emPolegadas(152.4, 'mm')), 6);
});

teste('estrutura: complemento interno cobre o poço todo', () => {
  const complemento = { ...poco, revestimentos: [...poco.revestimentos, { revDe: 0, revAte: 120, revDiam: 4, revDiamUnidade: '"', revTipo: 'INTERNO', revObs: 'caimento aos 60 m', origem: 'Obra 9' }] };
  assert.deepStrictEqual(trechosSemRevestimento(complemento), []);
  const r = resumoEstrutura(complemento);
  assert.ok(r.includes('Revestimento interno (complemento) 4" de 0 a 120 m (caimento aos 60 m) · Obra 9.'), r.join('\n'));
  assert.ok(!r.some(l => l.startsWith('Sem revestimento')));
});

teste('estrutura: resumo em frases', () => {
  assert.deepStrictEqual(resumoEstrutura(poco), [
    'Perfuração: 0 a 48 m em 8"; 48 a 120 m em 6".',
    'Revestimento 6" PVC geomecânico de 0 a 48 m.',
    'Sem revestimento de 48 a 120 m: parede em rocha sã e fratura com água.',
    'Entradas de água (fraturas): 87–88 m.',
    'Nível estático 18 m · bomba a 72 m.',
  ]);
  // revestimento com furo no meio (ex.: filtro só embaixo)
  const meio = { perfuracoes: [{ perfDe: 0, perfAte: 60, perfDiam: 6 }], revestimentos: [{ revDe: 0, revAte: 20, revDiam: 6 }, { revDe: 40, revAte: 60, revDiam: 6, revTipo: 'FILTRO' }] };
  assert.deepStrictEqual(trechosSemRevestimento(meio), [{ de: 20, ate: 40 }]);
});

teste('estrutura: desenho', () => {
  assert.ok(temEstrutura(poco) && !temEstrutura({}));
  const svg = svgPerfil(poco);
  assert.ok(svg.startsWith('<svg') && svg.includes('NE (nível estático) · 18 m') && svg.includes('Bomba · 72 m') && svg.includes('Sem revestimento · 48–120 m'));
  assert.ok(!svgPerfil({ revestimentos: [{ revDe: 0, revAte: 30, revDiam: 6 }] }).includes('NaN'));
});
