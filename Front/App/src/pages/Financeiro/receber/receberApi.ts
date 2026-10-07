// API de contas a receber (/api/financeiro/receber)
import { useEffect, useState } from 'react';
import { operadorAtual } from '../../PDV/caixa/caixaApi';
import { API_URL } from '../../../shared/api/config';

const API = `${API_URL}/api/financeiro/receber`;

export type SituacaoTitulo = 'VENCIDO' | 'VENCE_HOJE' | 'A_VENCER' | 'PAGO' | 'CANCELADO';

export interface Titulo {
  idTitulo: number;
  idCliente: number;
  cliente: string;
  idVenda: number | null;
  parcela: number;
  totalParcelas: number;
  descricao: string | null;
  vencimento: string;
  valor: number;
  valorPago: number;
  saldo: number;
  status: 'ABERTO' | 'PAGO' | 'CANCELADO';
  situacao: SituacaoTitulo;
  diasAtraso: number;
  criadoEm: string;
}

export interface Baixa {
  idBaixa: number; forma: string; valor: number; idCaixa: number | null;
  observacao: string | null; operador: string; estornadoEm: string | null; criadoEm: string;
}

export interface SituacaoCliente {
  idCliente: number;
  limite: number | null;
  bloqueado: boolean;
  observacao: string | null;
  emAberto: number;
  vencido: number;
  qtdVencidas: number;
  disponivel: number | null;
  titulos: Titulo[];
}

export interface ResumoReceber { emAberto: number; vencido: number; qtdVencidos: number; venceHoje: number; proximos7: number; recebidoMes: number }

const pedir = async <T,>(url: string, init: RequestInit | undefined, erro: string): Promise<T> => {
  const response = await fetch(url, init);
  const dados = await response.json().catch(() => ({}));
  if (response.status === 404 && !dados.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!response.ok) throw new Error(dados.error || erro);
  return dados as T;
};
const enviar = (metodo: 'POST' | 'PUT', corpo: unknown): RequestInit => ({
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(corpo as object), operador: operadorAtual() }),
});

export const receberApi = {
  listar: (filtros: { situacao?: string; busca?: string; idCliente?: number }) =>
    pedir<Titulo[]>(`${API}?${new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))}`,
      undefined, 'Erro ao listar as contas a receber.'),
  resumo: () => pedir<ResumoReceber>(`${API}/resumo`, undefined, 'Erro ao carregar o resumo.'),
  cliente: (idCliente: number) => pedir<SituacaoCliente>(`${API}/clientes/${idCliente}`, undefined, 'Erro ao carregar a situação do cliente.'),
  salvarCredito: (idCliente: number, dados: { limite: number | null; bloqueado: boolean; observacao?: string }) =>
    pedir<{ success: boolean }>(`${API}/clientes/${idCliente}/credito`, enviar('PUT', dados), 'Erro ao salvar o crédito.'),
  baixas: (idTitulo: number) => pedir<Baixa[]>(`${API}/${idTitulo}/baixas`, undefined, 'Erro ao listar os recebimentos.'),
  receber: (idTitulo: number, forma: string, valor: number, observacao?: string) =>
    pedir<{ success: boolean; status: string }>(`${API}/${idTitulo}/baixas`, enviar('POST', { forma, valor, observacao }), 'Erro ao registrar o recebimento.'),
  estornar: (idBaixa: number, motivo: string) =>
    pedir<{ success: boolean }>(`${API}/baixas/${idBaixa}/estornar`, enviar('POST', { motivo }), 'Erro ao estornar o recebimento.'),
};

/** Situação de crédito do cliente (PDV): dívida em aberto, vencidos e limite. */
export const useSituacaoCliente = (idCliente: number | null | undefined) => {
  const [situacao, setSituacao] = useState<SituacaoCliente | null>(null);
  useEffect(() => {
    if (!idCliente) { setSituacao(null); return; }
    let ativo = true;
    receberApi.cliente(idCliente).then(s => { if (ativo) setSituacao(s); }).catch(() => { if (ativo) setSituacao(null); });
    return () => { ativo = false; };
  }, [idCliente]);
  return situacao;
};

export const ROTULO_SITUACAO: Record<SituacaoTitulo, { label: string; color: string }> = {
  VENCIDO: { label: 'Vencida', color: 'red' },
  VENCE_HOJE: { label: 'Vence hoje', color: 'orange' },
  A_VENCER: { label: 'A vencer', color: 'blue' },
  PAGO: { label: 'Paga', color: 'green' },
  CANCELADO: { label: 'Cancelada', color: 'default' },
};

export const dataBr = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
