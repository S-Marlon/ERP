import assert from 'assert';
import { barrasDoConjunto, conferirConjunto, precisaCorda, sugestoesTubo, svgConjunto, textoTubo } from './desenhoConjunto';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const c = {
  bombaTipo: 'SUBMERSA', bombaMarca: 'Ebara', bombaModelo: '3BPS2-14', potenciaCv: 1, tensao: '220 V mono', estagios: 14, profundidadeBombaM: 36,
  tuboMaterial: 'PVC geomecânico', tuboDiametro: '1 1/4"', tuboBarras: 6, tuboMetros: 36, fioTipo: 'Cabo PP', fioBitola: '3 x 4 mm²', fioMetros: 46,
  cordaMaterial: 'Corda de nylon', cordaMetros: 40,
};

teste('conjunto: tubo por barra', () => {
  assert.deepStrictEqual(barrasDoConjunto(c), { barras: 6, comprimento: 6, total: 36 });
  assert.strictEqual(textoTubo(c), '6 barras de 6 m = 36 m');
  assert.strictEqual(textoTubo({ tuboBarras: 10 }), '10 barras (metros não informados)');
  assert.strictEqual(textoTubo({ tuboMetros: 42 }), '42 m');
  assert.strictEqual(textoTubo({}), '');
});

teste('conjunto: conferência', () => {
  const ok = conferirConjunto(c, { profundidadeM: 60, nivelDinamicoM: 25 });
  assert.ok(ok.every(x => x.ok), JSON.stringify(ok));
  assert.ok(ok.some(x => x.texto === 'Tubos (36 m) batem com a bomba a 36 m.') && ok.some(x => x.texto.includes('sobram 10 m até o quadro')));
  const ruim = conferirConjunto({ ...c, tuboMetros: 30, fioMetros: 34, cordaMetros: null }, { profundidadeM: 37, nivelDinamicoM: 38 });
  const textos = ruim.filter(x => !x.ok).map(x => x.texto);
  assert.ok(textos.some(t => t.startsWith('Tubos somam 30 m e a bomba está a 36 m (faltam 6 m)')), textos.join(' | '));
  assert.ok(textos.includes('Fio de 34 m não chega à bomba a 36 m.'));
  assert.ok(!textos.some(t => t.includes('corda')), 'PVC geomecânico (rosca): corda opcional');
  assert.ok(conferirConjunto({ ...c, tuboMaterial: 'PVC irrigação (soldado)', cordaMetros: null }).some(x => !x.ok && x.texto.includes('sem corda')));
  assert.ok(textos.includes('Bomba a 1 m do fundo: risco de puxar areia.'));
  assert.ok(textos.some(t => t.includes('acima do nível dinâmico')));
});

teste('conjunto: desenho com as emendas', () => {
  const svg = svgConjunto(c, { profundidadeM: 60, nivelEstaticoM: 12, nivelDinamicoM: 25 });
  assert.ok(svg.startsWith('<svg') && !svg.includes('NaN'));
  assert.strictEqual((svg.match(/Emenda /g) || []).length, 5);   // 6 barras = 5 emendas
  assert.ok(svg.includes('6 barras de 6 m = 36 m') && svg.includes('Bomba a 36 m') && svg.includes('Fio Cabo PP 3 x 4 mm² · 46 m'));
  assert.ok(!svgConjunto({}).includes('NaN'));
});

teste('conjunto: corda só no tubo que pede e regra de 3 do tubo', () => {
  assert.strictEqual(precisaCorda('PVC irrigação (soldado)'), true);
  assert.strictEqual(precisaCorda('Tubo flexível (Subteck/PEX)'), true);
  assert.strictEqual(precisaCorda('PVC geomecânico (rosca)'), false);
  assert.strictEqual(precisaCorda('Aço galvanizado'), false);
  assert.strictEqual(precisaCorda('PVC'), null);
  assert.deepStrictEqual(sugestoesTubo(64, null, 4), { barras: { valor: 16, exata: true }, comprimento: null, profundidade: null });
  assert.deepStrictEqual(sugestoesTubo(65, null, 6).barras, { valor: 11, exata: false });
  assert.strictEqual(sugestoesTubo(64, 16, null).comprimento, 4);
  assert.strictEqual(sugestoesTubo(null, 16, 4).profundidade, 64);
  assert.deepStrictEqual(sugestoesTubo(64, 16, 4), { barras: null, comprimento: null, profundidade: null });
});
