// Vendas › resultado do pedido (fechamento, só leitura): GET /api/vendas/pedidos/:idVenda/resultado.
import { API_URL } from '../../../shared/api/config';

export type NivelResultado = 'PREJUIZO' | 'ABAIXO_MINIMA' | 'ABAIXO_ALVO' | 'BOA' | 'OTIMA';
export interface ItemDoResultado {
  nome: string; sku: string; quantidade: number; unidade: string; precoTabela: number; totalItem: number; custoTotal: number;
  receita: number; lucro: number; margem: number | null; semCusto: boolean; descontoPct: number;
}
export interface ResultadoPedido {
  pedido: { idVenda: number; status: string; cliente: string | null; operador: string | null; data: string; condicao: string | null;
    autorizadoPor: string | null; motivoAutorizacao: string | null; negociado: boolean };
  resultado: {
    tabela: number; descontoItens: number; descontoForma: number; receita: number; frete: number; devolvido: number; custo: number; lucroBruto: number;
    taxas: number; taxasEstimadas: boolean; lucro: number; margem: number | null; nivel: NivelResultado; avaliacao: string;
    margemAlvo: number; margemMinima: number;
    faltaParaAlvo: number; receitaNoAlvo: number | null; fatores: string[]; itens: ItemDoResultado[];
    melhorItem: { sku: string; nome: string; lucro: number } | null; custoCompleto: boolean;
  };
  pagamentos: Array<{ forma: string; valor: number; quando: string; taxa: number | null; previsto: boolean }>;
}

export const carregarResultadoPedido = async (idVenda: number): Promise<ResultadoPedido> => {
  const r = await fetch(`${API_URL}/api/vendas/pedidos/${idVenda}/resultado?tenant_id=1`);
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo?.error || 'Não foi possível calcular o resultado do pedido.');
  return corpo as ResultadoPedido;
};
