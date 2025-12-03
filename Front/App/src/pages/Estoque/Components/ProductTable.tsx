import React, { useMemo } from "react";
import { Product } from "../../../types/types";
import TableHeader from "./TableHeader";
// Importações
import Table from "../../../components/ui/Table/Table";
import { TableColumn } from "../../../types/Table.types"; // Importe o tipo TableColumn
// Importamos o tipo Produto, mas para manter a flexibilidade, usaremos o tipo Product diretamente

// O tipo Product é usado como T do componente Table<T>
interface ProductTableProps {
  products?: Product[]; // agora opcional
  onSelect?: (p: Product) => void;
  onEdit?: (p: Product) => void;
}

// Define o tipo para garantir a compatibilidade com a função render
type ProductWithIndex = Product & { index: number };

const ProductTable: React.FC<ProductTableProps> = ({ products, onSelect, onEdit }) => {
  // garante array mesmo se undefined
  const safeProducts = products ?? [];

  // preserva a lógica anterior (ex.: adicionar índice)
  const dataWithIndex = safeProducts.map((p, i) => ({ ...p, __index: i + 1 }));

  // 2. Define as colunas (productColumns)
  // Use useMemo para evitar recriar o array a cada renderização
  const productColumns: TableColumn<ProductWithIndex>[] = useMemo(() => [
    {
      key: 'index', 
      header: 'Número', 
      // Renderiza o quadrado e o número
      render: (item) => (
        <>
          <span style={{ marginRight: '5px' }}>&#9634;</span> 
          {item.index}
        </>
      ),
    },
    { key: 'name', header: 'Nome do Produto' },
    { key: 'sku', header: 'SKU' },
    { key: 'category', header: 'Categoria' },
    // A coluna 'sub-Categoria' usa a mesma chave 'category' no seu HTML original,
    // se for um campo diferente em 'Product', ajuste a 'key'.
    { key: 'category', header: 'Sub-Categoria' }, 
    { key: 'stock', header: 'Estoque' },
    { key: 'status', header: 'Status', render: (item) => <span>{item.status}</span> },
    { 
      key: 'price', 
      header: 'Preço de Venda',
      render: (item) => `R$ ${item.price.toFixed(2)}`,
    },
    // Coluna 'Fornecedor' era fixa "SOLAI", vamos deixá-la assim por enquanto.
    // Se 'supplier' for uma propriedade de 'Product', mude para { key: 'supplier', header: 'Fornecedor' }
    { key: 'supplierName', header: 'Fornecedor', render: () => 'SOLAI' }, 
    { 
      key: 'actions', 
      header: 'Editar',
      render: () => (
        <button
          className="icon-button"
          // O clique deve ser definido DENTRO do render se for uma ação específica de célula,
          // ou fora se for o clique na linha inteira (que já está configurado).
          // Vamos deixar o clique na linha fazer a seleção, e o botão de editar aqui é apenas visual.
          onClick={(e) => {
            e.stopPropagation(); // Impede que o clique suba para a linha (onRowClick)
            // Aqui você pode adicionar a lógica de edição, ex: onEdit(item)
            alert('Editar acionado!'); 
          }}
          style={{ fontSize: "small", background: "black", border: "none", cursor: "pointer" }}
        >
          ✏️
        </button>
      ),
    },
  ], []); // Dependências do useMemo

  // 3. Define a variante, se necessário
  const variant = 'inventory'; // Exemplo de variante, pode ser 'default', 'compact', etc.

  return (
    <>
      <TableHeader productCount={0} />

      <Table<ProductWithIndex>
        data={dataWithIndex} // Passa os dados com o índice
        columns={productColumns} // Passa as colunas definidas
        caption="Lista de Produtos"
        variant={variant}
        onRowClick={onSelect} // Adiciona a função de clique na linha
      />

      {/* A tabela HTML estática foi removida para usar o componente <Table />.
        Se você precisar de TableHeader na parte inferior, ele está aqui:
      */}
      <TableHeader productCount={0} /> 
    </>
  );
};

export default ProductTable;