import React from "react";
import { Product } from "../../../types/types";

interface Props {
  products: Product[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  handleAddToCart: (product: Product) => void;
}

const ProductList: React.FC<Props> = ({
  products,
    handleAddToCart,
}) => {
  // Extraindo categorias únicas dos produtos para os botões de filtro
  
  return (
    <div className="pdv-products">
      <h2>Lista de Produtos</h2>
      
      <div className="pdv-product-grid">
        {products.length > 0 ? (
          products.map((product) => (
            <div
              key={product.id}
              className="pdv-product-card"
              onClick={() => handleAddToCart(product)}
            >
              <h3>{product.name}</h3>
              <span className="pdv-code">Cod: #{product.sku}</span>
              <span className="pdv-category">{product.category}</span>
              <p className="pdv-price">
                R$ {product.price.toFixed(2).replace(".", ",")}
              </p>
              <p className="pdv-stock">Estoque: {product.stock}</p>
            </div>
          ))
        ) : (
          <p>Nenhum produto encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default ProductList;