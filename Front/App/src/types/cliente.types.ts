/**
 * TIPOS CLIENTE
 * Definições TypeScript para o módulo de gestão de clientes
 */

// ======================================================================
// ENUMS
// ======================================================================

export enum TipoCliente {
  PESSOA_FISICA = 'PESSOA_FISICA',
  PESSOA_JURIDICA = 'PESSOA_JURIDICA',
}

export enum StatusCredito {
  LIBERADO = 'LIBERADO',
  BLOQUEADO = 'BLOQUEADO',
  ANALISE = 'ANALISE',
}

export enum StatusCliente {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
  BLOQUEADO = 'BLOQUEADO',
}

// ======================================================================
// INTERFACES PRINCIPAIS
// ======================================================================

export interface Cliente {
  id_cliente: number;
  nome_razao: string;
  cpf_cnpj: string;
  tipo_cliente: TipoCliente;
  endereco: string;
  numero?: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  
  // Crédito
  limite_credito: number;
  dia_vencimento: number;
  status_credito: StatusCredito;
  
  // Status
  status_cliente: StatusCliente;
  saldo_devedor_atual: number;
  
  // Metadata
  observacoes?: string;
  criado_em: Date;
  atualizado_em?: Date;
}

export interface ClienteContato {
  id: number;
  id_cliente: number;
  nome: string;
  telefone: string;
  cargo?: string;
  criado_em?: Date;
}

export interface ClienteEmail {
  id: number;
  id_cliente: number;
  email: string;
  principal: boolean;
  criado_em?: Date;
}

export interface ClientePrecoEspecial {
  id: number;
  id_cliente: number;
  id_produto: number;
  tipo_desconto: 'VALOR_FIXO' | 'PERCENTUAL';
  valor: number;
  data_validade: Date | string;
  criado_em?: Date;
}

export interface ContaReceber {
  id_conta: number;
  id_venda: number;
  valor: number;
  data_vencimento: Date | string;
  data_pagamento: Date | string | null;
  status: 'ABERTO' | 'PAGO' | 'CANCELADO';
  criado_em?: Date;
}

export interface Venda {
  id_venda: number;
  id_cliente: number;
  data: Date | string;
  valor_total: number;
  metodo_pagamento: string;
  criado_em?: Date;
}

export interface VendaItem {
  id: number;
  id_venda: number;
  id_produto: number;
  quantidade: number;
  valor_unitario: number;
}

// ======================================================================
// TIPOS COMPOSTOS
// ======================================================================

export interface FinanceiroSummary {
  totalAberto: number;
  totalPago: number;
  totalAtrasado: number;
  contas: ContaReceber[];
}

export interface ResumoVendas {
  total_vendas: number;
  valor_total: number;
  ticket_medio: number;
  ultima_venda: Date;
}

export interface ClienteFormData {
  nome_razao?: string;
  cpf_cnpj?: string;
  tipo_cliente?: TipoCliente;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  limite_credito?: number;
  dia_vencimento?: number;
  status_credito?: StatusCredito;
  status_cliente?: StatusCliente;
  observacoes?: string;
}

// ======================================================================
// TIPOS DE RESPOSTA API
// ======================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page?: number;
  limit?: number;
}
