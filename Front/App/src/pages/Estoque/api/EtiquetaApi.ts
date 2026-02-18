// EtiquetaApi.ts
const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001/api';

export async function searchProducts(query: string) {
    if (!query) return [];
    
const res = await fetch(`${apiBase}/products?query=${encodeURIComponent(query)}`);    

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Erro ao buscar produtos');
    }
    
    return res.json(); 
    // Espera-se um array: [{ id, name, sku, price, ... }]
}