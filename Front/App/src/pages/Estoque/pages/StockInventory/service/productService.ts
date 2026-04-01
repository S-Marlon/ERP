import { Product } from '../types/Stock_Products';

/* ================= BASE ================= */
const apiBase = import.meta.env?.VITE_API_BASE || 'http://localhost:3001/api';

/* ================= API CLIENT ================= */
async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Erro na requisição');
  }

  return res.json();
}

/* ================= TYPES ================= */
export interface ProductFilters {
  searchTerm?: string;
  category?: string;
  page?: number;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  minStock?: number;
  maxStock?: number;
  status?: string;
  brand?: string;
  sort?: string; // ✅ corrigido
  onlyInStock?: boolean;
  onlyActive?: boolean;
}

export interface ProductBasic {
  id: number;
  sku: string;
  name: string;
  category: string;
  categoryParentId?: number;
  brand?: string;
  location?: string;
  pictureUrl?: string;
  salePrice: number;
  costPrice: number;
  currentStock: number;
}

export interface ProductsResponse {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/* ================= ENDPOINTS ================= */
const endpoints = {
  products: '/products',
  productById: (id: number | string) => `/products/${id}`,
};

/* ================= CACHE ================= */
let basicProductsCache: ProductBasic[] | null = null;

/* ================= HELPERS ================= */
const mapToBasicProduct = (p: Product): ProductBasic => ({
  id: p.id,
  sku: p.sku,
  name: p.name,
  category: p.category,
  brand: p.brand,
  pictureUrl: p.pictureUrl,
  location: p.location || '',
  salePrice: p.salePrice,
  // Melhorando o acesso aos preços
  costPrice: p.preco_custo_novo ?? p.preco_custo ?? 0, // Garantir um valor fallback
  currentStock: p.currentStock,
});

/* ================= SERVICES ================= */

/**
 * Lista simplificada (com cache)
 */
export async function getAllBasicProducts(forceRefresh = false): Promise<ProductBasic[]> {
  if (basicProductsCache && !forceRefresh) {
    return basicProductsCache;
  }

  const params = new URLSearchParams({
    page: '1',
    limit: '1000', // 🔥 reduzido
  });

  const data = await apiClient<ProductsResponse>(`${endpoints.products}?${params}`);

  const mapped = data.data.map(mapToBasicProduct);

  basicProductsCache = mapped;

  return mapped;
}

/**
 * Buscar produto por ID
 */
export function getProductById(id: number): Promise<Product> {
  return apiClient<Product>(endpoints.productById(id));
}

/**
 * Atualizar produto
 */
export function updateProduct(
  id: number | string,
  productData: Partial<Product>
): Promise<Product> {
  return apiClient<Product>(endpoints.productById(id), {
    method: 'PUT',
    body: JSON.stringify(productData),
  });
}

/* ================= PDV ================= */

/**
 * Abort controller para evitar corrida de requests
 */
let pdvController: AbortController | null = null;

export async function getPdvProducts(filters: ProductFilters): Promise<ProductsResponse> {
  // Abort previous request if needed
  pdvController?.abort();
  pdvController = new AbortController();

  const params = new URLSearchParams();

  /* 🔎 Busca */
  if (filters.searchTerm) params.set('query', filters.searchTerm);
  if (filters.category && filters.category !== 'Todas') {
    params.set('category', filters.category);
  }

  /* 📄 Paginação */
  params.set('page', String(filters.page || 1));
  params.set('limit', String(filters.limit || 20));

  /* 💰 Preço */
  if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));

  /* 📦 Estoque */
  if (filters.onlyInStock) {
    params.set('minStock', '1');
  } else if (filters.minStock !== undefined) {
    params.set('minStock', String(filters.minStock));
  }

  /* 🏷️ Status */
  if (filters.onlyActive) {
    params.set('status', 'Ativo');
  } else if (filters.status && filters.status !== 'Todos') {
    params.set('status', filters.status);
  }

  /* 🏭 Marca */
  if (filters.brand && filters.brand !== 'Todos') {
    params.set('brand', filters.brand);
  }

  /* ↕️ Ordenação */
  if (filters.sort) {
    params.set('sort', filters.sort);
  }

  const url = `${endpoints.products}?${params.toString()}`;

  if (import.meta.env.DEV) {
    console.log('API PDV:', url);
  }

  return apiClient<ProductsResponse>(url, {
    signal: pdvController.signal,
  });
}