import { Product } from '../../Estoque/pages/StockInventory/types/Stock_Products';
import { ProductBasic, CategoryNode } from '../types';

const apiBase = 'http://localhost:3001/api';

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
}

/**
 * Carrega TODOS os produtos básicos (ID, SKU, Name, Category, Brand, Localização)
 * para cache local. Sem paginação - retorna tudo para processamento local.
 */
export async function getAllBasicProducts(): Promise<ProductBasic[]> {
    try {
        // Busca produtos com limite alto e sem paginação
        const params = new URLSearchParams({
            limit: '10000', // Carrega até 10k produtos
            page: '1'
        });
        
        const url = `${apiBase}/products?${params.toString()}`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error('Erro ao carregar produtos básicos');
        
        const data: ProductsResponse = await res.json();
        
        // Mapeia para formato básico
        return data.data.map(p => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            category: p.category,
            brand: p.brand,
            pictureUrl: p.pictureUrl,
            location: p.location || ''
        }));
    } catch (error) {
        console.error('Erro ao carregar produtos básicos:', error);
        return [];
    }
}

/**
 * Busca produtos do PDV com suporte a filtros avançados e paginação
 * Query params: query, category, page, limit, minPrice, maxPrice, minStock, status, brand
 */
export async function getPdvProducts(filters: ProductFilters): Promise<ProductsResponse> {
    const params = new URLSearchParams();
    
    if (filters.searchTerm) params.append('query', filters.searchTerm);
    if (filters.category) params.append('category', filters.category);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.minPrice !== undefined && filters.minPrice > 0) params.append('minPrice', filters.minPrice.toString());
    if (filters.maxPrice !== undefined && filters.maxPrice < 999999) params.append('maxPrice', filters.maxPrice.toString());
    if (filters.minStock !== undefined && filters.minStock >= 0) params.append('minStock', filters.minStock.toString());
    if (filters.maxStock !== undefined && filters.maxStock < 999999) params.append('maxStock', filters.maxStock.toString());
    if (filters.status && filters.status !== 'Todos') params.append('status', filters.status);
    if (filters.brand && filters.brand !== 'Todos') params.append('brand', filters.brand);
    
    const url = `${apiBase}/products?${params.toString()}`;
    const res = await fetch(url);
    
    if (!res.ok) throw new Error('Erro ao carregar produtos do PDV');
    
    return res.json();
}

/**
 * Valida estoque e preço atual de um produto via API
 * Chamado quando produto for selecionado ou adicionado ao carrinho
 */
export async function validateProductStockPrice(productId: number): Promise<{stock: number, price: number} | null> {
    try {
        const res = await fetch(`${apiBase}/produtos/${productId}`);
        if (!res.ok) return null;
        
        const product = await res.json();
        return {
            stock: product.currentStock || 0,
            price: product.salePrice || 0
        };
    } catch (error) {
        console.error('Erro ao validar estoque/preço:', error);
        return null;
    }
}

/**
 * Busca categorias do banco de dados com hierarquia (categorias PAI + subcategorias)
 */
export async function getCategoryHierarchy(type: 'parts' | 'services'): Promise<CategoryNode[]> {
    try {
        const res = await fetch(`${apiBase}/categories/tree?type=${type}`);
        if (!res.ok) throw new Error('Erro ao buscar categorias');
        return res.json();
    } catch (error) {
        console.error('Erro ao buscar hierarquia de categorias:', error);
        return getDefaultCategories(type).map((name, idx) => ({
            id: idx,
            name,
            children: []
        }));
    }
}

/**
 * Busca categorias do banco de dados (apenas PAI)
 */
export async function getPdvCategories(type: 'parts' | 'services'): Promise<string[]> {
    const res = await fetch(`${apiBase}/categories?type=${type}`);
    if (!res.ok) throw new Error('Erro ao buscar categorias');
    return res.json();
}

/**
 * Busca lista de marcas para filtro
 */
export async function getPdvBrands(): Promise<string[]> {
    try {
        const res = await fetch(`${apiBase}/brands`);
        if (!res.ok) return [];
        return res.json();
    } catch (error) {
        console.error('Erro ao buscar marcas:', error);
        return [];
    }
}

/**
 * Busca lista de status de produtos
 */
export async function getPdvStatuses(): Promise<string[]> {
    try {
        const res = await fetch(`${apiBase}/statuses`);
        if (!res.ok) return [];
        return res.json();
    } catch (error) {
        console.error('Erro ao buscar status:', error);
        return ['Ativo', 'Inativo'];
    }
}

/**
 * Fallback local
 */
function getDefaultCategories(type: 'parts' | 'services'): string[] {
    return type === 'parts' 
        ? ['Hidráulica', 'Pneumática', 'Elétrica', 'Automotiva'] 
        : ['Prensagem', 'Manutenção', 'Qualidade'];
}
