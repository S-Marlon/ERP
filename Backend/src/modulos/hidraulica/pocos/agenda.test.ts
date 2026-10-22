import assert from 'assert';
import { avisosDoCompromisso, CompromissoResumo, diasEntre, sobrepoe, validarCompromisso, validarEquipamento, validarMembro } from './agenda';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('agenda de poços: equipe e equipamentos', () => {
  assert.deepStrictEqual(validarMembro({ nome: ' João  ', funcao: 'perfurador', telefone: '(11) 9 8888-7777' }),
    { nome: 'João', funcao: 'PERFURADOR', telefone: '11988887777', observacao: null, ativo: 1 });
  assert.strictEqual(validarMembro({ nome: 'Zé', ativo: false }).ativo, 0);
  assert.throws(() => validarMembro({}), /nome/);
  assert.throws(() => validarMembro({ nome: 'Zé', funcao: 'GERENTE' }), /Função/);
  assert.deepStrictEqual(validarEquipamento({ nome: 'Sonda 1', tipo: 'sonda', identificacao: 'abc1d23', situacao: 'manutencao' }),
    { nome: 'Sonda 1', tipo: 'SONDA', identificacao: 'ABC1D23', situacao: 'MANUTENCAO', observacao: null });
  assert.throws(() => validarEquipamento({ nome: 'X', situacao: 'QUEBRADO' }), /Situação/);
});

teste('agenda de poços: compromisso', () => {
  const c = validarCompromisso({ titulo: 'Perfuração', dataInicio: '2026-10-26', dataFim: '2026-10-28', horaInicio: '07:30', equipe: [3, '3', 5, 0, 'x'], equipamentos: [1] });
  assert.deepStrictEqual([c.dataInicio, c.dataFim, c.horaInicio, c.tipo, c.situacao, c.equipe, c.equipamentos, c.idObra],
    ['2026-10-26', '2026-10-28', '07:30', 'OBRA', 'AGENDADO', [3, 5], [1], null]);
  assert.strictEqual(validarCompromisso({ titulo: 'Visita', dataInicio: '2026-10-26' }).dataFim, '2026-10-26');   // um dia
  assert.throws(() => validarCompromisso({ titulo: 'X', dataInicio: '2026-10-28', dataFim: '2026-10-26' }), /antes do início/);
  assert.throws(() => validarCompromisso({ titulo: 'X', dataInicio: '2026-02-30' }), /data inválida/);
  assert.throws(() => validarCompromisso({ titulo: 'X', dataInicio: '2026-10-26', horaInicio: '25:00' }), /Hora/);
  assert.throws(() => validarCompromisso({ titulo: 'X', dataInicio: '2026-01-01', dataFim: '2026-06-01' }), /no máximo/);
  assert.throws(() => validarCompromisso({ dataInicio: '2026-10-26' }), /título/);
  assert.strictEqual(diasEntre('2026-10-26', '2026-11-02'), 7);
});

teste('agenda de poços: sobreposição e avisos', () => {
  assert.ok(sobrepoe({ dataInicio: '2026-10-26', dataFim: '2026-10-28' }, { dataInicio: '2026-10-28', dataFim: '2026-10-30' }));   // encosta no último dia
  assert.ok(!sobrepoe({ dataInicio: '2026-10-26', dataFim: '2026-10-28' }, { dataInicio: '2026-10-29', dataFim: '2026-10-30' }));
  const c = (idAgenda: number, titulo: string, de: string, ate: string, equipe: number[], equip: [number, string?][], situacao = 'AGENDADO'): CompromissoResumo => ({
    idAgenda, titulo, dataInicio: de, dataFim: ate, situacao,
    equipe: equipe.map(id => ({ id, nome: `P${id}` })), equipamentos: equip.map(([id, s]) => ({ id, nome: `E${id}`, situacao: s })),
  });
  const a = c(1, 'Obra A', '2026-10-26', '2026-10-28', [1, 2], [[10, 'ATIVO'], [11, 'MANUTENCAO']]);
  const outros = [
    a,
    c(2, 'Obra B', '2026-10-28', '2026-10-29', [2], [[10]]),          // P2 e E10 no dia 28
    c(3, 'Obra C', '2026-10-27', '2026-10-27', [1], [], 'CANCELADO'),   // cancelado: não conta
    c(4, 'Obra D', '2026-11-05', '2026-11-05', [1], [[10]]),          // outra semana
  ];
  assert.deepStrictEqual(avisosDoCompromisso(a, outros).map(x => x.texto), [
    'E11 está em manutenção.',
    'P2 também está em "Obra B" (28/10 a 29/10).',
    'E10 também está em "Obra B" (28/10 a 29/10).',
  ]);
  assert.deepStrictEqual(avisosDoCompromisso({ ...a, situacao: 'REALIZADO' }, outros), []);
});
