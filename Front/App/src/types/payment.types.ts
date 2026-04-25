/**
 * PAGAMENTO (PAYMENT)
 * Sistema flexível de pagamentos parciais e múltiplos
 */

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'boleto' | 'transfer';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  // Identificadores
  id: string;
  saleId: string;         // FK para Sale
  
  // Dados do pagamento
  method: PaymentMethod;
  amount: number;
  
  // Status
  status: PaymentStatus;
  
  // Datas
  createdAt: Date;
  paidAt?: Date;
  dueDate?: Date;          // Para boleto, por exemplo
  
  // Informações adicionais por método
  methodDetails?: {
    // PIX
    pixKey?: string;
    pixQrCode?: string;
    
    // Boleto
    boletoNumber?: string;
    boletoBarCode?: string;
    
    // Cartão
    cardLastFour?: string;
    cardBrand?: string;
    installments?: number;
    
    // Transferência
    accountNumber?: string;
  };
  
  // Auditoria
  processedBy?: string;    // ID do usuário que processou
  notes?: string;
  referenceNumber?: string; // Número de referência do banco
}

export interface CreatePaymentInput {
  saleId: string;
  method: PaymentMethod;
  amount: number;
  dueDate?: Date;
  methodDetails?: Payment['methodDetails'];
  notes?: string;
}

export interface UpdatePaymentInput {
  status?: PaymentStatus;
  amount?: number;
  dueDate?: Date;
  notes?: string;
}

/**
 * Resumo financeiro de uma venda
 * Usado para cálculos rápidos
 */
export interface SaleFinancialSummary {
  total: number;
  paid: number;
  remaining: number;
  paymentCount: number;
  isPaid: boolean;
  isPartiallyPaid: boolean;
  isPending: boolean;
}
