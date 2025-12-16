// src/data.ts

export interface Category {
  id: string;
  name: string;
  children?: Category[]; 
}

// Dados de exemplo (seus dados reais)
export const categoriesData: Category[] = [
  // ... (os dados de exemplo de Eletrônicos, Livros, Moda, etc.)
  {
    id: '1',
    name: 'Eletrônicos',
    children: [
      {
        id: '1.1',
        name: 'Smartphones',
        children: [
          { id: '1.1.1', name: 'Apple iPhone' },
          { id: '1.1.2', name: 'Samsung Galaxy' },
        ],
      },
      { id: '1.2', name: 'Computadores' },
    ],
  },
  { id: '2', name: 'Livros' },
];