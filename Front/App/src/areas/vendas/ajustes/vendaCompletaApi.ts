// Venda completa (itens, pagamentos, parcelas, devoluções, ajustes e nota) e ajuste de venda a prazo:
// quantidade e preço das linhas, linha tirada (fica com 0) e item incluído. A diferença vai para as parcelas abertas.
import { API_URL } from '../../../shared/api/config';

const API = `${API_URL}/api/vendas/pdv/vendas`;

export type DestinoAjuste = 'ESPALHAR' | 'ULTIMA' | 'NOVA';
export const DESTINOS_AJUSTE: Record<DestinoAjuste, string> = {
  ESPALHAR: 'Espalhar nas parcelas em aberto', ULTIMA: 'Na última parcela em aberto', NOVA: 'Numa parcela nova',
};

export interface ItemVenda {
  idVendaItem: number; idItem: number; sku: string; nome: string; unidade: string | null; fator: number; quantidade: number; precoTabela: number;
  precoUnitario: number; desconto: number; total: number; devolvido: number; kit: boolean; servico: boolean;
}
export interface ParcelaVenda { idTitulo: number; parcela: number; totalParcelas: number; descricao: string | null; vencimento: string | null; valor: number; valorPago: number; status: string }
export interface AjusteVenda {
  idAjuste: number; totalAntes: number; totalDepois: number; diferenca: number; destino: DestinoAjuste; motivo: string; operador: string; em: string;
  itens: { nome: string; unidade: string | null; tipo: 'ALTERADO' | 'INCLUIDO' | 'REMOVIDO'; quantidadeAntes: number; quantidadeDepois: number; precoAntes: number; precoDepois: number; totalAntes: number; totalDepois: number }[];
}
export interface VendaCompleta {
  idVenda: number; status: string; cliente: string | null; idCliente: number | null; operador: string | null; criadaEm: string; canceladaEm: string | null;
  motivoCancelamento: string | null; observacao: string | null; totalBruto: number; totalDesconto: number; totalFrete: number; totalLiquido: number;
  totalDevolvido: number; totalCusto: number; itens: ItemVenda[]; pagamentos: { forma: string; valor: number; parcelas: number; troco: number }[];
  parcelas: ParcelaVenda[]; devolucoes: { idDevolucao: number; reembolso: string; valor: number; motivo: string; operador: string; em: string }[];
  ajustes: AjusteVenda[]; nota: { status: string; numero: number | null; serie: number | null; modelo: string | null } | null;
  /** Por que não dá para ajustar (null = pode). */
  travaAjuste: string | null;
}
export interface LinhaEditada { idVendaItem: number; quantidade: number; precoUnitario: number }
export interface ItemNovo { idItem: number; nome: string; sku: string; idUnidade: number | null; unidade: string | null; quantidade: number; precoUnitario: number }

const pedir = async <T,>(url: string, init: RequestInit | undefined, padrao: string): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || padrao);
  return d as T;
};

export const vendaApi = {
  completa: (idVenda: number) => pedir<VendaCompleta>(`${API}/${idVenda}/completa?tenant_id=1`, undefined, 'Erro ao abrir a venda.'),
  ajustar: (idVenda: number, d: { linhas: LinhaEditada[]; novos: Omit<ItemNovo, 'nome' | 'sku' | 'unidade'>[]; destino: DestinoAjuste; vencimentoNova?: string | null; motivo: string }) =>
    pedir<{ idAjuste: number; totalAntes: number; totalDepois: number; diferenca: number; parcelaNova: boolean }>(`${API}/${idVenda}/ajustes?tenant_id=1`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }, 'Erro ao ajustar a venda.'),
};

const c = (v: number) => Math.round(Number(v || 0) * 100);

/**
 * Prévia do ajuste (o servidor refaz a conta): linhas que mudaram, total novo e a diferença. Linha que só mudou a
 * quantidade mantém o preço final; item novo entra por quantidade × preço.
 */
export const previaAjuste = (itens: ItemVenda[], editadas: Record<number, { quantidade: number; precoUnitario: number }>, novos: ItemNovo[]) => {
  let antes = 0, depois = 0;
  const mudadas: LinhaEditada[] = [];
  for (const i of itens) {
    antes += c(i.total);
    const e = editadas[i.idVendaItem];
    const mudou = e && (Math.abs(e.quantidade - i.quantidade) >= 0.00005 || Math.abs(e.precoUnitario - i.precoUnitario) >= 0.00005);
    if (!mudou) { depois += c(i.total); continue; }
    mudadas.push({ idVendaItem: i.idVendaItem, quantidade: e.quantidade, precoUnitario: e.precoUnitario });
    depois += e.quantidade === 0 ? 0 : c(e.quantidade * e.precoUnitario);
  }
  for (const n of novos) depois += c(n.quantidade * n.precoUnitario);
  return { mudadas, totalItensAntes: antes / 100, totalItensDepois: depois / 100, diferenca: (depois - antes) / 100, mudou: mudadas.length > 0 || novos.length > 0 };
};
