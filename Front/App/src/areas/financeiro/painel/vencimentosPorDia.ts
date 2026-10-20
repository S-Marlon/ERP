// Próximos vencimentos agrupados por dia, com o que entra e o que sai em cada um (lista do painel do financeiro).
import type { TituloPainel } from './painelFinanceiroApi';

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export interface DiaDeVencimento { data: string; rotulo: string; entra: number; sai: number; titulos: TituloPainel[] }

export const vencimentosPorDia = (titulos: TituloPainel[], hoje: string): DiaDeVencimento[] => {
  const dias = new Map<string, DiaDeVencimento>();
  const amanha = new Date(`${hoje}T00:00:00Z`);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  for (const t of [...titulos].sort((a, b) => a.vencimento.localeCompare(b.vencimento))) {
    let d = dias.get(t.vencimento);
    if (!d) {
      const semana = DIAS[new Date(`${t.vencimento}T00:00:00Z`).getUTCDay()];
      const nome = t.vencimento === hoje ? 'hoje' : t.vencimento === amanha.toISOString().slice(0, 10) ? 'amanhã' : semana;
      d = { data: t.vencimento, rotulo: `${nome}, ${t.vencimento.slice(8, 10)}/${t.vencimento.slice(5, 7)}`, entra: 0, sai: 0, titulos: [] };
      dias.set(t.vencimento, d);
    }
    if (t.tipo === 'RECEBER') d.entra = r2(d.entra + t.valor); else d.sai = r2(d.sai + t.valor);
    d.titulos.push(t);
  }
  return [...dias.values()];
};
