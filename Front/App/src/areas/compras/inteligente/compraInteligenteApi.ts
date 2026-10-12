// Compra inteligente (/api/compras/inteligente, /api/compras/pedidos, /api/compras/precos).
import { API_URL } from '../../../shared/api/config';

const API = `${API_URL}/api/compras`;

export interface ResumoFornecedor {
  idFornecedor: number; nome: string; cnpj: string; itensVinculados: number; itensRepor: number; abaixoMinimo: number;
  valorSugerido: number; pedidoMinimo: number; prazoEntregaDias: number; atingeMinimo: boolean;
  ultimoPedido: string | null; pedidosAbertos: number;
}

export interface ItemSugestao {
  idItem: number; sku: string; nome: string; unidade: string; saldo: number; minimo: number | null; maximo: number | null;
  vendido: number; codigoFornecedor: string | null; unidadeCompra: string; fatorCompra: number; precoCompra: number;
  consumoDia: number; coberturaAtual: number | null; necessidadeBase: number; quantidade: number; valor: number;
  motivo: 'ABAIXO_MINIMO' | 'COBERTURA' | null; origemPreco: 'COTACAO' | 'NOTA'; dataCotacao: string | null;
  precoUltimaNota: number; fornecedorPadrao: boolean;
  // Vários fornecedores: como ESTE escreve o item, qual é o principal (como a loja conhece) e os outros
  descricaoFornecedor: string | null;
  ehPrincipal: boolean;
  principal: { idFornecedor: number; fornecedor: string; codigo: string | null; descricao: string | null } | null;
  outrosFornecedores: OutroFornecedor[];
  precoBase: number; // por unidade de estoque
  emPedidos: Array<{ idPedido: number; idFornecedor: number; fornecedor: string; status: string; quantidade: number; unidade: string }>;
}

export interface OutroFornecedor {
  idFornecedor: number; fornecedor: string; codigo: string | null; descricao: string | null; unidadeCompra: string;
  fatorCompra: number; preco: number; precoBase: number; principal: boolean;
}

export interface CondicoesFornecedor { pedidoMinimo: number; prazoEntregaDias: number; contato: string; observacao: string }

export interface AnaliseFornecedor {
  fornecedor: { idFornecedor: number; nome: string; cnpj: string };
  condicoes: CondicoesFornecedor;
  parametros: { dias: number; coberturaDias: number; prazoEntregaDias: number };
  itens: ItemSugestao[];
}

export type StatusPedido = 'RASCUNHO' | 'ENVIADO' | 'COTADO' | 'COMPRADO' | 'CANCELADO';

export interface PedidoResumo {
  idPedido: number; idFornecedor: number; fornecedor: string; status: StatusPedido; totalEstimado: number;
  totalCotado: number | null; criadoEm: string; validadeCotacao: string | null; itens: number;
}

export interface PedidoItem {
  idPedidoItem: number; idItem: number | null; codigoFornecedor: string | null; nome: string; nomeCatalogo: string; skuCatalogo: string; unidadeCompra: string;
  fatorCompra: number; quantidade: number; precoEstimado: number; precoCotado: number | null; origem: string;
}

export interface PedidoDetalhe {
  idPedido: number; idFornecedor: number; fornecedor: string; status: StatusPedido; operador: string | null; observacao: string;
  totalEstimado: number; totalCotado: number | null; validadeCotacao: string | null; criadoEm: string; cotadoEm: string | null;
  itens: PedidoItem[]; texto: string;
}

export interface PrecoHistorico {
  tipo: 'NOTA' | 'COTACAO'; data: string; fornecedor: string; idFornecedor: number | null; documento: string;
  unidade: string; quantidade: number; preco: number; precoBase: number; validade: string | null;
}

const ler = async <T,>(r: Response, padrao: string): Promise<T> => {
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) {
    const msg = String(d.details || d.error || '');
    if (/compras_(pedidos|fornecedores_condicoes)/.test(msg) && /exist/i.test(msg)) {
      throw new Error('As tabelas da compra inteligente ainda não existem: rode o script SQL enviado (compras_fornecedores_condicoes, compras_pedidos).');
    }
    throw new Error(d.error || padrao);
  }
  return d as T;
};
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const compraInteligenteApi = {
  resumo: async (dias: number, cobertura: number) =>
    ler<ResumoFornecedor[]>(await fetch(`${API}/inteligente/fornecedores?tenant_id=1&dias=${dias}&cobertura=${cobertura}`), 'Erro ao analisar os fornecedores.'),
  analise: async (idFornecedor: number, dias: number, cobertura: number) =>
    ler<AnaliseFornecedor>(await fetch(`${API}/inteligente/fornecedores/${idFornecedor}?tenant_id=1&dias=${dias}&cobertura=${cobertura}`), 'Erro ao analisar o fornecedor.'),
  completar: async (idFornecedor: number, dados: { quantidades: Record<number, number>; pedidoMinimo: number; dias: number; cobertura: number; limiteCobertura: number }) =>
    ler<{ quantidades: Record<string, number>; acrescentados: Record<string, number>; total: number; falta: number }>(
      await fetch(`${API}/inteligente/fornecedores/${idFornecedor}/completar?tenant_id=1`, json('POST', dados)), 'Erro ao completar o pedido.'),
  salvarCondicoes: async (idFornecedor: number, c: CondicoesFornecedor) =>
    ler<{ success: boolean }>(await fetch(`${API}/fornecedores/${idFornecedor}/condicoes?tenant_id=1`, json('PUT', c)), 'Erro ao salvar as condições.'),
  criarPedido: async (dados: { idFornecedor: number; observacao?: string; itens: Array<{ idItem: number; quantidade: number; origem: string }> }) =>
    ler<PedidoDetalhe>(await fetch(`${API}/pedidos?tenant_id=1`, json('POST', dados)), 'Erro ao gravar o pedido.'),
  pedidos: async (status = '') => ler<PedidoResumo[]>(await fetch(`${API}/pedidos?tenant_id=1&status=${status}`), 'Erro ao listar os pedidos.'),
  pedido: async (id: number) => ler<PedidoDetalhe>(await fetch(`${API}/pedidos/${id}?tenant_id=1`), 'Erro ao carregar o pedido.'),
  status: async (id: number, status: StatusPedido) => ler<PedidoDetalhe>(await fetch(`${API}/pedidos/${id}/status?tenant_id=1`, json('PUT', { status })), 'Erro ao mudar a situação.'),
  cotacao: async (id: number, itens: Array<{ idPedidoItem: number; precoCotado: number | null }>, validade: string | null) =>
    ler<PedidoDetalhe>(await fetch(`${API}/pedidos/${id}/cotacao?tenant_id=1`, json('PUT', { itens, validade })), 'Erro ao registrar a cotação.'),
  excluir: async (id: number) => ler<{ success: boolean }>(await fetch(`${API}/pedidos/${id}?tenant_id=1`, { method: 'DELETE' }), 'Erro ao excluir.'),
  definirPrincipal: async (idItem: number, idFornecedor: number) =>
    ler<{ success: boolean }>(await fetch(`${API}/itens/${idItem}/fornecedor-principal?tenant_id=1`, json('PUT', { idFornecedor })), 'Erro ao definir o fornecedor principal.'),
  historico: async (idItem: number) => ler<{ historico: PrecoHistorico[] }>(await fetch(`${API}/precos/${idItem}?tenant_id=1`), 'Erro ao carregar os preços.'),
};
