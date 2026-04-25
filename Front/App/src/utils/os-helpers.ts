/**
 * HELPERS PARA ORDEM DE SERVIÇO
 * Funções puras de validação, status e cálculos
 */

import type { OrderService, OSStatus, OSLineItem, LaborCalculation } from '../types/erp.types';

/**
 * Validar se pode editar uma OS
 */
export const canEditOS = (status: OSStatus): boolean => {
  return ['draft', 'open'].includes(status);
};

/**
 * Validar se pode iniciar execução
 */
export const canStartOS = (status: OSStatus): boolean => {
  return ['open'].includes(status);
};

/**
 * Validar se pode marcar como finalizada
 */
export const canFinalizeOS = (status: OSStatus): boolean => {
  return ['in_progress', 'waiting_parts'].includes(status);
};

/**
 * Validar se pode gerar venda
 */
export const canGenerateSale = (status: OSStatus): boolean => {
  return ['finished', 'delivered'].includes(status);
};

/**
 * Validar se pode cancelar
 */
export const canCancelOS = (status: OSStatus): boolean => {
  return !['delivered', 'canceled'].includes(status);
};

/**
 * Obter próximo status possível
 */
export const getNextOSStatus = (currentStatus: OSStatus): OSStatus | null => {
  const transitions: Record<OSStatus, OSStatus | null> = {
    'draft': 'open',
    'open': 'in_progress',
    'in_progress': 'finished',
    'waiting_parts': 'in_progress',
    'finished': 'delivered',
    'delivered': null,
    'canceled': null,
  };
  return transitions[currentStatus];
};

/**
 * Label legível para status
 */
export const getOSStatusLabel = (status: OSStatus): string => {
  const labels: Record<OSStatus, string> = {
    'draft': 'Rascunho',
    'open': 'Aberta',
    'in_progress': 'Em Andamento',
    'waiting_parts': 'Aguardando Peças',
    'finished': 'Finalizada',
    'delivered': 'Entregue',
    'canceled': 'Cancelada',
  };
  return labels[status];
};

/**
 * Cor para exibição de status
 */
export const getOSStatusColor = (status: OSStatus): string => {
  const colors: Record<OSStatus, string> = {
    'draft': '#95a5a6',
    'open': '#3498db',
    'in_progress': '#f39c12',
    'waiting_parts': '#e74c3c',
    'finished': '#2ecc71',
    'delivered': '#27ae60',
    'canceled': '#c0392b',
  };
  return colors[status];
};

/**
 * Calcular subtotal de itens
 */
export const calculateItemsSubtotal = (items: OSLineItem[]): number => {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
};

/**
 * Calcular mão de obra
 */
export const calculateLaborTotal = (labor: LaborCalculation, terminals?: number): number => {
  if (labor.type === 'per_point' && terminals) {
    return labor.value * terminals;
  }
  if (labor.type === 'fixed') {
    return labor.value;
  }
  // 'table' - já deve vir calculado
  return labor.total;
};

/**
 * Calcular total com desconto
 */
export const calculateTotal = (
  subtotalProducts: number,
  subtotalServices: number,
  laborTotal: number,
  discountPercentage?: number,
  discountAmount?: number
): number => {
  const subtotal = subtotalProducts + subtotalServices + laborTotal;
  
  let finalTotal = subtotal;
  
  if (discountAmount) {
    finalTotal -= discountAmount;
  } else if (discountPercentage) {
    finalTotal -= subtotal * (discountPercentage / 100);
  }
  
  return Math.max(0, finalTotal);
};

/**
 * Validar se OS está completa e pode ser processada
 */
export const isOSValid = (os: Partial<OrderService>): boolean => {
  // Check required fields
  if (!os.id || !os.customerId || !os.config) return false;
  if (!os.items || os.items.length === 0) return false;
  if (!os.labor) return false;
  
  // Check config completeness
  const config = os.config;
  if (!config.equipment || !config.gauge || config.layers === undefined || config.finalLength === undefined) {
    return false;
  }
  
  return true;
};

/**
 * Gerar resumo da OS para exibição
 */
export const getOSSummary = (os: OrderService): string => {
  return `${os.config.equipment} • ${os.config.gauge}" ${os.config.layers}T`;
};

/**
 * Clonar OS para criar uma duplicata
 */
export const duplicateOS = (os: OrderService, newCustomerId?: string): Omit<OrderService, 'id' | 'number' | 'createdAt' | 'updatedAt'> => {
  return {
    ...os,
    status: 'draft',
    customerId: newCustomerId || os.customerId,
    saleId: undefined,
    completedAt: undefined,
    deliveredAt: undefined,
    canceledAt: undefined,
  };
};

/**
 * Obter estatísticas da OS
 */
export interface OSStats {
  itemCount: number;
  serviceCount: number;
  totalItems: number;
  averageItemPrice: number;
  averageServicePrice: number;
}

export const getOSStats = (os: OrderService): OSStats => {
  const itemCounts = os.items.length;
  const serviceCounts = os.services.length;
  const totalItems = os.items.length + os.services.length;
  
  const avgItems = itemCounts > 0 
    ? os.items.reduce((sum, i) => sum + i.price, 0) / itemCounts 
    : 0;
    
  const avgServices = serviceCounts > 0
    ? os.services.reduce((sum, s) => sum + s.price, 0) / serviceCounts
    : 0;
  
  return {
    itemCount: itemCounts,
    serviceCount: serviceCounts,
    totalItems,
    averageItemPrice: avgItems,
    averageServicePrice: avgServices,
  };
};
