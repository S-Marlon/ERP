import { avaliarPublicacao, avaliarSaudeFamilia, mesclarAtributos, statusAposSaude } from './saudeFamilia';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const attr = (id: string, nome: string, classificacao: string, extra: Record<string, unknown> = {}) =>
  ({ id, nome, classificacao, obrigatorio: false, ...extra } as any);

export const runSaudeFamiliaTests = (): void => {
  const familiaOk = { status: 'ATIVO', templateSku: '{SIGLA}{S}{Eixo}x{Alojamento}', templateNomeComercial: '{FAMILIA} {Eixo}', siglaSku: 'RET' };
  const atributosOk = [
    attr('1', 'Material', 'dna', { valorPadraoGrupo: 'NBR' }),
    attr('2', 'Eixo', 'grade'),
    attr('3', 'Alojamento', 'grade'),
  ];
  const ok = avaliarSaudeFamilia(familiaOk, atributosOk);
  assert(ok.saudavel && ok.avisos.length === 0, 'Retentor NBR bem configurado deveria estar saudável.');

  const semGrade = avaliarSaudeFamilia({ ...familiaOk, templateSku: '{SIGLA}' }, [atributosOk[0]]);
  assert(semGrade.bloqueios.some(b => b.codigo === 'SEM_GRADE'), 'Família sem grade deveria bloquear.');

  const dnaVazio = avaliarSaudeFamilia(familiaOk, [attr('1', 'Material', 'dna'), ...atributosOk.slice(1)]);
  assert(dnaVazio.bloqueios.some(b => b.codigo === 'DNA_SEM_VALOR'), 'DNA sem valor fixo deveria bloquear.');

  const tokenRuim = avaliarSaudeFamilia({ ...familiaOk, templateSku: '{SIGLA}-{Diametro}' }, atributosOk);
  assert(tokenRuim.bloqueios.some(b => b.codigo === 'TOKEN_DESCONHECIDO'), 'Template com atributo inexistente deveria bloquear.');

  const semSigla = avaliarSaudeFamilia({ ...familiaOk, siglaSku: '' }, atributosOk);
  assert(semSigla.bloqueios.some(b => b.codigo === 'SIGLA_VAZIA'), 'Template com {SIGLA} e sigla vazia deveria bloquear.');

  const gradeFora = avaliarSaudeFamilia({ ...familiaOk, templateSku: '{SIGLA}' }, atributosOk);
  assert(gradeFora.saudavel && gradeFora.avisos.some(a => a.codigo === 'GRADE_FORA_DO_CODIGO'), 'Grade fora do código é aviso.');

  const marcaGrade = avaliarSaudeFamilia({ ...familiaOk, templateSku: '{SIGLA}-{MARCA}', templateNomeComercial: '{FAMILIA}', comportamentoMarca: 'grade' }, [atributosOk[0]]);
  assert(marcaGrade.saudavel, 'Marca como grade conta como atributo de grade.');

  assert(statusAposSaude('ATIVO', semGrade) === 'BLOQUEADO_INCONSISTENCIA', 'Ativa com bloqueio vira bloqueada.');
  assert(statusAposSaude('BLOQUEADO_INCONSISTENCIA', ok) === 'ATIVO', 'Bloqueada corrigida volta a ativa.');
  assert(statusAposSaude('RASCUNHO', semGrade) === 'RASCUNHO', 'Rascunho é respeitado mesmo com problemas.');

  const efetivos = mesclarAtributos([attr('1', 'Material', 'ficha')], [attr('1', 'Material', 'dna')]);
  assert(efetivos.length === 1 && efetivos[0].classificacao === 'dna', 'Atributo próprio da família sobrescreve o herdado.');

  const obrig = [attr('2', 'Eixo', 'grade', { obrigatorio: true }), attr('1', 'Material', 'dna', { obrigatorio: true, valorPadraoGrupo: 'NBR' })];
  const pub = avaliarPublicacao({ statusItem: 'ATIVO', exibirNoPdv: true, statusFamilia: 'ATIVO', obrigatorios: obrig, atributosComValor: new Set(['2']) });
  assert(pub.publicavel, 'Item com grade preenchida e DNA fixo na família é publicável.');
  const pend = avaliarPublicacao({ statusItem: 'ATIVO', exibirNoPdv: true, statusFamilia: 'RASCUNHO', obrigatorios: obrig, atributosComValor: new Set() });
  assert(!pend.publicavel && pend.motivos.length === 2, 'Família em rascunho e obrigatório vazio deveriam impedir a publicação.');
  assert(avaliarPublicacao({ statusItem: 'ATIVO', exibirNoPdv: true, statusFamilia: null, obrigatorios: [], atributosComValor: new Set() }).publicavel,
    'Item sem família e sem obrigatórios é publicável.');

  // Token com código da opção conta como o atributo (não é "token desconhecido")
  const comCodigo = avaliarSaudeFamilia(
    { status: 'ATIVO', templateSku: '1{Ângulo:cod}{SIGLA}-{Rosca JIC:cod}', templateNomeComercial: '{FAMILIA} - {Rosca JIC}', siglaSku: 'FJ' },
    [attr('1', 'Ângulo', 'grade'), attr('2', 'Rosca JIC', 'grade')]
  );
  assert(comCodigo.saudavel && comCodigo.avisos.length === 0, 'Template com {Atributo:cod} é saudável e a grade conta no código.');
};
