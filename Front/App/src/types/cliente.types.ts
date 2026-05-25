/**
 * TIPOS CLIENTE
 * Definições TypeScript para o módulo de gestão de clientes
 */

// ======================================================================
// TIPOS AUXILIARES
// ======================================================================

export type ISODateString = string;
export type Money = number;

// ======================================================================
// ENUMS
// ======================================================================

// Alinhado com o ENUM('PF', 'PJ') do Banco
export enum TipoCliente {
  PESSOA_FISICA = 'PF',
  PESSOA_JURIDICA = 'PJ',
}


export enum StatusCredito {
  LIBERADO = 'LIBERADO',
  BLOQUEADO = 'BLOQUEADO',
  ANALISE = 'ANALISE',
  EM_ATRASO = 'EM_ATRASO',
}

export enum StatusCliente {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
  BLOQUEADO = 'BLOQUEADO',
}

export enum StatusConta {
  ABERTO = 'ABERTO',
  PAGO = 'PAGO',
  CANCELADO = 'CANCELADO',
  ATRASADO = 'ATRASADO',
}

export enum MetodoPagamento {
  DINHEIRO = 'DINHEIRO',
  PIX = 'PIX',
  CARTAO_CREDITO = 'CARTAO_CREDITO',
  CARTAO_DEBITO = 'CARTAO_DEBITO',
  BOLETO = 'BOLETO',
  TRANSFERENCIA = 'TRANSFERENCIA',
}


// ======================================================================
// CRM / ANALYTICS
// ======================================================================

export enum SegmentoCliente {
  OFICINA = 'OFICINA',
  AUTOPECAS = 'AUTOPECAS',
  VAREJO = 'VAREJO',
  PRESTADOR_SERVICO = 'PRESTADOR_SERVICO',
  CONSUMIDOR_FINAL = 'CONSUMIDOR_FINAL',
  DISTRIBUIDOR = 'DISTRIBUIDOR',
  TRANSPORTADORA = 'TRANSPORTADORA',
  FROTA = 'FROTA',
  INDUSTRIA = 'INDUSTRIA',
  OUTRO = 'OUTRO',
}

export enum ClassificacaoCliente {
  A = 'A',
  B = 'B',
  C = 'C',
}

export enum PotencialCliente {
  BAIXO = 'BAIXO',
  MEDIO = 'MEDIO',
  ALTO = 'ALTO',
  ESTRATEGICO = 'ESTRATEGICO',
}

export enum SensibilidadePreco {
  BAIXA = 'BAIXA',
  MEDIA = 'MEDIA',
  ALTA = 'ALTA',
}

export enum TipoInsightCliente {
  SEM_COMPRAR = 'SEM_COMPRAR',
  AUMENTO_CONSUMO = 'AUMENTO_CONSUMO',
  QUEDA_CONSUMO = 'QUEDA_CONSUMO',
  RISCO_INADIMPLENCIA = 'RISCO_INADIMPLENCIA',
  CLIENTE_PREMIUM = 'CLIENTE_PREMIUM',
  OPORTUNIDADE_VENDA = 'OPORTUNIDADE_VENDA',
}

export enum SeveridadeInsight {
  INFO = 'INFO',
  ALERTA = 'ALERTA',
  CRITICO = 'CRITICO',
}

// ======================================================================
// INTERFACES BASE
// ======================================================================

export interface Auditoria {
  criado_em: ISODateString;
  atualizado_em?: ISODateString;

  criado_por?: number;
  atualizado_por?: number;

  deletado_em?: ISODateString;
}

export enum TipoEndereco {
  FISCAL = 'FISCAL',
  ENTREGA = 'ENTREGA',
  COBRANCA = 'COBRANCA',
  FILIAL = 'FILIAL',
}

export interface Endereco {
  id?: number;

  tipo: TipoEndereco;

  principal?: boolean;

  logradouro: string;
  numero?: string;
  complemento?: string;

  bairro: string;
  cidade: string;
  estado: string;

  cep: string;

  pais?: string;
  referencia?: string;
}

// ======================================================================
// INTERFACE PRINCIPAL CLIENTE
// ======================================================================


export interface Cliente {
  id_cliente: number;

  nome_razao: string;
  nome_fantasia?: string;

  cpf_cnpj: string;

  tipo_cliente: TipoCliente;

  status_cliente: StatusCliente;

  aceita_marketing: boolean;

  created_at: ISODateString;
  updated_at?: ISODateString;
}


export interface Cliente extends Auditoria {
  id_cliente: number;

  // Tipo
  tipo_cliente: TipoCliente;

  // Segmentação CRM
  segmento?: SegmentoCliente;

  // PF/PJ
  nome_razao: string;
  nome_fantasia?: string;
  cpf_cnpj: string;

  // Fiscal
  inscricao_estadual?: string;
  inscricao_municipal?: string;

  // Contato rápido
  telefone_principal?: string;
  whatsapp?: string;

  // Endereço principal legado
endereco?: Endereco;

// Novo modelo
enderecos?: Endereco[];

  // Crédito
  limite_credito: Money;
  dia_vencimento: number;
  status_credito: StatusCredito;

  // Financeiro
  saldo_devedor_atual: Money;
  dias_atraso?: number;
  score_credito?: number;

  // CRM / Comercial
  score_comercial?: number;
  classificacao?: ClassificacaoCliente;
  potencial?: PotencialCliente;

  // Status
  status_cliente: StatusCliente;
  motivo_status?: string;

  // Compras
  ultima_compra?: ISODateString;

  // LGPD / marketing
  aceita_marketing?: boolean;
  consentimento_dados_em?: ISODateString;





  rg?: string;


  indicador_ie?: IndicadorIE;

  email_principal?: string;




  // Observações
}

// ======================================================================
// CONTATOS
// ======================================================================

export interface ClienteContato extends Auditoria {
  id: number;
  id_cliente: number;

  nome: string;

  telefone: string;

  cargo?: string;

  tipo_contato?: TipoContatoCliente;

  tipo_telefone?: TipoTelefone;

  principal?: boolean;

  whatsapp?: boolean;
}

// ======================================================================
// EMAILS
// ======================================================================

export enum TipoEmail {
  PESSOAL = 'PESSOAL',
  FINANCEIRO = 'FINANCEIRO',
  COMERCIAL = 'COMERCIAL',
}

export interface ClienteEmail extends Auditoria {
  id: number;
  id_cliente: number;

  email: string;

  principal: boolean;
  verificado?: boolean;

tipo?: TipoEmail;
}

// ======================================================================
// PREÇOS ESPECIAIS
// ======================================================================

export enum TipoDesconto {
  VALOR_FIXO = 'VALOR_FIXO',
  PERCENTUAL = 'PERCENTUAL',
}

export interface ClientePrecoEspecial extends Auditoria {
  id: number;
  id_cliente: number;
  id_produto: number;

  tipo_desconto: TipoDesconto;
  valor: Money;

  data_validade?: ISODateString;
}

// ======================================================================
// CONTAS A RECEBER
// ======================================================================

export interface ContaReceber extends Auditoria {
  id_conta: number;

  id_cliente: number;
  id_venda?: number;

  valor: Money;

  data_vencimento: ISODateString;
  data_pagamento?: ISODateString | null;

  status: StatusConta;
}

// ======================================================================
// VENDAS
// ======================================================================

export interface Venda extends Auditoria {
  id_venda: number;
  id_cliente: number;

  data: ISODateString;

  valor_total: Money;

  metodo_pagamento: MetodoPagamento;
}

export interface VendaItem {
  id: number;

  id_venda: number;
  id_produto: number;

  quantidade: number;
  valor_unitario: Money;

  valor_total?: Money;
}

// ======================================================================
// HISTÓRICO DE CRÉDITO
// ======================================================================

export interface HistoricoCredito extends Auditoria {
  id: number;
  id_cliente: number;

  limite_anterior: Money;
  limite_novo: Money;

  motivo?: string;
}

// ======================================================================
// ANALYTICS
// ======================================================================

export interface ProdutoMaisComprado {
  id_produto: number;

  nome: string;

  quantidade_total: number;
  valor_total: Money;

  ultima_compra?: ISODateString;
}

export interface PerfilCompraCliente {
  ticket_medio: Money;

  frequencia_compra_dias?: number;

  categoria_mais_comprada?: string;
  marca_preferida?: string;
  produto_mais_comprado?: string;

  ultima_compra?: ISODateString;

  potencial_consumo?: PotencialCliente;

  sensibilidade_preco?: SensibilidadePreco;

  compra_frequente?: boolean;
}

export interface ClienteInsight {
  tipo: TipoInsightCliente;

  titulo: string;
  descricao: string;

  severidade?: SeveridadeInsight;

  criado_em: ISODateString;
}

export interface PrevisaoCompra {
  id_produto: number;

  produto_nome?: string;

  proxima_compra_estimada: ISODateString;

  probabilidade: number;
}

export interface PreferenciaCliente {
  prefere_whatsapp?: boolean;

  horario_preferido_contato?: string;

  vendedor_responsavel?: number;

  aceita_promocoes?: boolean;

  marcas_preferidas?: string[];

  observacoes_comerciais?: string;
}

export interface ClienteAnalytics {
  perfil_compra?: PerfilCompraCliente;

  produtos_mais_comprados?: ProdutoMaisComprado[];

  insights?: ClienteInsight[];

  previsoes_compra?: PrevisaoCompra[];

  preferencias?: PreferenciaCliente;
}

// ======================================================================
// TIPOS COMPOSTOS
// ======================================================================

export interface FinanceiroSummary {
  total_aberto: Money;
  total_pago: Money;
  total_atrasado: Money;

  contas: ContaReceber[];
}

export interface ResumoVendas {
  total_vendas: number;

  valor_total: Money;
  ticket_medio: Money;

  ultima_venda?: ISODateString;
}

export interface ClienteCompleto extends Cliente {
  contatos?: ClienteContato[];
  emails?: ClienteEmail[];

  ClienteAtividade?: ClienteAtividade[];

  financeiro?: FinanceiroSummary;

  resumo_vendas?: ResumoVendas;

  analytics?: ClienteAnalytics;
}

// ======================================================================
// FORM DATA
// ======================================================================

export interface ClienteFormData {
  tipo_cliente?: TipoCliente;

  segmento?: SegmentoCliente;

  nome_razao?: string;
  nome_fantasia?: string;

  cpf_cnpj?: string;

  inscricao_estadual?: string;
  inscricao_municipal?: string;

  telefone_principal?: string;
  whatsapp?: string;

endereco?: Partial<Endereco>;
enderecos?: Partial<Endereco>[];

  limite_credito?: Money;
  dia_vencimento?: number;

  status_credito?: StatusCredito;
  status_cliente?: StatusCliente;

  classificacao?: ClassificacaoCliente;
  potencial?: PotencialCliente;

  aceita_marketing?: boolean;

}

// ======================================================================
// API RESPONSE
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



export interface ClienteAtividade extends Auditoria {
  id: number;

  id_cliente: number;

  titulo?: string;

  descricao: string;

  tipo?: TipoObservacaoCliente;

  prioridade?: PrioridadeObservacao;

  concluido?: boolean;

  concluido_em?: ISODateString;
}

export enum TipoObservacaoCliente {
  GERAL = 'GERAL',
  FINANCEIRO = 'FINANCEIRO',
  COBRANCA = 'COBRANCA',
  COMERCIAL = 'COMERCIAL',
  SUPORTE = 'SUPORTE',
  POS_VENDA = 'POS_VENDA',
}

export enum PrioridadeObservacao {
  BAIXA = 'BAIXA',
  MEDIA = 'MEDIA',
  ALTA = 'ALTA',
  URGENTE = 'URGENTE',
}




export enum TipoContatoCliente {
  GERAL = 'GERAL',
  FINANCEIRO = 'FINANCEIRO',
  COMPRAS = 'COMPRAS',
  COMERCIAL = 'COMERCIAL',
}


export enum TipoTelefone {
  CELULAR = 'CELULAR',
  FIXO = 'FIXO',
  WHATSAPP = 'WHATSAPP',
  RECADO = 'RECADO',
}



// 17. Sugestão final mais importante

// Você está começando a ter um domínio rico.

// Então eu separaria arquivos:

// cliente.types.ts
// cliente.analytics.types.ts
// cliente.crm.types.ts
// cliente.financeiro.types.ts