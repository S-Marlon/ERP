// Obras de poços › agenda, equipe e sonda (etapa 5): regras puras. Equipe e equipamentos são cadastros do próprio
// módulo (não usam os funcionários nem a frota da loja). O compromisso pode durar vários dias; o sistema avisa (sem
// bloquear) quando a mesma pessoa ou o mesmo equipamento está em dois compromissos ao mesmo tempo, ou quando o
// equipamento está em manutenção/inativo.
import { ErroObra } from './obras';

export const FUNCOES_EQUIPE = ['PERFURADOR', 'AJUDANTE', 'MOTORISTA', 'ELETRICISTA', 'OUTRO'] as const;
export const TIPOS_EQUIPAMENTO = ['SONDA', 'CAMINHAO', 'COMPRESSOR', 'BOMBA_TESTE', 'GERADOR', 'OUTRO'] as const;
export const SITUACOES_EQUIPAMENTO = ['ATIVO', 'MANUTENCAO', 'INATIVO'] as const;
export const TIPOS_AGENDA = ['OBRA', 'VISITA_ORCAMENTO', 'MANUTENCAO', 'OUTRO'] as const;
export const SITUACOES_AGENDA = ['AGENDADO', 'REALIZADO', 'CANCELADO'] as const;
export const DIAS_MAXIMOS = 90;

const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || null;
const opcao = <T extends readonly string[]>(lista: T, v: unknown, padrao: T[number], nome: string): T[number] => {
  if (v === undefined || v === null || v === '') return padrao;
  const s = String(v).toUpperCase();
  if (!(lista as readonly string[]).includes(s)) throw new ErroObra(`${nome} inválido(a): ${v}.`);
  return s as T[number];
};
const ativo = (v: unknown) => (v === false || v === 0 || v === '0' ? 0 : 1);

export const validarMembro = (b: any) => {
  const nome = texto(b?.nome, 100);
  if (!nome) throw new ErroObra('Informe o nome de quem está na equipe.');
  const telefone = String(b?.telefone ?? '').replace(/\D/g, '').slice(0, 20) || null;
  return { nome, funcao: opcao(FUNCOES_EQUIPE, b?.funcao, 'AJUDANTE', 'Função'), telefone, observacao: texto(b?.observacao, 255), ativo: ativo(b?.ativo) };
};

export const validarEquipamento = (b: any) => {
  const nome = texto(b?.nome, 100);
  if (!nome) throw new ErroObra('Dê um nome ao equipamento (ex.: Sonda roto-pneumática 1).');
  return {
    nome, tipo: opcao(TIPOS_EQUIPAMENTO, b?.tipo, 'OUTRO', 'Tipo'), identificacao: texto(b?.identificacao, 30)?.toUpperCase() ?? null,
    situacao: opcao(SITUACOES_EQUIPAMENTO, b?.situacao, 'ATIVO', 'Situação'), observacao: texto(b?.observacao, 255),
  };
};

const lerDia = (v: unknown, nome: string) => {
  const s = String(v ?? '').slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new ErroObra(`${nome}: data inválida.`);
  return s;
};
export const diasEntre = (de: string, ate: string) => Math.round((new Date(`${ate}T12:00:00`).getTime() - new Date(`${de}T12:00:00`).getTime()) / 86400000);
const ids = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map(Number).filter(n => Number.isInteger(n) && n > 0))];

/** Compromisso: título, início e fim (fim vazio = um dia), hora opcional "HH:MM", quem vai e o que vai. */
export const validarCompromisso = (b: any) => {
  const titulo = texto(b?.titulo, 150);
  if (!titulo) throw new ErroObra('Dê um título ao compromisso (ex.: Perfuração - Sítio São José).');
  const dataInicio = lerDia(b?.dataInicio, 'Início');
  const dataFim = b?.dataFim ? lerDia(b.dataFim, 'Fim') : dataInicio;
  if (dataFim < dataInicio) throw new ErroObra('O fim não pode ser antes do início.');
  if (diasEntre(dataInicio, dataFim) > DIAS_MAXIMOS) throw new ErroObra(`Compromisso de no máximo ${DIAS_MAXIMOS} dias.`);
  const hora = String(b?.horaInicio ?? '').trim();
  if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora.slice(0, 5))) throw new ErroObra('Hora inválida (use 07:30).');
  return {
    idObra: Number(b?.idObra) > 0 ? Number(b.idObra) : null, tipo: opcao(TIPOS_AGENDA, b?.tipo, 'OBRA', 'Tipo'), titulo, local: texto(b?.local, 150),
    dataInicio, dataFim, horaInicio: hora ? hora.slice(0, 5) : null, situacao: opcao(SITUACOES_AGENDA, b?.situacao, 'AGENDADO', 'Situação'),
    observacao: texto(b?.observacao, 255), equipe: ids(b?.equipe), equipamentos: ids(b?.equipamentos),
  };
};

/** Dois períodos (datas inclusive) se encontram? */
export const sobrepoe = (a: { dataInicio: string; dataFim: string }, b: { dataInicio: string; dataFim: string }) => a.dataInicio <= b.dataFim && b.dataInicio <= a.dataFim;

export interface CompromissoResumo {
  idAgenda: number; titulo: string; dataInicio: string; dataFim: string; situacao: string;
  equipe: { id: number; nome: string }[]; equipamentos: { id: number; nome: string; situacao?: string }[];
}
export interface Aviso { tipo: 'PESSOA' | 'EQUIPAMENTO' | 'INDISPONIVEL'; texto: string }

const br = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const periodo = (c: { dataInicio: string; dataFim: string }) => (c.dataInicio === c.dataFim ? br(c.dataInicio) : `${br(c.dataInicio)} a ${br(c.dataFim)}`);

/**
 * Avisos do compromisso: pessoa ou equipamento também escalado em outro compromisso que se sobrepõe (cancelados não
 * contam), e equipamento em manutenção/inativo. Compromisso cancelado ou realizado não gera aviso.
 */
export const avisosDoCompromisso = (c: CompromissoResumo, outros: CompromissoResumo[]): Aviso[] => {
  if (c.situacao !== 'AGENDADO') return [];
  const avisos: Aviso[] = [];
  for (const e of c.equipamentos) {
    if (e.situacao === 'MANUTENCAO' || e.situacao === 'INATIVO') {
      avisos.push({ tipo: 'INDISPONIVEL', texto: `${e.nome} está ${e.situacao === 'MANUTENCAO' ? 'em manutenção' : 'inativo'}.` });
    }
  }
  for (const o of outros) {
    if (o.idAgenda === c.idAgenda || o.situacao === 'CANCELADO' || !sobrepoe(c, o)) continue;
    for (const p of c.equipe) if (o.equipe.some(x => x.id === p.id)) avisos.push({ tipo: 'PESSOA', texto: `${p.nome} também está em "${o.titulo}" (${periodo(o)}).` });
    for (const e of c.equipamentos) if (o.equipamentos.some(x => x.id === e.id)) avisos.push({ tipo: 'EQUIPAMENTO', texto: `${e.nome} também está em "${o.titulo}" (${periodo(o)}).` });
  }
  return avisos;
};
