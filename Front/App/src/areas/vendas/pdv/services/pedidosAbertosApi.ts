// Orçamentos e vendas suspensas (/api/vendas/pdv/pedidos-abertos)
import { operadorAtual } from '../../caixa/caixaApi';
import { lerConfiguracoes } from '../../../../shared/core/configuracoes/configuracoes';
import { imprimirHtml } from '../../../../shared/core/impressao/saida';
import { API_URL } from '../../../../shared/api/config';
import { modeloOrcamento } from '../../orcamentos/modeloOrcamento';
import { htmlOrcamento } from '../../orcamentos/htmlOrcamento';
import type { CondicaoPagamento } from '../../negociacao/condicaoPagamento';

const API = `${API_URL}/api/vendas/pdv/pedidos-abertos`;

export type TipoPedidoAberto = 'ORCAMENTO' | 'SUSPENSA';
export type SituacaoPedido = 'VALIDO' | 'VENCIDO' | 'CONVERTIDO' | 'SUSPENSA';

export interface PedidoAbertoResumo {
  id: number; tipo: TipoPedidoAberto; situacao: SituacaoPedido; cliente: string; idCliente: number | null; contato: string | null;
  operador: string | null; total: number; custo: number; observacao: string | null; criadoEm: string; validade: string | null;
  qtdItens: number; idVendaGerada: number | null;
  /** O orçamento virou pedido faturado (Vendas › Pedidos faturados), não venda de balcão. */
  virouPedido?: boolean;
}

export interface ItemPedidoAberto {
  idItem: number; sku: string; nome: string; idUnidade: number | null; unidade: string | null; quantidade: number;
  precoTabela: number; precoUnitario: number; desconto: number; total: number;
  componentes?: Array<{ slot: number; idItem: number; quantidade: number }>;
  /** Negociação: unidade base (preço por L, kg, m...), categoria (seções da proposta), custo, item travado e faixas. */
  fator?: number; siglaBase?: string | null; categoria?: string | null; custoUnitarioBase?: number; travado?: boolean;
  faixas?: Array<{ quantidadeMinima: number; precoUnitario: number }>;
}

export interface PedidoAbertoDetalhe {
  id: number; tipo: TipoPedidoAberto; situacao: SituacaoPedido; cliente: string; idCliente: number | null; contato: string | null;
  operador: string | null; observacao: string | null; validade: string | null; criadoEm: string;
  totalBruto: number; totalDesconto: number; total: number; itens: ItemPedidoAberto[];
  /** Orçamento de negociação (null = orçamento comum). */
  margemAlvo?: number | null; condicaoPagamento?: string | null; autorizadoPor?: string | null;
  /** Condição em campos (null = a combinar ou só o texto). */
  condicao?: CondicaoPagamento | null;
  /** Telefone principal do cliente cadastrado (só no detalhe). */
  telefoneCliente?: string | null;
}

export interface NovoPedidoAberto {
  tipo: TipoPedidoAberto;
  itens: Array<{ idItem: number; quantidade: number; idUnidade?: number | null; precoUnitario?: number; componentes?: Array<{ slot: number; idItem: number; quantidade: number }> }>;
  clienteNome?: string; idCliente?: number | null; contato?: string; observacao?: string; validadeDias?: number;
}

const pedir = async <T,>(url: string, init: RequestInit | undefined, erro: string): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || erro);
  return d as T;
};

export const pedidosAbertosApi = {
  salvar: (dados: NovoPedidoAberto) => pedir<{ id: number; tipo: TipoPedidoAberto; totalLiquido: number }>(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dados, operador: operadorAtual() }),
  }, 'Erro ao salvar.'),
  listar: (tipo: TipoPedidoAberto, situacao = 'ABERTOS', busca = '') =>
    pedir<PedidoAbertoResumo[]>(`${API}?${new URLSearchParams({ tipo, situacao, busca })}`, undefined, 'Erro ao listar.'),
  detalhe: (id: number) => pedir<PedidoAbertoDetalhe>(`${API}/${id}`, undefined, 'Erro ao carregar.'),
  retomar: (id: number) => pedir<PedidoAbertoDetalhe>(`${API}/${id}/retomar`, { method: 'POST' }, 'Erro ao retomar.'),
  excluir: (id: number) => pedir<{ success: boolean }>(`${API}/${id}`, { method: 'DELETE' }, 'Erro ao excluir.'),
  /** Liga o orçamento (ou venda suspensa) a um cliente do cadastro. */
  definirCliente: (id: number, idCliente: number) => pedir<{ success: boolean; idCliente: number; cliente: string }>(`${API}/${id}/cliente`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idCliente }),
  }, 'Erro ao definir o cliente.'),
};


/** Imprime o orçamento (comum ou negociado) no modelo da empresa: o mesmo desenho do PDF (orcamentos/modeloOrcamento). */
export const imprimirOrcamento = (o: PedidoAbertoDetalhe) => imprimirHtml(htmlOrcamento(modeloOrcamento(o, lerConfiguracoes().empresa)));
