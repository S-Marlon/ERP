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
    onlyInStock?: boolean; // Adicione isso
    onlyActive?: boolean;  // Adicione isso
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
    
    // 1. Mapeamento de searchTerm para 'query' (Como seu backend espera)
    if (filters.searchTerm) params.append('query', filters.searchTerm);
    if (filters.category && filters.category !== 'Todas') params.append('category', filters.category);
    
    // 2. Paginação
    params.append('page', (filters.page || 1).toString());
    params.append('limit', (filters.limit || 20).toString());
    
    // 3. Preços (Removida a trava do > 0 para permitir busca de produtos gratuitos ou base 0)
    if (filters.minPrice !== undefined) params.append('minPrice', filters.minPrice.toString());
    if (filters.maxPrice !== undefined) params.append('maxPrice', filters.maxPrice.toString());
    
    // 4. Estoque
    if (filters.minStock !== undefined) params.append('minStock', filters.minStock.toString());
    
    // 5. Status e Marca
    if (filters.status && filters.status !== 'Todos') params.append('status', filters.status);
    if (filters.brand && filters.brand !== 'Todos') params.append('brand', filters.brand);


    if (filters.onlyActive === true) {
    // Se o seu backend já usa o campo 'status', force 'Ativo' quando o switch estiver ligado
    params.append('status', 'Ativo');
} else {
    // Se estiver desligado (false), talvez você queira mandar 'Todos' ou nem mandar o parâmetro
    // params.append('status', 'Todos'); 
}

if (filters.onlyInStock === true) {
    // Se o backend não entende 'onlyInStock', tente enviar minStock=1
    params.append('minStock', '1');
}

    const url = `${apiBase}/products?${params.toString()}`;
    
    // Debug amigável para você ver no console do navegador a URL exata sendo chamada
    console.log('Chamando API PDV:', url);

    const res = await fetch(url);
    
    if (!res.ok) {
        // Tenta ler o erro do corpo da resposta se disponível
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erro ao carregar produtos do PDV');
    }
    
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
