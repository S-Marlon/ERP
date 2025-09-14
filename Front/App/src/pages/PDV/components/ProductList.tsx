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
  searchTerm,
  setSearchTerm,
  handleAddToCart,
}) => {
  // Extraindo categorias únicas dos produtos para os botões de filtro
  const uniqueCategories = [...new Set(products.map(p => p.category))];

  return (
    <div className="pdv-products">
        <h2>Lista de Produtos</h2>

      <div className="pdv-search-filter">
        <fieldset>
          <legend>Filtros</legend>
          {/* Campo de pesquisa de produto principal */}
          <input
            type="text"
            placeholder="Pesquisar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </fieldset>
      </div>

      <div className="pdv-categories-filter">
        <h2>Categorias</h2>
        <div className="pdv-category-buttons">
          {uniqueCategories.map(category => (
            <button
              key={category}
              className={`pdv-category-button ${searchTerm === category ? 'active' : ''}`}
            >
              {category}
            </button>
          ))}
          {/* Botão para limpar a pesquisa/filtro */}
          <button
            className={`pdv-category-button ${searchTerm === '' ? 'active' : ''}`}
            onClick={() => setSearchTerm('')}
          >
            Todas
          </button>
        </div>
      </div>

      <div className="pdv-product-grid">
        {products.length > 0 ? (
          products.map((product) => (
            <div
              key={product.id}
              className="pdv-product-card"
              onClick={() => handleAddToCart(product)}
            >
              <h3>{product.name}</h3>
              <span className="pdv-code">Cod: #{product.id}</span>
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