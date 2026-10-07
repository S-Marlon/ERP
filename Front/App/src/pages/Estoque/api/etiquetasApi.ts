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
