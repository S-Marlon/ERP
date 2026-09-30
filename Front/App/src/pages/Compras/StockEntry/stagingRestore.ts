// Retomada da conferência: aplica nos itens recém-lidos do XML o que já foi salvo na staging
// (mapeamento, tipo de entrada, GTIN manual, quantidade recebida e conferência).
import { TIPO_RECURSO_PADRAO } from './tipoRecurso';
import { FreightMode } from './freightDistribution';

export interface StagingRowSalva {
  item_nfe_seq: string | null;
  quantidade_recebida?: number | string | null;
  divergencia?: number | string | null;
  is_confirmed?: number | null;
  produto_id_sistema?: number | null;
  sku_sistema?: string | null;
  sku_sugerido?: string | null;
  nome_item_sugerido?: string | null;
  mapeamento_json?: string | Record<string, any> | null;
}

export interface FreteAdicionalSalvo {
  valor: number;
  metodo: string;
  observacao: string;
  modo_rateio?: FreightMode;
}

const lerJson = (valor: unknown): Record<string, any> => {
  if (!valor) return {};
  if (typeof valor === 'object') return valor as Record<string, any>;
  try {
    return JSON.parse(String(valor)) || {};
  } catch {
    return {};
  }
};

export const lerFreteAdicionalSalvo = (valor: unknown): FreteAdicionalSalvo | null => {
  const json = lerJson(valor);
  if (json.valor === undefined) return null;
  return {
    valor: Number(json.valor) || 0,
    metodo: json.metodo || '',
    observacao: json.observacao || '',
    modo_rateio: json.modo_rateio,
  };
};

export interface ResultadoRestauracao<T> {
  items: T[];
  restaurados: number;
  mapeados: number;
  conferidos: number;
}

export const restaurarItensDoStaging = <T extends { nItem?: string | number; quantidade?: number }>(
  items: T[],
  linhas: StagingRowSalva[]
): ResultadoRestauracao<T> => {
  const porSeq = new Map(
    linhas.filter(l => String(l.item_nfe_seq || '').trim() !== '').map(l => [String(l.item_nfe_seq), l])
  );

  let restaurados = 0;
  let mapeados = 0;
  let conferidos = 0;

  const restaurados_items = items.map(item => {
    const linha = porSeq.get(String(item.nItem));
    if (!linha) return item;
    restaurados++;

    const json = lerJson(linha.mapeamento_json);
    const { tipo_recurso, gtin_manual, ...payloadModal } = json;
    const temMapeamento = Boolean(payloadModal.mode);

    const produtoId = linha.produto_id_sistema ? Number(linha.produto_id_sistema) : null;
    const skuSugerido = String(linha.sku_sugerido || '').trim() || null;
    // Após a aprovação, item novo tem produto_id_sistema mas o código exibido continua sendo o SKU criado
    const mappedId = produtoId ? (linha.sku_sistema || skuSugerido || produtoId) : skuSugerido;
    if (mappedId) mapeados++;

    const quantidadeNota = Number(item.quantidade) || 0;
    const recebida = linha.quantidade_recebida !== null && linha.quantidade_recebida !== undefined
      ? Number(linha.quantidade_recebida)
      : quantidadeNota;
    const isConfirmed = Number(linha.is_confirmed) === 1 && Boolean(mappedId);
    if (isConfirmed) conferidos++;

    return {
      ...item,
      receivedQuantity: recebida,
      difference: recebida - quantidadeNota,
      isConfirmed,
      tipoRecurso: tipo_recurso || TIPO_RECURSO_PADRAO,
      customGtin: gtin_manual || undefined,
      produtoIdSistema: produtoId,
      skuSistema: linha.sku_sistema || null,
      skuSugerido,
      nomeItemSugerido: linha.nome_item_sugerido || null,
      mapeamento: temMapeamento ? payloadModal : null,
      mappedId: mappedId || undefined,
      isMapped: Boolean(mappedId),
    };
  });

  return { items: restaurados_items, restaurados, mapeados, conferidos };
};
