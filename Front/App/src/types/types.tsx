
export interface FilterState {
  status: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  minStock: string;
  maxStock: string;
  clientName: string;
  clientEmail: string;
  clientCpf: string;
  clientPhone: string;
  orderNumber: string;
  serviceType: string;
  date: string;
  paymentMethod: string;
}

// Nova interface para o produto
export interface Product {
    id: string;
    sku: string;
    name: string;
    pictureUrl: string; // URL para a imagem
    category: string;
    stock: number;
    status: 'Ativo' | 'Inativo' | 'Baixo Estoque';
    price: number;
}

// types/CartItem.ts

export interface CartItem {
  id: string;           // ID do item no carrinho
  productId: string;    // ID do produto referenciado
  name: string;         // Nome do produto (salvo para histórico)
  category: string;         // Nome do produto (salvo para histórico)
    sku: string;

  price: number;        // Preço unitário no momento da compra
  quantity: number;     // Quantidade no carrinho
  total: number;        // Preço total (price * quantity)
}

export interface ServiceItem {
  orderNumber: string;
  serviceType: string;
  clientName: string;
  clientDetails: string;
  status: 'Completo' | 'Pendente' | 'Em Andamento'; // Tipos literais são ótimos aqui
  day: string;
  time: string;
  date: string;
  items: ServiceProduct[];
  total: number;
  tags: string[];
  responsible: string;
}

export interface ServiceProduct {
    id: string;
    sku: string;
    name: string;
    category: string;
    price: number;
}
