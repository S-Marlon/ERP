// Desempenho dos anúncios no ML: visitas, vendas e conversão dos últimos dias comparados com o período anterior
// (como o painel do ML mostra), e quantos dias o estoque no ML dura no ritmo de venda. Visitas vêm do ML (por dia);
// vendas vêm dos pedidos do ML importados no ERP (só os pagos contam).

export const DIAS_PADRAO = 30;

export interface Periodo { de: string; ate: string }   // AAAA-MM-DD, inclusive

const dia = (d: Date) => d.toISOString().slice(0, 10);
const somarDias = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** Os últimos `dias` até ontem (o dia de hoje ainda está incompleto, como no painel do ML) e o mesmo tanto antes. */
export const periodos = (hoje: Date, dias = DIAS_PADRAO): { atual: Periodo; anterior: Periodo } => {
  const ontem = somarDias(new Date(`${dia(hoje)}T00:00:00Z`), -1);
  const ini = somarDias(ontem, -(dias - 1));
  return {
    atual: { de: dia(ini), ate: dia(ontem) },
    anterior: { de: dia(somarDias(ini, -dias)), ate: dia(somarDias(ini, -1)) },
  };
};

const dentro = (data: string, p: Periodo) => { const d = data.slice(0, 10); return d >= p.de && d <= p.ate; };

/** Visitas no período, a partir da lista por dia do ML ({ date, total }). */
export const visitasNoPeriodo = (porDia: { date: string; total: number }[], p: Periodo) =>
  porDia.filter(x => dentro(String(x.date || ''), p)).reduce((s, x) => s + (Number(x.total) || 0), 0);

export interface PedidoResumo { data: string; pago: boolean; itens: { mlbId: string; quantidade: number }[] }
export interface Vendas { vendas: number; unidades: number }

/** Vendas (pedidos pagos) e unidades de cada MLB no período. */
export const vendasNoPeriodo = (pedidos: PedidoResumo[], p: Periodo) => {
  const mapa = new Map<string, Vendas>();
  for (const ped of pedidos) {
    if (!ped.pago || !dentro(ped.data, p)) continue;
    const vistos = new Set<string>();
    for (const i of ped.itens) {
      const v = mapa.get(i.mlbId) || { vendas: 0, unidades: 0 };
      if (!vistos.has(i.mlbId)) { v.vendas += 1; vistos.add(i.mlbId); }   // um pedido = uma venda do anúncio
      v.unidades += Number(i.quantidade) || 0;
      mapa.set(i.mlbId, v);
    }
  }
  return mapa;
};

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Conversão do ML: vendas ÷ visitas, em %. Sem visitas: null. */
export const conversao = (vendas: number, visitas: number) => (visitas > 0 ? r1((vendas / visitas) * 100) : null);

/** Variação em % sobre o período anterior. Sem base (antes 0): null, ou 'novo' quando agora tem. */
export const variacao = (atual: number, antes: number | null): number | 'novo' | null => {
  if (antes === null) return null;
  if (antes === 0) return atual > 0 ? 'novo' : null;
  return r1(((atual - antes) / antes) * 100);
};

export interface Numeros { visitas: number; vendas: number; unidades: number; conversao: number | null }
export const numeros = (visitas: number, v: Vendas | undefined): Numeros => ({
  visitas, vendas: v?.vendas ?? 0, unidades: v?.unidades ?? 0, conversao: conversao(v?.vendas ?? 0, visitas),
});

/** Soma de várias linhas (anúncio com variações). */
export const somar = (lista: Numeros[]): Numeros => {
  const visitas = lista.reduce((s, n) => s + n.visitas, 0);
  const vendas = lista.reduce((s, n) => s + n.vendas, 0);
  return { visitas, vendas, unidades: lista.reduce((s, n) => s + n.unidades, 0), conversao: conversao(vendas, visitas) };
};

/** Dias que o estoque no ML dura no ritmo de venda do período; null sem venda (não dá para estimar). */
export const coberturaDias = (estoqueMl: number, unidadesNoPeriodo: number, dias = DIAS_PADRAO) =>
  unidadesNoPeriodo > 0 ? Math.floor(Math.max(0, estoqueMl) / (unidadesNoPeriodo / dias)) : null;
