// types/sale.types.ts

/**
 * ✅ NOVO: PaymentSource
 * Diferencia a origem de um pagamento
 */
export type PaymentSource = 'sale' | 'os';

/**
 * ✅ ATUALIZADO: Interface de Pagamento com source tracking
 */
export interface VendaPagamento {
  id: string;
  metodo: string;
  valor: number;
  parcelas: number;
  source: PaymentSource;      // ✅ NOVO: Identifica se é venda normal ou OS
  saleId?: string;            // ✅ NOVO: ID da venda (se source === 'sale')
  osId?: string;              // ✅ NOVO: ID da OS (se source === 'os')
}

/**
 * ✅ NOVO: Item normal de venda
 */
export interface VendaItem {
  type: 'produto';            // ✅ NOVO: Type para diferenciação
  productId: number;
  nome: string;
  quantidade: number;
  precoVenda: number;
  precoCusto: number;
  subtotal: number;
  lucroUnitario: number;
}

/**
 * ✅ NOVO: Ordem de Serviço no payload da venda
 */
export interface OrdemServicoVenda {
  osNumber: string;
  equipment: string;
  gauge: string;
  layers: string;
  finalLength: number;
  laborType: string;
  laborValue: number;
  items: VendaItem[];
  services: any[];            // Services array
  productsTotal: number;
  servicesTotal: number;
  laborTotal: number;
  total: number;
  paid: number;
  remaining: number;
}

/**
 * ✅ ATUALIZADO: VendaPayload com suporte a OS
 */
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
  
  // ✅ NOVO: Separar items normais e OS
  itens: VendaItem[];                    // Items normais (produtos/serviços)
  ordensServico?: OrdemServicoVenda[];   // OS separadas
  
  // ✅ ATUALIZADO: Pagamentos com source
  pagamentos: VendaPagamento[];
}

export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX';

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