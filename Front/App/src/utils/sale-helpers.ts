/**
 * HELPERS PARA ORDEM DE VENDA
 * Funções puras de status, validações e cálculos
 */

import type { Sale, SaleStatus } from '../types/erp.types';
import { calculateItemsSubtotal } from './os-helpers';

/**
 * Validar se pode editar uma venda
 */
export const canEditSale = (status: SaleStatus): boolean => {
  return ['draft', 'sent'].includes(status);
};

/**
 * Validar se pode aprovar uma venda
 */
export const canApproveSale = (status: SaleStatus): boolean => {
  return ['sent'].includes(status);
};

/**
 * Validar se pode marcar como completa
 */
export const canCompleteSale = (status: SaleStatus): boolean => {
  return ['in_progress'].includes(status);
};

/**
 * Validar se pode cancelar
 */
export const canCancelSale = (status: SaleStatus): boolean => {
  return !['completed', 'canceled'].includes(status);
};

/**
 * Obter próximo status possível
 */
export const getNextSaleStatus = (currentStatus: SaleStatus): SaleStatus | null => {
  const transitions: Record<SaleStatus, SaleStatus | null> = {
    'draft': 'sent',
    'sent': 'approved',
    'approved': 'in_progress',
    'in_progress': 'completed',
    'completed': null,
    'canceled': null,
  };
  return transitions[currentStatus];
};

/**
 * Label legível para status
 */
export const getSaleStatusLabel = (status: SaleStatus): string => {
  const labels: Record<SaleStatus, string> = {
    'draft': 'Rascunho',
    'sent': 'Enviada',
    'approved': 'Aprovada',
    'in_progress': 'Em Andamento',
    'completed': 'Concluída',
    'canceled': 'Cancelada',
  };
  return labels[status];
};

/**
 * Cor para exibição de status
 */
export const getSaleStatusColor = (status: SaleStatus): string => {
  const colors: Record<SaleStatus, string> = {
    'draft': '#95a5a6',
    'sent': '#3498db',
    'approved': '#2ecc71',
    'in_progress': '#f39c12',
    'completed': '#27ae60',
    'canceled': '#c0392b',
  };
  return colors[status];
};

/**
 * Calcular total bruto sem impostos
 */
export const calculateSaleSubtotal = (sale: Sale): number => {
  return sale.items.reduce((sum, item) => sum + item.totalPrice, 0);
};

/**
 * Calcular total com descontos e impostos
 */
export const calculateSaleTotal = (sale: Sale): number => {
  let total = calculateSaleSubtotal(sale);
  
  // Aplicar desconto
  if (sale.discountAmount) {
    total -= sale.discountAmount;
  } else if (sale.discountPercentage) {
    total -= total * (sale.discountPercentage / 100);
  }
  
  // Aplicar imposto
  if (sale.taxAmount) {
    total += sale.taxAmount;
  } else if (sale.taxPercentage) {
    total += total * (sale.taxPercentage / 100);
  }
  
  return Math.max(0, total);
};

/**
 * Validar se venda está completa
 */
export const isSaleValid = (sale: Partial<Sale>): boolean => {
  if (!sale.id || !sale.orderId || !sale.customerId) return false;
  if (!sale.items || sale.items.length === 0) return false;
  if (sale.totalAmount === undefined) return false;
  
  return true;
};

/**
 * Gerar identificador legível da venda
 */
export const generateSaleNumber = (timestamp: Date = new Date()): string => {
  const year = timestamp.getFullYear();
  const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `VND-${year}-${sequence}`;
};

/**
 * Obter status de pagamento textual
 */
export const getPaymentStatus = (sale: Sale): 'fully_paid' | 'partially_paid' | 'unpaid' => {
  if (sale.payments.length === 0) return 'unpaid';
  
  const totalPaid = sale.payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);
  
  if (totalPaid >= sale.totalAmount) return 'fully_paid';
  if (totalPaid > 0) return 'partially_paid';
  
  return 'unpaid';
};

/**
 * Calcular valores pendentes
 */
export const calculateSalePaymentSummary = (sale: Sale) => {
  const totalPaid = sale.payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);
  
  const remaining = Math.max(0, sale.totalAmount - totalPaid);
  const percentage = sale.totalAmount > 0 ? (totalPaid / sale.totalAmount) * 100 : 0;
  
  return {
    totalPaid,
    remaining,
    isPaid: remaining === 0,
    paymentPercentage: Math.min(100, percentage),
  };
};
