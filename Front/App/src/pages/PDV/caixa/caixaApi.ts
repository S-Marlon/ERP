// API do caixa do PDV (/api/vendas/caixa e /api/vendas/caixas)
import { API_URL } from '../../../shared/api/config';
import { lerConfiguracoes } from '../../../core/configuracoes/configuracoes';

const API = `${API_URL}/api/vendas`;

// Sem login: o operador é o nome de Configurações › Meu Perfil (padrão ADM)
export const operadorAtual = (): string => {
  const nome = String(lerConfiguracoes().perfil.nome || '').trim();
  return nome && nome !== 'Usuário' ? nome.slice(0, 60) : 'ADM';
};

export interface Caixa {
  idCaixa: number;
  status: 'ABERTO' | 'FECHADO';
  operador: string;
  valorAbertura: number;
  abertoEm: string;
  fechadoEm: string | null;
  operadorFechamento: string | null;
  observacaoFechamento: string | null;
}

export interface LinhaResumoCaixa {
  forma: string;
  abertura: number;
  vendas: number;
  suprimentos: number;
  recebimentos: number;
  sangrias: number;
  estornos: number;
  esperado: number;
}

export interface MovimentoCaixa {
  idMovimento: number;
  tipo: 'SUPRIMENTO' | 'SANGRIA' | 'ESTORNO_VENDA' | 'RECEBIMENTO' | 'ESTORNO_RECEBIMENTO' | 'ADIANTAMENTO' | 'DEVOLUCAO_SINAL' | 'DEVOLUCAO_VENDA';
  forma: string;
  valor: number;
  idOrigem: number | null;
  motivo: string | null;
  operador: string;
  criadoEm: string;
}

export interface ResumoCaixa {
  linhas: LinhaResumoCaixa[];
  totalVendas: number;
  dinheiroEsperado: number;
  vendas: { concluidas: number; canceladas: number; total: number; custo: number; taxas?: number };
  movimentos: MovimentoCaixa[];
}

export interface LinhaConferencia { forma: string; esperado: number; informado: number; diferenca: number }

export interface CaixaHistorico extends Caixa { qtdVendas: number; totalVendas: number; diferenca: number | null }

const pedir = async <T,>(url: string, init: RequestInit | undefined, erro: string): Promise<T> => {
  const response = await fetch(url, init);
  const dados = await response.json().catch(() => ({}));
  if (response.status === 404 && !dados.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!response.ok) throw new Error(dados.error || erro);
  return dados as T;
};

const post = (corpo: unknown): RequestInit => ({
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(corpo as object), operador: operadorAtual() }),
});

export const caixaApi = {
  atual: () => pedir<{ caixa: Caixa | null; resumo?: ResumoCaixa }>(`${API}/caixa/atual`, undefined, 'Erro ao carregar o caixa.'),
  abrir: (valorAbertura: number) =>
    pedir<{ caixa: Caixa; resumo: ResumoCaixa }>(`${API}/caixa/abrir`, post({ valorAbertura }), 'Erro ao abrir o caixa.'),
  movimento: (tipo: 'SANGRIA' | 'SUPRIMENTO', valor: number, motivo: string) =>
    pedir<{ caixa: Caixa; resumo: ResumoCaixa }>(`${API}/caixa/movimentos`, post({ tipo, valor, motivo }), 'Erro ao lançar o movimento.'),
  fechar: (contagem: Record<string, number>, observacao: string) =>
    pedir<{ idCaixa: number; conferencia: LinhaConferencia[]; diferencaTotal: number; resumo: ResumoCaixa }>(
      `${API}/caixa/fechar`, post({ contagem, observacao }), 'Erro ao fechar o caixa.'),
  historico: (de?: string, ate?: string) =>
    pedir<CaixaHistorico[]>(`${API}/caixas?${new URLSearchParams({ ...(de ? { de } : {}), ...(ate ? { ate } : {}) })}`, undefined, 'Erro ao listar os caixas.'),
  detalhe: (idCaixa: number) =>
    pedir<{ caixa: Caixa; resumo: ResumoCaixa; fechamento: LinhaConferencia[] }>(`${API}/caixas/${idCaixa}`, undefined, 'Erro ao carregar o caixa.'),
};

// A prazo vira contas a receber: aparece no resumo, mas não é contado no fechamento
export const FORMAS_SEM_CONFERENCIA = ['PRAZO', 'ADIANTAMENTO'];

export const ROTULO_FORMA: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX: 'PIX', DEBITO: 'Débito', CREDITO: 'Crédito', PRAZO: 'A prazo', TRANSFERENCIA: 'Transferência', ADIANTAMENTO: 'Sinal/crédito', CREDITO_LOJA: 'Crédito na loja',
};

export const ROTULO_MOVIMENTO: Record<string, { label: string; color: string; sinal: 1 | -1 }> = {
  SUPRIMENTO: { label: 'Suprimento', color: 'green', sinal: 1 },
  RECEBIMENTO: { label: 'Recebimento', color: 'blue', sinal: 1 },
  SANGRIA: { label: 'Sangria', color: 'orange', sinal: -1 },
  ESTORNO_VENDA: { label: 'Estorno de venda', color: 'red', sinal: -1 },
  ESTORNO_RECEBIMENTO: { label: 'Estorno de recebimento', color: 'red', sinal: -1 },
  ADIANTAMENTO: { label: 'Sinal recebido', color: 'cyan', sinal: 1 },
  DEVOLUCAO_SINAL: { label: 'Devolução de sinal', color: 'red', sinal: -1 },
  DEVOLUCAO_VENDA: { label: 'Devolução de venda', color: 'red', sinal: -1 },
};
