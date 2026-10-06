// API do contas a pagar (/api/financeiro/pagar): boletos das notas de entrada e títulos
import { operadorAtual } from '../../PDV/caixa/caixaApi';

const API = 'http://localhost:3001/api/financeiro/pagar';

export type FormaPagamento = 'BOLETO' | 'PIX' | 'TRANSFERENCIA' | 'DINHEIRO' | 'CARTAO';
export const FORMAS_PAGAMENTO: Array<{ value: FormaPagamento; label: string }> = [
  { value: 'BOLETO', label: 'Boleto' }, { value: 'PIX', label: 'PIX' }, { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'DINHEIRO', label: 'Dinheiro' }, { value: 'CARTAO', label: 'Cartão' },
];

export interface TituloPagar {
  idTitulo: number; idFornecedor: number; fornecedor: string | null; idLote: number | null; numeroNf: string | null;
  numeroDocumento: string | null; parcela: number; totalParcelas: number; descricao: string | null;
  vencimento: string; valor: number; valorPago: number; forma: FormaPagamento; codigoBarras: string | null;
  status: 'ABERTO' | 'PAGO' | 'CANCELADO'; pagoEm: string | null; vencido: boolean; operador: string;
}
export interface Duplicata { numero: string | null; vencimento: string | null; valor: number }
export interface SituacaoCobranca {
  duplicatas: number; totalDuplicatas: number; titulos: number; totalTitulos: number; dispensado: boolean; motivoDispensa: string | null;
}
export interface CobrancaDaNota {
  idLote: number; numeroNf: string | null; statusLote: string;
  fornecedor: { id: number | null; nome: string | null; cnpj: string | null };
  cobranca: { fatura: { numero: string | null; valorOriginal: number; desconto: number; valorLiquido: number } | null; duplicatas: Duplicata[] };
  situacao: SituacaoCobranca; financeiroSituacao: string | null; financeiroObservacao: string | null;
  titulos: TituloPagar[];
}
export interface ParcelaLancamento { numero: string | null; vencimento: string; valor: number; codigoBarras: string | null; forma: FormaPagamento }

const requisitar = async <T>(url: string, init: RequestInit | undefined, erro: string): Promise<T> => {
  const response = await fetch(url, init);
  const dados = await response.json().catch(() => ({}));
  if (response.status === 404 && !dados.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!response.ok) throw new Error(dados.error || erro);
  return dados as T;
};
const enviar = (metodo: 'POST' | 'PUT', corpo: unknown = {}): RequestInit => ({
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(corpo as object), operador: operadorAtual() }),
});

export const pagarApi = {
  cobrancaDaNota: (idLote: number) => requisitar<CobrancaDaNota>(`${API}/notas/${idLote}/cobranca`, undefined, 'Erro ao carregar a cobrança.'),
  lancar: (idLote: number, parcelas: ParcelaLancamento[]) =>
    requisitar<{ parcelas: number; total: number }>(`${API}/notas/${idLote}/cobranca/lancar`, enviar('POST', { parcelas }), 'Erro ao lançar.'),
  dispensar: (idLote: number, motivo: string) => requisitar(`${API}/notas/${idLote}/cobranca/dispensar`, enviar('POST', { motivo }), 'Erro ao dispensar.'),
  desfazer: (idLote: number) => requisitar(`${API}/notas/${idLote}/cobranca/desfazer`, enviar('POST'), 'Erro ao desfazer.'),
  listar: (situacao: string, busca: string) =>
    requisitar<{ titulos: TituloPagar[]; resumo: { aberto: number; vencido: number; proximos7: number; pagoMes: number } }>(
      `${API}?situacao=${situacao}&busca=${encodeURIComponent(busca)}`, undefined, 'Erro ao listar as contas a pagar.'),
  pagar: (idTitulo: number, pagoEm: string, forma: FormaPagamento) => requisitar(`${API}/${idTitulo}/pagar`, enviar('POST', { pagoEm, forma }), 'Erro ao registrar o pagamento.'),
  reabrir: (idTitulo: number) => requisitar(`${API}/${idTitulo}/reabrir`, enviar('POST'), 'Erro ao reabrir.'),
  ajustar: (idTitulo: number, dados: Partial<{ numeroDocumento: string | null; vencimento: string; valor: number; codigoBarras: string | null; forma: FormaPagamento }>) =>
    requisitar(`${API}/${idTitulo}`, enviar('PUT', dados), 'Erro ao ajustar o título.'),
};

export const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
