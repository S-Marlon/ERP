import { Product } from '../../Estoque/pages/StockInventory/types/Stock_Products';

const apiBase = 'http://localhost:3001/api';
/**
 * Busca produtos para o PDV
 * Pode filtrar por termo de busca e, futuramente, por outros parâmetros
 */
export async function getPdvProducts(searchTerm?: string): Promise<Product[]> {
    const url = searchTerm 
        ? `${apiBase}/products?query=${encodeURIComponent(searchTerm)}`
        : `${apiBase}/products`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Erro ao carregar produtos do PDV');
    
    return res.json();
}

/**
 * Busca categorias do banco de dados baseadas no tipo (Peças ou Serviços)
 */
export async function getPdvCategories(type: 'parts' | 'services'): Promise<string[]> {
    const res = await fetch(`${apiBase}/categories?type=${type}`);
    if (!res.ok) throw new Error('Erro ao buscar categorias');
    return res.json();
}

/**
 * Fallback local caso o banco ainda não tenha as categorias cadastradas
 */
function getDefaultCategories(type: 'parts' | 'services'): string[] {
    return type === 'parts' 
        ? ['Hidráulica', 'Pneumática', 'Elétrica', 'Automotiva'] 
        : ['Prensagem', 'Manutenção', 'Qualidade'];
}

/**
 * Busca a lista de serviços (caso queira tirar do MOCK_SERVICES e levar para o banco)
 */
export async function getPdvServices(): Promise<any[]> {
    const res = await fetch(`${apiBase}/services`);
    if (!res.ok) throw new Error('Erro ao carregar serviços');
    return res.json();
}