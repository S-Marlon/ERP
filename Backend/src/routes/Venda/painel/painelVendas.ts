// Central de Vendas (sem banco): períodos, comparação com o período anterior e série preenchida.

export type Periodo = 'hoje' | 'ontem' | '7dias' | 'mes' | '30dias' | 'personalizado';
export type Agrupamento = 'hora' | 'dia';

export interface Intervalo {
  de: string;          // AAAA-MM-DD (inclusive)
  ate: string;         // AAAA-MM-DD (inclusive)
  anteriorDe: string;  // mesmo tamanho, imediatamente antes
  anteriorAte: string;
  dias: number;
  agrupamento: Agrupamento;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const somarDias = (d: Date, n: number) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const lerData = (s?: string | null): Date | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [a, m, d] = s.split('-').map(Number);
  const x = new Date(a, m - 1, d);
  return x.getFullYear() === a && x.getMonth() === m - 1 ? x : null;
};

export const intervaloPeriodo = (periodo: string, hoje: Date, de?: string | null, ate?: string | null): Intervalo => {
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let ini = h;
  let fim = h;
  switch (periodo as Periodo) {
    case 'ontem': ini = fim = somarDias(h, -1); break;
    case '7dias': ini = somarDias(h, -6); break;
    case '30dias': ini = somarDias(h, -29); break;
    case 'mes': ini = new Date(h.getFullYear(), h.getMonth(), 1); break;
    case 'personalizado': {
      const a = lerData(de);
      const b = lerData(ate);
      if (a && b) { ini = a <= b ? a : b; fim = a <= b ? b : a; }
      break;
    }
    default: break; // hoje
  }
  const dias = Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1;
  // Mês corrente compara com o mesmo trecho do mês anterior (1 a N); os demais, com os N dias anteriores
  let anteriorIni = somarDias(ini, -dias);
  let anteriorFim = somarDias(ini, -1);
  if (periodo === 'mes') {
    anteriorIni = new Date(ini.getFullYear(), ini.getMonth() - 1, 1);
    const ultimoDiaMesAnterior = new Date(ini.getFullYear(), ini.getMonth(), 0).getDate();
    anteriorFim = new Date(ini.getFullYear(), ini.getMonth() - 1, Math.min(fim.getDate(), ultimoDiaMesAnterior));
  }
  return { de: iso(ini), ate: iso(fim), anteriorDe: iso(anteriorIni), anteriorAte: iso(anteriorFim), dias, agrupamento: dias === 1 ? 'hora' : 'dia' };
};

export const variacaoPct = (atual: number, anterior: number): number | null =>
  anterior > 0 ? Number((((atual - anterior) / anterior) * 100).toFixed(1)) : null;

export interface PontoSerie { chave: string; rotulo: string; total: number; qtd: number }

/** Série com todos os pontos do intervalo (horas 7h-20h ou cada dia), zerando os sem venda. */
export const preencherSerie = (linhas: Array<{ chave: string; total: number; qtd: number }>, intervalo: Intervalo): PontoSerie[] => {
  const mapa = new Map(linhas.map(l => [String(l.chave), l]));
  const pontos: PontoSerie[] = [];
  if (intervalo.agrupamento === 'hora') {
    const horas = linhas.map(l => Number(l.chave)).filter(n => Number.isFinite(n));
    const ini = Math.min(7, ...horas);
    const fim = Math.max(20, ...horas);
    for (let h = ini; h <= fim; h++) {
      const l = mapa.get(String(h));
      pontos.push({ chave: String(h), rotulo: `${String(h).padStart(2, '0')}h`, total: Number(l?.total) || 0, qtd: Number(l?.qtd) || 0 });
    }
    return pontos;
  }
  const ini = lerData(intervalo.de)!;
  for (let i = 0; i < intervalo.dias; i++) {
    const d = somarDias(ini, i);
    const chave = iso(d);
    const l = mapa.get(chave);
    pontos.push({ chave, rotulo: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, total: Number(l?.total) || 0, qtd: Number(l?.qtd) || 0 });
  }
  return pontos;
};

/** Margem líquida (%) sobre o faturamento: o que sobra depois do custo e das taxas de pagamento. */
export const margemLiquidaPct = (faturamento: number, custo: number, taxas: number): number | null =>
  faturamento > 0 ? Number((((faturamento - custo - taxas) / faturamento) * 100).toFixed(1)) : null;
