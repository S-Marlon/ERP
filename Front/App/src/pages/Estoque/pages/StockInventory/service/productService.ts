import { Product } from '../types/Stock_Products';

const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001/api';

/**
 * Busca todos os produtos para a tabela
 */
export async function getProducts(searchTerm?: string): Promise<Product[]> {
    // Monta a URL com a query string se houver termo de busca
    const url = searchTerm 
        ? `${apiBase}/products?query=${encodeURIComponent(searchTerm)}`
        : `${apiBase}/products`;

    const res = await fetch(url);

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Erro ao carregar lista de produtos');
    }

    return res.json();
}

/**
 * Busca um produto específico pelo ID
 */
export async function getProductById(id: number): Promise<Product> {
    const res = await fetch(`${apiBase}/produtos/${id}`);

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Erro ao buscar detalhes do produto');
    }

    return res.json();
}

/**
 * Salva as alterações de um produto (Update)
 */
export async function updateProduct(id: number | string, productData: Partial<Product>): Promise<Product> {
    const res = await fetch(`${apiBase}/produtos/${id}`, {
        method: 'PUT', // Ou 'PATCH' dependendo da sua API
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Erro ao salvar alterações do produto');
    }

    return res.json();
}