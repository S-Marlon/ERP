// Central do dia (página inicial): tarefas calculadas pelo servidor a partir de cada área. Backend em areas/inicio.
import { API_URL } from '../../shared/api/config';
import { operadorAtual } from '../vendas/caixa/caixaApi';

export type Nivel = 'URGENTE' | 'HOJE' | 'SEMANA' | 'SUGESTAO';
export type AreaTarefa = 'COMPRAS' | 'ESTOQUE' | 'PRECOS' | 'VENDAS' | 'FINANCEIRO' | 'CAIXA' | 'MANUAL';

export interface Tarefa {
  chave: string; area: AreaTarefa; nivel: Nivel; titulo: string; detalhe: string | null; rota: string; acao: string;
  quantidade?: number; valor?: number; exemplos?: string[];
  /** Lembrete do operador (área MANUAL). */
  idTarefa?: number; vencimento?: string | null; prioridade?: Prioridade; responsavel?: string | null; descricao?: string | null;
}

export type Prioridade = 'ALTA' | 'NORMAL' | 'BAIXA';
export interface Lembrete { id: number; titulo: string; descricao: string | null; vencimento: string | null; prioridade: Prioridade; responsavel: string | null }
export interface RespostaTarefas {
  hoje: string; tarefas: Tarefa[]; fontesComErro: string[];
  /** Lembretes com data mais longe que 7 dias (entram na lista quando chegar perto). */
  agendados: Lembrete[];
  /** Tarefas automáticas adiadas (somem até a data; voltam se ainda existirem). */
  adiadas: Array<{ chave: string; titulo: string; ate: string }>;
  feitasHoje: number;
}
export type QuandoAdiar = 'AMANHA' | 'SEMANA' | string;

export const NIVEIS: Record<Nivel, { titulo: string; cor: string; vazio: string }> = {
  URGENTE: { titulo: 'Atrasado', cor: '#cf1322', vazio: 'Nada atrasado.' },
  HOJE: { titulo: 'Para hoje', cor: '#1677ff', vazio: 'Nada para hoje.' },
  SEMANA: { titulo: 'Esta semana', cor: '#d48806', vazio: 'Nada para os próximos dias.' },
  SUGESTAO: { titulo: 'Sugestões para girar e lucrar', cor: '#722ed1', vazio: 'Sem sugestões agora.' },
};

export const AREAS: Record<AreaTarefa, string> = {
  CAIXA: 'Caixa', VENDAS: 'Vendas', COMPRAS: 'Compras', ESTOQUE: 'Estoque', FINANCEIRO: 'Financeiro', PRECOS: 'Preços', MANUAL: 'Minhas',
};

export const buscarTarefas = async (): Promise<RespostaTarefas> => {
  const r = await fetch(`${API_URL}/api/inicio/tarefas`);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend (rs).');
  if (!r.ok) throw new Error(d.error || 'Não foi possível carregar as tarefas do dia.');
  return d as RespostaTarefas;
};

const pedir = async <T,>(url: string, metodo = 'GET', corpo?: unknown): Promise<T> => {
  const r = await fetch(url, corpo === undefined && metodo === 'GET' ? undefined : {
    method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(corpo as object || {}), operador: operadorAtual() }),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend (rs).');
  if (!r.ok) throw new Error(d.error || 'Erro na central do dia.');
  return d as T;
};
const API = `${API_URL}/api/inicio`;
type DadosLembrete = { titulo: string; descricao?: string | null; vencimento?: string | null; prioridade?: Prioridade; responsavel?: string | null };

export const inicioApi = {
  criarLembrete: (d: DadosLembrete) => pedir<{ id: number }>(`${API}/lembretes`, 'POST', d),
  editarLembrete: (id: number, d: DadosLembrete) => pedir<{ success: true }>(`${API}/lembretes/${id}`, 'PUT', d),
  situacao: (id: number, situacao: 'FEITA' | 'CANCELADA' | 'ABERTA') => pedir<{ success: true }>(`${API}/lembretes/${id}/situacao`, 'POST', { situacao }),
  adiarLembrete: (id: number, para: QuandoAdiar) => pedir<{ ate: string }>(`${API}/lembretes/${id}/adiar`, 'POST', { para }),
  adiarTarefa: (chave: string, titulo: string, para: QuandoAdiar) => pedir<{ ate: string }>(`${API}/adiar`, 'POST', { chave, titulo, para }),
  desfazerAdiamento: (chave: string) => pedir<{ success: true }>(`${API}/adiar/desfazer`, 'POST', { chave }),
  feitos: () => pedir<Array<{ id: number; titulo: string; concluidaPor: string | null; concluidaEm: string }>>(`${API}/lembretes/feitos`),
};

/** "23/11" */
export const diaMes = (iso: string) => iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/');

/** "segunda-feira, 23 de novembro" */
export const dataPorExtenso = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export const saudacao = (hora = new Date().getHours()) => (hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite');
