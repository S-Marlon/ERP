// Margem abaixo do alvo: o preço segue a concorrência, mas o custo precisa cair. Calcula o lucro líquido
// (depois da taxa da maquininha embutida no preço) sobre o custo, compara com o alvo e diz o custo-alvo
// (quanto pagar ao fornecedor para chegar no alvo sem mexer no preço). Regras puras, testadas em margemAlvo.test.ts.

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const r4 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 10000) / 10000;

export interface ResultadoMargem {
  liquido: number;              // preço - taxa da maquininha
  lucro: number;                // líquido - custo
  lucroSobreCustoPct: number;   // (líquido / custo - 1) × 100  — o "alvo" é medido assim
  margemSobrePrecoPct: number;  // lucro / preço × 100 — para comparar
  abaixoDoAlvo: boolean;
  prejuizo: boolean;            // líquido abaixo do custo
  custoAlvo: number;            // custo máximo para atingir o alvo neste preço
  reducaoCustoPct: number;      // quanto o custo precisa cair (%)
  precoAlvo: number;            // preço que daria o alvo com o custo atual (para comparar com o mercado)
}

/**
 * preco: preço de venda (já com a taxa embutida); custo: custo atual; taxaPct: taxa de referência da maquininha;
 * alvoPct: lucro líquido desejado sobre o custo (ex.: 30 = vender com 30% sobre o custo, depois da taxa).
 */
export const analisarMargem = (p: { preco: number; custo: number; taxaPct: number; alvoPct: number }): ResultadoMargem | null => {
  if (!(p.preco > 0) || !(p.custo > 0)) return null;
  const t = Math.min(Math.max(Number(p.taxaPct) || 0, 0), 99) / 100;
  const alvo = Math.max(Number(p.alvoPct) || 0, 0) / 100;
  const liquido = r4(p.preco * (1 - t));
  const lucro = r2(liquido - p.custo);
  const lucroSobreCustoPct = r2((liquido / p.custo - 1) * 100);
  const custoAlvo = r2(liquido / (1 + alvo));
  return {
    liquido: r2(liquido),
    lucro,
    lucroSobreCustoPct,
    margemSobrePrecoPct: r2(((liquido - p.custo) / p.preco) * 100),
    abaixoDoAlvo: lucroSobreCustoPct < p.alvoPct - 0.005,
    prejuizo: liquido < p.custo - 0.004,
    custoAlvo,
    reducaoCustoPct: custoAlvo < p.custo ? r2((1 - custoAlvo / p.custo) * 100) : 0,
    precoAlvo: r2((p.custo * (1 + alvo)) / (1 - t)),
  };
};

/** Alvo do item: o da família (margem mínima); sem ela, o padrão informado. */
export const alvoEfetivo = (margemFamilia: number | null | undefined, padrao: number) =>
  Number(margemFamilia) > 0 ? { alvoPct: Number(margemFamilia), origem: 'FAMILIA' as const } : { alvoPct: padrao, origem: 'PADRAO' as const };

export interface OfertaCusto { fornecedor: string; idFornecedor: number | null; precoBase: number; origem: 'NOTA' | 'COTACAO'; data: string | null }

/** Melhor oferta conhecida abaixo do custo atual (memória de preços: notas e cotações). */
export const melhorOferta = (ofertas: OfertaCusto[], custoAtual: number): OfertaCusto | null => {
  const validas = ofertas.filter(o => o.precoBase > 0 && o.precoBase < custoAtual - 0.004);
  return validas.sort((a, b) => a.precoBase - b.precoBase || String(b.data || '').localeCompare(String(a.data || '')))[0] || null;
};
