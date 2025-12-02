import React from "react";
// Assumindo que estes tipos estão definidos em um arquivo 'types/types' ou similar
import { Product, FilterState } from "../../../types/types"; 
import { MovimentacaoFormData } from "../types/estoque";

// Componentes (mocks de importação)
import ProductFilter from "./ProductFilter";
import ProductTable from "./ProductTable";
import ProductInfo from "./ProductInfo";
// import MovimentacaoForm from "./MovimentacaoForm"; // Importado mas não usado no exemplo

// --- INTERFACE DE PROPS ---
interface ProductContentProps {
  filters: FilterState;
  products: Product[];
  onFilterChange: (key: keyof FilterState, value: string | number | boolean) => void;
  onApplyFilter: () => void;
  selectedProduct?: Product;
  onSelectProduct: (product: Product) => void;
  onCloseInfo: () => void;
}

// --- COMPONENTE PRINCIPAL ---
const ProductContent: React.FC<ProductContentProps> = ({
  filters,
  products,
  onFilterChange,
  onApplyFilter,
  selectedProduct,
  onSelectProduct,
  onCloseInfo,
}) => {

  // A classe do container muda dependendo se um produto está selecionado
  const containerClass = selectedProduct ? `content-grid` : `content-grid-full`;
    
  return (
    <>
      {/* O CSS está dentro de uma tag <style> para demonstração.
        Em um projeto real, mova isso para ProductContent.css e importe.
      */}
      <style>
        {`
          /* === LAYOUT DE 2 COLUNAS (Produto Selecionado) === */
          .content-grid {
            display: grid;
            /* Define 3 áreas: 'filter' (topo), 'table' (esquerda), 'info' (direita) */
            grid-template-areas: 
              "filter filter"
              "table info";
            /* A coluna da tabela ocupa 70%, a coluna de info 30% */
            grid-template-columns: 70% 30%; 
            gap: 20px; 
            padding: 20px;
            height: 80vh; /* Define uma altura para que a seção de info tenha um limite */
          }

          /* === LAYOUT DE 1 COLUNA (Nenhum Produto Selecionado) === */
          .content-grid-full {
            display: grid;
            /* Define 2 áreas: 'filter' e 'table' */
            grid-template-areas: 
              "filter"
              "table";
            /* A coluna única ocupa 100% da largura */
            grid-template-columns: 100%; 
            gap: 20px;
            padding: 20px;
          }

          /* Posicionamento dos Filtros (Ocupa a largura total em ambos os layouts) */
          .product-filter {
            grid-area: filter;
          }

          /* Posicionamento da Tabela */
          .product-table-wrapper {
            grid-area: table;
            overflow-y: auto; /* Permite rolagem na tabela se o conteúdo for grande */
          }

          /* Estilização e Posicionamento do Painel de Informações */
          .product-info-panel {
            grid-area: info;
            background-color: #f9f9f9;
            border-left: 1px solid #ddd;
            padding: 20px;
            box-shadow: -2px 0 5px rgba(0,0,0,0.05);
            overflow-y: auto; /* Permite rolagem no painel de info */
          }
        `}
      </style>

      {/* RENDERIZAÇÃO DO CONTEÚDO */}
      <div className={containerClass}>
        
        {/* 1. Filtros */}
        <div className="product-filter">
          {/* <ProductFilter
            filters={filters}
            onFilterChange={onFilterChange}
            onApply={onApplyFilter}
          /> */}
        </div>

        {/* 2. Tabela de Produtos */}
        <div className="product-table-wrapper">
          <ProductTable products={products} onSelectProduct={onSelectProduct} />
        </div>
        
        {/* 3. Painel de Informações (Renderização Condicional) */}
        {selectedProduct && (
          <div className="product-info-panel">
            <ProductInfo product={selectedProduct} onClose={onCloseInfo} />
            {/* Você pode adicionar o MovimentacaoForm aqui, passando o produto selecionado */}
            {/* <MovimentacaoForm 
              produto={selectedProduct} 
              onSubmit={(data: MovimentacaoFormData) => console.log('Movimentação:', data)} 
            /> */}
          </div>
        )}

      </div>
    </>
  );
};

export default ProductContent;