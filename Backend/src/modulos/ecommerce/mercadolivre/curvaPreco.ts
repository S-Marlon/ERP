// "Onde o preço está": o lucro em função do preço, para ver o que acontece subindo ou baixando e onde ficam os degraus
// do ML (taxa fixa do item barato, frete a partir de R$ 79) e o alvo. Regra pura: quais preços calcular.

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * Preços da curva: `pontos` preços igualmente espaçados numa faixa em volta do atual (do custo, ou de 60% do preço, até
 * 160% ou um pouco acima do alvo), mais o centavo antes e o próprio valor de cada marca dentro da faixa (para o degrau
 * aparecer em pé no gráfico). A faixa estica até um pouco depois de R$ 79 quando o preço está perto deles.
 */
export const precosDaCurva = (p: { atual: number; custo: number; alvo: number | null; marcas: (number | null)[]; limiteFrete?: number }, pontos = 18) => {
  const atual = Math.max(0.5, p.atual);
  const baixo = r2(Math.max(0.5, Math.min(atual * 0.6, p.custo > 0 ? p.custo * 1.05 : atual * 0.6)));
  let alto = r2(Math.max(atual * 1.6, (p.alvo || 0) * 1.25));
  const lf = p.limiteFrete ?? 79;
  if (atual < lf && alto < lf * 1.15 && lf <= atual * 2.5) alto = r2(lf * 1.15);
  const passo = (alto - baixo) / Math.max(1, pontos - 1);
  const lista = Array.from({ length: pontos }, (_, k) => r2(baixo + k * passo));
  for (const m of [...p.marcas, lf, atual, p.alvo]) {
    if (m === null || m === undefined || !(m > baixo && m < alto)) continue;
    lista.push(r2(m - 0.01), r2(m));
  }
  return [...new Set(lista)].filter(x => x > 0).sort((a, b) => a - b);
};
