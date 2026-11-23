// Central do dia (página inicial): tarefas calculadas pelo servidor a partir de cada área. Backend em areas/inicio.
import { API_URL } from '../../shared/api/config';

export type Nivel = 'URGENTE' | 'HOJE' | 'SEMANA' | 'SUGESTAO';
export type AreaTarefa = 'COMPRAS' | 'ESTOQUE' | 'PRECOS' | 'VENDAS' | 'FINANCEIRO' | 'CAIXA' | 'MANUAL';

export interface Tarefa {
  chave: string; area: AreaTarefa; nivel: Nivel; titulo: string; detalhe: string | null; rota: string; acao: string;
  quantidade?: number; valor?: number; exemplos?: string[];
}

export interface RespostaTarefas { hoje: string; tarefas: Tarefa[]; fontesComErro: string[] }

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

/** "segunda-feira, 23 de novembro" */
export const dataPorExtenso = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export const saudacao = (hora = new Date().getHours()) => (hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite');
