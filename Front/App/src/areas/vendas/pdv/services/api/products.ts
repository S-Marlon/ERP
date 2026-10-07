// services/api/products.ts
// PDV no modelo novo (itens_core): backend em /api/vendas/pdv
import { Product } from '../../types/product.types';
import { API_URL } from '../../../../../shared/api/config';

const API_BASE_URL = `${API_URL}`;
const PDV_URL = `${API_BASE_URL}/api/vendas/pdv`;

export interface ProductsResponse {
  data: Product[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };
}

export interface ProductFilters {
  searchTerm?: string;
  category?: string;
  page?: number;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  minStock?: number;
  status?: string;
  brand?: string;
  sort?: string;
  onlyInStock?: boolean;
  onlyActive?: boolean;
  // Provisório: mostra também itens que ainda não passam na regra de publicação
  incluirNaoPublicaveis?: boolean;
}

export const getPdvProducts = async (filters: ProductFilters = {}): Promise<ProductsResponse> => {
  try {
    const params = new URLSearchParams();
    if (filters.searchTerm) params.append('query', filters.searchTerm);
    if (filters.category && filters.category !== 'Todas') params.append('category', filters.category);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.minPrice !== undefined && filters.minPrice > 0) params.append('minPrice', filters.minPrice.toString());
    if (filters.maxPrice !== undefined && filters.maxPrice < 999999) params.append('maxPrice', filters.maxPrice.toString());
    if (filters.minStock !== undefined && filters.minStock >= 0) params.append('minStock', filters.minStock.toString());
    if (filters.onlyActive) params.append('status', 'Ativo');
    else if (filters.status && filters.status !== 'Todos') params.append('status', filters.status);
    if (filters.brand && filters.brand !== 'Todos') params.append('brand', filters.brand);
    if (filters.sort) params.append('sort', filters.sort);
    if (filters.onlyInStock) params.append('onlyInStock', 'true');
    if (filters.incluirNaoPublicaveis) params.append('incluirNaoPublicaveis', 'true');

    const response = await fetch(`${PDV_URL}/itens?${params.toString()}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    return {
      data: data.data || [],
      pagination: {
        total: data.pagination?.total || 0,
        page: data.pagination?.page || filters.page || 1,
        limit: data.pagination?.limit || filters.limit || 20,
        totalPages: data.pagination?.totalPages || 0,
        hasNextPage: data.pagination?.hasNextPage,
        hasPrevPage: data.pagination?.hasPrevPage
      }
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    return {
      data: [],
      pagination: { total: 0, page: filters.page || 1, limit: filters.limit || 20, totalPages: 0 }
    };
  }
};

// Dados atualizados do item (estoque, preço, unidades e faixas)
export const getPdvProductDetail = async (productId: number | string): Promise<Product | null> => {
  const response = await fetch(`${PDV_URL}/itens/${productId}`);
  if (!response.ok) return null;
  const { data } = await response.json();
  return data || null;
};

export const validateProductStockPrice = async (productId: number): Promise<{ stock: number; price: number } | null> => {
  try {
    const product = await getPdvProductDetail(productId);
    if (!product) return null;
    return { stock: product.currentStock || 0, price: product.salePrice || 0 };
  } catch (error) {
    console.error('Error validating product:', error);
    return null;
  }
};

export const getPdvCategories = async (_type: 'parts' | 'services'): Promise<string[]> => {
  try {
    const response = await fetch(`${PDV_URL}/categorias`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return await response.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
    return ['Todas'];
  }
};

export const getPdvBrands = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${PDV_URL}/marcas`);
    if (!response.ok) throw new Error('Failed to fetch brands');
    return await response.json();
  } catch (error) {
    console.error('Error fetching brands:', error);
    return ['Todos'];
  }
};

export const getPdvStatuses = async (): Promise<string[]> => ['Ativo', 'Inativo'];

// Clientes do cadastro (papel CLIENTE/CONSUMIDOR) por nome, razão social, CPF ou CNPJ
export interface ClienteBusca {
  id: number;
  tipo: string;
  nome: string;
  razaoSocial: string | null;
  documento: string;
}

export const buscarClientesPdv = async (busca: string): Promise<ClienteBusca[]> => {
  try {
    const response = await fetch(`${PDV_URL}/clientes?busca=${encodeURIComponent(busca)}`);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
};

// Árvore de categorias do catálogo novo (para o filtro do PDV)
export interface CategoriaNo { value: string; title: string; children: CategoriaNo[] }

export const getArvoreCategoriasPdv = async (): Promise<CategoriaNo[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/catalogo/cadastros/categorias?tenant_id=1`);
    if (!response.ok) return [];
    const lista: any[] = await response.json();
    const ativas = lista.filter(c => c.ativa !== false);
    const montar = (pai: string | null): CategoriaNo[] => ativas
      .filter(c => (c.categoria_pai_id ? String(c.categoria_pai_id) : null) === pai)
      .map(c => ({ value: String(c.id), title: c.nome, children: montar(String(c.id)) }));
    return montar(null);
  } catch {
    return [];
  }
};

export const getAllBasicProducts = async (): Promise<any[]> => {
  try {
    const response = await fetch(`${PDV_URL}/itens?limit=500`);
    if (!response.ok) throw new Error('Failed to fetch products');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching basic products:', error);
    return [];
  }
};
