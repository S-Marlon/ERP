export interface AutoPart {
  id: string;
  name: string;
  brand: string;
  oemCode: string;       // Código Original/Fabricante
  sku: string;           // Código interno
  compatibility: string; // Modelos e anos
  location: string;      // Prateleira/Corredor
  price: number;
  stock: number;
}

export interface CartItem extends AutoPart {
  quantity: number;
  discount: number;
}

export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX';

export interface SaleSummary {
  subtotal: number;
  taxes: number;
  total: number;
}