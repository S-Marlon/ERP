export interface ServiceItem {
  orderNumber: string;
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
  quantity: number;
  name: string;
  price: number;
}

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