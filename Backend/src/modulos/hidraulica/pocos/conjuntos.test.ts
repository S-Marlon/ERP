import assert from 'assert';
import { conjuntoDoRelatorio, idadeEmAnos, instalaConjunto, resumoConjunto, validarConjunto } from './conjuntos';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const HOJE = '2026-11-12';

teste('conjunto: validação', () => {
  const c = validarConjunto({ bombaTipo: 'submersa', bombaMarca: '  Ebara ', potenciaCv: '1,5', tuboBarras: '10.4', instaladoEm: '2024-03-01' }, HOJE);
  assert.deepStrictEqual([c.bombaTipo, c.bombaMarca, c.potenciaCv, c.tuboBarras, c.instaladoEm, c.fioBitola], ['SUBMERSA', 'Ebara', 1.5, 10, '2024-03-01', null]);
  assert.throws(() => validarConjunto({ observacao: 'só isso' }, HOJE), /ao menos/);
  assert.throws(() => validarConjunto({ bombaMarca: 'X', instaladoEm: '2027-01-01' }, HOJE), /futuro/);
  assert.throws(() => validarConjunto({ bombaMarca: 'X', instaladoEm: '2025-01-01', retiradoEm: '2024-01-01' }, HOJE), /antes da instalação/);
  assert.throws(() => validarConjunto({ bombaMarca: 'X', tuboMetros: '-3' }, HOJE), /Metros de tubo/);
  assert.throws(() => validarConjunto({ bombaTipo: 'roda', bombaMarca: 'X' }, HOJE), /Tipo de bomba/);
  assert.strictEqual(validarConjunto({ cabecaPoco: 'x'.repeat(300) }, HOJE).cabecaPoco!.length, 255, 'corta no tamanho da coluna');
});

teste('conjunto: vindo do relatório da obra', () => {
  assert.strictEqual(conjuntoDoRelatorio(null), null);
  const doRel = conjuntoDoRelatorio({ bombaProfundidade: 36, bombaQtdTubos: 6, bombaTamTubo: 6, bombaCabeamento: 'Cabo PP 3x4 mm', bombaCaboMetros: 46, bombaCorda: 'Corda de segurança', bombaCordaMetros: 40 })!;
  assert.deepStrictEqual([doRel.tuboBarras, doRel.tuboMetros, doRel.fioBitola, doRel.fioMetros, doRel.cordaMaterial, doRel.cordaMetros], [6, 36, 'Cabo PP 3x4 mm', 46, 'Corda de segurança', 40]);
  assert.strictEqual(conjuntoDoRelatorio({ bombaTuboUnidade: '"', cliente: 'José' }), null, 'só a unidade padrão não é bomba');
  const c = conjuntoDoRelatorio({ bombaMarca: 'Ebara', bombaQtdTubos: 10, bombaTamTubo: 6, bombaMedidaTubo: '1 1/4', bombaTuboUnidade: '"',
    bombaTubulacao: 'PVC geomecânico', bombaCabeamento: '3 x 4 mm²', bombaCavalete: 'galvanizado', bombaDtInstalacao: '2026-09-09T03:00:00Z' })!;
  assert.deepStrictEqual([c.tuboBarras, c.tuboMetros, c.profundidadeBombaM, c.tuboDiametro, c.fioBitola, c.cabecaPoco, c.instaladoEm],
    [10, 60, 60, '1 1/4"', '3 x 4 mm²', 'Cavalete: galvanizado', '2026-09-09'], 'sem profundidade informada usa os metros de tubo');
  assert.strictEqual(conjuntoDoRelatorio({ bombaMarca: 'Leão', bombaProfundidade: 48, bombaQtdTubos: 10, bombaTamTubo: 6 })!.profundidadeBombaM, 48);
});

teste('conjunto: resumo, idade e serviços', () => {
  assert.strictEqual(resumoConjunto({ bombaTipo: 'SUBMERSA', bombaMarca: 'Ebara', potenciaCv: 1.5, profundidadeBombaM: 60, tuboMaterial: 'PVC', tuboDiametro: '1 1/4"', tuboBarras: 10, fioBitola: '4 mm²', fioMetros: 70 }),
    'Submersa Ebara 1,5 CV · a 60 m · tubo PVC 1 1/4" (10 barras) · fio 4 mm² 70 m');
  assert.strictEqual(resumoConjunto({ motorMarca: 'Franklin', tuboMetros: 36 }), 'motor Franklin · tubo 36 m');
  assert.strictEqual(resumoConjunto({}), 'Conjunto sem descrição');
  assert.strictEqual(idadeEmAnos('2021-11-13', HOJE), 4);
  assert.strictEqual(idadeEmAnos('2021-11-12', HOJE), 5);
  assert.strictEqual(idadeEmAnos(null, HOJE), null);
  assert.deepStrictEqual([instalaConjunto(['TROCA_BOMBA']), instalaConjunto(['LIMPEZA', 'MANUTENCAO'])], [true, false]);
});
