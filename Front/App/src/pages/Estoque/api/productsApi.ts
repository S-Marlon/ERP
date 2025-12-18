import { Category, CategoryTreeBuilder } from '../utils/CategoryTreeBuilder';
// Use a interface Category do seu componente (se já existir)
// Importe a classe que acabamos de criar (ajuste o caminho se necessário)

// A base da API será lida do ambiente (VITE_API_BASE) ou usa o fallback local.
const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001/api';



// --- 2. Tipagem do Formato de Árvore (para o Frontend) ---
// Deve ser idêntica à interface Category que seu CategoryTree espera
export interface TreeCategory {
  id: string;
  name: string;
  children: TreeCategory[];
}



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
 * 6. CATEGORIAS RAW: Busca categorias e retorna a resposta bruta (Usado no loadCategories para debug/tratamento).
 */
export async function fetchCategoriesRaw() {
    const res = await fetch(`${apiBase}/products/categories`);
    const body = await res.text();
    return { ok: res.ok, status: res.status, statusText: res.statusText, body };
}




// --- 4. Função Principal da API de Produtos (FINALIZADA) ---

export async function getCategoryTree(): Promise<Category[]> {
    // 1. Busca a lista da API
    const res = await fetch(`${apiBase}/categories/tree`);
    if (!res.ok) {
        throw new Error(`GET ${apiBase}/categories/tree failed: ${res.status} ${res.statusText}`);
    }

    // A API retorna a árvore bruta
    const rawTreeCategories = await res.json(); 
    
    // 🛑 DEBUG: Log do que a API retorna (para confirmar que é uma árvore)
    console.log('flatCategories Tree:', rawTreeCategories); 

    if (!Array.isArray(rawTreeCategories)) {
        throw new Error("A API não retornou um array de categorias raiz.");
    }
    
    // 2. Converte a árvore bruta em árvore limpa
    const categoryTree = CategoryTreeBuilder.mapRawTreeToCleanTree(rawTreeCategories);
    
    // 🛑 DEBUG: Log do resultado final
    console.log('Category Tree:', categoryTree);

    return categoryTree;
}
