import React from "react";
import "../Estoque.css";
import { Product } from "../../../types/types";



interface ProductTableProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({ products, onSelectProduct }) => {
  return (
    <>
      <div className="table-header">
        <div>{99999} produtos encontrados</div>

        <div>
          <button>Prev</button>
          <button>1</button>
          <button>
            <strong>2</strong>
          </button>
          <button>3</button>
          <button>Pos</button>
        </div>

        <div>
          <div>
            <section>
              <button>A-</button>
              <button>A+</button>
            </section>
            <section style={{ border: "1px outset  rgb(255, 0, 0)", padding: "1px 5px", borderRadius: "5px" }}>
              <button>20</button> 
             &nbsp; por pagina
            </section>
          </div>
        </div>
      </div>

      <table className="product-table">
        <thead>
          <tr>
            <th style={{ width: "6%" }}>Número</th>
            <th style={{ width: "25%" }}>Nome do Produto</th>

            <th style={{ width: "6%" }}>SKU</th>
            <th style={{ width: "7%" }}>Categoria</th>
            <th style={{ width: "9%" }}>sub-Categoria</th>
            <th style={{ width: "4%" }}>Estoque</th>
            <th style={{ width: "8%" }}>Status</th>
            <th style={{ width: "8%" }}>Preço de Venda</th>
            <th style={{ width: "8%" }}>Fornecedor</th>

            <th style={{ width: "5%" }}>Editar</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}
            onClick={() => onSelectProduct(product)}>
              <td>100</td>

              <td>{product.name}</td>
              {/* <td><img src={product.pictureUrl} alt={product.name} style={{ width: '50px' }} /></td> */}
              <td>{product.sku}</td>
              <td>{product.category}</td>
              <td>{product.category}</td>
              <td>{product.stock}</td>
              <td>
                {" "}
                <span>{product.status}</span>
              </td>
              <td>R$ {product.price.toFixed(2)}</td>
              <td>SOLAI</td>
              <td>
                <button
                  className="icon-button"
                  style={{ fontSize: "small", background: "black" }}
                >
                  ✏️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="table-header" style={{ flexDirection: "row-reverse" }}>
        <div>{99999} produtossss encontrados</div>

        <div>
          <button>°</button>
          <button>1</button>
          <button>
            <strong>2</strong>
          </button>
          <button>3</button>
          <button>°</button>
        </div>

        <div>
          <button>A+</button>
          <button>A-</button>
          <button>20</button>
          por pagina
        </div>
      </div>
    </>
  );
};

export default ProductTable;