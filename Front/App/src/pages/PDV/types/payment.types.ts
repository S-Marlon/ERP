/**
 * payment.types.ts
 * Tipos centralizados para pagamentos
 * Define estrutura única de Payment com rastreabilidade
 */

export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BANK_TRANSFER' | 'STORE_CREDIT';

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';

/**
 * PaymentSource: Diferencia a origem do pagamento
 * - 'sale': Pagamento de venda normal (PDV)
 * - 'os': Pagamento de Ordem de Serviço
 * - 'manual': Pagamento manual registrado por gerente
 */
export type PaymentSource = 'sale' | 'os' | 'manual';

/**
 * Payment: Interface unificada para todos os pagamentos
 * Inclui rastreabilidade via source e referencias (saleId, osId)
 */
export interface Payment {
  id: string;                    // UUID único
  valor: number;                 // Valor do pagamento
  metodo: PaymentMethod;         // Método de pagamento
  status: PaymentStatus;         // Status do pagamento
  parcelas: number;              // Número de parcelas (padrão 1)
  source: PaymentSource;         // Origem: sale | os | manual ✅ NOVO
  
  // Referências para reconciliação
  saleId?: string;              // ID da venda (se source='sale')
  osId?: string;                // ID da OS (se source='os')
  
  // Metadados opcionais (para cartão, PIX, etc.)
  detalhes?: {
    bandeira?: string;          // Visa, Master, Elo, etc.
    authCode?: string;          // Código de autorização
    nsu?: string;               // Número sequencial único
    chavePix?: string;          // ID da transação PIX
    ultimosDigitos?: string;    // Últimos 4 dígitos do cartão
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * OSPayment: Extensão específica para pagamentos de OS
 * Garante que source='os' e osId é obrigatório
 */
export interface OSPayment extends Payment {
  source: 'os';
  osId: string;  // ✅ Obrigatório
}

/**
 * SalePayment: Extensão específica para pagamentos de venda
 * Garante que source='sale' e saleId é obrigatório
 */
export interface SalePayment extends Payment {
  source: 'sale';
  saleId: string;  // ✅ Obrigatório
}

/**
 * PaymentDetails: Detalhes de pagamento para exibição
 */
export interface PaymentDisplay {
  id: string;
  metodo: string;               // Label do método (ex: 'Dinheiro', 'Cartão')
  valor: number;
  parcelas: number;
  status: PaymentStatus;
  source: PaymentSource;        // ✅ Incluir source
  statusLabel?: string;         // Label traduzido do status
}

/**
 * Helper: Verificar se é pagamento de OS
 */
export function isOSPayment(payment: Payment): payment is OSPayment {
  return payment.source === 'os' && payment.osId !== undefined;
}

/**
 * Helper: Verificar se é pagamento de Venda
 */
export function isSalePayment(payment: Payment): payment is SalePayment {
  return payment.source === 'sale' && payment.saleId !== undefined;
}

/**
 * Helper: Calcular total pago (soma de pagamentos confirmados)
 */
export function calculateTotalPaid(payments: Payment[]): number {
  return payments
    .filter(p => p.status === 'paid' || p.status === 'processing')
    .reduce((sum, p) => sum + p.valor, 0);
}

/**
 * Helper: Filtrar pagamentos por source
 */
export function filterPaymentsBySource(payments: Payment[], source: PaymentSource): Payment[] {
  return payments.filter(p => p.source === source);
}

/**
 * Helper: Validar estrutura de payment
 */
export function validatePayment(payment: Partial<Payment>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payment.id) errors.push('ID é obrigatório');
  if (!payment.valor || payment.valor <= 0) errors.push('Valor deve ser maior que 0');
  if (!payment.metodo) errors.push('Método de pagamento é obrigatório');
  if (!payment.status) errors.push('Status é obrigatório');
  if (payment.parcelas === undefined || payment.parcelas < 1) errors.push('Parcelas deve ser >= 1');
  if (!payment.source) errors.push('Source é obrigatório');
  if (!payment.createdAt) errors.push('createdAt é obrigatório');

  // Validação específica por source
  if (payment.source === 'os' && !payment.osId) {
    errors.push('osId é obrigatório quando source=os');
  }
  if (payment.source === 'sale' && !payment.saleId) {
    errors.push('saleId é obrigatório quando source=sale');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
