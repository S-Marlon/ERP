/**
 * HELPERS PARA PAGAMENTOS
 * Funções puras para gerenciamento de pagamentos
 */

import type { Payment, PaymentStatus, PaymentMethod, SaleFinancialSummary } from '../types/erp.types';

/**
 * Label legível para o método de pagamento
 */
export const getPaymentMethodLabel = (method: PaymentMethod): string => {
  const labels: Record<PaymentMethod, string> = {
    'pix': 'PIX',
    'credit_card': 'Cartão de Crédito',
    'debit_card': 'Cartão de Débito',
    'cash': 'Dinheiro',
    'boleto': 'Boleto Bancário',
    'transfer': 'Transferência Bancária',
  };
  return labels[method];
};

/**
 * Label legível para status
 */
export const getPaymentStatusLabel = (status: PaymentStatus): string => {
  const labels: Record<PaymentStatus, string> = {
    'pending': 'Pendente',
    'processing': 'Processando',
    'completed': 'Concluído',
    'failed': 'Falha',
    'refunded': 'Reembolsado',
  };
  return labels[status];
};

/**
 * Cor para exibição de status
 */
export const getPaymentStatusColor = (status: PaymentStatus): string => {
  const colors: Record<PaymentStatus, string> = {
    'pending': '#f39c12',
    'processing': '#3498db',
    'completed': '#2ecc71',
    'failed': '#e74c3c',
    'refunded': '#95a5a6',
  };
  return colors[status];
};

/**
 * Ícone para método de pagamento
 */
export const getPaymentMethodIcon = (method: PaymentMethod): string => {
  const icons: Record<PaymentMethod, string> = {
    'pix': '📱',
    'credit_card': '💳',
    'debit_card': '💳',
    'cash': '💰',
    'boleto': '📄',
    'transfer': '🏦',
  };
  return icons[method];
};

/**
 * Validar se pagamento pode ser processado
 */
export const canProcessPayment = (payment: Payment): boolean => {
  return payment.status === 'pending';
};

/**
 * Validar se pagamento pode ser reembolsado
 */
export const canRefundPayment = (payment: Payment): boolean => {
  return ['completed', 'processing'].includes(payment.status);
};

/**
 * Adicionar pagamento a um resumo
 */
export const addPaymentToSummary = (
  summary: SaleFinancialSummary,
  payment: Payment
): SaleFinancialSummary => {
  if (payment.status !== 'completed') {
    return summary;
  }
  
  const newPaid = summary.paid + payment.amount;
  const newRemaining = Math.max(0, summary.total - newPaid);
  
  return {
    ...summary,
    paid: newPaid,
    remaining: newRemaining,
    paymentCount: summary.paymentCount + 1,
    isPaid: newRemaining === 0,
    isPartiallyPaid: newPaid > 0 && newRemaining > 0,
    isPending: newRemaining > 0,
  };
};

/**
 * Calcular resumo financeiro a partir de pagamentos
 */
export const calculatePaymentSummary = (
  total: number,
  payments: Payment[]
): SaleFinancialSummary => {
  const paid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);
  
  const remaining = Math.max(0, total - paid);
  
  return {
    total,
    paid,
    remaining,
    paymentCount: payments.length,
    isPaid: remaining === 0,
    isPartiallyPaid: paid > 0 && remaining > 0,
    isPending: remaining > 0,
  };
};

/**
 * Validar se pode aceitar novo pagamento
 * (não exceder o total)
 */
export const canAcceptPayment = (
  newPaymentAmount: number,
  total: number,
  currentPaid: number
): boolean => {
  return (currentPaid + newPaymentAmount) <= total;
};

/**
 * Agrupar pagamentos por método
 */
export const groupPaymentsByMethod = (payments: Payment[]): Record<PaymentMethod, Payment[]> => {
  const groups: Record<PaymentMethod, Payment[]> = {
    'pix': [],
    'credit_card': [],
    'debit_card': [],
    'cash': [],
    'boleto': [],
    'transfer': [],
  };
  
  payments.forEach(payment => {
    groups[payment.method].push(payment);
  });
  
  return groups;
};

/**
 * Obter total pago por método
 */
export const getTotalByPaymentMethod = (payments: Payment[]): Record<PaymentMethod, number> => {
  const totals: Record<PaymentMethod, number> = {
    'pix': 0,
    'credit_card': 0,
    'debit_card': 0,
    'cash': 0,
    'boleto': 0,
    'transfer': 0,
  };
  
  payments
    .filter(p => p.status === 'completed')
    .forEach(payment => {
      totals[payment.method] += payment.amount;
    });
  
  return totals;
};

/**
 * Gerar chave PIX aleatória (mock)
 * Em produção, seria gerada pelo servidor
 */
export const generatePixKey = (): string => {
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  return uuid;
};

/**
 * Formatar número para exibição
 */
export const formatPaymentAmount = (amount: number, locale: string = 'pt-BR'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
};
