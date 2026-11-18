// Reconhecimento automático na entrada: aplica, nas linhas ainda sem vínculo, o item sugerido pelo backend
// (código do fornecedor em notas anteriores ou GTIN). A linha continua precisando ser conferida.
import type { MappingPayload } from './itens/ProductMappingModal';

export interface SugestaoVinculo {
  idItem: number;
  sku: string;
  nome: string;
  status: string;
  tipoRecurso: string;
  unidadeBase: string | null;
  origem: 'FORNECEDOR' | 'GTIN';
  ultimosDepositos: string[];
  /** Unidade que veio na nota em que esta conversão foi usada (ex.: UN). */
  unidadeNota?: string | null;
  /** Unidade de compra depois da conferência (ex.: RL quando o fornecedor manda o rolo como UN). */
  unidadeCompra: string | null;
  fator: number;
  precoUltimaCompra: number | null;
}

export const chaveDaLinha = (item: any): string => String(item.nItem ?? item.tempId);

const linhaJaVinculada = (item: any) => Boolean(item.mapeamento || item.mappedId || item.produtoIdSistema || item.skuSugerido);

export const aplicarSugestoes = (itens: any[], sugestoes: Record<string, SugestaoVinculo>) => {
  let aplicadas = 0;
  const resultado = itens.map(item => {
    const s = sugestoes[chaveDaLinha(item)];
    if (!s || linhaJaVinculada(item)) return item;
    aplicadas++;
    const unidadeNf = String(item.unidade || 'UN').toUpperCase();
    // A conversão da última compra só vale se a nota veio na mesma unidade (inclusive a correção UN -> RL feita na conferência)
    const unidadeDaquelaNota = String(s.unidadeNota ?? s.unidadeCompra ?? '').toUpperCase();
    const mesma = unidadeDaquelaNota === unidadeNf;
    const fator = mesma ? s.fator : 1;
    const unidadeCompra = mesma && s.unidadeCompra ? s.unidadeCompra.toUpperCase() : unidadeNf;
    const mapping: MappingPayload = {
      mode: 'EXISTING_DIRECT',
      existingProductId: s.idItem,
      existingProduct: { sku: s.sku, nome: s.nome, tipo_recurso: s.tipoRecurso },
      supplierLinkData: {
        sku_fornecedor: item.sku || '',
        ean_fornecedor: item.ean || null,
        descricao_fornecedor: item.descricao || '',
      },
      salesUnits: [],
      conversaoCompra: {
        unidade_compra: unidadeCompra,
        unidade_base: (s.unidadeBase || unidadeNf).toUpperCase(),
        fator,
      },
      configVendas: null,
      draftIdentity: null,
    };
    // Destino segue o tipo do item (a divisão de uso interno, se houver, é feita na conferência)
    const destinos = null;
    return {
      ...item,
      mapeamento: mapping,
      produtoIdSistema: s.idItem,
      skuSistema: s.sku,
      skuSugerido: null,
      nomeItemSugerido: null,
      tipoRecurso: s.tipoRecurso || item.tipoRecurso,
      mappedId: s.sku,
      isMapped: true,
      destinos,
      vinculoSugerido: s.origem,
    };
  });
  return { itens: resultado, aplicadas };
};
