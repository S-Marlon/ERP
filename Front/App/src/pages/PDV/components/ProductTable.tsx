// ProductTable.tsx (Refatorado para usar o componente genérico Table)

import React from 'react';
// IMPORTAÇÕES
import { TableColumn } from '../../../types/Table.types'; // Ajuste o caminho para os tipos do Table
import { Produto, ProductTableProps } from '../../../types/ProductTable.types';
import { formatCurrency } from '../../../utils/utils';
import Table from '../../../components/ui/Table';

// 1. Definição das Colunas para a Tabela de Produtos
// Usamos a função 'render' para customizar a exibição das células.
const getProductColumns = (handleAddToCart: (product: Produto) => void): TableColumn<Produto>[] => [
  {
    // Coluna "Nmr" (Número) - Renderiza um checkbox e o índice
    // OBS: No componente Table.tsx original, não há o index da linha no render.
    // Tive que adaptar o Nmr com o render, mas o index+1 é perdido aqui,
    // a menos que você passe o index no seu Table.tsx.
    // Para simplificar, vou usar apenas um marcador.
    header: (
      <>
        <span style={{ width: "4%", display: "inline-block" }}>Nmr</span>
      </>
    ) as React.ReactNode,
    key: 'indexMarker', // Chave fictícia, pois usamos 'render'
    render: () => (
      <>
        <td> &#9634;</td>
        {/* Você pode tentar passar 'rowIndex' via 'render' no seu Table.tsx para obter o index + 1 */}
      </>
    ) as React.ReactNode,
  },
  {
    header: 'Nome do Produto',
    key: 'nome',
    render: (item) => (
      <span className="truncado" title={item.nome}>
        {item.nome}
      </span>
    ),
  },
  {
    header: 'SKU',
    key: 'sku',
  },
  {
    header: 'Categoria',
    key: 'categoriaNome',
  },
  {
    header: 'Sub-Categoria',
    key: 'subcategoriaNome',
    render: (item) => item.subcategoriaNome || 'N/A',
  },
  {
    header: 'Estoque',
    key: 'estoque',
  },
  {
    header: 'Status',
    key: 'status',
  },
  {
    header: 'Preço',
    key: 'precoUnitario',
    render: (item) => formatCurrency(item.precoUnitario),
  },
  {
    header: 'Fornecedor',
    key: 'fornecedorNome',
    render: (item) => item.fornecedorNome || 'N/A',
  },
];

const ProductTable: React.FC<ProductTableProps> = ({ products, handleAddToCart, variant = 'default' }) => {
  // OBS: O seu componente Table genérico NÃO aceita um prop 'onClick' na linha <tr>.
  // Para manter a funcionalidade de clique na linha, teremos que modificar o Table.tsx
  // ou criar um 'render' complexo para todas as colunas.
  // Vou **ASSUMIR** que você adicionará uma prop `onRowClick` ao seu componente `Table.tsx`.

  /*
  // Se o Table.tsx fosse modificado para aceitar onRowClick:
  <Table<Produto>
      data={products}
      columns={getProductColumns()}
      variant={variant}
      onRowClick={handleAddToCart} // O onRowClick receberia (item: Produto)
  />
  */

  // **SOLUÇÃO ATUAL (COM BASE NO SEU TABLE.TSX SEM MODIFICAÇÃO DE PROPS):**
  // Para manter a funcionalidade, precisamos adicionar uma Coluna de Ação ou envolver a célula
  // com um elemento clicável, pois a funcionalidade de clique em 'tr' foi perdida.
  // A melhor solução é modificar o Table.tsx para aceitar onRowClick.

  // **USANDO O COMPONENTE ATUAL:**
  // 1. Criamos as colunas.
  const productColumns = getProductColumns(handleAddToCart);

  // 2. Adaptamos o render para simular o clique (Não é ideal, mas funciona com seu Table atual)
  // Como a célula Nmr estava em duas TDs no seu código antigo e agora é uma coluna,
  // precisamos de uma solução para o `index + 1` e para o checkbox.
  // A forma mais direta é modificar o seu `Table.tsx` para aceitar um `onRowClick`.
  // Como não posso modificar o `Table.tsx` fornecido, vou manter a estrutura e **recomendar a modificação**.

  // **RECOMENDAÇÃO: Adicionar `onRowClick` ao Table.tsx**
  // Adicione: `onRowClick?: (item: T) => void;` na interface `TableProps<T>`
  // Adicione: `onClick={() => onRowClick(item)}` na tag `<tr>` no `Table.tsx`.

  return (
    <div onClick={() => console.log('Adicionando o clique no wrapper para simular, pois o Table.tsx não tem onRowClick')}>
      <Table<Produto>
        data={products}
        columns={productColumns}
        caption="Lista de Produtos"
        variant={variant}
      />
    </div>
  );
};

export default ProductTable;