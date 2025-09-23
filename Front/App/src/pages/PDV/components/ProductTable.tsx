import React from "react";
import { Product } from "../../../types/types";



interface ProductTableProps {
  products: Product[];
  handleAddToCart: (product: Product) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({ products, handleAddToCart }) => {
  return (
   
      <table className="pdv-product-table">
        <thead>
          <tr>
            <th className="pdv-table-header"  colSpan={2} style={{ width: "4%" }}>Nmr</th>
            <th className="pdv-table-header" style={{ width: "25%" }}>Nome do Produto</th>
            <th className="pdv-table-header" style={{ width: "12%" }}>SKU</th>
            <th className="pdv-table-header" style={{ width: "12%" }}>Categoria</th>
            <th className="pdv-table-header" style={{ width: "12%" }}>Sub-Categoria</th>
            <th className="pdv-table-header" style={{ width: "5%" }}>Estoque</th>
            <th className="pdv-table-header" style={{ width: "11%" }}><select><option>status</option></select></th>
            <th className="pdv-table-header" style={{ width: "10%" }}>Preço</th>
            <th className="pdv-table-header" style={{ width: "10%" }}>Fornecedor</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr key={product.id} className="pdv-table-row" onClick={() => handleAddToCart(product)}>
              <td> &#9634;</td>
              <td> {index + 1}</td>
              <td> <span  className="truncado" title={product.name}>{product.name}</span></td>
              <td>{product.sku}</td>
              <td>{product.category}</td>
              <td>{product.category}</td>
              <td>{product.stock}</td>
              <td>
                <span>{product.status}</span>
              </td>
              <td>R$ {product.price.toFixed(2)}</td>
              <td>{product.category}</td>
              
            </tr>
          ))}
        </tbody>
      </table>
  );
};

export default ProductTable;