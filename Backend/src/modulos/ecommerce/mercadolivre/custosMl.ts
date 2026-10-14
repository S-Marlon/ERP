// Custos de uma venda no Mercado Livre: tarifa (comissão % + fixa por unidade), frete grátis que o vendedor paga
// (por envio, muda com a faixa de preço da compra) e o custo do ERP. Dá o "você recebe", o lucro, os cenários
// (Clássico × Premium, com e sem frete grátis), o lucro por quantidade e os avisos de degrau. Regras puras.
import type { Tarifa } from './precificacao';

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const moeda = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

/** A partir deste valor de compra o frete grátis é obrigatório no ML Brasil (e o frete fica mais caro para o vendedor). */
export const LIMITE_FRETE_GRATIS = 79;

/** Frete grátis que o vendedor paga num envio (consulta ao ML): com desconto, cheio (tabela) e o peso cobrado. */
export interface FreteEnvio { valor: number; cheio: number | null; descontoPct: number | null; pesoG: number | null }

/** O vendedor paga o frete quando oferece frete grátis ou quando a compra passa do limite (aí é obrigatório). */
export const vendedorPagaFrete = (totalCompra: number, freteGratis: boolean) => freteGratis || totalCompra >= LIMITE_FRETE_GRATIS;

export interface ResultadoVenda {
  quantidade: number; precoUnit: number; receita: number; tarifa: number; frete: number; recebe: number;
  custo: number; lucro: number; lucroPorUnidade: number; lucroSobreCustoPct: number | null; margemSobrePrecoPct: number | null;
  tarifaPct: number;            // quanto a tarifa + frete levam da receita
}

/** Uma compra no ML: tarifa por unidade (% + fixa), frete por envio e o custo das unidades. */
export const resultadoVenda = (p: { precoUnit: number; quantidade?: number; custoUnit: number; tarifa: Tarifa; frete: number }): ResultadoVenda => {
  const q = Math.max(1, Math.floor(p.quantidade || 1));
  const receita = r2(p.precoUnit * q);
  const tarifa = r2(r2(p.precoUnit * (p.tarifa.comissaoPct / 100) + (p.tarifa.fixa || 0)) * q);
  const frete = r2(p.frete || 0);
  const recebe = r2(receita - tarifa - frete);
  const custo = r2(p.custoUnit * q);
  const lucro = r2(recebe - custo);
  return {
    quantidade: q, precoUnit: r2(p.precoUnit), receita, tarifa, frete, recebe, custo, lucro, lucroPorUnidade: r2(lucro / q),
    lucroSobreCustoPct: custo > 0 ? r2((lucro / custo) * 100) : null,
    margemSobrePrecoPct: receita > 0 ? r2((lucro / receita) * 100) : null,
    tarifaPct: receita > 0 ? r2(((tarifa + frete) / receita) * 100) : 0,
  };
};

/** Preço que empata o lucro de hoje depois de passar do limite do frete grátis (o frete sobe junto). */
export const precoQueCompensaFrete = (p: { preco: number; comissaoPct: number; freteHoje: number; freteAcima: number }) => {
  const resto = 1 - p.comissaoPct / 100;
  if (!(resto > 0)) return null;
  return r2(Math.max(LIMITE_FRETE_GRATIS, p.preco + (p.freteAcima - p.freteHoje) / resto));
};

/** Avisos dos degraus de custo do ML: o limite do frete grátis e a taxa fixa de item barato. */
export const avisosDeDegrau = (p: {
  preco: number; comissaoPct: number; freteGratis: boolean;
  freteAbaixo: number | null;       // frete grátis de uma compra logo abaixo do limite (ex.: R$ 78,90)
  freteAcima: number | null;        // frete de uma compra a partir do limite
  tarifaFixa: number; precoSemFixa: number | null;
}) => {
  const avisos: string[] = [];
  const { preco } = p;
  if (preco < LIMITE_FRETE_GRATIS && p.freteAcima !== null) {
    const hoje = p.freteGratis ? p.freteAbaixo ?? 0 : 0;
    if (preco >= LIMITE_FRETE_GRATIS * 0.8 && p.freteAcima > hoje) {
      const compensa = precoQueCompensaFrete({ preco, comissaoPct: p.comissaoPct, freteHoje: hoje, freteAcima: p.freteAcima });
      avisos.push(`A partir de ${moeda(LIMITE_FRETE_GRATIS)} o frete grátis é obrigatório e custa ${moeda(p.freteAcima)} (hoje ${moeda(hoje)}). Subir o preço só compensa a partir de ${moeda(compensa ?? LIMITE_FRETE_GRATIS)}.`);
    } else if (preco * 2 >= LIMITE_FRETE_GRATIS && p.freteAcima > hoje) {
      avisos.push(`Quem compra ${Math.ceil(LIMITE_FRETE_GRATIS / preco)} ou mais passa de ${moeda(LIMITE_FRETE_GRATIS)}: o frete dessa compra é ${moeda(p.freteAcima)} ou mais, por sua conta (veja "Por quantidade").`);
    }
  }
  if (preco >= LIMITE_FRETE_GRATIS && preco < LIMITE_FRETE_GRATIS * 1.15 && p.freteAbaixo !== null && p.freteAcima !== null && p.freteAcima > p.freteAbaixo) {
    const resto = 1 - p.comissaoPct / 100;
    const ganho = r2((78.9 * resto - (p.freteGratis ? p.freteAbaixo : 0)) - (preco * resto - p.freteAcima));
    if (ganho > 0) avisos.push(`Baixando para ${moeda(78.9)} o frete cai de ${moeda(p.freteAcima)} para ${p.freteGratis ? moeda(p.freteAbaixo) : 'zero (sem frete grátis)'}: você receberia ${moeda(ganho)} a mais por venda e ainda ficaria mais barato.`);
  }
  if (p.tarifaFixa > 0) {
    avisos.push(`Item barato: o ML cobra ${moeda(p.tarifaFixa)} fixos por unidade, além da comissão${p.precoSemFixa ? ` (some a partir de ${moeda(p.precoSemFixa)})` : ''}. Pacote ou kit dilui essa taxa.`);
  }
  return avisos;
};

export type TipoAnuncio = 'gold_special' | 'gold_pro';

export interface Cenario extends ResultadoVenda { tipo: TipoAnuncio; freteGratis: boolean; atual: boolean; obrigatorio: boolean }

/** Clássico × Premium, com e sem frete grátis (sem frete grátis só existe abaixo do limite). */
export const montarCenarios = (p: {
  preco: number; custoUnit: number; tarifas: Record<TipoAnuncio, Tarifa>; frete: number | null; tipoAtual: string; freteGratisAtual: boolean;
}): Cenario[] => {
  const obrigatorio = p.preco >= LIMITE_FRETE_GRATIS;
  const saida: Cenario[] = [];
  for (const tipo of ['gold_special', 'gold_pro'] as TipoAnuncio[]) {
    for (const freteGratis of obrigatorio ? [true] : [true, false]) {
      const r = resultadoVenda({ precoUnit: p.preco, custoUnit: p.custoUnit, tarifa: p.tarifas[tipo], frete: freteGratis ? p.frete ?? 0 : 0 });
      saida.push({ ...r, tipo, freteGratis, obrigatorio, atual: tipo === p.tipoAtual && (obrigatorio || freteGratis === p.freteGratisAtual) });
    }
  }
  return saida;
};

/** Quantidades para mostrar: 1, as faixas por quantidade e a primeira que passa do limite do frete grátis. */
export const quantidadesParaAnalise = (preco: number, faixas: { minimo: number; desconto: number }[]) => {
  const q = new Map<number, number>([[1, 0]]);
  for (const f of faixas) q.set(f.minimo, f.desconto);
  if (preco > 0 && preco < LIMITE_FRETE_GRATIS) {
    const passa = Math.ceil(LIMITE_FRETE_GRATIS / preco);
    if (passa <= 100 && !q.has(passa)) {
      const desconto = [...faixas].filter(f => f.minimo <= passa).pop()?.desconto ?? 0;
      q.set(passa, desconto);
    }
  }
  return [...q.entries()].sort((a, b) => a[0] - b[0]).slice(0, 7).map(([quantidade, desconto]) => ({ quantidade, desconto }));
};

/**
 * Menor preço (ao centavo) em que o ML não cobra mais a taxa fixa de item barato. Busca binária entre R$ 1 e `ate`:
 * a taxa fixa vale até um limite e some acima dele. null quando não há taxa fixa (ou ela não some até `ate`).
 */
export const acharLimiteTaxaFixa = async (fixaDe: (preco: number) => Promise<number>, ate = 40) => {
  if ((await fixaDe(ate)) > 0) return null;
  let comTaxa = 100;            // centavos
  if (!((await fixaDe(comTaxa / 100)) > 0)) return null;
  let semTaxa = Math.round(ate * 100);
  while (semTaxa - comTaxa > 1) {
    const meio = Math.floor((comTaxa + semTaxa) / 2);
    if ((await fixaDe(meio / 100)) > 0) comTaxa = meio; else semTaxa = meio;
  }
  return semTaxa / 100;
};

export interface AlertaPreco { tipo: 'TAXA_FIXA' | 'PERTO_TAXA_FIXA' | 'FRETE_ACIMA_79' | 'PERTO_FRETE_79'; grave: boolean; texto: string; precoSugerido: number | null }

const pctTexto = (v: number | null) => (v === null ? '' : ` (${v.toFixed(1).replace('.', ',')}%)`);

/** Degraus de preço que mudam muito a margem: taxa fixa de item barato e o frete grátis a partir de R$ 79. */
export const alertasDePreco = (p: {
  preco: number; lucro: number; pct: number | null;
  taxaFixa: { limite: number; fixa: number; noLimite: { lucro: number; pct: number | null } | null } | null;
  frete: { abaixo: { lucro: number; pct: number | null } | null; freteHoje: number; freteAcima: number | null; compensaAPartir: number | null } | null;
}): AlertaPreco[] => {
  const a: AlertaPreco[] = [];
  const t = p.taxaFixa;
  if (t && p.preco < t.limite && t.fixa > 0) {
    a.push({
      tipo: 'TAXA_FIXA', grave: true, precoSugerido: t.limite,
      texto: `Até ${moeda(r2(t.limite - 0.01))} o ML cobra ${moeda(t.fixa)} de taxa fixa por unidade.`
        + (t.noLimite ? ` Com ${moeda(t.limite)} (+${moeda(r2(t.limite - p.preco))}) o lucro vai de ${moeda(p.lucro)}${pctTexto(p.pct)} para ${moeda(t.noLimite.lucro)}${pctTexto(t.noLimite.pct)}.` : ` A partir de ${moeda(t.limite)} ela some.`),
    });
  } else if (t && p.preco >= t.limite && p.preco <= t.limite * 1.2) {
    a.push({ tipo: 'PERTO_TAXA_FIXA', grave: false, precoSugerido: null, texto: `Cuidado ao baixar: abaixo de ${moeda(t.limite)} o ML cobra taxa fixa por unidade e o lucro despenca.` });
  }
  const f = p.frete;
  if (f && p.preco >= LIMITE_FRETE_GRATIS && f.abaixo && f.abaixo.lucro > p.lucro) {
    a.push({
      tipo: 'FRETE_ACIMA_79', grave: true, precoSugerido: 78.9,
      texto: `A partir de ${moeda(LIMITE_FRETE_GRATIS)} o frete grátis custa ${moeda(f.freteHoje)}. Baixando para ${moeda(78.9)} o lucro vai de ${moeda(p.lucro)}${pctTexto(p.pct)} para ${moeda(f.abaixo.lucro)}${pctTexto(f.abaixo.pct)} e o preço fica menor.`,
    });
  } else if (f && p.preco < LIMITE_FRETE_GRATIS && f.freteAcima !== null && f.freteAcima > f.freteHoje && f.compensaAPartir !== null) {
    a.push({
      tipo: 'PERTO_FRETE_79', grave: false, precoSugerido: null,
      texto: `A partir de ${moeda(LIMITE_FRETE_GRATIS)} o frete grátis sobe para ${moeda(f.freteAcima)} (hoje ${moeda(f.freteHoje)}): só suba o preço se for para ${moeda(f.compensaAPartir)} ou mais.`,
    });
  }
  return a;
};
