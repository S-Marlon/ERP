// Equivalentes no balcão: itens que servem para a mesma coisa (mesma categoria e mesmos atributos de equivalência,
// ex.: bomba 0,75 HP), para oferecer outro quando o pedido está sem estoque. Guarda por 1 minuto para o carrinho não
// repetir a consulta a cada mudança de quantidade.
import { API_URL } from '../../../../shared/api/config';
import type { Product } from '../types/product.types';

export type ProdutoEquivalente = Product & { decisaoCompra?: 'PREFERIDO' | 'NAO_RECOMPRAR' | null };
export interface RespostaEquivalentes {
  data: ProdutoEquivalente[];
  /** Atributos que definem o grupo ("Potência (HP) 0,75"). */
  criterio: string | null;
  motivo: 'SEM_CATEGORIA' | 'SEM_ATRIBUTO' | 'SEM_EQUIVALENTE' | null;
}

const VALIDADE_MS = 60_000;
const guardados = new Map<number, { quando: number; resposta: Promise<RespostaEquivalentes> }>();

export const buscarEquivalentes = (idItem: number): Promise<RespostaEquivalentes> => {
  const g = guardados.get(idItem);
  if (g && Date.now() - g.quando < VALIDADE_MS) return g.resposta;
  const resposta = fetch(`${API_URL}/api/vendas/pdv/itens/${idItem}/equivalentes`)
    .then(async r => {
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo?.error || 'Não foi possível buscar os equivalentes.');
      return corpo as RespostaEquivalentes;
    });
  resposta.catch(() => guardados.delete(idItem));
  guardados.set(idItem, { quando: Date.now(), resposta });
  return resposta;
};

/** Os equivalentes com estoque (o que dá para oferecer agora). */
export const comEstoque = (lista: ProdutoEquivalente[]) => lista.filter(p => Number(p.currentStock) > 0 || p.podeVenderSemEstoque);
