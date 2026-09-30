// Estoque no modelo novo (itens_core): saldos, movimentações e ajustes — backend em /api/estoque
const API = 'http://localhost:3001/api/estoque';

export type SituacaoSaldo = 'NEGATIVO' | 'ZERADO' | 'ABAIXO_MINIMO' | 'OK';
export type TipoAjuste = 'ENTRADA' | 'SAIDA' | 'CONTAGEM';

export interface SaldoItem {
  idItem: number;
  sku: string;
  nome: string;
  tipoRecurso: string;
  status: string;
  unidade: string;
  categoria: string;
  familia: string;
  quantidade: number;
  custoMedio: number;
  custoReferencia: number;
  ultimoCusto: number | null;
  valorEstoque: number;
  minimo: number | null;          // efetivo: do item ou, sem ele, da família
  minimoItem: number | null;
  minimoFamilia: number | null;
  maximo: number | null;
  localizacao: string;
  sugestaoReposicao: number;
  situacao: SituacaoSaldo;
  ultimoMovimento: string | null;
}

export interface ResumoSaldos {
  itens: number;
  comSaldo: number;
  zerados: number;
  negativos: number;
  abaixoMinimo: number;
  valorTotal: number;
}

export interface Movimento {
  idMovimento: number;
  idItem: number;
  sku: string;
  nome: string;
  unidade: string;
  tipo: 'ENTRADA' | 'SAIDA';
  origem: string;
  origemRotulo: string;
  idOrigem: number | null;
  documento: string | null;
  quantidade: number;
  quantidadeDocumento: number | null;
  unidadeDocumento: string | null;
  fatorConversao: number;
  custoUnitario: number;
  custoTotal: number;
  saldoAnterior: number;
  saldoPosterior: number;
  observacao: string | null;
  criadoEm: string;
}

export interface Paginacao {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const lerErro = async (r: Response, padrao: string) => {
  const d = await r.json().catch(() => ({}));
  return new Error(d.error || d.message || padrao);
};

const qs = (filtros: Record<string, unknown>) => {
  const p = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== '') p.append(k, String(v));
  });
  return p.toString();
};

export const getSaldos = async (filtros: { busca?: string; categoria?: string; situacao?: string; page?: number; limit?: number }) => {
  const r = await fetch(`${API}/saldos?${qs(filtros)}`);
  if (!r.ok) throw await lerErro(r, 'Erro ao carregar os saldos.');
  return r.json() as Promise<{ data: SaldoItem[]; resumo: ResumoSaldos; pagination: Paginacao }>;
};

export const getMovimentos = async (filtros: { idItem?: number; de?: string; ate?: string; origem?: string; tipo?: string; busca?: string; page?: number; limit?: number }) => {
  const r = await fetch(`${API}/movimentos?${qs(filtros)}`);
  if (!r.ok) throw await lerErro(r, 'Erro ao carregar as movimentações.');
  return r.json() as Promise<{ data: Movimento[]; pagination: Paginacao }>;
};

export interface AjusteItem {
  idItem: number;
  tipo: TipoAjuste;
  quantidade: number;
  custoUnitario?: number | null;
}

export const lancarAjuste = async (payload: { origem: 'AJUSTE_MANUAL' | 'INVENTARIO'; motivo: string; itens: AjusteItem[] }) => {
  const r = await fetch(`${API}/ajustes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw await lerErro(r, 'Erro ao lançar o ajuste.');
  return r.json() as Promise<{ lote: number; documento: string; lancados: number; semDiferenca: number }>;
};

export const salvarParametrosEstoque = async (
  idItem: number,
  parametros: { estoqueMinimo?: number | null; estoqueMaximo?: number | null; localizacao?: string }
) => {
  const r = await fetch(`${API}/itens/${idItem}/parametros`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parametros),
  });
  if (!r.ok) throw await lerErro(r, 'Erro ao salvar os parâmetros.');
  return r.json();
};

export const getCategoriasEstoque = async (): Promise<string[]> => {
  try {
    const r = await fetch('http://localhost:3001/api/vendas/pdv/categorias');
    return r.ok ? r.json() : ['Todas'];
  } catch {
    return ['Todas'];
  }
};

export const ROTULO_SITUACAO: Record<SituacaoSaldo, { label: string; color: string }> = {
  NEGATIVO: { label: 'Negativo', color: 'red' },
  ZERADO: { label: 'Zerado', color: 'default' },
  ABAIXO_MINIMO: { label: 'Abaixo do mínimo', color: 'orange' },
  OK: { label: 'OK', color: 'green' },
};

export const ORIGENS_MOVIMENTO: Record<string, { label: string; color: string }> = {
  ENTRADA_NFE: { label: 'Entrada NF-e', color: 'blue' },
  VENDA_PDV: { label: 'Venda PDV', color: 'purple' },
  CANCELAMENTO_VENDA: { label: 'Cancelamento de venda', color: 'magenta' },
  AJUSTE_MANUAL: { label: 'Ajuste manual', color: 'gold' },
  INVENTARIO: { label: 'Inventário', color: 'cyan' },
};
