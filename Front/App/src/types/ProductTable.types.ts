// ProductTable.types.ts

// 1. Tipo base para os dados da tabela de produtos (Sugestão baseada no seu código)
export interface Produto {
  id: number;
  nome: string;
  sku: string;
  categoriaNome: string;
  subcategoriaNome?: string; // Opcional
  estoque: number;
  status: string;
  precoUnitario: number;
  fornecedorNome?: string; // Opcional
  // Adicione outras propriedades se houverem
}

// 2. Props para o novo componente ProductTable
export interface ProductTableProps {
  products: Produto[];
  handleAddToCart: (product: Produto) => void;
  // Aqui você pode passar a variante que deseja para a tabela, se o seu CSS suportar
  variant?: 'default' | 'striped' | 'compact';
}

// *É necessário que os tipos do Table.tsx (TableColumn e TableProps)
// estejam disponíveis para importação no seu projeto.
// Se você não tiver um arquivo Table.types.ts, adapte a importação.
// Exemplo:
// import { TableColumn, TableProps } from './Table.types';