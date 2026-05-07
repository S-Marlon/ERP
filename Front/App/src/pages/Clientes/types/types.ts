/**
 * ARQUIVO LEGADO - USE cliente.types.ts PARA NOVOS DESENVOLVIMENTOS
 * 
 * Este arquivo mantém compatibilidade com código antigo
 * Todos os novos tipos devem ser adicionados em cliente.types.ts
 */

// Re-exportar tipos do novo arquivo para compatibilidade
export type {
  Cliente,
  ClienteInput,
  ClienteUpdate,
  ClienteContato,
  ClienteEmail,
  ClientePrecoEspecial,
  ContaReceber,
  Venda,
  VendaItem,
  ClienteComDetalhes,
  ResumoFinanceiro,
  ResumoVendas,
  ApiResponse,
  ApiListResponse,
  ClienteState,
  ClienteAction,
  TipoCliente,
  StatusCredito,
  StatusCliente,
  TipoContato,
  TipoEmail,
  TipoDesconto,
  StatusConta,
  OrigemVenda,
} from './cliente.types';

export { default as ClienteTypes } from './cliente.types';