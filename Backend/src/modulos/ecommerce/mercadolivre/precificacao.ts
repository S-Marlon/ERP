// Preço no Mercado Livre: lucro depois da tarifa do ML (e do frete que o vendedor paga), comparação com o mercado
// pelo preço por unidade (pacote ÷ quantidade) e se cada faixa por quantidade ainda dá lucro. Regras puras.

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

/** Quantas unidades vêm no produto: o atributo do ML e, quando ele falta ou diz 1, o que o nome indica ("Kit 50", "c/12", "10 Un"). */
export const unidadesDoProduto = (atributo: string | number | null | undefined, nome: string) => {
  const pelo = Number(String(atributo ?? '').replace(/\D/g, '')) || 0;
  const n = String(nome || '').toLowerCase();
  const m = n.match(/(?:kit|c\/|com|caixa|cx|pacote|pct|embalagem)\s*(?:com\s*)?(\d{1,4})\b/)
    || n.match(/\b(\d{1,4})\s*(?:un|unid|unidades|pe[cç]as|pcs|p[cç]s)\b/);
  const peloNome = m ? Number(m[1]) : 0;
  if (pelo > 1) return pelo;
  return peloNome > 1 ? peloNome : 1;
};

export interface Estatisticas { n: number; min: number; p25: number; mediana: number; p75: number; max: number }

export const estatisticas = (valores: number[]): Estatisticas | null => {
  const v = valores.filter(x => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p: number) => {
    const i = (v.length - 1) * p;
    const a = Math.floor(i);
    return r2(v[a] + (v[Math.min(a + 1, v.length - 1)] - v[a]) * (i - a));
  };
  return { n: v.length, min: r2(v[0]), p25: q(0.25), mediana: q(0.5), p75: q(0.75), max: r2(v[v.length - 1]) };
};

export interface Tarifa { comissaoPct: number; fixa: number }

/** Lucro de uma venda no ML: preço - tarifa (comissão % + fixa) - frete do vendedor - custo. Alvo medido sobre o custo. */
export const lucroNoMl = (p: { preco: number; custo: number; tarifa: Tarifa; frete?: number }) => {
  const tarifa = r2(p.preco * (p.tarifa.comissaoPct / 100) + (p.tarifa.fixa || 0));
  const liquido = r2(p.preco - tarifa - (p.frete || 0));
  const lucro = r2(liquido - p.custo);
  return {
    preco: r2(p.preco), tarifa, frete: r2(p.frete || 0), liquido, custo: r2(p.custo), lucro,
    lucroSobreCustoPct: p.custo > 0 ? r2((lucro / p.custo) * 100) : null,
    margemSobrePrecoPct: p.preco > 0 ? r2((lucro / p.preco) * 100) : null,
  };
};

/** Menor preço que ainda dá o alvo de lucro sobre o custo. */
export const precoParaAlvo = (p: { custo: number; tarifa: Tarifa; frete?: number; alvoPct: number }) => {
  const resto = 1 - p.tarifa.comissaoPct / 100;
  if (!(resto > 0) || !(p.custo > 0)) return null;
  return r2((p.custo * (1 + p.alvoPct / 100) + (p.tarifa.fixa || 0) + (p.frete || 0)) / resto);
};

export type NivelLucro = 'PREJUIZO' | 'BAIXO' | 'BOM' | 'ALTO' | 'SEM_CUSTO';
/** Lucro sobre o custo x alvo: abaixo do alvo = baixo; até o dobro do alvo = bom; acima = alto (talvez dê para baixar o preço). */
export const classificarLucro = (lucroSobreCustoPct: number | null, alvoPct: number): NivelLucro => {
  if (lucroSobreCustoPct === null) return 'SEM_CUSTO';
  if (lucroSobreCustoPct < 0) return 'PREJUIZO';
  if (lucroSobreCustoPct < alvoPct) return 'BAIXO';
  if (lucroSobreCustoPct <= Math.max(alvoPct * 2, alvoPct + 30)) return 'BOM';
  return 'ALTO';
};

export type NivelPreco = 'ABAIXO' | 'COMPETITIVO' | 'ACIMA' | 'SEM_REFERENCIA';
/** Preço por unidade x mercado: abaixo do 1º quartil, entre os quartis (competitivo) ou acima do 3º. */
export const classificarPreco = (porUnidade: number, mercado: Estatisticas | null) => {
  if (!mercado || mercado.n < 3) return { nivel: 'SEM_REFERENCIA' as NivelPreco, difMedianaPct: null as number | null };
  const difMedianaPct = r2((porUnidade / mercado.mediana - 1) * 100);
  const nivel: NivelPreco = porUnidade < mercado.p25 ? 'ABAIXO' : porUnidade > mercado.p75 ? 'ACIMA' : 'COMPETITIVO';
  return { nivel, difMedianaPct };
};

/** Lucro em cada faixa por quantidade (preço da unidade vendida com o desconto da faixa). */
export const analisarFaixas = (
  faixas: { minimo: number; desconto: number }[], p: { preco: number; custo: number; tarifaDaFaixa: (preco: number) => Tarifa; frete?: number; alvoPct: number }
) => faixas.map(f => {
  const preco = r2(p.preco * (1 - f.desconto / 100));
  const l = lucroNoMl({ preco, custo: p.custo, tarifa: p.tarifaDaFaixa(preco), frete: p.frete });
  return { minimo: f.minimo, desconto: f.desconto, ...l, nivel: classificarLucro(l.lucroSobreCustoPct, p.alvoPct) };
});

/** Conselhos curtos a partir da análise. */
export const conselhos = (a: {
  nivelLucro: NivelLucro; nivelPreco: NivelPreco; difMedianaPct: number | null; precoAtual: number; precoAlvo: number | null;
  precoMercado: number | null; unidades: number; faixasNegativas: number[]; faixasAbaixoAlvo: number[]; mesmaMarcaMediana: number | null; porUnidade: number;
  tarifaFixa?: number; tarifaTotal?: number;
  poucos?: { min: number; max: number; n: number } | null;   // referência com menos de 3 anúncios iguais
}) => {
  const c: string[] = [];
  if (a.nivelLucro === 'SEM_CUSTO') c.push('O item não tem custo no ERP: sem ele não dá para saber o lucro. Lance o custo (entrada de nota ou cadastro).');
  if (a.nivelLucro === 'PREJUIZO') c.push(`Vendendo com prejuízo no ML. O preço mínimo para o alvo é ${moeda(a.precoAlvo)}.`);
  if (a.nivelLucro === 'BAIXO' && a.precoAlvo) c.push(`Lucro abaixo do alvo: para chegar nele o preço precisa ser ${moeda(a.precoAlvo)}${a.nivelPreco === 'ACIMA' ? ', mas você já está acima do mercado: o caminho é baixar o custo (compra) ou vender em quantidade' : ''}.`);
  if (a.nivelPreco === 'ACIMA' && (a.nivelLucro === 'ALTO' || a.nivelLucro === 'BOM') && a.precoMercado && a.precoAlvo && a.precoAlvo < a.precoAtual) {
    c.push(`Preço acima do mercado (${a.difMedianaPct}% sobre a mediana por unidade). Dá para baixar até ${moeda(Math.max(a.precoAlvo, a.precoMercado))} sem sair do alvo.`);
  }
  if (a.nivelPreco === 'ABAIXO' && (a.nivelLucro === 'BOM' || a.nivelLucro === 'ALTO')) c.push('Preço abaixo do mercado com lucro bom: há espaço para subir um pouco.');
  if (a.nivelPreco === 'ABAIXO' && (a.nivelLucro === 'BAIXO' || a.nivelLucro === 'PREJUIZO') && a.precoMercado) {
    c.push(`Preço abaixo do mercado (${a.difMedianaPct}% da mediana por unidade) e lucro ${a.nivelLucro === 'BAIXO' ? 'baixo' : 'negativo'}: dá para subir para perto de ${moeda(a.precoMercado)} (mediana do mercado) e continuar competitivo.`);
  }
  if ((a.tarifaFixa || 0) > 0 && a.tarifaTotal && a.precoAtual > 0 && a.tarifaTotal / a.precoAtual > 0.3) {
    c.push(`A tarifa do ML leva ${Math.round((a.tarifaTotal / a.precoAtual) * 100)}% do preço (tem taxa fixa de ${moeda(a.tarifaFixa || 0)} em item barato): pacote maior ou kit dilui essa taxa.`);
  }
  if (a.nivelPreco === 'SEM_REFERENCIA' && a.poucos && a.poucos.n > 0) {
    c.push(`Poucos anúncios iguais para comparar (${a.poucos.n}): ${moeda(a.poucos.min * a.unidades)}${a.poucos.max > a.poucos.min ? ` a ${moeda(a.poucos.max * a.unidades)}` : ''} no mesmo tamanho de pacote; o seu está em ${moeda(a.precoAtual)}.`);
  }
  if (a.mesmaMarcaMediana && a.porUnidade > a.mesmaMarcaMediana * 1.1) c.push(`Outros anúncios da mesma marca saem a ${moeda(a.mesmaMarcaMediana)} por unidade (mediana).`);
  if (a.unidades === 1 && a.precoAtual < 30) c.push('Item barato vendido por unidade: a tarifa e o frete pesam muito. No ML costuma compensar vender em pacote (ex.: c/10, c/12) ou com preço por quantidade.');
  if (a.faixasNegativas.length) c.push(`As faixas a partir de ${a.faixasNegativas.join(', ')} un. dão prejuízo: reduza o desconto ou tire a faixa.`);
  else if (a.faixasAbaixoAlvo.length) c.push(`As faixas a partir de ${a.faixasAbaixoAlvo.join(', ')} un. ficam abaixo do alvo (ainda dão lucro): mantenha só se o volume compensar.`);
  if (!c.length) {
    c.push(a.nivelPreco === 'SEM_REFERENCIA'
      ? 'Lucro dentro do alvo. Não achei anúncios parecidos o bastante no catálogo para comparar o preço.'
      : 'Preço competitivo e lucro dentro do alvo: pode manter.');
  }
  return c;
};

const moeda = (v: number | null) => (v === null ? '—' : `R$ ${v.toFixed(2).replace('.', ',')}`);
