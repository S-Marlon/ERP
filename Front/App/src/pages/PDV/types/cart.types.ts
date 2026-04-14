// types/cart.types.ts

/**
 * ItemType: Tipagem unificada para o tipo de item no carrinho
 * 'product' = Produto do catálogo
 * 'service' = Serviço do catálogo
 */
export type ItemType = 'product' | 'service';

export interface SaleItem {
  id: string | number;
  name: string;
  category: string;
  price: number;
  costPrice?: number; // Custo real do produto (para cálculo de margem)
  type: ItemType;
  stock?: number;
  sku?: string;
  unitOfMeasure?: string;
  status?: string;
  brand?: string;
  oemCode?: string;
  compatibility?: string;
  location?: string;
  pictureUrl?: string;
}

export interface CartItem extends SaleItem {
  quantity: number;
  type: ItemType; // Agora unificado
  osData?: any;
  originalPrice?: number; // Para descontos
}

export interface AutoPart extends SaleItem {
  type: 'part';
  brand: string;
  oemCode: string;
  compatibility: string;
  location: string;
  stock: number;
}

export type DisplayMode = 'cards' | 'lista' | 'simplificado';