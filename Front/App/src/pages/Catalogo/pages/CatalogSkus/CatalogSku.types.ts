// ==========================================
// CATALOG SKU - TIPOS ADAPTADOS AO BANCO DE DADOS
// ==========================================

export interface SkuChildType {
  key: string;
  id_item: number;
  sku: string;
  variacao: string; // Mapeia para `descricao_variacao` do itens_core
  marca?: string;
  estoque: number;
  preco_venda: number;
  custo_gerencial: number;
  status: 'ATIVO' | 'INATIVO' | 'Esgotado'; // Adicionado 'Esgotado' para refletir o status correto
}

export interface ItemParentType {
  key: string;
  id_item: number;
  tenant_id: number;
  sku: string;
  nome_item: string;
  tipo_recurso: string; // Ex: 'PRODUTO', 'INSUMO'
  status: 'ATIVO' | 'INATIVO';
  categoria_id: number | null;
  categoria?: string | null;
  familia_id: number | null;
  id_marca?: number | null;
  skus: SkuChildType[];
}

export interface CreateProdutoPayload {
  tenant_id?: number;
  sku?: string;
  codItem?: string;
  nome?: string;
  nome_item?: string;
  tipo_recurso?: string;
  categoria_id?: number | null;
  familia_id?: number | null;
  id_marca?: number | null;
  estoque_inicial?: number;
  financeiro?: {
    preco_venda?: number;
    custo_gerencial?: number;
    margem_lucro?: number;
  };
  skus?: Partial<SkuChildType>[];
}

export interface UpdateProdutoPayload {
  nome_item?: string;
  sku?: string;
  status?: string;
  categoria_id?: number | null;
  familia_id?: number | null;
  id_marca?: number | null;
  preco_venda?: number;
  custo_gerencial?: number;
  skus?: Partial<SkuChildType>[];
  [key: string]: any;
}

export interface GenericProductAPIResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}