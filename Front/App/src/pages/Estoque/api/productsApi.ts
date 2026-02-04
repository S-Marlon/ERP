import { Category, CategoryTreeBuilder } from '../utils/CategoryTreeBuilder';
import { ProdutoNF } from '../utils/nfeParser';
// Use a interface Category do seu componente (se já existir)
// Importe a classe que acabamos de criar (ajuste o caminho se necessário)

// A base da API será lida do ambiente (VITE_API_BASE) ou usa o fallback local.
const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001/api';




interface ProdutoPersistencia extends ProdutoNF {

    CodInterno: string;

    name: string;
    Categorias: string;
    Marca?: string;
    Descrição?: string;
    Margem_Lucro?: number;
    Preço_Final_de_Venda?: number;
    individualUnit: string;
    unitsPerPackage?: number | null; // ✅ Alinha com estado inicial

}

export interface MappingPayload {
    original: any;
    mapped: any; // Ou a interface ProdutoPersistencia se você a exportar
    supplierCnpj: string;
}


// --- 2. Tipagem do Formato de Árvore (para o Frontend) ---
// Deve ser idêntica à interface Category que seu CategoryTree espera
export interface TreeCategory {
  id: string;
  name: string;
  children: TreeCategory[];
}

export async function searchProductsMapping(query: string): Promise<InternalProductData[]> {
    const res = await fetch(`${apiBase}/products?query=${encodeURIComponent(query)}`); // Note que mudei para a rota principal
    
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro na busca: ${res.status}. ${errorText}`);
    }
    
    return res.json();
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


export const saveProductMapping = async (payload: MappingPayload) => {
    const response = await fetch(`${apiBase}/products/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.text();
        let errorMessage = `Erro ${response.status}`;
        
        try {
            // Tenta transformar em JSON para pegar a mensagem amigável que você criou no backend
            const parsedError = JSON.parse(errorData);
            errorMessage = parsedError.error || errorMessage;
        } catch {
            // Se não for JSON (ex: erro 500 com stack trace), usa o texto bruto
            console.error("Erro bruto do servidor:", errorData);
        }

        throw new Error(errorMessage);
    }

    return await response.json();
};


// Verifica se um fornecedor existe pelo CNPJ
export const checkSupplier = async (supplierCnpj: string) => {
    // Sanitização: É recomendável remover pontos e traços antes de enviar, 
    // dependendo de como você salva no banco (varchar 18 permite ambos).
    const response = await fetch(`${apiBase}/suppliers/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: supplierCnpj })
    });

    if (!response.ok) throw new Error(await response.text());
    
    // O retorno esperado do seu backend deve mapear id_fornecedor e razao_social
    return await response.json(); 
    // Exemplo de retorno: { exists: true, supplier: { id_fornecedor: 1, razao_social: "Empresa X" } }
};


// services/supplierService.ts
export async function buscarSiglaNoBanco(cnpj: string): Promise<string> {
    if (!cnpj) return "";

    // IMPORTANTE: Não use .replace(/\D/g, '') aqui! 
    // O CNPJ deve ir como '71.636.179/0001-16'
    
    try {
        const response = await fetch(`${apiBase}/suppliers/get-sigla`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cnpj: cnpj }) 
        });

        const data = await response.json();
        return data.sigla || "";
    } catch (error) {
        console.error("Erro na busca:", error);
        return "";
    }
}

export async function buscarProdutosExistentes(termo: string): Promise<any[]> {
    if (!termo || termo.length < 2) return [];

    try {
        // Aqui usamos GET pois é uma consulta simples por parâmetro
        const response = await fetch(`${apiBase}/products/search?term=${encodeURIComponent(termo)}`);
        
        if (!response.ok) return [];

        const data = await response.json();
        return Array.isArray(data) ? data : []; 
    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        return [];
    }
}

// Cria fornecedor com CNPJ e nome
export const createSupplier = async (payload: { cnpj: string; name: string, nomeFantasia: string, siglaGerada: string }) => {
    // Mapeia diretamente para os campos esperados pelo backend: { cnpj, name }
    // Caso seu backend aceite outras chaves como razao_social, você pode incluí-las também.
    const body = {
        cnpj: payload.cnpj,
        name: payload.name,
        nomeFantasia: payload.nomeFantasia,
        siglaGerada: payload.siglaGerada,
        
        // Nome vindo do formulário/NFe
        // Opcional: nome_fantasia: payload.name, razao_social: payload.name
    };

    const response = await fetch(`${apiBase}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
    }
    return await response.json();
};

export const checkExistingMappings = async (supplierCnpj: string, skus: string[]) => {
    const response = await fetch('http://localhost:3001/api/products/check-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierCnpj, skus })
    });
    return await response.json();
};
/**
 * Consolida a entrada de NF no banco de dados
 * Cria registros de NF, itens, movimentações e atualiza estoque
 */
export const submitStockEntry = async (payload: {
    invoiceNumber: string;
    accessKey: string;
    entryDate: string;
    supplierCnpj: string;
    supplierName: string;
    totalFreight: number;
    totalIpi: number;
    totalOtherExpenses: number;
    totalNoteValue: number;
    items: {
        codigoInterno: string;
        skuFornecedor: string;
        quantidadeRecebida: number;
        unidade: string;
        custoUnitario: number;
    }[];
}) => {
    const response = await fetch(`${apiBase}/stock-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
    }
    return await response.json();
};