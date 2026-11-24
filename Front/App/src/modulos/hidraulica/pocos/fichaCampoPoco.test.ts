import assert from 'assert';
import { valoresFichaDoPoco } from './fichaCampoPoco';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const poco = {
  identificacao: 'Poço de Carlos', endereco: 'Estrada do Sítio, 120', bairro: 'Rural', cidade: 'Atibaia', uf: 'SP',
  latitude: -23.0566517, longitude: -46.6253881, profundidadeM: 120, diametro: '6"', vazaoLh: 3500, nivelEstaticoM: 18, nivelDinamicoM: 42.5, tipoSolo: null,
};

teste('ficha de campo do poço: preenchida com o poço, a estrutura e a bomba', () => {
  const v = valoresFichaDoPoco(poco, { nome: 'Carlos', telefone: '11999990000' }, {
    perfuracoes: [{ perfDe: 0, perfAte: 48, perfDiam: 10 }, { perfDe: 48, perfAte: 120, perfDiam: 6 }],
    revestimentos: [{ revDe: 0, revAte: 48, revDiam: 6, revMaterial: 'PVC geomecânico' }, { revDe: 40, revAte: 120, revDiam: 4, revTipo: 'INTERNO', revMaterial: 'PVC' }],
    perfilGeologico: [{ geoDe: 0, geoAte: 30, geoTipo: 'Argila' }, { geoDe: 30, geoAte: 120, geoTipo: 'Rocha sã' }],
  }, {
    bombaMarca: 'Ebara', bombaModelo: 'BHS', potenciaCv: 1.5, motorMarca: 'WEG', motorModelo: null, profundidadeBombaM: 60,
    tuboMaterial: 'PVC', tuboDiametro: '1¼"', tuboBarras: 10, tuboMetros: 60, fioTipo: 'PP', fioBitola: '4 mm²', fioMetros: 70, instaladoEm: '2026-11-10',
  }, '2026-11-23');
  assert.strictEqual(v.obra_endereco, 'Estrada do Sítio, 120, Rural');
  assert.strictEqual(v.obra_cidade, 'Atibaia / SP');
  assert.strictEqual(v.obra_ref, 'Poço de Carlos · GPS -23.056652, -46.625388');
  assert.deepStrictEqual([v.prof_atingida, v.vazao, v.nivel_estatico, v.nivel_dinamico], [120, '3.500 L/h', 18, 42.5]);
  assert.strictEqual(v.solo, '0–30 m argila; 30–120 m rocha sã');
  assert.deepStrictEqual([v.perf_de_1, v.perf_ate_1, v.perf_diam_1, v.perf_de_2, v.perf_diam_2, v.perf_de_3], [0, 48, '10"', 48, '6"', undefined]);
  assert.deepStrictEqual([v.rev_material_1, v.rev_material_2, v.rev_diam_2], ['PVC geomecânico', 'Rev. interno · PVC', '4"']);
  assert.deepStrictEqual([v.bomba_marca, v.bomba_motor, v.bomba_cabo, v.bomba_prof, v.bomba_tubulacao, v.bomba_data],
    ['Ebara BHS', 'WEG 1,5 CV', 'PP 4 mm² 70 m', 60, '10 barras PVC 1¼" (60 m)', '2026-11-10']);
});

teste('ficha de campo do poço: sem estrutura, sem bomba e sem GPS', () => {
  const v = valoresFichaDoPoco({ ...poco, latitude: null, longitude: null, profundidadeM: null, vazaoLh: null, tipoSolo: 'Arenito' }, null, null, null, '2026-11-23');
  assert.deepStrictEqual([v.cliente_nome, v.obra_ref, v.prof_atingida, v.vazao, v.solo, v.bomba_marca, v.perf_de_1], [null, 'Poço de Carlos', null, null, 'Arenito', undefined, undefined]);
});
