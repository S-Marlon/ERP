// services/api/products.ts
import { Product } from '../../types/product.types';

const API_BASE_URL = 'http://localhost:3001';

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
}

export const getPdvProducts = async (filters: ProductFilters = {}): Promise<ProductsResponse> => {
  try {
    // Build query string
    const params = new URLSearchParams();
    
    if (filters.searchTerm) {
      params.append('query', filters.searchTerm);
    }
    if (filters.category && filters.category !== 'Todas') {
      params.append('category', filters.category);
    }
    if (filters.page) {
      params.append('page', filters.page.toString());
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }
    if (filters.minPrice !== undefined && filters.minPrice > 0) {
      params.append('minPrice', filters.minPrice.toString());
    }
    if (filters.maxPrice !== undefined && filters.maxPrice < 999999) {
      params.append('maxPrice', filters.maxPrice.toString());
    }
    if (filters.minStock !== undefined && filters.minStock >= 0) {
      params.append('minStock', filters.minStock.toString());
    }
    if (filters.status && filters.status !== 'Todos') {
      params.append('status', filters.status);
    }
    if (filters.brand && filters.brand !== 'Todos') {
      params.append('brand', filters.brand);
    }
    if (filters.sort) {
      params.append('sort', filters.sort);
    }

    const url = `${API_BASE_URL}/api/products?${params.toString()}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

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
      pagination: {
        total: 0,
        page: filters.page || 1,
        limit: filters.limit || 20,
        totalPages: 0
      }
    };
  }
};

export const validateProductStockPrice = async (productId: number): Promise<{ stock: number; price: number } | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/products/${productId}`);
    if (!response.ok) return null;
    
    const product = await response.json();
    return {
      stock: product.currentStock || 0,
      price: product.salePrice || 0
    };
  } catch (error) {
    console.error('Error validating product:', error);
    return null;
  }
};

export const getPdvCategories = async (type: 'parts' | 'services'): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
    return ['Todas'];
  }
};

export const getPdvBrands = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/brands`);
    if (!response.ok) throw new Error('Failed to fetch brands');
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching brands:', error);
    return ['Todos'];
  }
};

export const getPdvStatuses = async (): Promise<string[]> => {
  try {
    // No specific endpoint, using default values
    return ['Ativo', 'Inativo'];
  } catch (error) {
    console.error('Error fetching statuses:', error);
    return ['Ativo', 'Inativo'];
  }
};

export const getAllBasicProducts = async (): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/products?limit=1000`);
    if (!response.ok) throw new Error('Failed to fetch products');
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching basic products:', error);
    return [];
  }
};