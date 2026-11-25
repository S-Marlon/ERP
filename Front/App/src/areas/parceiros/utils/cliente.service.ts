// ==========================================
// CLIENTES - SERVIÇO DE API DE CLIENTES
// ==========================================
import { API_URL } from '../../../shared/api/config';

const API_BASE_URL = `${API_URL}/api/parceiros`; // Ajuste conforme o prefixo da sua rota no index
const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

const handleResponse = async <T>(response: Response, defaultError: string): Promise<T> => {
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(String(errorData.error ?? errorData.message ?? defaultError));
  }
  return response.json() as Promise<T>;
};

/**
 * 🔄 GET /clientes
 * Busca a lista completa de clientes para a tabela ou listagem
 */
export const getClientes = async (tenantId: number = 1): Promise<any[]> => {
  const response = await fetch(`${API_BASE_URL}/clientes?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });
  return handleResponse<any[]>(response, 'Erro ao carregar a lista de clientes.');
};

/**
 * 🔄 POST /clientes
 * Cria um novo cliente completo (Pessoa Física ou Jurídica) com endereços, e-mails e telefones em lote/transação
 */
export const createCliente = async (payload: any, tenantId: number = 1): Promise<any> => {
  const bodyData = {
    tenant_id: tenantId,
    ...payload
  };

  console.log("📤 [API REQUEST] Criando cliente - Body enviado:", bodyData);

  const response = await fetch(`${API_BASE_URL}/clientes?tenant_id=${tenantId}`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(bodyData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("❌ [API ERROR DETALHADO]:", errorData);
    throw new Error(String(errorData.error ?? errorData.message ?? 'Erro ao cadastrar cliente.'));
  }

  return response.json();
};
/** Venda ou orçamento do cliente, com a nota emitida (se houver). */
export interface VendaDoCliente {
  idVenda: number; status: string; data: string; validade: string | null; total: number; itens: number; observacao: string | null; operador: string | null;
  nota: { modelo: string; status: string; numero: number | null } | null;
}
export interface HistoricoCliente {
  resumo: { compras: number; totalComprado: number; ultimaCompra: string | null; orcamentosAbertos: number };
  vendas: VendaDoCliente[];
}

/** GET /clientes/:id/vendas — vendas, orçamentos e notas do cliente (pedidos suspensos no PDV ficam de fora). */
export const getHistoricoCliente = async (idCliente: number, tenantId: number = 1): Promise<HistoricoCliente> => {
  const response = await fetch(`${API_BASE_URL}/clientes/${idCliente}/vendas?tenant_id=${tenantId}`, { headers: DEFAULT_HEADERS });
  return handleResponse<HistoricoCliente>(response, 'Erro ao carregar o histórico do cliente.');
};
