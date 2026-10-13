// Preço por quantidade do ML (% B2B): faixas "a partir de N unidades, X% de desconto" que valem para compradores
// empresa. Regras do ML: até 5 faixas, mínimo de 2 a 100 unidades, desconto entre 0 e 100 e sempre maior
// conforme a quantidade aumenta. Regras puras: sem banco.

export interface FaixaQuantidade { minimo: number; desconto: number }   // desconto em % sobre o preço do anúncio

export const MAX_FAIXAS = 5;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Lê o JSON gravado no anúncio (inválido = sem faixas). */
export const lerFaixas = (json: string | null | undefined): FaixaQuantidade[] => {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v.map((f: any) => ({ minimo: Number(f?.minimo), desconto: Number(f?.desconto) })) : [];
  } catch { return []; }
};

/** Problemas das faixas (vazio = pode mandar ao ML). */
export const errosDasFaixas = (faixas: FaixaQuantidade[]): string[] => {
  const erros: string[] = [];
  if (faixas.length > MAX_FAIXAS) erros.push(`O Mercado Livre aceita no máximo ${MAX_FAIXAS} faixas.`);
  faixas.forEach((f, k) => {
    if (!Number.isInteger(f.minimo) || f.minimo < 2 || f.minimo > 100) erros.push(`Faixa ${k + 1}: a quantidade mínima vai de 2 a 100 unidades.`);
    if (!(f.desconto > 0 && f.desconto < 100)) erros.push(`Faixa ${k + 1}: o desconto precisa ser maior que 0% e menor que 100%.`);
    const ant = faixas[k - 1];
    if (ant && f.minimo <= ant.minimo) erros.push(`Faixa ${k + 1}: a quantidade precisa ser maior que a da faixa anterior (${ant.minimo}).`);
    if (ant && f.desconto <= ant.desconto) erros.push(`Faixa ${k + 1}: o desconto precisa ser maior que o da faixa anterior (${ant.desconto}%).`);
  });
  return erros;
};

/** Normaliza o que vem da tela: ordena pela quantidade e arredonda o desconto (2 casas). */
export const normalizarFaixas = (entrada: any[]): FaixaQuantidade[] =>
  (Array.isArray(entrada) ? entrada : [])
    .map(f => ({ minimo: Math.floor(Number(f?.minimo)), desconto: r2(Number(f?.desconto)) }))
    .filter(f => Number.isFinite(f.minimo) && Number.isFinite(f.desconto))
    .sort((a, b) => a.minimo - b.minimo);

/** Corpo do POST /items/:id/prices/price-per-quantity (substitui a tabela inteira; vazio apaga). */
export const corpoFaixas = (faixas: FaixaQuantidade[]) => ({
  price_per_quantity: faixas.map(f => ({
    type: 'discount_percentage',
    percentage: f.desconto,
    conditions: { context_restrictions: ['channel_marketplace', 'user_type_business'], min_purchase_unit: f.minimo, eligible: true },
  })),
});

/** Preço por unidade numa faixa. */
export const precoNaFaixa = (preco: number, desconto: number) => r2(preco * (1 - desconto / 100));

/**
 * Faixas a partir do atacado do cadastro (quantidade mínima + preço unitário de cada faixa de atacado),
 * em % sobre o preço do anúncio. Faixas que não dão desconto ou quebram a escada ficam de fora.
 */
export const faixasDoAtacado = (atacado: { quantidadeMinima: number; precoUnitario: number }[], precoAnuncio: number): FaixaQuantidade[] => {
  if (!(precoAnuncio > 0)) return [];
  const saida: FaixaQuantidade[] = [];
  for (const a of [...atacado].sort((x, y) => x.quantidadeMinima - y.quantidadeMinima)) {
    const minimo = Math.max(2, Math.ceil(a.quantidadeMinima));
    const desconto = r2((1 - a.precoUnitario / precoAnuncio) * 100);
    const ant = saida[saida.length - 1];
    if (minimo > 100 || !(desconto > 0 && desconto < 100)) continue;
    if (ant && (minimo <= ant.minimo || desconto <= ant.desconto)) continue;
    saida.push({ minimo, desconto });
  }
  return saida.slice(0, MAX_FAIXAS);
};

/** Faixas que o ML já tem no item (array price_per_quantity de /items/:id/prices), só as de empresa. */
export const faixasDoMl = (precos: any): FaixaQuantidade[] =>
  (precos?.price_per_quantity || [])
    .filter((p: any) => p?.type === 'discount_percentage' && (p?.conditions?.context_restrictions || []).includes('user_type_business'))
    .map((p: any) => ({ minimo: Number(p.conditions.min_purchase_unit), desconto: r2(Number(p.percentage)) }))
    .sort((a: FaixaQuantidade, b: FaixaQuantidade) => a.minimo - b.minimo);
