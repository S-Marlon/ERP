// Representa um item na venda - unificado para parts, services e combos
export interface CartItem extends SaleItem {
  quantity: number;
  type: 'part' | 'os'; // 👈 NOVO
  osData?: any; // 👈 guarda estrutura completa
}

// Item original da lista (antes de entrar no carrinho)
export interface SaleItem {
  id: string | number;
  name: string;
  category: string;
  price: number;
  type: 'part' | 'service';
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

export interface AutoPart extends SaleItem {
  type: 'part';
  brand: string;
  oemCode: string;
  compatibility: string;
  location: string;
  stock: number;
}

export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX';

export type DisplayMode = 'cards' | 'lista' | 'simplificado';

export interface SaleSummary {
  subtotal: number;
  taxes: number;
  total: number;
}

// Cache local de produtos com informações básicas
export interface ProductBasic {
  id: number;
  sku: string;
  name: string;
  category: string;
  categoryParentId?: number;
  brand?: string;
  location?: string;
  pictureUrl?: string;
}

// Hierarquia de categorias para navegação
export interface CategoryNode {
  id: number;
  name: string;
  parentId?: number;
  children: CategoryNode[];
}


export type StatusVenda = 'disponivel' | 'editando' | 'pagamento';

export interface Venda {
  id: number;
  cliente: string;
  vendedor: string;
  itens: string[];
  valorTotal: number;
  ultimaAlteracao: string;
  status: StatusVenda;
  editadoPor?: string;
}


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