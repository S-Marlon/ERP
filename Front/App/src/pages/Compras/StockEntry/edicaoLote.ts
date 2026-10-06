// Edições em lote na conferência da NF (regras puras, testáveis sem tela):
// - cadastro rápido: linhas sem vínculo viram itens novos com os dados da nota e um markup único;
// - classificação: família/categoria (e valores de atributos, se informados) nos itens novos selecionados.
import type { MappingPayload } from './ItemsConference/ProductMappingModal';

// Chave da linha na staging (mesma regra de chaveDaLinhaNova do modal, sem importar a tela)
const chaveDaLinha = (nItem: unknown) => `LINHA-${nItem}`;
import type { ClassificacaoItem } from './ItemsConference/ClassificacaoPim';
import type { SalvarConfigPayload } from '../../Catalogo/pages/ProductPricingModule/configVendas.api';
import { estadoParaPayload, precoPorMarkup, sincronizarRascunho } from '../../Catalogo/pages/ProductPricingModule/configVendas.mapper';

export const TIPOS_FORA_DA_VENDA = ['CONSUMO', 'INSUMO', 'ATIVO'];
export const foraDaVenda = (tipo: unknown) => TIPOS_FORA_DA_VENDA.includes(String(tipo || '').toUpperCase());

export const linhaSemVinculo = (item: any) => !(item.mapeamento || item.mappedId || item.produtoIdSistema || item.skuSugerido);
export const linhaItemNovo = (item: any) => item.mapeamento?.mode === 'DRAFT' && Boolean(item.mapeamento?.draftIdentity);

/**
 * Itens novos com o mesmo SKU Customizado (sem diferenciar maiúsculas). A aprovação fica bloqueada até o operador
 * confirmar que são o mesmo produto (agrupa num item só) ou mudar o SKU. `mesmoProduto` indica se o código ou a
 * descrição do fornecedor batem (só orienta: o fornecedor pode repetir código em produtos diferentes).
 */
type LinhaSku = {
  tempId?: unknown; sku?: unknown; descricao?: unknown;
  mapeamento?: { mode?: string; draftIdentity?: { sku_comercial?: unknown } | null; agrupamentoConfirmado?: unknown } | null;
};
export interface GrupoSkuRepetido<T> { linhas: T[]; mesmoProduto: boolean; confirmado: boolean }
export const situacaoSkusNovos = <T extends LinhaSku>(itens: T[]): Map<string, GrupoSkuRepetido<T>> => {
  const n = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  const mesmo = (a: LinhaSku, b: LinhaSku) => (!!n(a.sku) && n(a.sku) === n(b.sku)) || (!!n(a.descricao) && n(a.descricao) === n(b.descricao));
  const grupos = new Map<string, T[]>();
  for (const i of itens) {
    if (!linhaItemNovo(i)) continue;
    const sku = n(i.mapeamento?.draftIdentity?.sku_comercial);
    if (sku) grupos.set(sku, [...(grupos.get(sku) || []), i]);
  }
  const repetidos = new Map<string, GrupoSkuRepetido<T>>();
  for (const [sku, linhas] of grupos) {
    if (linhas.length < 2) continue;
    repetidos.set(sku, {
      linhas,
      mesmoProduto: linhas.every(l => mesmo(linhas[0], l)),
      confirmado: linhas.every(l => n(l.mapeamento?.agrupamentoConfirmado) === sku),
    });
  }
  return repetidos;
};

// Venda só na unidade da nota, preço de varejo = custo x markup (atacado/embalagens ficam para o editor)
export const configVendasRapida = (unidade: string, custoUnidade: number, markup: number): SalvarConfigPayload => {
  const r = sincronizarRascunho([], [], { unidadeBase: unidade, unidadeCompra: unidade, fatorCompra: 1, custoUnidadeCompra: custoUnidade });
  const units = r.units.map(u => ({ ...u, retailMarkup: markup }));
  const tiers = r.tiers.map(t => ({ ...t, markupOrDiscount: markup, unitPrice: precoPorMarkup(r.custo, 1, markup) }));
  return estadoParaPayload(units, tiers, r.custo);
};

export const classificacaoNoRascunho = (c: ClassificacaoItem | null | undefined) => ({
  familia_id: c?.familiaId ?? null,
  // Com família, a categoria vem dela (regra do PIM)
  categoria_id: c?.familiaId ? null : (c?.categoriaId ?? null),
  atributos: c?.atributos && Object.keys(c.atributos).length > 0 ? { ...c.atributos } : null,
  marca_id: c?.marcaId ?? null,
});

export const mapeamentoRapido = (item: any, opcoes: { markup: number; classificacao?: ClassificacaoItem | null }): MappingPayload => {
  const tipo = String(item.tipoRecurso || 'PRODUTO').toUpperCase();
  const unidade = String(item.unidade || 'UN').toUpperCase();
  const custo = Number(item.valorUnitario) || 0;
  const descricao = String(item.descricao || '').trim();
  const fora = foraDaVenda(tipo);
  return {
    mode: 'DRAFT',
    existingProductId: null,
    existingProduct: null,
    supplierLinkData: {
      sku_fornecedor: item.sku || '',
      ean_fornecedor: item.ean || null,
      descricao_fornecedor: descricao,
    },
    salesUnits: [],
    conversaoCompra: { unidade_compra: unidade, unidade_base: unidade, fator: 1 },
    // Fora da venda (consumo/patrimônio) não tem preço
    configVendas: fora ? null : configVendasRapida(unidade, custo, opcoes.markup),
    draftIdentity: {
      tipo_recurso: tipo,
      ...classificacaoNoRascunho(opcoes.classificacao),
      nome_comercial: descricao,
      nome_interno: descricao,
      sku_interno: chaveDaLinha(item.nItem ?? item.tempId),
      // Venda: código do fornecedor; consumo/patrimônio: sequencial gerado na aprovação
      sku_comercial: fora ? '' : String(item.sku || '').trim(),
      id_unidade: 1,
      custo_unitario_base: custo,
      unidade_xml: item.unidade,
    },
  };
};

/**
 * Classificação em lote num item novo. Mesma família/categoria: os valores informados somam aos que o item já tem.
 * Família/categoria diferente: os valores antigos saem (os atributos mudam) e ficam só os informados.
 * substituir (edição de uma linha só): os valores passam a ser exatamente os informados.
 * Retorna null se a linha não é item novo (item já cadastrado é classificado no editor de catálogo).
 */
export const aplicarClassificacao = (
  mapping: MappingPayload | null | undefined, c: ClassificacaoItem, opcoes: { substituir?: boolean } = {}
): MappingPayload | null => {
  if (!mapping || mapping.mode !== 'DRAFT' || !mapping.draftIdentity) return null;
  const d = mapping.draftIdentity;
  const nova = classificacaoNoRascunho(c);
  const mesma = (d.familia_id ?? null) === nova.familia_id && (d.categoria_id ?? null) === nova.categoria_id;
  const atuais = mesma ? (d.atributos ?? null) : null;
  const atributos = opcoes.substituir
    ? nova.atributos
    : nova.atributos ? { ...(atuais || {}), ...nova.atributos } : atuais;
  // Lote sem marca escolhida mantém a de cada item; substituir aplica exatamente a escolhida
  const marca_id = opcoes.substituir ? nova.marca_id : (nova.marca_id ?? d.marca_id ?? null);
  return { ...mapping, draftIdentity: { ...d, familia_id: nova.familia_id, categoria_id: nova.categoria_id, atributos, marca_id } };
};
