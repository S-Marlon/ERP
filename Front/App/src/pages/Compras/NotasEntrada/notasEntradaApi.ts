// Notas de entrada (modelo novo): /api/compras/notas
const API = 'http://localhost:3001/api/compras';

export type SituacaoNota = 'EM_CONFERENCIA' | 'PRONTA' | 'IMPORTADA' | 'DESCARTADA';

export interface NotaEntrada {
  idLote: number;
  chave: string;
  numero: string;
  serie: string | null;
  fornecedor: string;
  fantasia: string | null;
  cnpj: string | null;
  emissao: string | null;
  entradaEm: string;
  valorNf: number;
  freteAdicional: number;
  custoEntrada: number;
  totalItens: number;
  conferidos: number;
  semVinculo: number;
  situacao: SituacaoNota;
}

export interface ResumoNotas {
  notas: number;
  importadas: number;
  pendentes: number;
  valorImportado: number;
  valorPendente: number;
}

export interface ItemNota {
  idStaging: number;
  seq: number | null;
  codigoFornecedor: string | null;
  descricaoNf: string;
  ean: string | null;
  unidadeNf: string | null;
  quantidadeNf: number;
  quantidadeRecebida: number | null;
  custoUnitarioNf: number;
  valorNf: number;
  freteRateado: number;
  custoUnitarioFinal: number;
  custoTotalFinal: number;
  tipoEntrada: string;
  conferido: boolean;
  idItem: number | null;
  skuItem: string | null;
  nomeItem: string | null;
  unidadeBase: string | null;
  quantidadeEstoque: number | null;
  fatorConversao: number | null;
  custoEstoque: number | null;
  // Quanto entrou em cada depósito (VENDA, ALMOXARIFADO, PATRIMONIO)
  depositos: Array<{ deposito: string; quantidade: number }>;
}

export interface DetalheNota {
  idLote: number;
  chave: string;
  numero: string;
  serie: string | null;
  fornecedor: string;
  fantasia: string | null;
  cnpj: string | null;
  emitente: { ie: string | null; municipio: string | null; uf: string | null; fone: string | null } | null;
  emissao: string | null;
  entradaEm: string;
  situacao: SituacaoNota;
  totais: {
    produtos: number; frete: number; seguro: number; desconto: number; ipi: number; icmsSt: number;
    outros: number; icms: number; nota: number; freteAdicional: number; freteAdicionalMetodo: string | null;
  };
  itens: ItemNota[];
  resumo: { totalItens: number; conferidos: number; semVinculo: number };
}

const lerErro = async (r: Response, padrao: string) => {
  const d = await r.json().catch(() => ({}));
  return new Error(d.error || d.message || padrao);
};

export const listarNotas = async (filtros: { de?: string; ate?: string; situacao?: string; busca?: string; incluirDescartadas?: boolean }) => {
  const p = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== false) p.append(k, String(v)); });
  const r = await fetch(`${API}/notas?${p.toString()}`);
  if (!r.ok) throw await lerErro(r, 'Erro ao carregar as notas.');
  return r.json() as Promise<{ data: NotaEntrada[]; resumo: ResumoNotas }>;
};

export const detalheNota = async (idLote: number): Promise<DetalheNota> => {
  const r = await fetch(`${API}/notas/${idLote}`);
  if (!r.ok) throw await lerErro(r, 'Erro ao carregar a nota.');
  return r.json();
};

export const descartarNota = async (idLote: number) => {
  const r = await fetch(`${API}/lotes/${idLote}`, { method: 'DELETE' });
  if (!r.ok) throw await lerErro(r, 'Erro ao descartar a nota.');
  return r.json();
};

export const SITUACOES_NOTA: Record<SituacaoNota, { label: string; color: string }> = {
  EM_CONFERENCIA: { label: 'Em conferência', color: 'gold' },
  PRONTA: { label: 'Pronta para entrada', color: 'blue' },
  IMPORTADA: { label: 'Entrada realizada', color: 'green' },
  DESCARTADA: { label: 'Descartada', color: 'default' },
};

export const formatarCnpj = (v?: string | null) => {
  const d = String(v || '').replace(/\D/g, '');
  return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : (v || '');
};
