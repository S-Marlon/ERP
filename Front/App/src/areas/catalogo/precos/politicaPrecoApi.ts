// API do "Varejo e atacado em lote" (/api/catalogo/precos/politica): opções do filtro, prévia e aplicar.
import { API_URL } from '../../../shared/api/config';

const API = `${API_URL}/api/catalogo/precos/politica`;

export type RegraVarejo =
  | { modo: 'MANTER' }
  | { modo: 'MARKUP'; markup: number }
  | { modo: 'POR_CUSTO'; faixas: { ateCusto: number | null; markup: number }[] };
export interface NivelAtacado { quantidade: number; markup: number }
export interface Politica {
  varejo: RegraVarejo;
  atacado: { modo: 'MANTER' } | { modo: 'DEFINIR'; nivel1: NivelAtacado | null; nivel2: NivelAtacado | null; pularQuemTem: boolean };
}
export interface FiltroPolitica { idCategoria?: number | null; idsFamilias?: number[]; idMarca?: number | null; busca?: string }

export interface FaixaPrevia {
  tipo: 'VAREJO' | 'ATACADO'; ordem: number; quantidadeMinima: number; quantidadeMaxima: number | null; markup: number; preco: number;
  lucroPct: number; margemPct: number;
}
export interface ItemPrevia {
  idItem: number; sku: string; nome: string; familia: string | null; marca: string | null; unidade: string | null; alvoPct: number;
  custo: number | null;
  varejoAtual: { markup: number; preco: number } | null;
  atacadoAtual: { quantidade: number; markup: number; preco: number }[];
  plano: { situacao: 'ALTERA' | 'IGUAL' | 'ERRO'; erro: string | null; avisos: string[]; faixas: FaixaPrevia[]; mexeNoAtacado: boolean };
}
export interface OpcoesPolitica {
  categorias: { id: number; nome: string; idPai: number | null }[];
  familias: { id: number; nome: string; itens: number }[];
  marcas: { id: number; nome: string }[];
}

const pedir = async <T,>(url: string, init: RequestInit | undefined, padrao: string): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || padrao);
  return d as T;
};
const post = (corpo: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

export const politicaPrecoApi = {
  opcoes: () => pedir<OpcoesPolitica>(`${API}/opcoes?tenant_id=1`, undefined, 'Erro ao carregar o filtro.'),
  previa: (filtro: FiltroPolitica, politica: Politica) =>
    pedir<{ taxaPct: number; itens: ItemPrevia[] }>(`${API}/previa?tenant_id=1`, post({ filtro, politica }), 'Erro ao montar a prévia.'),
  aplicar: (idsItens: number[], politica: Politica) =>
    pedir<{ alterados: number; iguais: number; ignorados: { idItem: number; sku: string; motivo: string }[] }>(
      `${API}/aplicar?tenant_id=1`, post({ idsItens, politica }), 'Erro ao aplicar.'),
};
