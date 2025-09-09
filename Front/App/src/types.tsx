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
  clientName: string;
  clientEmail: string;
  clientCpf: string;
  clientPhone: string;
  orderNumber: string;
  status: string;
  serviceType: string;
  date: string;
  paymentMethod: string;
}