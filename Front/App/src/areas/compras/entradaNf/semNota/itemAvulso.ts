// Item novo cadastrado com compra sem nota (catálogo › Cadastrar produto): o mapeamento da linha já vai pronto
// para a conferência — mesmo formato do cadastro rápido da entrada de NF.
import type { MappingPayload } from '../itens/ProductMappingModal';
import type { ClassificacaoItem } from '../itens/ClassificacaoPim';
import { classificacaoNoRascunho, configVendasRapida, foraDaVenda } from '../edicaoLote';

export interface ItemAvulso {
  nItem: number;
  nome: string;
  /** SKU customizado (vazio = sequencial gerado na aprovação) */
  skuCustomizado?: string;
  tipoRecurso: string;
  unidade: string;
  custoUnitario: number;
  /** Preço de venda = custo × markup (× taxa da maquininha embutida) */
  markup: number;
  classificacao: ClassificacaoItem | null;
  codigoFornecedor?: string;
  ean?: string;
}

export const mapeamentoItemAvulso = (i: ItemAvulso): MappingPayload => {
  const tipo = String(i.tipoRecurso || 'PRODUTO').toUpperCase();
  const unidade = String(i.unidade || 'UN').toUpperCase();
  const nome = String(i.nome || '').trim();
  const fora = foraDaVenda(tipo);
  return {
    mode: 'DRAFT',
    existingProductId: null,
    existingProduct: null,
    supplierLinkData: { sku_fornecedor: i.codigoFornecedor || '', ean_fornecedor: i.ean || null, descricao_fornecedor: nome.toUpperCase() },
    salesUnits: [],
    conversaoCompra: { unidade_compra: unidade, unidade_base: unidade, fator: 1 },
    configVendas: fora ? null : configVendasRapida(unidade, Number(i.custoUnitario) || 0, i.markup),
    draftIdentity: {
      tipo_recurso: tipo,
      ...classificacaoNoRascunho(i.classificacao),
      nome_comercial: nome,
      nome_interno: nome,
      sku_interno: `LINHA-${i.nItem}`,
      sku_comercial: fora ? '' : String(i.skuCustomizado || '').trim(),
      id_unidade: 1,
      custo_unitario_base: Number(i.custoUnitario) || 0,
      unidade_xml: unidade,
    },
  };
};
