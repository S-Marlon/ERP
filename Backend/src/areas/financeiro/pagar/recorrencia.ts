// Contas fixas (água, luz, aluguel, seguro...): quais meses (competências) cada uma gera e em que dia vence. Regras
// puras: o controller grava os títulos que faltam no contas a pagar (a chave única id_recorrente + competência impede
// duplicata). Datas como texto 'AAAA-MM-DD'.

export const PERIODICIDADES = { MENSAL: 1, BIMESTRAL: 2, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 } as const;
export type Periodicidade = keyof typeof PERIODICIDADES;

export interface ContaRecorrente {
  inicio: string;            // primeira competência (o dia é ignorado)
  fim: string | null;        // última competência (contrato); null = sem fim
  periodicidade: Periodicidade;
  diaVencimento: number;     // 1 a 31
}

const mesDe = (s: string) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7)) - 1;
const textoDoMes = (m: number) => `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-01`;

/** Vencimento da conta no mês da competência: o dia escolhido, ou o último dia nos meses mais curtos. */
export const vencimentoNaCompetencia = (competencia: string, dia: number) => {
  const ano = Number(competencia.slice(0, 4)), mes = Number(competencia.slice(5, 7));
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${competencia.slice(0, 7)}-${String(Math.min(Math.max(1, dia), ultimo)).padStart(2, '0')}`;
};

/**
 * Competências a gerar: do mês de `desde` (ou do início, se for depois) até o mês de `ate`, no passo da periodicidade
 * contado a partir do início (anual de março vence todo março), sem passar do fim.
 */
export const competenciasNoPeriodo = (c: ContaRecorrente, desde: string, ate: string): string[] => {
  const passo = PERIODICIDADES[c.periodicidade] || 1;
  const ini = mesDe(c.inicio);
  const ultimo = Math.min(mesDe(ate), c.fim ? mesDe(c.fim) : Infinity);
  const saida: string[] = [];
  for (let m = ini; m <= ultimo; m += passo) if (m >= mesDe(desde)) saida.push(textoDoMes(m));
  return saida;
};

/**
 * Títulos que faltam lançar: as competências do mês atual até o horizonte (meses à frente), sem as que já existem.
 * Mês passado não é gerado sozinho (o operador lança à mão se quiser).
 */
export const titulosQueFaltam = (c: ContaRecorrente, op: { hoje: string; horizonteMeses: number; existentes: string[] }) => {
  const ate = textoDoMes(mesDe(op.hoje) + op.horizonteMeses);
  const ja = new Set(op.existentes.map(e => e.slice(0, 7)));
  return competenciasNoPeriodo(c, op.hoje, ate)
    .filter(comp => !ja.has(comp.slice(0, 7)))
    .map(competencia => ({ competencia, vencimento: vencimentoNaCompetencia(competencia, c.diaVencimento) }));
};
