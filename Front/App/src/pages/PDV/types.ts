// Representa um item na venda - unificado para parts, services e combos
export interface CartItem {
  id: string;
  sku?: string;
  name: string;
  brand?: string;
  price: number;
  quantity: number;
  type: 'part' | 'service';
  stock?: number;           // apenas partes
  category?: string;
  status?: string;
  location?: string;        // apenas partes
  compatibility?: string;   // apenas partes
  oemCode?: string;         // apenas partes
}

// Item original da lista (antes de entrar no carrinho)
export type SaleItem = CartItem & { quantity?: never };

export interface AutoPart extends SaleItem {
  type: 'part';
  brand: string;
  oemCode: string;
  compatibility: string;
  location: string;
  stock: number;
}

export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX';

export interface SaleSummary {
  subtotal: number;
  taxes: number;
  total: number;
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