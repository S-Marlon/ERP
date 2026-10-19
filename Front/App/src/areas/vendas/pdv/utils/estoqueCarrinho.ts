// Estoque no carrinho: item sem estoque entra (para orçamento), mas a venda só sai com estoque. Aqui fica quanto falta
// em cada linha; o pagamento usa a lista para barrar a venda e oferecer salvar como orçamento.
import type { CartItem } from '../types/cart.types';

/** Quanto falta de estoque na linha (0 = tem estoque, é serviço/OS ou o item pode vender sem estoque). */
export const faltaNaLinha = (item: CartItem): number => {
  if (item.type === 'service' || item.type === 'os' || item.podeVenderSemEstoque || item.stock === undefined) return 0;
  const falta = item.quantity - Math.max(0, Number(item.stock) || 0);
  return falta > 0 ? Number(falta.toFixed(3)) : 0;
};

export const linhasSemEstoque = (cart: CartItem[]) =>
  cart.map(item => ({ item, falta: faltaNaLinha(item) })).filter(l => l.falta > 0);
