// Pedidos faturados (venda para empresa, entrega depois): API e tipos. Backend em areas/vendas/pedidos.
import { API_URL } from '../../../shared/api/config';
import { operadorAtual } from '../caixa/caixaApi';
import type { CondicaoPagamento } from '../negociacao/condicaoPagamento';

const API = `${API_URL}/api/vendas/pedidos-faturados`;

export type EtapaPedido = 'CONFIRMADO' | 'FATURADO' | 'ENTREGUE_SEM_NOTA' | 'CONCLUIDO' | 'CANCELADO';

export const ETAPAS: Record<EtapaPedido, { rotulo: string; cor: string }> = {
  CONFIRMADO: { rotulo: 'Confirmado', cor: 'blue' },
  FATURADO: { rotulo: 'Faturado · a entregar', cor: 'gold' },
  ENTREGUE_SEM_NOTA: { rotulo: 'Entregue · a faturar', cor: 'orange' },
  CONCLUIDO: { rotulo: 'Concluído', cor: 'green' },
  CANCELADO: { rotulo: 'Cancelado', cor: 'default' },
};

export interface PedidoFaturadoResumo {
  id: number; etapa: EtapaPedido; status: string; idCliente: number | null; cliente: string; contato: string | null; idOrcamento: number | null;
  pedidoCliente: string | null; previsaoEntrega: string | null; enderecoEntrega: string | null; observacao: string | null;
  total: number; totalCusto: number; condicaoPagamento: string | null; condicao: CondicaoPagamento | null;
  operador: string | null; criadoEm: string; faturadoEm: string | null; entregueEm: string | null; recebidoPor: string | null;
  canceladoEm: string | null; motivoCancelamento: string | null;
  notaNumero?: number | null; parcelasAbertas?: number; aReceber?: number; boletosFaltando?: number;
}

export interface ParcelaPedido {
  idTitulo?: number; parcela: number; totalParcelas: number; vencimento: string; valor: number; valorPago?: number; status?: string;
  forma: string; codigoBarras: string | null;
}

export interface PedidoFaturadoDetalhe extends PedidoFaturadoResumo {
  itens: Array<{ idItem: number; sku: string; nome: string; unidade: string | null; fator: number; siglaBase: string | null; quantidade: number;
    quantidadeBase: number; precoUnitario: number; total: number; servico: boolean; localizacao?: string | null;
    componentes: Array<{ idItem: number; nome: string; quantidade: number; localizacao?: string | null }> }>;
  /** Do cadastro do cliente, para o romaneio (documento e telefone só com números). */
  clienteDados?: { documento: string | null; telefone: string | null; endereco: string | null } | null;
  estoque: Array<{ idItem: number; nome: string; sai: number; saldo: number; reservadoOutros: number; podeSemEstoque: boolean }>;
  faltas: Array<{ idItem: number; nome: string; sai: number; disponivel: number }>;
  nota: { idDocumento: number; status: string; serie: number | null; numero: number | null; chave: string | null; emissor: string; emitidaEm: string | null; motivoCancelamento: string | null } | null;
  parcelas: ParcelaPedido[];
  parcelasSugeridas: ParcelaPedido[];
  formasParcela: string[];
}

export class ErroPedido extends Error {
  constructor(message: string, public detalhes?: any) { super(message); }
}

const pedir = async <T,>(url: string, init?: RequestInit, erro = 'Erro no pedido.'): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend (rs).');
  if (!r.ok) throw new ErroPedido(d.error || erro, d.detalhes);
  return d as T;
};
const enviar = (metodo: string, corpo: unknown) => ({
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(corpo as object), operador: operadorAtual() }),
});

export const pedidosFaturadosApi = {
  listar: (situacao: 'ABERTOS' | 'TODOS') => pedir<PedidoFaturadoResumo[]>(`${API}?situacao=${situacao}`, undefined, 'Erro ao listar os pedidos.'),
  detalhe: (id: number) => pedir<PedidoFaturadoDetalhe>(`${API}/${id}`, undefined, 'Erro ao abrir o pedido.'),
  criar: (d: { idOrcamento: number; previsaoEntrega?: string | null; enderecoEntrega?: string; pedidoCliente?: string; observacao?: string }) =>
    pedir<{ id: number; faltas: Array<{ nome: string; sai: number; disponivel: number }> }>(API, enviar('POST', d), 'Erro ao criar o pedido.'),
  atualizar: (id: number, d: { previsaoEntrega: string | null; enderecoEntrega: string | null; pedidoCliente: string | null; observacao: string | null }) =>
    pedir<{ success: true }>(`${API}/${id}`, enviar('PUT', d), 'Erro ao salvar.'),
  faturar: (id: number, d: { nota: { numero: number; serie: number; chave?: string; emitidaEm?: string }; parcelas: ParcelaPedido[] }) =>
    pedir<{ success: true }>(`${API}/${id}/faturar`, enviar('POST', d), 'Erro ao faturar.'),
  parcela: (id: number, idTitulo: number, d: { codigoBarras?: string | null; forma?: string; vencimento?: string }) =>
    pedir<{ success: true }>(`${API}/${id}/parcelas/${idTitulo}`, enviar('PUT', d), 'Erro ao salvar a parcela.'),
  entregar: (id: number, recebidoPor: string) => pedir<{ success: true; concluido: boolean }>(`${API}/${id}/entregar`, enviar('POST', { recebidoPor }), 'Erro ao registrar a entrega.'),
  cancelar: (id: number, motivo: string, notaCanceladaNoEmissor = false) =>
    pedir<{ success: true }>(`${API}/${id}/cancelar`, enviar('POST', { motivo, notaCanceladaNoEmissor }), 'Erro ao cancelar.'),
};

/** Linha digitável em blocos para ler/conferir (47: 5.5 5.6 5.6 1 14). */
export const formatarLinhaDigitavel = (s: string | null | undefined) => {
  const d = String(s || '').replace(/\D/g, '');
  if (d.length !== 47) return d;
  return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d[32]} ${d.slice(33)}`;
};
