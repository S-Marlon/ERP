// API do contas a pagar (/api/financeiro/pagar): boletos das notas de entrada, contas da loja, contas fixas e categorias
import { operadorAtual } from '../../vendas/caixa/caixaApi';
import { API_URL } from '../../../shared/api/config';

const API = `${API_URL}/api/financeiro/pagar`;

export type FormaPagamento = 'BOLETO' | 'PIX' | 'TRANSFERENCIA' | 'DINHEIRO' | 'CARTAO' | 'DEBITO_AUTOMATICO';
export const FORMAS_PAGAMENTO: Array<{ value: FormaPagamento; label: string }> = [
  { value: 'BOLETO', label: 'Boleto' }, { value: 'PIX', label: 'PIX' }, { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'DINHEIRO', label: 'Dinheiro' }, { value: 'CARTAO', label: 'Cartão' }, { value: 'DEBITO_AUTOMATICO', label: 'Débito automático' },
];

export interface TituloPagar {
  idTitulo: number; idFornecedor: number | null; fornecedor: string | null; favorecido: string | null; idLote: number | null; numeroNf: string | null;
  idCategoria: number | null; categoria: string | null; grupo: string | null; idRecorrente: number | null; competencia: string | null; estimado: boolean;
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
  listar: (situacao: string, busca: string, idCategoria?: number | null) =>
    requisitar<{ titulos: TituloPagar[]; resumo: { aberto: number; vencido: number; proximos7: number; pagoMes: number } }>(
      `${API}?situacao=${situacao}&busca=${encodeURIComponent(busca)}${idCategoria ? `&idCategoria=${idCategoria}` : ''}`, undefined, 'Erro ao listar as contas a pagar.'),
  /** Conta da loja lançada à mão (uma ou várias parcelas mensais). */
  criarConta: (dados: NovaConta) => requisitar<{ parcelas: number; total: number }>(API, enviar('POST', dados), 'Erro ao lançar a conta.'),
  fixas: () => requisitar<ContaFixa[]>(`${API}/fixas`, undefined, 'Erro ao listar as contas fixas.'),
  criarFixa: (dados: ContaFixaForm) => requisitar<{ idRecorrente: number; gerados: number }>(`${API}/fixas`, enviar('POST', dados), 'Erro ao cadastrar a conta fixa.'),
  salvarFixa: (id: number, dados: ContaFixaForm) => requisitar<{ gerados: number }>(`${API}/fixas/${id}`, enviar('PUT', dados), 'Erro ao salvar a conta fixa.'),
  statusFixa: (id: number, status: ContaFixa['status']) => requisitar(`${API}/fixas/${id}/status`, enviar('POST', { status }), 'Erro ao mudar a situação.'),
  categorias: () => requisitar<CategoriaConta[]>(`${API_URL}/api/financeiro/categorias`, undefined, 'Erro ao listar as categorias.'),
  criarCategoria: (dados: { tipo: string; grupo: string; nome: string }) =>
    requisitar<{ idCategoria: number }>(`${API_URL}/api/financeiro/categorias`, enviar('POST', dados), 'Erro ao criar a categoria.'),
  salvarCategoria: (id: number, dados: { tipo: string; grupo: string; nome: string; ativo: boolean }) =>
    requisitar(`${API_URL}/api/financeiro/categorias/${id}`, enviar('PUT', dados), 'Erro ao salvar a categoria.'),
  /** Fornecedores cadastrados (para escolher quem recebe). */
  fornecedores: async () => (await requisitar<any[]>(`${API_URL}/api/parceiros/fornecedores`, undefined, 'Erro ao listar os fornecedores.'))
    .map(f => ({ id: Number(f.id_pessoa), nome: String(f.nome_fantasia || f.razao_social || `Fornecedor ${f.id_pessoa}`) })),
  pagar: (idTitulo: number, pagoEm: string, forma: FormaPagamento) => requisitar(`${API}/${idTitulo}/pagar`, enviar('POST', { pagoEm, forma }), 'Erro ao registrar o pagamento.'),
  reabrir: (idTitulo: number) => requisitar(`${API}/${idTitulo}/reabrir`, enviar('POST'), 'Erro ao reabrir.'),
  ajustar: (idTitulo: number, dados: Partial<{
    numeroDocumento: string | null; vencimento: string; valor: number; codigoBarras: string | null; forma: FormaPagamento; idCategoria: number | null; descricao: string;
  }>) =>
    requisitar(`${API}/${idTitulo}`, enviar('PUT', dados), 'Erro ao ajustar o título.'),
};

export interface CategoriaConta { idCategoria: number; tipo: 'DESPESA' | 'RECEITA'; grupo: string; nome: string; ativo: boolean; uso: number }
export interface NovaConta {
  descricao: string; idCategoria: number | null; idFornecedor: number | null; favorecido: string | null; vencimento: string; valor: number;
  parcelas: number; forma: FormaPagamento; codigoBarras: string | null; estimado: boolean;
}
export type Periodicidade = 'MENSAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
export const PERIODICIDADES: Array<{ value: Periodicidade; label: string }> = [
  { value: 'MENSAL', label: 'Todo mês' }, { value: 'BIMESTRAL', label: 'A cada 2 meses' }, { value: 'TRIMESTRAL', label: 'A cada 3 meses' },
  { value: 'SEMESTRAL', label: 'A cada 6 meses' }, { value: 'ANUAL', label: 'Uma vez por ano' },
];
export interface ContaFixaForm {
  descricao: string; idCategoria: number | null; idFornecedor: number | null; favorecido: string | null; valor: number; valorVariavel: boolean;
  diaVencimento: number; periodicidade: Periodicidade; inicio: string; fim: string | null; forma: FormaPagamento; observacao: string | null;
}
export interface ContaFixa extends ContaFixaForm {
  idRecorrente: number; categoria: string | null; grupo: string | null; quemRecebe: string | null; status: 'ATIVA' | 'PAUSADA' | 'ENCERRADA';
  proximo: { vencimento: string; valor: number; estimado: boolean } | null; pagoNoAno: number;
}

export const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
