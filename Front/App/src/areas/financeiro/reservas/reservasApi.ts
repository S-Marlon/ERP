// Fundos de reposição: API e tipos. Backend em areas/financeiro/reservas.
import { API_URL } from '../../../shared/api/config';
import { operadorAtual } from '../../vendas/caixa/caixaApi';

const API = `${API_URL}/api/financeiro/reservas`;

export interface ResumoFundo {
  saldo: number; entradas: number; compras: number; ajustes: number; entradasMes: number; comprasMes: number; estoque: number;
  cobertura: number | null; comprasAcimaDoSaldo: number;
}
export interface MovimentoFundo {
  data: string; tipo: 'VENDA' | 'DEVOLUCAO' | 'COMPRA' | 'AJUSTE' | 'INICIAL'; descricao: string; valor: number; saldo: number;
  compraAcimaDoSaldo: boolean; idAjuste?: number;
}
export interface Fundo {
  id: number; nome: string; percentualCusto: number; saldoInicial: number; dataInicio: string; ativo: boolean; categorias: number[];
  resumo: ResumoFundo; ultimos?: MovimentoFundo[]; extrato?: MovimentoFundo[];
}
export interface ListaFundos {
  fundos: Fundo[]; categorias: Array<{ id: number; nome: string; pai: number | null }>; totalSeparado: number; totalEstoque: number;
}
export interface DadosFundo { nome: string; categorias: number[]; percentualCusto: number; saldoInicial: number; dataInicio: string; ativo: boolean }

const pedir = async <T,>(url: string, init?: RequestInit, erro = 'Erro nos fundos de reposição.'): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend (rs).');
  if (!r.ok) throw new Error(d.error || erro);
  return d as T;
};
const enviar = (metodo: string, corpo: unknown = {}) => ({
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(corpo as object), operador: operadorAtual() }),
});

export const reservasApi = {
  listar: () => pedir<ListaFundos>(API),
  extrato: (id: number) => pedir<Fundo>(`${API}/${id}/extrato`),
  criar: (d: DadosFundo) => pedir<{ id: number }>(API, enviar('POST', d), 'Erro ao criar o fundo.'),
  salvar: (id: number, d: DadosFundo) => pedir(`${API}/${id}`, enviar('PUT', d), 'Erro ao salvar o fundo.'),
  excluir: (id: number) => pedir(`${API}/${id}`, { method: 'DELETE' }, 'Erro ao excluir o fundo.'),
  ajuste: (id: number, d: { data: string; valor: number; motivo: string }) => pedir(`${API}/${id}/ajustes`, enviar('POST', d), 'Erro ao lançar o ajuste.'),
  excluirAjuste: (id: number, idAjuste: number) => pedir(`${API}/${id}/ajustes/${idAjuste}`, { method: 'DELETE' }, 'Erro ao excluir o ajuste.'),
};
