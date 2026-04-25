/**
 * ORDEM DE SERVIÇO (OS)
 * Tipos para gerenciamento de ordens de serviço/manutenção
 */

export type OSStatus = 
  | 'draft' 
  | 'open' 
  | 'in_progress' 
  | 'waiting_parts' 
  | 'finished' 
  | 'delivered' 
  | 'canceled';

export type LaborCalculationType = 'per_point' | 'fixed' | 'table';

/**
 * Configuração específica de montagem hidráulica
 * Pode ser estendida conforme necessário
 */
export interface HydraulicAssemblyConfig {
  equipment: string;        // Ex: "Escavadeira PC200"
  application: string;       // Ex: "Comando Central"
  gauge: string;            // Ex: "1/2" (-08)
  layers: number;           // Ex: 2 (tramas/reforço)
  finalLength: number;      // em mm
}

/**
 * Item de serviço (produto ou serviço)
 */
export interface OSLineItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  itemType: 'product' | 'service';   // Diferencia produto de serviço
}

/**
 * Cálculo de mão de obra
 */
export interface LaborCalculation {
  type: LaborCalculationType;
  value: number;            // Valor por terminal, valor fixo, etc
  total: number;            // Total calculado
  terminals?: number;       // Usado se type === 'per_point'
}

/**
 * ORDEM DE SERVIÇO COMPLETA
 */
export interface OrderService {
  // Identificadores
  id: string;               // UUID gerado pelo backend
  number: string;           // Número legível: OS-2026-0001
  
  // Status e workflow
  status: OSStatus;
  createdAt: Date;
  updatedAt: Date;
  
  // Relacionamentos
  customerId: string;       // FK para Customer
  technicianId?: string;    // FK para Technician (opcional)
  saleId?: string;          // FK para Sale (quando gerada)
  
  // Dados da OS
  config: HydraulicAssemblyConfig;
  items: OSLineItem[];      // Produtos utilizados
  services: OSLineItem[];   // Serviços executados
  labor: LaborCalculation;
  
  // Financeiro
  subtotalProducts: number;
  subtotalServices: number;
  laborTotal: number;
  discountPercentage?: number;     // Desconto aplicado (%)
  discountAmount?: number;          // Desconto em R$
  totalAmount: number;   // Total = subtotais + labor - desconto
  
  // Observações
  notes?: string;
  internalNotes?: string;   // Notas internas (não vão para cliente)
  
  // Histórico
  completedAt?: Date;
  deliveredAt?: Date;
  canceledAt?: Date;
  cancelReason?: string;
}

/**
 * Dados mínimos para criar uma OS
 * Usado em formulários de criação
 */
export interface CreateOrderServiceInput {
  customerId: string;
  technicianId?: string;
  config: HydraulicAssemblyConfig;
  items: Omit<OSLineItem, 'id'>[];
  services: Omit<OSLineItem, 'id'>[];
  labor: Omit<LaborCalculation, 'total'>;
  notes?: string;
}

/**
 * Dados para atualizar uma OS
 */
export interface UpdateOrderServiceInput {
  config?: Partial<HydraulicAssemblyConfig>;
  items?: OSLineItem[];
  services?: OSLineItem[];
  labor?: Partial<LaborCalculation>;
  notes?: string;
  internalNotes?: string;
  discountPercentage?: number;
  technicianId?: string;
}
