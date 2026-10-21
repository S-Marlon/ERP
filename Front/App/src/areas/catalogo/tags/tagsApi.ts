// API das tags do catálogo (/api/catalogo/tags): cadastro, famílias com as tags, itens da família e aplicação em lote.
import { API_URL } from '../../../shared/api/config';

const API = `${API_URL}/api/catalogo/tags`;

export const CORES_TAG = ['default', 'blue', 'green', 'orange', 'red', 'purple', 'cyan', 'gold', 'magenta', 'lime'] as const;
export type CorTag = typeof CORES_TAG[number];

export interface TagCatalogo { idTag: number; nome: string; grupo: string | null; cor: CorTag; ativo: boolean; familias: number; itens: number }
export interface TagCurta { idTag: number; nome: string; cor: CorTag; herdada?: boolean }
export interface FamiliaComTags { idFamilia: number; nome: string; categoria: string | null; itens: number; tags: TagCurta[] }
export interface ItemComTags { idItem: number; sku: string; nome: string; tags: TagCurta[] }

const pedir = async <T,>(url: string, init: RequestInit | undefined, padrao: string): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || padrao);
  return d as T;
};
const corpo = (method: string, dados?: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: dados === undefined ? undefined : JSON.stringify(dados) });

export const tagsApi = {
  listar: () => pedir<TagCatalogo[]>(`${API}?tenant_id=1`, undefined, 'Erro ao listar as tags.'),
  criar: (dados: { nome: string; grupo: string | null; cor: CorTag }) => pedir<{ idTag: number }>(`${API}?tenant_id=1`, corpo('POST', dados), 'Erro ao criar a tag.'),
  salvar: (id: number, dados: { nome: string; grupo: string | null; cor: CorTag; ativo: boolean }) =>
    pedir(`${API}/${id}?tenant_id=1`, corpo('PUT', dados), 'Erro ao salvar a tag.'),
  excluir: (id: number) => pedir(`${API}/${id}?tenant_id=1`, corpo('DELETE'), 'Erro ao excluir a tag.'),
  juntar: (id: number, idDestino: number) => pedir(`${API}/${id}/juntar?tenant_id=1`, corpo('POST', { idDestino }), 'Erro ao juntar as tags.'),
  familias: (f: { idCategoria?: number | null; busca?: string; idTag?: number | null; semTag?: boolean }) => {
    const q = new URLSearchParams({ tenant_id: '1' });
    if (f.idCategoria) q.set('idCategoria', String(f.idCategoria));
    if (f.busca?.trim()) q.set('busca', f.busca.trim());
    if (f.idTag) q.set('idTag', String(f.idTag));
    if (f.semTag) q.set('semTag', '1');
    return pedir<FamiliaComTags[]>(`${API}/familias?${q}`, undefined, 'Erro ao listar as famílias.');
  },
  itensDaFamilia: (idFamilia: number) => pedir<ItemComTags[]>(`${API}/familias/${idFamilia}/itens?tenant_id=1`, undefined, 'Erro ao listar os itens.'),
  aplicar: (idTag: number, acao: 'ADICIONAR' | 'REMOVER', alvo: { idsFamilias?: number[]; idsItens?: number[] }) =>
    pedir<{ mudou: number }>(`${API}/${idTag}/aplicar?tenant_id=1`, corpo('POST', { acao, ...alvo }), 'Erro ao aplicar a tag.'),
};
