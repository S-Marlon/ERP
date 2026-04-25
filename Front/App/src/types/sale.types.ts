/**
 * ORDEM DE VENDA (SALE)
 * Gerada automaticamente a partir de uma OS finalizada
 */

import { OrderService } from './order-service.types';
import { Payment } from './payment.types';

export type SaleStatus = 'draft' | 'sent' | 'approved' | 'in_progress' | 'completed' | 'canceled';

export interface Sale {
  // Identificadores
  id: string;
  number: string;         // Número legível: VND-2026-0001
  
  // Relacionamento
  orderId: string;        // FK para OrderService
  customerId: string;     // FK para Customer (desnormalizado para facilitar)
  
  // Status
  status: SaleStatus;
  
  // Dados da venda (desnormalizados da OS)
  order: Partial<OrderService>;  // Snapshot da OS
  
  // Itens da venda
  items: Array<{
    id: string;
    name: string;
    type: 'product' | 'service' | 'labor';
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  
  // Financeiro
  subtotal: number;
  discountPercentage?: number;
  discountAmount?: number;
  taxPercentage?: number;      // ICMS, PIS, etc se aplicável
  taxAmount?: number;
  totalAmount: number;
  
  // Pagamentos
  payments: Payment[];
  
  // Datas
  createdAt: Date;
  issuedAt?: Date;           // Data de emissão como nota fiscal
  approvedAt?: Date;
  completedAt?: Date;
  canceledAt?: Date;
  
  // Observações
  notes?: string;
  terms?: string;            // Termos e condições da venda
  
  // Integração com sistema fiscal (opcional)
  nfeNumber?: string;        // Número da NF-e
  nfeAccessKey?: string;
  invoiceUrl?: string;
}

export interface CreateSaleFromOrderInput {
  orderId: string;
  customerId: string;
  taxPercentage?: number;
  notes?: string;
  terms?: string;
}

export interface UpdateSaleInput {
  discountPercentage?: number;
  status?: SaleStatus;
  notes?: string;
  terms?: string;
}
