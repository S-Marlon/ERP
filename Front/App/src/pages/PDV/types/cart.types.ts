// types/cart.types.ts

/**
 * ItemType: Tipagem unificada para o tipo de item no carrinho
 * 'product' = Produto do catálogo
 * 'service' = Serviço do catálogo
 * 'os' = Ordem de Serviço (conjunto de itens + serviços + mão de obra)
 */
export type ItemType = 'product' | 'service' | 'os';

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

/**
 * ✅ NOVO: CartItemOS
 * Interface específica para Ordem de Serviço no carrinho
 * Garante type safety e imutabilidade de OS
 */
export interface CartItemOS extends CartItem {
  type: 'os';
  quantity: 1;  // ✅ OS sempre tem quantidade 1 (imutável)
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
    paid: number;           // ✅ NOVO: Valor já pago
    remaining: number;      // ✅ NOVO: Valor a pagar
    payments?: any[];       // ✅ NOVO: Histórico de pagamentos
  };
}

/**
 * ✅ NOVO: Guard Type para CartItemOS
 * Verifica se um CartItem é uma Ordem de Serviço
 */
export function isCartItemOS(item: CartItem): item is CartItemOS {
  return (
    item.type === 'os' &&
    item.osData?.osNumber !== undefined &&
    item.quantity === 1
  );
}

/**
 * ✅ NOVO: Factory Function para criar CartItemOS
 * Garante estrutura correta e valida dados
 */
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
    price: osData.remaining,  // ✅ USAR REMAINING (não total)
    quantity: 1,              // ✅ SEMPRE 1
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
      remaining: osData.remaining,  // ✅ IMPORTANTE
      payments: osData.payments || []
    }
  } as CartItemOS;
}