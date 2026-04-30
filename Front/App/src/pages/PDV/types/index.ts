/**
 * types/index.ts
 * ✅ PONTO ÚNICO DE EXPORTAÇÃO PARA TODOS OS TIPOS DO PDV
 * 
 * Consolidação centralizada:
 * - Cart types (items, cartItemOS, factory functions)
 * - Payment types (métodos, status, source)
 * - Sale types (venda, OS)
 * - Models (estruturas complexas)
 * - Reutilizáveis (Product, Category, etc)
 */

// Re-export models
export * from './models';

// ========== CART TYPES ==========
export type ItemType = 'product' | 'service' | 'os';
export type DisplayMode = 'cards' | 'lista' | 'simplificado';

export interface SaleItem {
  id: string | number;
  name: string;
  category: string;
  price: number;
  costPrice?: number;
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
  type: ItemType;
  osData?: any;
  originalPrice?: number;
}

export interface AutoPart extends SaleItem {
  type: 'part';
  brand: string;
  oemCode: string;
  compatibility: string;
  location: string;
  stock: number;
}

export interface CartItemOS extends CartItem {
  type: 'os';
  quantity: 1;
  osData: {
    osNumber: string;
    equipment: string;
    application: string;
    gauge: string;
    layers: string;
    finalLength: number;
    laborType: string;
    laborValue: number;
    customerName: string;
    technician: string;
    status: string;
    title: string;
    notes: string;
    items: CartItem[];
    services: CartItem[];
    productsTotal: number;
    servicesTotal: number;
    laborTotal: number;
    total: number;
    paid: number;
    remaining: number;
    payments?: any[];
  };
}

export function isCartItemOS(item: CartItem): item is CartItemOS {
  return (
    item.type === 'os' &&
    item.osData?.osNumber !== undefined &&
    item.quantity === 1
  );
}

export function createCartItemOS(osData: any): CartItemOS {
  if (!osData.osNumber) {
    throw new Error('osNumber é obrigatório');
  }
  if (!osData.equipment || !osData.gauge) {
    throw new Error('equipment e gauge são obrigatórios');
  }
  if (osData.remaining === undefined) {
    throw new Error('remaining é obrigatório');
  }

  return {
    id: `os-${Date.now()}`,
    name: `${osData.equipment} • ${osData.gauge}`,
    category: 'OS',
    price: osData.remaining,
    quantity: 1,
    type: 'os',
    osData: {
      osNumber: osData.osNumber,
      equipment: osData.equipment,
      application: osData.application || '',
      gauge: osData.gauge,
      layers: osData.layers || '2',
      finalLength: osData.finalLength || 0,
      laborType: osData.laborType || 'fixed',
      laborValue: osData.laborValue || 0,
      customerName: osData.customerName || '',
      technician: osData.technician || '',
      status: osData.status || 'draft',
      title: osData.title || '',
      notes: osData.notes || '',
      items: osData.items || [],
      services: osData.services || [],
      productsTotal: osData.productsTotal || 0,
      servicesTotal: osData.servicesTotal || 0,
      laborTotal: osData.laborTotal || 0,
      total: osData.total || 0,
      paid: osData.paid || 0,
      remaining: osData.remaining,
      payments: osData.payments || []
    }
  } as CartItemOS;
}

// ========== PAYMENT TYPES ==========
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BANK_TRANSFER' | 'STORE_CREDIT';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';
export type PaymentSource = 'sale' | 'os' | 'manual';

export interface Payment {
  id: string;
  valor: number;
  metodo: PaymentMethod;
  status: PaymentStatus;
  parcelas: number;
  source: PaymentSource;
  saleId?: string;
  osId?: string;
  detalhes?: {
    bandeira?: string;
    authCode?: string;
    nsu?: string;
    chavePix?: string;
    ultimosDigitos?: string;
  };
  createdAt: Date;
  updatedAt?: Date;
}

export interface OSPayment extends Payment {
  source: 'os';
  osId: string;
}

export interface SalePayment extends Payment {
  source: 'sale';
  saleId: string;
}

export interface PaymentDisplay {
  id: string;
  metodo: string;
  valor: number;
  parcelas: number;
  status: PaymentStatus;
  source: PaymentSource;
  statusLabel?: string;
}

export function isOSPayment(payment: Payment): payment is OSPayment {
  return payment.source === 'os' && payment.osId !== undefined;
}

export function isSalePayment(payment: Payment): payment is SalePayment {
  return payment.source === 'sale' && payment.saleId !== undefined;
}

export function calculateTotalPaid(payments: Payment[]): number {
  return payments
    .filter(p => p.status === 'paid' || p.status === 'processing')
    .reduce((sum, p) => sum + p.valor, 0);
}

// ========== SALE TYPES ==========
export interface VendaItem {
  type: 'produto';
  productId: number;
  nome: string;
  quantidade: number;
  precoVenda: number;
  precoCusto: number;
  subtotal: number;
  lucroUnitario: number;
}

export interface OrdemServicoVenda {
  osNumber: string;
  equipment: string;
  gauge: string;
  layers: string;
  finalLength: number;
  laborType: string;
  laborValue: number;
  items: VendaItem[];
  services: any[];
  productsTotal: number;
  servicesTotal: number;
  laborTotal: number;
  total: number;
  paid: number;
  remaining: number;
}

export interface VendaPagamento {
  id: string;
  metodo: string;
  valor: number;
  parcelas: number;
  source: PaymentSource;
  saleId?: string;
  osId?: string;
}

export interface VendaPayload {
  data: Date;
  clienteId?: number;
  clienteNome: string;
  totalBruto: number;
  totalDesconto: number;
  totalLiquido: number;
  totalCusto: number;
  lucroNominal: number;
  percentualLucro: number;
  itens: VendaItem[];
  ordensServico?: OrdemServicoVenda[];
  pagamentos: VendaPagamento[];
}

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

// ========== PRODUCT & CATEGORY TYPES ==========
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
}

export interface CategoryNode {
  id: number;
  name: string;
  parentId?: number;
  children: CategoryNode[];
}
