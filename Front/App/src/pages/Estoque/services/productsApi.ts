// services/productsApi.ts

// A base da API será lida do ambiente (VITE_API_BASE) ou usa o fallback local.
const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001/api';


/**
 * 1. BUSCA PADRÃO: Procura por produtos internos.
 * @param query Termo de busca (ID, nome ou SKU).
 */
export async function searchProducts(query: string) {
    const res = await fetch(`${apiBase}/products?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

/**
 * 2. CRIAÇÃO DE PRODUTO: Encontra ou cria um produto padrão.
 * @param payload Dados mínimos para buscar/criar o produto.
 */
export async function findOrCreateProduct(payload: { sku: string; name?: string; unitCost?: number; category?: string }) {
    const res = await fetch(`${apiBase}/products/find-or-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

/**
 * 3. CRIAÇÃO DE CATEGORIA: Cria um novo nó de categoria no sistema.
 * @param payload { name: 'Nome do Nó', parentId?: 'Nome Completo do Pai' }
 */
export async function createNewCategory(payload: { name: string; parentId?: string }) {
    const res = await fetch(`${apiBase}/products/categories/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    
    // O backend deve retornar 201 (Created) ou 409 (Conflict/Exists) ou 400 (Bad Request).
    if (!res.ok) {
        // Lança o erro com o texto da resposta (que deve ser um JSON de erro)
        const errorText = await res.text();
        throw new Error(`POST /products/categories/create failed: ${res.status} ${res.statusText}. Body: ${String(errorText).slice(0, 1000)}`);
    }

    // Se a criação for bem-sucedida, retorna a resposta JSON (ou true se for 204 No Content)
    return res.status === 204 ? true : res.json(); 
}

/**
 * 4. REGISTRO DE ESTOQUE: Envia os itens mapeados da NF para o backend.
 * @param payload Dados da entrada de estoque e itens.
 */
export async function createStockEntry(payload: {
    accessKey: string;
    supplier: string;
    entryDate: string;
    items: { mappedProductId: string | number; quantityReceived: number; unitCost: number; total: number }[];
}) {
    const res = await fetch(`${apiBase}/stock/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

/**
 * 5. CATEGORIAS: Busca categorias e faz o parsing (Usado no useEffect).
 */
export async function getCategories() {
    const res = await fetch(`${apiBase}/products/categories`);
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`GET /products/categories failed: ${res.status} ${res.statusText}. Body: ${String(text).slice(0,1000)}`);
    }
    try {
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('GET /products/categories: resposta inesperada (não é array)');
        return data;
    } catch (err) {
        throw new Error(`GET /products/categories: payload inválido (não é JSON). Body: ${String(text).slice(0,1000)}`);
    }
}

/**
 * 6. CATEGORIAS RAW: Busca categorias e retorna a resposta bruta (Usado no loadCategories para debug/tratamento).
 */
export async function fetchCategoriesRaw() {
    const res = await fetch(`${apiBase}/products/categories`);
    const body = await res.text();
    return { ok: res.ok, status: res.status, statusText: res.statusText, body };
}