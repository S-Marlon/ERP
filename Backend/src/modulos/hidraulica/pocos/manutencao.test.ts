import assert from 'assert';
import { garantiaVencendo, linhaDoTempo, situacaoDoPlano, ultimaPorServico, validarPlano, validarRegistro } from './manutencao';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const hoje = '2026-10-22';

teste('manutenção de poço: registros avulsos', () => {
  const m = validarRegistro({ tipo: 'medicao', nivelEstaticoM: '18,5', vazaoLh: 4200 }, hoje);
  assert.deepStrictEqual(m, { tipo: 'MEDICAO', data: hoje, descricao: null, nivelEstaticoM: 18.5, nivelDinamicoM: null, vazaoLh: 4200, ocorrencias: [] });
  // visita só com o checklist (sem texto) vale; código que não existe é descartado
  assert.deepStrictEqual(validarRegistro({ tipo: 'VISITA', ocorrencias: ['chkEnergiaRuim', 'chkInventado'] }, hoje).ocorrencias, ['chkEnergiaRuim']);
  assert.throws(() => validarRegistro({ tipo: 'MEDICAO' }, hoje), /ao menos uma medida/);
  assert.throws(() => validarRegistro({ tipo: 'PROBLEMA' }, hoje), /Descreva/);
  assert.throws(() => validarRegistro({ tipo: 'VISITA', descricao: 'x', data: '2026-10-30' }, hoje), /futuro/);
  assert.throws(() => validarRegistro({ tipo: 'RUIDO', descricao: 'x' }, hoje), /Tipo/);
});

teste('manutenção de poço: plano e próxima data', () => {
  assert.deepStrictEqual(validarPlano({ servico: 'limpeza', aCadaMeses: '24', ultimaInformada: '2025-01-10' }),
    { servico: 'LIMPEZA', descricao: null, aCadaMeses: 24, ultimaInformada: '2025-01-10', ativo: 1 });
  assert.throws(() => validarPlano({ aCadaMeses: 0 }), /1 a 120/);
  const p = { aCadaMeses: 24, ultimaInformada: '2024-05-01' };
  assert.deepStrictEqual(situacaoDoPlano(p, null, hoje), { ultima: '2024-05-01', origemUltima: 'INFORMADA', proxima: '2026-05-01', situacao: 'VENCIDA' });
  assert.deepStrictEqual(situacaoDoPlano(p, '2024-11-10', hoje), { ultima: '2024-11-10', origemUltima: 'OBRA', proxima: '2026-11-10', situacao: 'A_VENCER' });   // a obra é mais recente
  assert.strictEqual(situacaoDoPlano({ aCadaMeses: 12, ultimaInformada: null }, '2026-03-01', hoje).situacao, 'EM_DIA');
  assert.deepStrictEqual(situacaoDoPlano({ aCadaMeses: 12, ultimaInformada: null }, null, hoje), { ultima: null, origemUltima: null, proxima: null, situacao: 'SEM_BASE' });
});

teste('manutenção de poço: última obra por serviço e garantia', () => {
  assert.deepStrictEqual(ultimaPorServico([
    { servicos: ['PERFURACAO', 'INSTALACAO'], situacao: 'CONCLUIDA', dataTermino: '2023-02-01' },
    { servicos: ['LIMPEZA'], situacao: 'CONCLUIDA', dataTermino: '2024-11-10' },
    { servicos: ['LIMPEZA'], situacao: 'CONCLUIDA', dataTermino: '2022-01-01' },
    { servicos: ['LIMPEZA'], situacao: 'EM_EXECUCAO', dataTermino: null },
  ]), { PERFURACAO: '2023-02-01', INSTALACAO: '2023-02-01', LIMPEZA: '2024-11-10' });
  assert.deepStrictEqual([garantiaVencendo('2026-11-15', hoje), garantiaVencendo('2026-12-15', hoje), garantiaVencendo('2026-10-01', hoje), garantiaVencendo(null, hoje)],
    [true, false, false, false]);
});

teste('manutenção de poço: linha do tempo', () => {
  const l = linhaDoTempo(
    [{ idObra: 7, titulo: 'Perfuração', situacao: 'CONCLUIDA', servicos: ['PERFURACAO'], criadaEm: '2023-01-05', dataInicio: '2023-01-20', dataTermino: '2023-02-01', garantiaAte: '2024-02-01' },
      { idObra: 9, titulo: 'Limpeza', situacao: 'ORCAMENTO', servicos: ['LIMPEZA'], criadaEm: '2026-10-01', dataInicio: null, dataTermino: null, garantiaAte: null }],
    [{ idRegistro: 3, data: '2025-06-10', tipo: 'MEDICAO', descricao: 'cliente reclamou de pouca água', nivelEstaticoM: 22.5, nivelDinamicoM: null, vazaoLh: 3000 }],
  );
  assert.deepStrictEqual(l.map(e => `${e.data} ${e.titulo}: ${e.detalhe}`), [
    '2026-10-01 Limpeza: em orçamento',
    '2025-06-10 Medição: NE 22,5 m · 3.000 L/h · cliente reclamou de pouca água',
    '2023-02-01 Perfuração: concluída · garantia até 01/02/2024',
  ]);
});
