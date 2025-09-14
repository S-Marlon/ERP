// types/CartItem.ts

export interface CartItem {
  id: string;           // ID do item no carrinho
  productId: string;    // ID do produto referenciado
  name: string;         // Nome do produto (salvo para histórico)
  price: number;        // Preço unitário no momento da compra
  quantity: number;     // Quantidade no carrinho
  total: number;        // Preço total (price * quantity)
}
