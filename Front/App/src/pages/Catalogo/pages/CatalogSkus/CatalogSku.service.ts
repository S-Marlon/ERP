// ==========================================
// CATALOG SKU - SERVIÇO DE API DE PRODUTOS
// ==========================================

import { 
  ItemParentType, 
  SkuChildType, 
  CreateProdutoPayload, 
  UpdateProdutoPayload, 
  GenericProductAPIResponse 
} from './CatalogSku.types';

const API_BASE_URL = 'http://localhost:3001/api/catalogo';
const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Tratador genérico de respostas HTTP da API
 */
const handleResponse = async <T>(response: Response, defaultError: string): Promise<T> => {
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(String(errorData.error ?? errorData.message ?? defaultError));
  }
  return response.json() as Promise<T>;
};

/**
 * 🔄 GET /produtos
 * Busca a lista completa de produtos mapeando a junção de `itens_core` e `comercial_produtos_dados`
 */
export const getProdutos = async (tenantId: number = 1): Promise<ItemParentType[]> => {
  const response = await fetch(`${API_BASE_URL}/produtos?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const dados = (await handleResponse<Record<string, unknown>[]>(response, 'Erro ao carregar o catálogo de produtos.'));

  return dados.map((item: Record<string, unknown>): ItemParentType => {
    const idItem = toNumber(item.id_item ?? item.id, 0);
    const tenantIdResolved = toNumber(item.tenant_id ?? tenantId, tenantId);
    const itemStatus = String(item.status ?? 'ATIVO').toUpperCase();
    const nomeItem = String(item.nome_item ?? item.name ?? item.nome ?? 'Produto sem Nome');
    const categoriaNome = String(item.categoria ?? item.category ?? item.nome_familia ?? '');
    const variacao = String(item.descricao_variacao ?? item.variacao ?? 'Único');
    const marca = String(item.marca ?? item.brand ?? 'Própria');
    const estoque = toNumber(item.estoque ?? item.currentStock ?? 0, 0);
    const precoVenda = toNumber(item.preco_venda ?? item.salePrice ?? 0, 0);

    const skusMapeados: SkuChildType[] = [{
      key: `${idItem}-0`,
      id_item: idItem,
      sku: String(item.sku ?? ''),
      variacao,
      marca,
      estoque,
      preco_venda: precoVenda,
      custo_gerencial: toNumber(item.custo_gerencial ?? 0, 0),
      status: estoque === 0 ? 'Esgotado' : (itemStatus === 'INATIVO' ? 'INATIVO' : 'ATIVO'),
      imagem_url: typeof item.imagem_url === 'string' ? item.imagem_url : null,
    }];

    return {
      key: String(idItem),
      id_item: idItem,
      tenant_id: tenantIdResolved,
      sku: String(item.sku ?? ''),
      nome_item: nomeItem,
      tipo_recurso: String(item.tipo_recurso ?? 'PRODUTO'),
      status: itemStatus === 'INATIVO' ? 'INATIVO' : 'ATIVO',
      categoria_id: item.categoria_id ? toNumber(item.categoria_id, 0) || null : null,
      categoria: categoriaNome || null,
      familia_id: item.familia_id ? toNumber(item.familia_id, 0) || null : null,
      id_marca: item.id_marca ? toNumber(item.id_marca, 0) || null : null,
      skus: skusMapeados,
    };
  });
};

/**
 * 🔄 PUT /produtos/:id_item
 * Atualiza um produto existente no catálogo
 */

export const updateProduto = async (
  idItem: number | string, 
  payload: UpdateProdutoPayload, 
  tenantId: number = 1
): Promise<GenericProductAPIResponse> => {
  const url = `${API_BASE_URL}/produtos/${idItem}?tenant_id=${tenantId}`;
  
  const bodyData = {
    tenant_id: tenantId,
    ...payload
  };

  console.log("📤 [API REQUEST] URL:", url);
  console.log("📤 [API REQUEST] Body enviado:", bodyData);

  const response = await fetch(url, {
    method: 'PUT',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(bodyData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("❌ [API ERROR 400 DETALHADO]:", errorData); // <-- ADICIONE ESTE LOG AQUI
    throw new Error(errorData.error || errorData.message || 'Erro ao atualizar produto.');
  }

  return response.json();
};

/**
 * 🔄 POST /produtos/lote
 * Grava em lote a fila/rascunho de novos produtos criados
 */
export const saveProdutosLote = async (
  produtos: CreateProdutoPayload[], 
  tenantId: number = 1
): Promise<GenericProductAPIResponse> => {
  const payload = { 
    tenant_id: tenantId, 
    produtos
  };
  
  console.log('📤 [saveProdutosLote] Enviando payload para /produtos/lote:', JSON.stringify(payload, null, 2));
  
  const response = await fetch(`${API_BASE_URL}/produtos/lote?tenant_id=${tenantId}`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(payload),
  });

  return handleResponse<GenericProductAPIResponse>(response, 'Erro ao salvar o lote de produtos.');
};