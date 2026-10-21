// API da logística em lote (/api/catalogo/logistica): peso e medidas dos itens e a embalagem recomendada.
import { API_URL } from '../../../shared/api/config';
import type { FiltroPolitica } from '../precos/politicaPrecoApi';

const API = `${API_URL}/api/catalogo/logistica`;

export interface Medidas { altura: number; largura: number; comprimento: number }
export interface EmbalagemCatalogo { idEmbalagem: number; sku: string; nome: string; pesoKg: number | null; medidas: Medidas | null; custo: number; estoque: number }
export interface RegraEmbalagem { quantidadeAte: number; idEmbalagem: number }
export type FaltaLogistica = 'PESO' | 'MEDIDAS' | 'EMBALAGEM' | 'FOTO';
export interface ItemLogistica {
  idItem: number; sku: string; nome: string; idFamilia: number | null; familia: string | null; marca: string | null;
  pesoKg: number | null; medidas: Medidas | null; fotos: number; fotoFamilia: boolean;
  embalagens: { origem: 'ITEM' | 'FAMILIA' | null; regras: (RegraEmbalagem & { embalagem: EmbalagemCatalogo | null })[] };
  faltas: FaltaLogistica[];
}

const pedir = async <T,>(url: string, init: RequestInit | undefined, padrao: string): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || padrao);
  return d as T;
};
const corpo = (method: string, dados: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });

export const logisticaApi = {
  itens: (filtro: FiltroPolitica, falta?: FaltaLogistica | null) =>
    pedir<ItemLogistica[]>(`${API}/itens?tenant_id=1`, corpo('POST', { filtro, falta: falta || undefined }), 'Erro ao listar os itens.'),
  salvar: (itens: { idItem: number; pesoKg: number | null; altura: number | null; largura: number | null; comprimento: number | null }[]) =>
    pedir<{ salvos: number }>(`${API}/itens?tenant_id=1`, corpo('PUT', { itens }), 'Erro ao salvar peso e medidas.'),
  embalagens: () => pedir<EmbalagemCatalogo[]>(`${API}/embalagens?tenant_id=1`, undefined, 'Erro ao listar as embalagens.'),
  criarEmbalagem: (dados: { nome: string; pesoKg: number | null; altura: number | null; largura: number | null; comprimento: number | null; custo: number }) =>
    pedir<{ idEmbalagem: number; sku: string }>(`${API}/embalagens?tenant_id=1`, corpo('POST', dados), 'Erro ao criar a embalagem.'),
  salvarRegras: (alvo: { idsFamilias?: number[]; idsItens?: number[] }, regras: RegraEmbalagem[]) =>
    pedir<{ familias: number; itens: number }>(`${API}/embalagens/regras?tenant_id=1`, corpo('PUT', { ...alvo, regras }), 'Erro ao salvar as embalagens.'),
};

export const ROTULO_FALTA: Record<FaltaLogistica, string> = { PESO: 'sem peso', MEDIDAS: 'sem medidas', EMBALAGEM: 'sem embalagem', FOTO: 'sem foto' };
export const textoMedidas = (m: Medidas | null) => (m ? `${m.altura} × ${m.largura} × ${m.comprimento} cm` : '—');
