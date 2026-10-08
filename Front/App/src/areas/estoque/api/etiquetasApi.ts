// Dados para etiquetas: mesmo preço/unidade/GTIN do PDV (modelo novo)
import { API_URL } from '../../../shared/api/config';
const PDV = `${API_URL}/api/vendas/pdv`;

export interface ItemEtiquetaApi {
  id: number;
  sku: string;
  name: string;
  barcode: string;
  unitOfMeasure: string;
  salePrice: number;
  origemPreco: 'FAIXA' | 'CADASTRO' | 'SEM_PRECO';
  location: string;
  category: string;
  currentStock: number;
  publicavel: boolean;
  atacado: { quantidadeMinima: number; preco: number } | null;
}

export const getDadosEtiquetas = async (ids: number[]): Promise<ItemEtiquetaApi[]> => {
  if (ids.length === 0) return [];
  const r = await fetch(`${PDV}/etiquetas?ids=${ids.join(',')}`);
  if (!r.ok) throw new Error('Erro ao carregar os dados das etiquetas.');
  const d = await r.json();
  return d.data || [];
};

// Busca de itens para incluir na fila (inclui os não publicáveis: etiqueta não depende de publicação)
export const buscarItensEtiqueta = async (termo: string): Promise<ItemEtiquetaApi[]> => {
  const p = new URLSearchParams({ query: termo, limit: '20', incluirNaoPublicaveis: 'true' });
  const r = await fetch(`${PDV}/itens?${p.toString()}`);
  if (!r.ok) throw new Error('Erro ao buscar itens.');
  const d = await r.json();
  return d.data || [];
};

// ---------------------------------------------------------------- Etiquetas de gôndola (última impressa x preço atual)
const ESTOQUE = `${API_URL}/api/estoque/etiquetas`;

export interface EtiquetaDesatualizada {
  idItem: number; sku: string; nome: string; unidade: string | null; precoAtual: number;
  precoImpresso: number | null; unidadeImpressa: string | null; impressoEm: string | null;
  motivo: 'PRECO_MUDOU' | 'UNIDADE_MUDOU' | 'SEM_ETIQUETA';
}

/** Guarda o preço que está na gôndola (ao confirmar a impressão ou ao marcar como já etiquetado). */
export const registrarEtiquetasImpressas = async (itens: Array<{ idItem: number; unidade: string; preco: number }>, operador: string) => {
  const r = await fetch(`${ESTOQUE}/impressas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itens, operador }),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || 'Erro ao registrar as etiquetas.');
  return d as { registradas: number };
};

export const getEtiquetasDesatualizadas = async (): Promise<EtiquetaDesatualizada[]> => {
  const r = await fetch(`${ESTOQUE}/desatualizadas`);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || 'Erro ao carregar as etiquetas desatualizadas.');
  return d.itens || [];
};
