/**
 * TIPOS PARA MÓDULO DE CLIENTES
 * Mapeados diretamente do schema SQL do banco de dados
 */

// ============================================================================
// 1. CLIENTE (tabela principal)
// ============================================================================

export type TipoCliente = 'CONSUMIDOR' | 'SERRALHERIA' | 'OFICINA';
export type StatusCredito = 'LIBERADO' | 'BLOQUEADO' | 'ANALISE';
export type StatusCliente = 'ATIVO' | 'INATIVO' | 'BLOQUEADO';

export interface Cliente {
  // Identificação
  id_cliente: number;
  nome_razao: string;
  cpf_cnpj: string;
  tipo_cliente: TipoCliente;

  // Endereço
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;

  // Crédito
  limite_credito: number;
  dia_vencimento: number;
  status_credito: StatusCredito;
  status_cliente: StatusCliente;
  saldo_devedor_atual: number;

  // Metadata
  observacoes?: string;
  criado_em: Date;
}

/**
 * Tipo para criação/atualização de cliente
 * Omite campos que são gerados pelo servidor
 */
export type ClienteInput = Omit<Cliente, 'id_cliente' | 'criado_em' | 'saldo_devedor_atual'>;

/**
 * Tipo para atualização parcial
 */
export type ClienteUpdate = Partial<ClienteInput>;

// ============================================================================
// 2. CONTATOS (tabela clientes_contatos)
// ============================================================================

export type TipoContato = 'CELULAR' | 'FIXO' | 'WHATSAPP' | 'RECADO';

export interface ClienteContato {
  id_contato: number;
  id_cliente: number;
  tipo: TipoContato;
  numero: string;
  nome_referencia?: string;
}

export type ClienteContatoInput = Omit<ClienteContato, 'id_contato'>;
export type ClienteContatoUpdate = Partial<Omit<ClienteContatoInput, 'id_cliente'>>;

// ============================================================================
// 3. EMAILS (tabela clientes_emails)
// ============================================================================

export type TipoEmail = 'PESSOAL' | 'FINANCEIRO' | 'COMERCIAL';

export interface ClienteEmail {
  id_email: number;
  id_cliente: number;
  email: string;
  tipo: TipoEmail;
}

export type ClienteEmailInput = Omit<ClienteEmail, 'id_email'>;
export type ClienteEmailUpdate = Partial<Omit<ClienteEmailInput, 'id_cliente'>>;

// ============================================================================
// 4. PREÇOS ESPECIAIS (tabela clientes_precos_especiais)
// ============================================================================

export type TipoDesconto = 'VALOR_FIXO' | 'PERCENTUAL';

export interface ClientePrecoEspecial {
  id_regra: number;
  id_cliente: number;
  id_produto: number;
  descricao_produto?: string; // Campo computado para exibição
  tipo_desconto: TipoDesconto;
  valor: number;
  data_validade?: Date;
}

export type ClientePrecoEspecialInput = Omit<ClientePrecoEspecial, 'id_regra' | 'descricao_produto'>;
export type ClientePrecoEspecialUpdate = Partial<Omit<ClientePrecoEspecialInput, 'id_cliente' | 'id_produto'>>;

// ============================================================================
// 5. CONTAS A RECEBER (tabela contas_receber)
// ============================================================================

export type StatusConta = 'PENDENTE' | 'PAGO' | 'ATRASADO';

export interface ContaReceber {
  id_conta: number;
  id_venda: number;
  id_cliente: number;
  valor: number;
  data_vencimento: Date;
  data_pagamento?: Date;
  status: StatusConta;
}

export type ContaReceberInput = Omit<ContaReceber, 'id_conta'>;

// ============================================================================
// 6. VENDAS (tabela vendas - resumido)
// ============================================================================

export type OrigemVenda = 'PDV' | 'E-COMMERCE' | 'ERP';

export interface Venda {
  id_venda: number;
  id_cliente: number;
  data_venda: Date;
  valor_total: number;
  metodo_pagamento: string;
  origem: OrigemVenda;
  // Pode ter mais campos conforme necessário
}

// ============================================================================
// 7. ITENS DE VENDA (tabela vendas_itens - resumido)
// ============================================================================

export interface VendaItem {
  id_item: number;
  id_venda: number;
  id_produto: number;
  descricao_produto?: string; // Para exibição
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
}

// ============================================================================
// 8. DTOs COMPOSTOS (para exibição)
// ============================================================================

/**
 * Cliente com todos os seus relacionamentos
 * Usado para carregar ficha completa de cliente
 */
export interface ClienteComDetalhes extends Cliente {
  contatos: ClienteContato[];
  emails: ClienteEmail[];
  precosEspeciais: ClientePrecoEspecial[];
  contas: ContaReceber[];
  vendas: Venda[];
}

/**
 * Resumo financeiro do cliente
 */
export interface ResumoFinanceiro {
  id_cliente: number;
  total_aberto: number;
  total_pago_mes: number;
  total_atrasado: number;
  contas: ContaReceber[];
}

/**
 * Resumo de vendas do cliente
 */
export interface ResumoVendas {
  id_cliente: number;
  total_vendas: number;
  quantidade_vendas: number;
  ticket_medio: number;
  ultima_venda?: Date;
  vendas: Venda[];
}

// ============================================================================
// 9. TIPOS DE RESPOSTA DA API
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiListResponse<T> {
  success: boolean;
  data?: T[];
  total?: number;
  error?: string;
  message?: string;
}

// ============================================================================
// 10. ESTADO DO HOOK
// ============================================================================

export interface ClienteState {
  cliente: Cliente | null;
  contatos: ClienteContato[];
  emails: ClienteEmail[];
  precosEspeciais: ClientePrecoEspecial[];
  loading: boolean;
  error: string | null;
  isDirty: boolean;
  savedAt?: Date;
}

export type ClienteAction =
  | { type: 'SET_CLIENTE'; payload: Cliente }
  | { type: 'UPDATE_CLIENTE'; payload: Partial<Cliente> }
  | { type: 'SET_CONTATOS'; payload: ClienteContato[] }
  | { type: 'ADD_CONTATO'; payload: ClienteContato }
  | { type: 'REMOVE_CONTATO'; payload: number }
  | { type: 'UPDATE_CONTATO'; payload: ClienteContato }
  | { type: 'SET_EMAILS'; payload: ClienteEmail[] }
  | { type: 'ADD_EMAIL'; payload: ClienteEmail }
  | { type: 'REMOVE_EMAIL'; payload: number }
  | { type: 'UPDATE_EMAIL'; payload: ClienteEmail }
  | { type: 'SET_PRECOS_ESPECIAIS'; payload: ClientePrecoEspecial[] }
  | { type: 'ADD_PRECO_ESPECIAL'; payload: ClientePrecoEspecial }
  | { type: 'REMOVE_PRECO_ESPECIAL'; payload: number }
  | { type: 'UPDATE_PRECO_ESPECIAL'; payload: ClientePrecoEspecial }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_SAVED' }
  | { type: 'RESET' };
