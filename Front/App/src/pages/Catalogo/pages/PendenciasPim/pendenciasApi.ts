const API = 'http://localhost:3001/api/catalogo';

export type NivelPendencia = 'critico' | 'incompleto';

export interface Pendencia {
  codigo: string;
  nivel: NivelPendencia;
  detalhe: string;
}

export interface ItemPendente {
  idItem: number;
  sku: string;
  nome: string;
  tipoRecurso: string;
  familia: { id: number; nome: string; status: string } | null;
  categoria: { id: number; nome: string } | null;
  pendencias: Pendencia[];
}

export interface RespostaPendencias {
  data: ItemPendente[];
  pagination: { page: number; limit: number; total: number };
  totalItensComPendencia: number;
  criticos: number;
  resumo: Record<string, number>;
  porFamilia: Array<{ familiaId: number | null; nome: string; itens: number; criticos: number }>;
  tipos: Record<string, { nivel: NivelPendencia; label: string; ajuda: string }>;
}

export interface FiltrosPendencias {
  tipo?: 'VENDA' | 'TODOS';
  familiaId?: number | null;   // 0 = sem família
  codigo?: string;
  busca?: string;
  lote?: number | null;
  page?: number;
  limit?: number;
}

export const getPendenciasPim = async (f: FiltrosPendencias, tenantId: number = 1): Promise<RespostaPendencias> => {
  const qs = new URLSearchParams({ tenant_id: String(tenantId) });
  if (f.tipo) qs.set('tipo', f.tipo);
  if (f.familiaId !== undefined && f.familiaId !== null) qs.set('familia_id', String(f.familiaId));
  if (f.codigo) qs.set('codigo', f.codigo);
  if (f.busca) qs.set('busca', f.busca);
  if (f.lote) qs.set('lote', String(f.lote));
  if (f.page) qs.set('page', String(f.page));
  if (f.limit) qs.set('limit', String(f.limit));
  const r = await fetch(`${API}/pendencias?${qs}`);
  const data = await r.json().catch(() => ({}));
  if (r.status === 404) throw new Error('O servidor não conhece esta função ainda: reinicie o backend (npm start).');
  if (!r.ok) throw new Error(data.error || 'Erro ao carregar as pendências do PIM.');
  return data;
};
