// /**
//  * TIPOS PARA MÓDULO DE CLIENTES
//  * Estrutura profissional e alinhada com frontend + mock + API
//  */

// // ============================================================================
// // 1. ENUMS / UNIONS
// // ============================================================================

// export type TipoCliente =
//   | 'CONSUMIDOR'
//   | 'SERRALHERIA'
//   | 'OFICINA';

// export type StatusCredito =
//   | 'LIBERADO'
//   | 'BLOQUEADO'
//   | 'ANALISE';

// export type StatusCliente =
//   | 'ATIVO'
//   | 'INATIVO'
//   | 'BLOQUEADO';

// export type TipoContato =
//   | 'CELULAR'
//   | 'FIXO'
//   | 'WHATSAPP'
//   | 'RECADO';

// export type TipoEmail =
//   | 'PESSOAL'
//   | 'FINANCEIRO'
//   | 'COMERCIAL';

// export type TipoDesconto =
//   | 'VALOR_FIXO'
//   | 'PERCENTUAL';

// export type StatusConta =
//   | 'PENDENTE'
//   | 'PAGO'
//   | 'ATRASADO';

// export type OrigemVenda =
//   | 'PDV'
//   | 'E-COMMERCE'
//   | 'ERP';

// // ============================================================================
// // 2. CLIENTE (DOMÍNIO PRINCIPAL)
// // ============================================================================

// export interface Cliente {
//   // Identificação
//   id_cliente: number;

//   nome_razao: string;

//   cpf_cnpj: string;

//   tipo_cliente: TipoCliente;

//   // Endereço
//   endereco?: string;

//   bairro?: string;

//   cidade?: string;

//   estado?: string;

//   cep?: string;

//   // Crédito
//   limite_credito: number;

//   dia_vencimento: number;

//   status_credito: StatusCredito;

//   status_cliente: StatusCliente;

//   saldo_devedor_atual: number;

//   // Extras
//   observacoes?: string;

//   criado_em: string;
// }

// // ============================================================================
// // 3. FORMULÁRIOS / DTOs
// // ============================================================================

// export interface ClienteFormData {
//   nome_razao: string;

//   cpf_cnpj: string;

//   tipo_cliente: TipoCliente;

//   endereco?: string;

//   bairro?: string;

//   cidade?: string;

//   estado?: string;

//   cep?: string;

//   limite_credito: number;

//   dia_vencimento: number;

//   observacoes?: string;
// }

// export type ClienteUpdate =
//   Partial<ClienteFormData>;

// // ============================================================================
// // 4. LISTAGEM / VIEW MODEL
// // ============================================================================

// export interface ClienteListItem {
//   id_cliente: number;

//   nome_razao: string;

//   cpf_cnpj: string;

//   cidade?: string;

//   status_cliente: StatusCliente;
// }

// // ============================================================================
// // 5. CONTATOS
// // ============================================================================

// export interface ClienteContato {
//   id_contato: number;

//   id_cliente: number;

//   tipo: TipoContato;

//   numero: string;

//   nome_referencia?: string;
// }

// export interface ClienteContatoInput {
//   tipo: TipoContato;

//   numero: string;

//   nome_referencia?: string;
// }

// export type ClienteContatoUpdate =
//   Partial<ClienteContatoInput>;

// // ============================================================================
// // 6. EMAILS
// // ============================================================================

// export interface ClienteEmail {
//   id_email: number;

//   id_cliente: number;

//   email: string;

//   tipo: TipoEmail;
// }

// export interface ClienteEmailInput {
//   email: string;

//   tipo: TipoEmail;
// }

// export type ClienteEmailUpdate =
//   Partial<ClienteEmailInput>;

// // ============================================================================
// // 7. PREÇOS ESPECIAIS
// // ============================================================================

// export interface ClientePrecoEspecial {
//   id_regra: number;

//   id_cliente: number;

//   id_produto: number;

//   descricao_produto?: string;

//   tipo_desconto: TipoDesconto;

//   valor: number;

//   data_validade?: string;
// }

// export interface ClientePrecoEspecialInput {
//   id_produto: number;

//   tipo_desconto: TipoDesconto;

//   valor: number;

//   data_validade?: string;
// }

// export type ClientePrecoEspecialUpdate =
//   Partial<ClientePrecoEspecialInput>;

// // ============================================================================
// // 8. CONTAS A RECEBER
// // ============================================================================

// export interface ContaReceber {
//   id_conta: number;

//   id_venda: number;

//   id_cliente: number;

//   valor: number;

//   data_vencimento: string;

//   data_pagamento?: string;

//   status: StatusConta;
// }

// export interface ContaReceberInput {
//   id_venda: number;

//   valor: number;

//   data_vencimento: string;
// }

// // ============================================================================
// // 9. VENDAS
// // ============================================================================

// export interface Venda {
//   id_venda: number;

//   id_cliente: number;

//   data_venda: string;

//   valor_total: number;

//   metodo_pagamento: string;

//   origem: OrigemVenda;
// }

// // ============================================================================
// // 10. ITENS DE VENDA
// // ============================================================================

// export interface VendaItem {
//   id_item: number;

//   id_venda: number;

//   id_produto: number;

//   descricao_produto?: string;

//   quantidade: number;

//   preco_unitario: number;

//   valor_total: number;
// }

// // ============================================================================
// // 11. DTOs COMPOSTOS
// // ============================================================================

// export interface ClienteComDetalhes
//   extends Cliente {

//   contatos: ClienteContato[];

//   emails: ClienteEmail[];

//   precosEspeciais: ClientePrecoEspecial[];

//   contas: ContaReceber[];

//   vendas: Venda[];
// }

// // ============================================================================
// // 12. RESUMOS
// // ============================================================================

// export interface ResumoFinanceiro {
//   id_cliente: number;

//   total_aberto: number;

//   total_pago_mes: number;

//   total_atrasado: number;

//   contas: ContaReceber[];
// }

// export interface ResumoVendas {
//   id_cliente: number;

//   valor_total: number;

//   quantidade_vendas: number;

//   ticket_medio: number;

//   ultima_venda?: string;

//   vendas: Venda[];
// }

// // ============================================================================
// // 13. RESPOSTAS DA API
// // ============================================================================

// export interface ApiResponse<T> {
//   success: boolean;

//   data?: T;

//   error?: string;

//   message?: string;
// }

// export interface ApiListResponse<T> {
//   success: boolean;

//   data?: T[];

//   total?: number;

//   error?: string;

//   message?: string;
// }




// types/cliente.types.ts
// types/cliente.types.ts

/*
|--------------------------------------------------------------------------
| RAW API (o que vem do backend)
|--------------------------------------------------------------------------
| Nunca usar direto no React
*/

export interface ClienteAPI {
  id_cliente: number;

  nome_razao: string;
  cpf_cnpj?: string;

  cidade?: string;
  estado?: string;

  telefone?: string;

  status_cliente?: string;
  status_credito?: string;
  tipo_cliente?: string;

  limite_credito?: number;
  saldo_devedor_atual?: number;

  observacoes?: string;

  ultima_compra?: string;

  // variações do backend (ainda sujo aqui)
  contatos?: any[];
  cliente_contatos?: any[];

  emails?: any[];
  cliente_emails?: any[];
}

/*
|--------------------------------------------------------------------------
| MODELOS LIMPOS (UI / FRONTEND)
|--------------------------------------------------------------------------
*/

export interface ClienteDTO {
  id_cliente: number;

  nome_razao: string;
  cpf_cnpj?: string;

  cidade?: string;
  estado?: string;

  telefone?: string;

  status_cliente?: string;
  status_credito?: string;
  tipo_cliente?: string;

  limite_credito?: number;
  saldo_devedor_atual?: number;

  observacoes?: string;

  contatos: ContatoDTO[];
  emails: EmailDTO[];

  ultima_compra?: Date;
}

/*
|--------------------------------------------------------------------------
| SUB-ENTIDADES NORMALIZADAS
|--------------------------------------------------------------------------
*/

export interface ContatoDTO {
  id?: number;
  nome: string;
  telefone?: string;
  cargo?: string;
  tipo?: string;
}

export interface EmailDTO {
  id?: number;
  email: string;
}