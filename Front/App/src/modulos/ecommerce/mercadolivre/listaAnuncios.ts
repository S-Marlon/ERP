// Regras da lista de anúncios: resumo do lucro de cada anúncio (pior item manda) e os filtros rápidos. Regras puras,
// testadas em listaAnuncios.test.ts.
import type { AnuncioResumo, FinanceiroItem } from './mercadoLivreApi';

export type FiltroLista = 'todos' | 'pendentes' | 'prontos' | 'publicados' | 'pausados' | 'lucroBaixo' | 'degrau' | 'semEstoque';

// do pior para o melhor: é o pior item que pede atenção
const ORDEM_NIVEL: FinanceiroItem['nivel'][] = ['PREJUIZO', 'BAIXO', 'SEM_CUSTO', 'BOM', 'ALTO'];

export interface ResumoFinanceiro {
  recebeMin: number; recebeMax: number; lucroMin: number; lucroMax: number;
  pctMin: number | null; nivel: FinanceiroItem['nivel']; freteDesconhecido: boolean; comFrete: number;
  degraus: number;              // itens perdendo dinheiro num degrau de preço (taxa fixa, frete de R$ 79)
}

export const resumirFinanceiro = (itens: FinanceiroItem[] | undefined): ResumoFinanceiro | null => {
  if (!itens?.length) return null;
  const pcts = itens.map(i => i.lucroSobreCustoPct).filter((v): v is number => v !== null);
  return {
    recebeMin: Math.min(...itens.map(i => i.recebe)), recebeMax: Math.max(...itens.map(i => i.recebe)),
    lucroMin: Math.min(...itens.map(i => i.lucro)), lucroMax: Math.max(...itens.map(i => i.lucro)),
    pctMin: pcts.length ? Math.min(...pcts) : null,
    nivel: [...itens].sort((a, b) => ORDEM_NIVEL.indexOf(a.nivel) - ORDEM_NIVEL.indexOf(b.nivel))[0].nivel,
    freteDesconhecido: itens.some(i => i.freteDesconhecido),
    comFrete: itens.filter(i => i.frete > 0).length,
    degraus: itens.filter(i => (i.alertas || []).some(a => a.grave)).length,
  };
};

export const lucroBaixo = (r: ResumoFinanceiro | null) => !!r && (r.nivel === 'PREJUIZO' || r.nivel === 'BAIXO');
export const semEstoqueNoMl = (a: AnuncioResumo) => a.ativosMl + a.pausadosMl > 0 && a.estoqueMl === 0;

export const passaNoFiltro = (a: AnuncioResumo, fin: ResumoFinanceiro | null, filtro: FiltroLista) => {
  switch (filtro) {
    case 'pendentes': return a.situacao === 'RASCUNHO' && a.preparo === 'PENDENTE';
    case 'prontos': return a.situacao === 'RASCUNHO' && a.preparo === 'PRONTO';
    case 'publicados': return a.situacao !== 'RASCUNHO';
    case 'pausados': return a.pausadosMl > 0;
    case 'lucroBaixo': return lucroBaixo(fin);
    case 'degrau': return !!fin && fin.degraus > 0;
    case 'semEstoque': return semEstoqueNoMl(a);
    default: return true;
  }
};

/** Faixa de valores "R$ a – R$ b" (ou um só). */
export const faixaMoeda = (min: number, max: number, formatar: (v: number) => string) =>
  (Math.abs(max - min) < 0.005 ? formatar(min) : `${formatar(min)} a ${formatar(max)}`);

/**
 * Preço "de prateleira" para o alvo: o próximo final ,90 que não fica abaixo do mínimo. Não passa de R$ 79 por causa do
 * arredondamento (lá o frete grátis fica mais caro): nesse caso usa R$ 78,90 ou o mínimo exato.
 */
export const precoComercial = (minimo: number, limiteFrete = 79) => {
  const centavos = Math.ceil(Math.round(minimo * 1000) / 10);    // mínimo em centavos, arredondado para cima
  let p = Math.floor(centavos / 100) * 100 + 90;
  if (p < centavos) p += 100;
  const preco = p / 100;
  if (minimo < limiteFrete && preco >= limiteFrete) return minimo <= 78.9 ? 78.9 : centavos / 100;
  return preco;
};
