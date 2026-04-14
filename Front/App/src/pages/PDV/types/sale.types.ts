// types/sale.types.ts
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
  itens: {
    productId: number;
    nome: string;
    quantidade: number;
    precoVenda: number;
    precoCusto: number;
    subtotal: number;
    lucroUnitario: number;
  }[];
  pagamentos: {
    metodo: string;
    valor: number;
    parcelas: number;
  }[];
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