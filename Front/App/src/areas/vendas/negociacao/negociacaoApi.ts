// Orçamento de negociação: preparar as linhas (POST /api/vendas/negociacao/preparar) e salvar/renegociar (o mesmo POST dos
// orçamentos, com `negociacao`). O erro de autorização volta com os detalhes (motivos e se há senha).
import { API_URL } from '../../../shared/api/config';
import { operadorAtual } from '../caixa/caixaApi';
import type { FaixaQuantidade } from './negociacao';
import type { CondicaoPagamento } from './condicaoPagamento';
import type { PedidoAbertoDetalhe } from '../pdv/services/pedidosAbertosApi';

export interface LinhaPreparada {
  indice: number; idItem: number; sku: string; nome: string; quantidade: number; idUnidade: number | null; sigla: string; fator: number;
  siglaBase: string | null; precoTabela: number; custoUnitario: number; margemTabela: number | null;
  categoria: { id: number; nome: string; margemSugerida: number | null } | null;
  ultimaVenda: { idVenda: number; data: string; preco: number; unidade: string; margem: number | null } | null;
}
export interface ConfigNegociacao { margemAlvoPadrao: number; margemMinimaNegociacao: number; temSenha: boolean }

export interface ItemNegociacao {
  idItem: number; quantidade: number; idUnidade: number | null; componentes?: Array<{ slot: number; idItem: number; quantidade: number }>;
}
export interface SalvarNegociacao {
  idPedido?: number | null; idCliente?: number | null; clienteNome?: string; contato?: string; observacao?: string; validadeDias: number;
  margemAlvo: number; condicaoPagamento?: string;
  /** Condição em campos; com ela o texto da proposta é montado no servidor. */
  condicao?: CondicaoPagamento | null;
  itens: Array<ItemNegociacao & { precoUnitario: number; travado: boolean; faixas: FaixaQuantidade[] }>;
  autorizacao?: { senha: string; nome: string; motivo: string };
}

/** Erro com os detalhes do servidor (ex.: codigo AUTORIZACAO_NECESSARIA, motivos, temSenha). */
export class ErroNegociacao extends Error {
  constructor(message: string, public detalhes: any = null) { super(message); }
}

const pedir = async <T,>(url: string, corpo: unknown, erro: string): Promise<T> => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new ErroNegociacao('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new ErroNegociacao(d.error || erro, d.detalhes || null);
  return d as T;
};

export const negociacaoApi = {
  preparar: (itens: ItemNegociacao[], idCliente?: number | null) =>
    pedir<{ config: ConfigNegociacao; linhas: LinhaPreparada[] }>(`${API_URL}/api/vendas/negociacao/preparar`, { itens, idCliente }, 'Erro ao preparar a negociação.'),
  salvar: (d: SalvarNegociacao) => pedir<{ id: number; totalLiquido: number }>(`${API_URL}/api/vendas/pdv/pedidos-abertos`, {
    tipo: 'ORCAMENTO', idPedido: d.idPedido || undefined, idCliente: d.idCliente, clienteNome: d.clienteNome, contato: d.contato,
    observacao: d.observacao, validadeDias: d.validadeDias, itens: d.itens, autorizacao: d.autorizacao, operador: operadorAtual(),
    negociacao: { margemAlvo: d.margemAlvo, condicaoPagamento: d.condicaoPagamento, condicao: d.condicao ?? null },
  }, 'Erro ao salvar a negociação.'),
};

/** Condições mais usadas (sugestões do campo; pode digitar outra). */
export const CONDICOES_PAGAMENTO = [
  'À vista no PIX ou dinheiro', 'Boleto 21 dias (1 parcela)', 'Boleto 28 dias (1 parcela)', 'Boleto 28/56 dias (2 parcelas)',
  'Cartão de crédito em até 3x', 'A combinar no fechamento',
];

/** Renegociar um orçamento salvo: os itens dele e o que já estava combinado (preços, travas, faixas e condições). */
export const aberturaDoOrcamento = (d: PedidoAbertoDetalhe) => ({
  idPedido: d.id,
  cliente: { id: d.idCliente, nome: d.cliente },
  itens: d.itens.map(i => ({ idItem: i.idItem, quantidade: i.quantidade, idUnidade: i.idUnidade, componentes: i.componentes })),
  inicial: {
    precos: d.itens.map(i => i.precoUnitario), travados: d.itens.map(i => !!i.travado), faixas: d.itens.map(i => i.faixas || []),
    margemAlvo: d.margemAlvo ?? null, condicaoPagamento: d.condicaoPagamento ?? null, condicao: d.condicao ?? null, contato: d.contato, observacao: d.observacao,
  },
});
