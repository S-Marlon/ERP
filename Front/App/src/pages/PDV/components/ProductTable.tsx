import React from "react";
// 1. IMPORTAÇÃO ATUALIZADA: Trazendo o novo tipo Produto
import { Produto } from "../../../types/newtypes"; 


interface ProductTableProps {
  // 2. TIPAGEM CORRIGIDA: Usa o novo tipo Produto[]
  products: Produto[];
  handleAddToCart: (product: Produto) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({ products, handleAddToCart }) => {
  return (
    <table className="pdv-product-table">
      <thead>
        <tr>
          {/* Coluna Nmr (Número) */}
          <th className="pdv-table-header" colSpan={2} style={{ width: "4%" }}>Nmr</th>
          {/* Nome do Produto */}
          <th className="pdv-table-header" style={{ width: "25%" }}>Nome do Produto</th>
          {/* SKU */}
          <th className="pdv-table-header" style={{ width: "12%" }}>SKU</th>
          {/* Categoria */}
          <th className="pdv-table-header" style={{ width: "12%" }}>Categoria</th>
          {/* Sub-Categoria */}
          <th className="pdv-table-header" style={{ width: "12%" }}>Sub-Categoria</th>
          {/* Estoque */}
          <th className="pdv-table-header" style={{ width: "5%" }}>Estoque</th>
          {/* Status (Mudei o select do cabeçalho para 'Status' puro) */}
          <th className="pdv-table-header" style={{ width: "11%" }}>Status</th> 
          {/* Preço */}
          <th className="pdv-table-header" style={{ width: "10%" }}>Preço</th>
          {/* Fornecedor */}
          <th className="pdv-table-header" style={{ width: "10%" }}>Fornecedor</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product, index) => (
          // O clique na linha chama handleAddToCart com o objeto Produto
          <tr 
            key={product.id} 
            className="pdv-table-row" 
            onClick={() => handleAddToCart(product)}
          >
            <td> &#9634;</td>
            <td> {index + 1}</td>
            
            {/* 3. MAPEAMENTO DE CAMPOS - ATUALIZADO */}
            <td> <span className="truncado" title={product.nome}>{product.nome}</span></td>
            <td>{product.sku}</td>
            <td>{product.categoriaNome}</td> {/* Novo campo 'categoriaNome' */}
            <td>{product.subcategoriaNome || 'N/A'}</td> {/* Novo campo 'subcategoriaNome' */}
            <td>{product.estoque}</td> {/* Novo campo 'estoque' */}
            <td>
              <span>{product.status}</span>
            </td>
            <td>R$ {product.precoUnitario.toFixed(2)}</td> {/* Novo campo 'precoUnitario' */}
            <td>{product.fornecedorNome || 'N/A'}</td> {/* Novo campo 'fornecedorNome' */}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ProductTable;