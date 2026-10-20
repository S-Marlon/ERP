// Painel do financeiro (sem banco): fluxo previsto por dia ou semana com o saldo acumulado, atrasados por faixa e os
// meses do realizado. Datas sempre como texto 'AAAA-MM-DD' (contas em UTC, sem deslocar fuso).

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const paraData = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
const paraTexto = (d: Date) => d.toISOString().slice(0, 10);
export const somarDias = (s: string, dias: number) => { const d = paraData(s); d.setUTCDate(d.getUTCDate() + dias); return paraTexto(d); };
export const diasEntre = (de: string, ate: string) => Math.round((paraData(ate).getTime() - paraData(de).getTime()) / 86400000);

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export type Agrupamento = 'dia' | 'semana';
export interface Lancamento { data: string; valor: number; tipo: 'ENTRADA' | 'SAIDA' }
export interface PontoFluxo { chave: string; rotulo: string; de: string; ate: string; entradas: number; saidas: number; saldo: number; acumulado: number }

/** Início do período do lançamento: o próprio dia ou a segunda-feira da semana. */
export const inicioDoPeriodo = (data: string, agrupamento: Agrupamento) => {
  if (agrupamento === 'dia') return data.slice(0, 10);
  const dia = paraData(data).getUTCDay();             // 0 = domingo
  return somarDias(data, -((dia + 6) % 7));
};

/**
 * Fluxo de hoje até hoje + dias: entradas, saídas, saldo do período e o acumulado. Lançamento vencido (antes de hoje)
 * fica fora: aparece nos atrasados. Períodos sem lançamento entram zerados (o gráfico não pula dias).
 */
export const montarFluxo = (lancamentos: Lancamento[], op: { hoje: string; dias: number; agrupamento: Agrupamento }): PontoFluxo[] => {
  const fim = somarDias(op.hoje, op.dias - 1);
  const pontos = new Map<string, PontoFluxo>();
  for (let d = inicioDoPeriodo(op.hoje, op.agrupamento); d <= fim; d = somarDias(d, op.agrupamento === 'dia' ? 1 : 7)) {
    const ate = op.agrupamento === 'dia' ? d : somarDias(d, 6);
    const de = d < op.hoje ? op.hoje : d;
    const rotulo = op.agrupamento === 'dia' ? `${DIAS_SEMANA[paraData(d).getUTCDay()]} ${ddmm(d)}` : `${ddmm(de)} a ${ddmm(ate > fim ? fim : ate)}`;
    pontos.set(d, { chave: d, rotulo, de, ate: ate > fim ? fim : ate, entradas: 0, saidas: 0, saldo: 0, acumulado: 0 });
  }
  for (const l of lancamentos) {
    const data = l.data.slice(0, 10);
    if (data < op.hoje || data > fim) continue;
    const p = pontos.get(inicioDoPeriodo(data, op.agrupamento));
    if (!p) continue;
    if (l.tipo === 'ENTRADA') p.entradas = r2(p.entradas + l.valor); else p.saidas = r2(p.saidas + l.valor);
  }
  let acumulado = 0;
  return [...pontos.values()].map(p => {
    const saldo = r2(p.entradas - p.saidas);
    acumulado = r2(acumulado + saldo);
    return { ...p, saldo, acumulado };
  });
};

export const FAIXAS_ATRASO = ['1 a 15 dias', '16 a 30 dias', '31 a 60 dias', 'mais de 60 dias'] as const;
export const faixaDeAtraso = (dias: number) =>
  dias <= 15 ? FAIXAS_ATRASO[0] : dias <= 30 ? FAIXAS_ATRASO[1] : dias <= 60 ? FAIXAS_ATRASO[2] : FAIXAS_ATRASO[3];

/** Vencidos (vencimento antes de hoje) por faixa de atraso; as quatro faixas sempre aparecem. */
export const atrasosPorFaixa = (titulos: { vencimento: string; valor: number }[], hoje: string) => {
  const faixas = FAIXAS_ATRASO.map(faixa => ({ faixa, valor: 0, qtd: 0 }));
  for (const t of titulos) {
    const dias = diasEntre(t.vencimento, hoje);
    if (dias <= 0) continue;
    const f = faixas.find(x => x.faixa === faixaDeAtraso(dias))!;
    f.valor = r2(f.valor + t.valor);
    f.qtd++;
  }
  return faixas;
};

/** Os últimos n meses até o de hoje, do mais antigo ao atual ('AAAA-MM'). */
export const ultimosMeses = (hoje: string, n: number) => {
  const ano = Number(hoje.slice(0, 4)), mes = Number(hoje.slice(5, 7)) - 1;
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(Date.UTC(ano, mes - (n - 1 - k), 1));
    return d.toISOString().slice(0, 7);
  });
};
export const rotuloMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
