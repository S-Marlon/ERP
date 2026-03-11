const API_BASE_URL = 'http://localhost:3001/api';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  salePrice: number;
  minStock: number;
  currentStock: number;
  status: string;
  suppliers?: string;
  // ecommerce/logistics (optional for PDV, etc.)
  pictureUrl?: string;
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
