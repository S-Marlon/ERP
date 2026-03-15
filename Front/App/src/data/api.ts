const API_BASE_URL = 'http://localhost:3001/api';

export interface Product {
 
   id: number;
    name: string;
    sku: string;
    barcode?: string;
    pictureUrl?: string;
    category: string;
    brand?: string;
    unitOfMeasure: string;
    costPrice?: number;
    salePrice: number;
    priceMethod?: 'MARKUP' | 'MANUAL';
    markup?: number;
    minStock: number;
    currentStock: number;
    status: 'Ativo' | 'Inativo' | 'Baixo Estoque';
    ncm?: string;
    cest?: string;
    suppliers?: string;
    supplierCode?: string;
    supplierProductCode?: string;

    // extras usados pela UI
    maxStock?: number;
    cfop_padrao?: string;
    percentual_margem_sugerida?: number;

    // ecommerce/logistics
    weight?: number;
    length?: number;
    height?: number;
    width?: number;
    seoTitle?: string;
    descriptionHtml?: string;
    syncEcommerce?: boolean;
}


export const searchProducts = async (query: string): Promise<Product[]> => {
  console.log('Buscando produtos para query:', query);
  try {
    const url = query.trim() ? `${API_BASE_URL}/products?query=${encodeURIComponent(query)}` : `${API_BASE_URL}/products`;
    const response = await fetch(url);
    console.log('Resposta da API:', response.status);
    if (!response.ok) {
      throw new Error('Erro ao buscar produtos');
    }
    const data = await response.json();
    console.log('Dados recebidos:', data);
    return data.map((item: any) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      unitOfMeasure: item.unitOfMeasure,
      salePrice: item.salePrice,
      minStock: item.minStock,
      currentStock: item.currentStock,
      status: item.status,
      suppliers: item.suppliers,
      pictureUrl: item.pictureUrl,
      weight: item.weight,
      length: item.length,
      height: item.height,
      width: item.width,
      seoTitle: item.seoTitle,
      descriptionHtml: item.descriptionHtml,
      syncEcommerce: item.syncEcommerce,
    }));
  } catch (error) {
    console.error('Erro na busca de produtos:', error);
    return [];
  }
};
