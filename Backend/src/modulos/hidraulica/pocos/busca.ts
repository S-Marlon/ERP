// Obras de poços › busca geral: um campo só para achar cliente, poço ou contrato (obra) por nome, telefone, CPF/CNPJ,
// identificação do poço, cidade/endereço ou número do contrato. Regras puras (sem banco), com teste.

export interface TermoBusca {
  /** O texto digitado, sem espaços sobrando. */
  texto: string;
  /** Só os dígitos (telefone, CPF/CNPJ), quando há 3 ou mais; senão vazio. */
  digitos: string;
  /** Número de contrato/obra quando o texto é só um número ("12", "nº 12", "#12", "contrato 12"). */
  numero: number | null;
}

/** O que o operador digitou, já separado em texto, dígitos e número de contrato. null = curto demais para buscar. */
export const interpretarBusca = (q: unknown): TermoBusca | null => {
  const texto = String(q ?? '').trim().replace(/\s+/g, ' ');
  const m = texto.match(/^(?:n[ºo°]\.?\s*|#\s*|contrato\s*(?:n[ºo°]\.?\s*)?|obra\s*(?:n[ºo°]\.?\s*)?)?(\d{1,7})$/i);
  if (texto.length < 2 && !m) return null;
  const digitos = texto.replace(/\D/g, '');
  return { texto, digitos: digitos.length >= 3 ? digitos : '', numero: m ? Number(m[1]) : null };
};

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Quanto o valor bate com o termo: 3 igual, 2 começa com, 1 contém, 0 não bate (sem acento e sem maiúsculas). */
export const pontuar = (valor: string | number | null | undefined, termo: string) => {
  if (valor === null || valor === undefined || !termo) return 0;
  const v = semAcento(String(valor)), t = semAcento(termo);
  if (v === t) return 3;
  if (v.startsWith(t) || v.split(/[\s,.\-/]+/).some(p => p.startsWith(t))) return 2;
  return v.includes(t) ? 1 : 0;
};

/** Ordena pelo melhor campo de cada um (o que bate mais primeiro; empate mantém a ordem do banco) e corta no limite. */
export const ordenarPorRelevancia = <T,>(lista: T[], campos: (x: T) => Array<string | number | null | undefined>, termo: TermoBusca, limite = 8): T[] =>
  lista
    .map((x, i) => {
      const valores = campos(x);
      const porTexto = Math.max(0, ...valores.map(v => pontuar(v, termo.texto)));
      const porDigitos = termo.digitos ? Math.max(0, ...valores.map(v => (v !== null && v !== undefined && String(v).replace(/\D/g, '').includes(termo.digitos) ? 1 : 0))) : 0;
      return { x, i, p: Math.max(porTexto, porDigitos) };
    })
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .slice(0, limite)
    .map(r => r.x);

export type TipoContrato = 'FORMAL' | 'INFORMAL' | 'ORCAMENTO' | 'CANCELADO';

/**
 * Formal = contrato assinado; informal = obra fechada (sinal, execução ou concluída) sem contrato assinado no sistema
 * (combinado de boca ou por mensagem). Orçamento ainda não virou contrato; cancelada fica à parte.
 */
export const tipoDoContrato = (situacao: string, assinado: boolean): TipoContrato => {
  if (situacao === 'CANCELADA') return 'CANCELADO';
  if (assinado) return 'FORMAL';
  return situacao === 'ORCAMENTO' ? 'ORCAMENTO' : 'INFORMAL';
};

const temValor = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';

/** O relatório técnico da obra tem dados de campo (perfuração, revestimento, bomba ou teste), não só o cabeçalho. */
export const relatorioPreenchido = (r: Record<string, any> | null | undefined) => {
  if (!r || typeof r !== 'object') return false;
  const linhas = (l: unknown, campos: string[]) => Array.isArray(l) && l.some(x => x && campos.some(c => temValor(x[c])));
  return ['profundidade', 'bombaMarca', 'bombaNivelEstatico', 'bombaNivelDinamico', 'testeVazaoDuracao', 'testeVazaoEstabilizada', 'vazaoAprox'].some(c => temValor(r[c]))
    || linhas(r.perfuracoes, ['perfAte', 'perfDiam']) || linhas(r.revestimentos, ['revAte', 'revMaterial']);
};
