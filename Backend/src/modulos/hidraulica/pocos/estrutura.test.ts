import assert from 'assert';
import { estruturaDasObras } from './estrutura';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('estrutura do poço: perfuração original + complemento anos depois', () => {
  const e = estruturaDasObras([
    { origem: 'Obra 12 (complemento)', data: '2026-09-01', dados: {
      revestimentos: [{ revTipo: 'INTERNO', revDe: 0, revAte: 120, revDiam: 4, revObs: 'caimento' }], bombaProfundidade: 90, bombaNivelEstatico: 25 } },
    { origem: 'Obra 3 (perfuração)', data: '2021-03-10', dados: {
      profundidade: 120, perfuracoes: [{ perfDe: 0, perfAte: 48, perfDiam: 8 }, { perfDe: 48, perfAte: 120, perfDiam: 6 }],
      revestimentos: [{ revDe: 0, revAte: 48, revDiam: 6 }, { revDe: 0, revAte: 48, revDiam: 6 }],
      perfilGeologico: [{ geoDe: 0, geoAte: 48, geoTipo: 'Argila' }, { geoDe: 48, geoAte: 120, geoTipo: 'Rocha sã' }], bombaProfundidade: 72, bombaNivelEstatico: 18 } },
    { origem: 'Obra 20 (orçamento)', data: '2026-11-01', dados: null },
  ])!;
  assert.strictEqual(e.perfuracoes.length, 2);
  assert.strictEqual(e.perfilGeologico.length, 2);
  assert.deepStrictEqual(e.revestimentos.map((r: any) => [r.revTipo || 'EXTERNO', r.revAte, r.origem]), [['EXTERNO', 48, 'Obra 3 (perfuração)'], ['INTERNO', 120, 'Obra 12 (complemento)']]);
  assert.strictEqual(e.profundidade, 120);
  assert.strictEqual(e.bombaProfundidade, 90);      // a mais recente
  assert.strictEqual(e.bombaNivelEstatico, 25);
});

teste('estrutura do poço: uma obra só não marca a origem; sem dados = null', () => {
  const e = estruturaDasObras([{ origem: 'Obra 1', data: '2025-01-01', dados: { revestimentos: [{ revDe: 0, revAte: 30, revDiam: 6 }] } }])!;
  assert.strictEqual(e.revestimentos[0].origem, undefined);
  assert.strictEqual(estruturaDasObras([{ origem: 'Obra 1', data: null, dados: { cliente: 'x' } }]), null);
  assert.strictEqual(estruturaDasObras([]), null);
});
