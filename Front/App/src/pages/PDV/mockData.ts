import { AutoPart } from './types';

export const MOCK_PRODUCTS: AutoPart[] = [
  { 
    id: '1', 
    name: 'Pastilha de Freio Dianteira', 
    brand: 'Bosch',
    oemCode: '123456',
    sku: 'TRA-001',
    compatibility: 'VW Gol G5/G6',
    location: 'A-12',
    price: 120.50,
    stock: 15
  },
  { 
    id: '2', 
    name: 'Filtro de Óleo', 
    brand: 'Fram',
    oemCode: '987654',
    sku: 'FIL-042',
    compatibility: 'Universal Motores EA111',
    location: 'B-05',
    price: 35.00,
    stock: 50
  }
];