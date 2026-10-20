// API do painel do financeiro (/api/financeiro/painel): fluxo previsto, realizado por mês, vencimentos e atrasados.
import { API_URL } from '../../../shared/api/config';

export interface TituloPainel {
  tipo: 'RECEBER' | 'PAGAR'; idTitulo: number; nome: string; descricao: string | null; vencimento: string; valor: number;
  parcela: number; totalParcelas: number; forma: string | null; diasAtraso?: number; categoria?: string | null; estimado?: boolean;
}
export interface PontoFluxo { chave: string; rotulo: string; de: string; ate: string; entradas: number; saidas: number; saldo: number; acumulado: number }
export interface MesRealizado {
  mes: string; rotulo: string; entradas: number; saidas: number; saldo: number;
  detalhe: { vendasVista: number; taxasCartao: number; recebimentos: number; sinais: number; pagamentos: number; devolucoes: number };
}
export interface FaixaAtraso { faixa: string; valor: number; qtd: number }
export interface PainelFinanceiro {
  hoje: string; dias: number; agrupamento: 'dia' | 'semana';
  totais: {
    aReceber: number; aPagar: number; receberVencido: number; pagarVencido: number; qtdReceberVencido: number; qtdPagarVencido: number;
    entraNoPeriodo: number; saiNoPeriodo: number; receberSemPrazo: number; qtdReceberSemPrazo: number;
  };
  fluxo: PontoFluxo[];
  vencimentos: TituloPainel[];
  atrasados: TituloPainel[];
  atrasoReceber: FaixaAtraso[];
  atrasoPagar: FaixaAtraso[];
  realizado: MesRealizado[];
  fornecedores: { idPessoa: number; nome: string; pago: number; aberto: number }[];
  devedores: { idPessoa: number; nome: string; aberto: number; vencido: number; titulos: number }[];
  /** Para onde vai o dinheiro: pago nos 6 meses e o que vence no período, por categoria. */
  categorias: { grupo: string; nome: string; pago: number; previsto: number }[];
}

export const painelFinanceiroApi = {
  carregar: async (dias: number): Promise<PainelFinanceiro> => {
    const r = await fetch(`${API_URL}/api/financeiro/painel?tenant_id=1&dias=${dias}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || (r.status === 404 ? 'Rota não encontrada: reinicie o backend.' : 'Erro ao carregar o painel financeiro.'));
    return d;
  },
};

export const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** Valor curto para o eixo do gráfico (R$ 1,2 mil). */
export const brlCurto = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1000) return `${v < 0 ? '-' : ''}R$ ${(a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `${v < 0 ? '-' : ''}R$ ${a.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
};
export const dataBr = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
