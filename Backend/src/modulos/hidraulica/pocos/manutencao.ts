// Obras de poços › histórico e manutenção do poço (etapa 6): regras puras. A linha do tempo junta as obras do poço e os
// registros avulsos (medição, visita, observação, problema); o plano de manutenção calcula a próxima data pela última
// obra concluída com o serviço (ou pela data informada, para poço antigo); e a garantia vencendo vira aviso.
import { ErroObra, garantiaAte } from './obras';
import { codigosValidos, rotuloOcorrencia } from './ocorrencias';

export const TIPOS_REGISTRO = ['MEDICAO', 'VISITA', 'OBSERVACAO', 'PROBLEMA'] as const;
export const SERVICOS_PLANO = ['LIMPEZA', 'MANUTENCAO', 'TROCA_BOMBA', 'TESTE_VAZAO', 'OUTRO'] as const;
export const AVISO_DIAS = 30;

const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || null;
const numero = (v: unknown, nome: string, max = 1e7) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > max) throw new ErroObra(`${nome}: número inválido.`);
  return Math.round(n * 100) / 100;
};
const lerDia = (v: unknown, nome: string) => {
  const s = String(v ?? '').slice(0, 10);
  const d = new Date(`${s}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new ErroObra(`${nome}: data inválida.`);
  return s;
};
const opcao = <T extends readonly string[]>(lista: T, v: unknown, padrao: T[number], nome: string): T[number] => {
  if (v === undefined || v === null || v === '') return padrao;
  const s = String(v).toUpperCase();
  if (!(lista as readonly string[]).includes(s)) throw new ErroObra(`${nome} inválido(a): ${v}.`);
  return s as T[number];
};

/**
 * Registro avulso: a medição precisa de ao menos um número; os outros tipos, de uma descrição ou do checklist de
 * ocorrências (água turva, oscilação de energia...). Data no futuro, não.
 */
export const validarRegistro = (b: any, hoje: string) => {
  const tipo = opcao(TIPOS_REGISTRO, b?.tipo, 'OBSERVACAO', 'Tipo');
  const data = lerDia(b?.data || hoje, 'Data');
  if (data > hoje) throw new ErroObra('A data do registro não pode ser no futuro.');
  const r = {
    tipo, data, descricao: texto(b?.descricao, 255),
    nivelEstaticoM: numero(b?.nivelEstaticoM, 'Nível estático', 2000), nivelDinamicoM: numero(b?.nivelDinamicoM, 'Nível dinâmico', 2000), vazaoLh: numero(b?.vazaoLh, 'Vazão'),
    ocorrencias: codigosValidos(b?.ocorrencias),
  };
  if (tipo === 'MEDICAO' && r.nivelEstaticoM === null && r.nivelDinamicoM === null && r.vazaoLh === null) throw new ErroObra('Informe ao menos uma medida (nível estático, dinâmico ou vazão).');
  if (tipo !== 'MEDICAO' && !r.descricao && !r.ocorrencias.length) throw new ErroObra('Descreva o registro ou marque o que foi encontrado.');
  return r;
};

export const validarPlano = (b: any) => {
  const meses = Math.floor(Number(b?.aCadaMeses));
  if (!Number.isFinite(meses) || meses < 1 || meses > 120) throw new ErroObra('Periodicidade: de 1 a 120 meses.');
  return {
    servico: opcao(SERVICOS_PLANO, b?.servico, 'LIMPEZA', 'Serviço'), descricao: texto(b?.descricao, 150), aCadaMeses: meses,
    ultimaInformada: b?.ultimaInformada ? lerDia(b.ultimaInformada, 'Última vez') : null, ativo: b?.ativo === false || b?.ativo === 0 ? 0 : 1,
  };
};

const somarDias = (s: string, dias: number) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };
export type SituacaoPlano = 'VENCIDA' | 'A_VENCER' | 'EM_DIA' | 'SEM_BASE';

/**
 * Próxima manutenção: a última vez (a mais recente entre a última obra concluída com o serviço e a data informada) +
 * a periodicidade. Vencida se já passou; a vencer se cai nos próximos 30 dias; sem base se nunca foi feita.
 */
export const situacaoDoPlano = (p: { aCadaMeses: number; ultimaInformada: string | null }, ultimaObra: string | null, hoje: string) => {
  const ultima = [p.ultimaInformada, ultimaObra].filter((x): x is string => !!x).sort().pop() ?? null;
  const proxima = ultima ? garantiaAte(ultima, p.aCadaMeses) : null;
  const situacao: SituacaoPlano = !proxima ? 'SEM_BASE' : proxima < hoje ? 'VENCIDA' : proxima <= somarDias(hoje, AVISO_DIAS) ? 'A_VENCER' : 'EM_DIA';
  return { ultima, origemUltima: !ultima ? null : ultima === ultimaObra ? 'OBRA' as const : 'INFORMADA' as const, proxima, situacao };
};

/** A data da última obra concluída de cada serviço (para o plano do poço). */
export const ultimaPorServico = (obras: { servicos: string[]; situacao: string; dataTermino: string | null }[]) => {
  const m: Record<string, string> = {};
  for (const o of obras) {
    if (o.situacao !== 'CONCLUIDA' || !o.dataTermino) continue;
    for (const s of o.servicos) if (!m[s] || o.dataTermino > m[s]) m[s] = o.dataTermino;
  }
  return m;
};

export interface EventoPoco { data: string; tipo: string; titulo: string; detalhe: string | null; idObra?: number; idRegistro?: number }

/** Linha do tempo do poço, do mais recente para o mais antigo: obras (pela conclusão, início ou criação) e registros. */
export const linhaDoTempo = (
  obras: { idObra: number; titulo: string; situacao: string; servicos: string[]; criadaEm: string; dataInicio: string | null; dataTermino: string | null; garantiaAte: string | null }[],
  registros: { idRegistro: number; data: string; tipo: string; descricao: string | null; nivelEstaticoM: number | null; nivelDinamicoM: number | null; vazaoLh: number | null; ocorrencias?: string[] }[],
): EventoPoco[] => {
  const medidas = (r: typeof registros[number]) => [
    r.nivelEstaticoM !== null ? `NE ${String(r.nivelEstaticoM).replace('.', ',')} m` : null,
    r.nivelDinamicoM !== null ? `ND ${String(r.nivelDinamicoM).replace('.', ',')} m` : null,
    r.vazaoLh !== null ? `${r.vazaoLh.toLocaleString('pt-BR')} L/h` : null,
  ].filter(Boolean).join(' · ');
  const ev: EventoPoco[] = [
    ...obras.map(o => ({
      data: o.dataTermino || o.dataInicio || o.criadaEm, tipo: 'OBRA', titulo: o.titulo, idObra: o.idObra,
      detalhe: [o.situacao === 'CONCLUIDA' ? 'concluída' : o.situacao === 'EM_EXECUCAO' ? 'em execução' : o.situacao === 'CANCELADA' ? 'cancelada' : 'em orçamento',
        o.garantiaAte ? `garantia até ${o.garantiaAte.slice(8, 10)}/${o.garantiaAte.slice(5, 7)}/${o.garantiaAte.slice(0, 4)}` : null].filter(Boolean).join(' · '),
    })),
    ...registros.map(r => ({
      data: r.data, tipo: r.tipo, idRegistro: r.idRegistro,
      titulo: r.tipo === 'MEDICAO' ? 'Medição' : r.tipo === 'VISITA' ? 'Visita' : r.tipo === 'PROBLEMA' ? 'Problema' : 'Observação',
      detalhe: [medidas(r), (r.ocorrencias || []).map(rotuloOcorrencia).join(', '), r.descricao].filter(Boolean).join(' · ') || null,
    })),
  ];
  return ev.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : (b.idObra ?? 0) - (a.idObra ?? 0)));
};

/** Garantia que vence nos próximos 30 dias (hora de oferecer uma revisão). */
export const garantiaVencendo = (garantiaAteData: string | null, hoje: string) => !!garantiaAteData && garantiaAteData >= hoje && garantiaAteData <= somarDias(hoje, AVISO_DIAS);
