import React from "react";
import { Product } from "../../../types/types";



interface ProductTableProps {
  products: Product[];
  
}

const ProductTable: React.FC<ProductTableProps> = ({ products }) => {
  return (
   <div className="pdv-products">
      <h2>Lista de Produtos</h2>
      <table className="pdv-product-table">
        <thead>
          <tr>
            <th className="pdv-table-header" style={{ width: "4%" }}>Nmr</th>
            <th className="pdv-table-header" style={{ width: "30%" }}>Nome do Produto</th>
            <th className="pdv-table-header" style={{ width: "6%" }}>SKU</th>
            <th className="pdv-table-header" style={{ width: "7%" }}>Categoria</th>
            <th className="pdv-table-header" style={{ width: "9%" }}>sub-Categoria</th>
            <th className="pdv-table-header" style={{ width: "4%" }}>Estoque</th>
            <th className="pdv-table-header" style={{ width: "15%" }}>Status</th>
            <th className="pdv-table-header" style={{ width: "8%" }}>Preço de Venda</th>
            <th className="pdv-table-header" style={{ width: "8%" }}>Fornecedor</th>
            <th className="pdv-table-header" style={{ width: "8%" }}>sel</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr key={product.id} className="pdv-table-row">
              <td>{index + 1}</td>
              <td>{product.name}</td>
              <td>{product.sku}</td>
              <td>{product.category}</td>
              <td>{product.category}</td>
              <td>{product.stock}</td>
              <td>
                <span>{product.status}</span>
              </td>
              <td>R$ {product.price.toFixed(2)}</td>
              <td>{product.category}</td>
              <td>&#9634;</td>
              
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductTable;