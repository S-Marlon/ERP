// Conversão entre o formato da API (unidades/faixas do banco) e o estado do configurador de vendas
import type { ConfigVendasApi, SalvarConfigPayload } from './configVendas.api';

export interface SaleUnitConfig {
  unitKey: string;
  unitName: string;
  enabled: boolean;
  allowWholesale: boolean;
  conversionFactor: number;
  retailMarkup: number;
  isBase: boolean;
  gtin: string;
  padraoPdv: boolean;
  autoRascunho?: boolean; // criada automaticamente pelo rascunho (base/unidade da NF)
}

export interface TierRuleRecord {
  key: string;
  unitKey: string;
  tierType: 'retail' | 'wholesale';
  minQuantity: number;
  maxQuantity: number | 'INF';
  markupOrDiscount: number;
  unitPrice: number;
}

export const MARKUP_PADRAO = 1.8;

const arred2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export const precoPorMarkup = (custoBase: number, fator: number, markup: number): number =>
  arred2(custoBase * fator * markup);

export const custoReferencia = (config: ConfigVendasApi): number =>
  config.custos.custoGerencial ?? config.custos.ultimoCusto ?? config.custos.custoMedio ?? 0;

export const configParaEstado = (config: ConfigVendasApi) => {
  const custo = custoReferencia(config);

  const units: SaleUnitConfig[] = config.unidades.map(u => ({
    unitKey: u.sigla,
    unitName: u.nome_exibicao || u.descricao || u.sigla,
    enabled: u.permite_venda,
    allowWholesale: u.permite_atacado,
    conversionFactor: u.is_base ? 1 : u.fator,
    retailMarkup: u.markup_varejo ?? MARKUP_PADRAO,
    isBase: u.is_base,
    gtin: u.gtin || '',
    padraoPdv: u.padrao_pdv,
  }));

  const tiers: TierRuleRecord[] = config.faixas.map((f, i) => ({
    key: `${f.sigla}-${f.ordem}-${i}`,
    unitKey: f.sigla,
    tierType: f.tipo_faixa === 'ATACADO' ? 'wholesale' : 'retail',
    minQuantity: f.quantidade_minima,
    maxQuantity: f.quantidade_maxima === null ? 'INF' : f.quantidade_maxima,
    markupOrDiscount: f.markup,
    unitPrice: f.preco_unitario,
  }));

  // Unidade sem faixa (ex: embalagem aprendida na entrada de NF): começa com uma faixa de varejo
  units.forEach(u => {
    if (!tiers.some(t => t.unitKey === u.unitKey)) {
      tiers.push({
        key: `${u.unitKey}-1-novo`,
        unitKey: u.unitKey,
        tierType: 'retail',
        minQuantity: 0,
        maxQuantity: 'INF',
        markupOrDiscount: u.retailMarkup,
        unitPrice: precoPorMarkup(custo, u.conversionFactor, u.retailMarkup),
      });
    }
  });

  return { units, tiers, custo };
};

// Modo rascunho (item ainda não existe; vem do mapeamento da NF)
export interface RascunhoVendas {
  unidadeBase: string;          // unidade de estoque do item
  unidadeCompra: string;        // unidade da NF (uCom)
  fatorCompra: number;          // 1 unidadeCompra = fatorCompra x unidadeBase
  custoUnidadeCompra: number;   // custo final por unidade da NF
}

const novaUnidade = (sigla: string, fator: number, isBase: boolean): SaleUnitConfig => ({
  unitKey: sigla,
  unitName: sigla,
  enabled: true,
  allowWholesale: !isBase,
  conversionFactor: fator,
  retailMarkup: MARKUP_PADRAO,
  isBase,
  gtin: '',
  padraoPdv: isBase,
  autoRascunho: true,
});

/**
 * Mantém o rascunho coerente com a conversão da NF: a unidade base existe com fator 1,
 * a unidade da NF existe com o fator informado, toda unidade tem faixa de varejo e os preços
 * acompanham o custo por unidade base (custo da NF / fator), preservando os markups.
 */
export const sincronizarRascunho = (units: SaleUnitConfig[], tiers: TierRuleRecord[], rascunho: RascunhoVendas) => {
  const base = rascunho.unidadeBase.trim().toUpperCase() || 'UN';
  const compra = rascunho.unidadeCompra.trim().toUpperCase() || base;
  const fator = rascunho.fatorCompra > 0 ? rascunho.fatorCompra : 1;
  const custo = rascunho.custoUnidadeCompra / fator;

  // Unidades automáticas que deixaram de ser base/NF (ex: sigla digitada pela metade) saem do rascunho
  let novas = units
    .filter(u => !u.autoRascunho || u.unitKey === base || u.unitKey === compra)
    .map(u => ({ ...u, isBase: u.unitKey === base, padraoPdv: u.unitKey === base ? true : u.padraoPdv && u.unitKey !== base }));
  if (!novas.some(u => u.unitKey === base)) novas = [novaUnidade(base, 1, true), ...novas];
  novas = novas.map(u => (u.unitKey === base ? { ...u, conversionFactor: 1 } : u));

  if (compra !== base) {
    if (novas.some(u => u.unitKey === compra)) {
      novas = novas.map(u => (u.unitKey === compra ? { ...u, conversionFactor: fator } : u));
    } else {
      novas = [...novas, novaUnidade(compra, fator, false)];
    }
  }

  const fatorDe = new Map(novas.map(u => [u.unitKey, u.conversionFactor]));
  const markupDe = new Map(novas.map(u => [u.unitKey, u.retailMarkup]));

  const faixas = tiers
    .filter(t => fatorDe.has(t.unitKey))
    .map(t => ({ ...t, unitPrice: precoPorMarkup(custo, fatorDe.get(t.unitKey) ?? 1, t.markupOrDiscount) }));

  novas.forEach(u => {
    if (!faixas.some(t => t.unitKey === u.unitKey)) {
      faixas.push({
        key: `${u.unitKey}-1-rascunho`,
        unitKey: u.unitKey,
        tierType: 'retail',
        minQuantity: 0,
        maxQuantity: 'INF',
        markupOrDiscount: markupDe.get(u.unitKey) ?? MARKUP_PADRAO,
        unitPrice: precoPorMarkup(custo, u.conversionFactor, markupDe.get(u.unitKey) ?? MARKUP_PADRAO),
      });
    }
  });

  return { units: novas, tiers: faixas, custo };
};

export const estadoParaPayload =(units: SaleUnitConfig[], tiers: TierRuleRecord[], custo: number): SalvarConfigPayload => ({
  custo_gerencial: custo,
  unidades: units.map(u => ({
    sigla: u.unitKey,
    descricao: u.unitName,
    fator: u.isBase ? 1 : u.conversionFactor,
    is_base: u.isBase,
    nome_exibicao: u.unitName || null,
    gtin: u.gtin.trim() || null,
    permite_venda: u.enabled,
    permite_atacado: u.allowWholesale,
    markup_varejo: u.retailMarkup,
    padrao_pdv: u.padraoPdv,
  })),
  faixas: units.flatMap(u =>
    tiers
      .filter(t => t.unitKey === u.unitKey)
      .map((t, i) => ({
        sigla: u.unitKey,
        tipo_faixa: t.tierType === 'wholesale' ? 'ATACADO' as const : 'VAREJO' as const,
        ordem: i + 1,
        quantidade_minima: t.minQuantity,
        quantidade_maxima: t.maxQuantity === 'INF' ? null : t.maxQuantity,
        markup: t.markupOrDiscount,
        preco_unitario: t.unitPrice,
      }))
  ),
});
