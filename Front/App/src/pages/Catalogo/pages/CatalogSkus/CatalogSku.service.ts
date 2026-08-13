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

/**
 * Tratador genérico de respostas HTTP da API
 */
const handleResponse = async <T>(response: Response, defaultError: string): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || defaultError);
  }
  return response.json();
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

  const dados = await handleResponse<any[]>(response, 'Erro ao carregar o catálogo de produtos.');

  return dados.map((item: any): ItemParentType => {
    const idItem = Number(item.id_item || item.id);
    const tenantIdResolved = Number(item.tenant_id || tenantId);

    // Mapeamento das variações/filhos
    let skusMapeados: SkuChildType[] = [];

    if (Array.isArray(item.skus) && item.skus.length > 0) {
      skusMapeados = item.skus.map((sku: any, index: number): SkuChildType => {
        const estoque = Number(sku.estoque || 0);
        const statusRaw = String(sku.status || item.status || 'ATIVO').toUpperCase();
        
        return {
          key: sku.id_item ? `${sku.id_item}-${index}` : `${idItem}-sub-${index}`,
          id_item: Number(sku.id_item || idItem),
          sku: sku.sku || item.sku || '',
          variacao: sku.descricao_variacao || sku.variacao || sku.especificacao || 'Padrão',
          marca: sku.marca || item.marca || 'Própria',
          estoque,
          preco_venda: Number(sku.preco_venda || item.preco_venda || 0),
          custo_gerencial: Number(sku.custo_gerencial || item.custo_gerencial || 0),
          status: estoque === 0 ? 'Sem Estoque' : (statusRaw === 'INATIVO' ? 'INATIVO' : 'ATIVO')
        };
      });
    } else {
      // Fallback para itens individuais sem array de variação explícito no retorno
      const estoque = Number(item.estoque || 0);
      const statusRaw = String(item.status || 'ATIVO').toUpperCase();

      skusMapeados = [{
        key: `${idItem}-0`,
        id_item: idItem,
        sku: item.sku || '',
        variacao: item.descricao_variacao || 'Único',
        marca: item.marca || 'Própria',
        estoque,
        preco_venda: Number(item.preco_venda || 0),
        custo_gerencial: Number(item.custo_gerencial || 0),
        status: estoque === 0 ? 'Sem Estoque' : (statusRaw === 'INATIVO' ? 'INATIVO' : 'ATIVO')
      }];
    }

    return {
      key: String(idItem),
      id_item: idItem,
      tenant_id: tenantIdResolved,
      sku: item.sku || '',
      nome_item: item.nome_item || item.nome || 'Produto sem Nome',
      tipo_recurso: item.tipo_recurso || 'PRODUTO',
      status: String(item.status).toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO',
      categoria_id: item.categoria_id ? Number(item.categoria_id) : null,
      familia_id: item.familia_id ? Number(item.familia_id) : null,
      id_marca: item.id_marca ? Number(item.id_marca) : null,
      skus: skusMapeados
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
  const response = await fetch(`${API_BASE_URL}/produtos/lote?tenant_id=${tenantId}`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ 
      tenant_id: tenantId, 
      produtos // Ajustado de 'itens' para 'produtos' casando com o back-end
    }),
  });

  return handleResponse<GenericProductAPIResponse>(response, 'Erro ao salvar o lote de produtos.');
};