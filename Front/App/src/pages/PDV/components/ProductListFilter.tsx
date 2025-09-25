import React from "react";
import { Product } from "../../../types/types";

interface Props {
  products: Product[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
}

const ProductListFilter: React.FC<Props> = ({
  products,
  searchTerm,
  setSearchTerm,
}) => {
  // Extraindo categorias únicas dos produtos para os botões de filtro
  const uniqueCategories = [...new Set(products.map((p) => p.category))];

  return (
    <div className="pdv-side-panel">
      <div className="filter-container-column flex-column">
        <div className="pdv-search-filter">
          <fieldset>
            <legend>Filtros de Busca</legend>
            <div className="pdv-search-inputs">
              <input
                type="text"
                placeholder="Pesquisar nome do produto"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {/* Você pode adicionar outros campos de filtro aqui, se necessário */}
              {/* Exemplo: */}
              {/* <input
            type="text"
            placeholder="Filtrar por marca"
            // value={brandFilter}
            // onChange={(e) => setBrandFilter(e.target.value)}
          /> */}
            </div>
          </fieldset>
        </div>
        <div className="pdv-search-filter">
          <fieldset>
            <legend>Preço</legend>
             <div className="min-max-group">
          
          <fieldset>

          <legend>Min:</legend>

          <input
            className="min-max-input"
            type="number"
            min={0}
            placeholder="Min"
          />
          </fieldset>

          <fieldset>
            
          <legend>Max:</legend>

          <input
            className="min-max-input"
            type="number"
            min={0}
            placeholder="Max"
          />
          </fieldset>
        </div>
          </fieldset>
        </div>
        <div className="pdv-categories-filter">
          <span>Categorias</span>
          <div className="pdv-category-buttons">
            <button
              className={`pdv-category-button ${
                searchTerm === "" ? "active" : ""
              }`}
              onClick={() => setSearchTerm("")}
            >
              Todas
            </button>
            {uniqueCategories.map((category) => (
              <button
                key={category}
                className={`pdv-category-button  ${
                  searchTerm === category ? "active" : ""
                }`}
                // onClick={handleCategoryClick(category)} // Adicionar funcionalidade depois
              >
                {category} {category.length}
              </button>
            ))}
            {/* Botão para limpar a pesquisa/filtro */}
          </div>
          <div className="pdv-selected-categories-tags">
            {/* Renderizar as tags dinamicamente aqui */}
            <span className="selected-tag">perifericos</span>
            <span className="selected-tag">FOntes</span>
            <span className="selected-tag">Mangueiras</span>
            <span className="selected-tag">Conexão</span>
            <span className="selected-tag">Adaptadores</span>
            <span className="selected-tag">Categoria 1</span>
            <span className="selected-tag">Categoria 1</span>
            {/* ... mais tags ... */}
          </div>
          
          
          
        </div>
        <div className="pdv-categories-filter">
         
          <span>Sub-Categorias</span>
          <div className="pdv-category-buttons">
            <button
              className={`pdv-category-button ${
                searchTerm === "" ? "active" : ""
              }`}
              onClick={() => setSearchTerm("")}
            >
              Todas
            </button>
            {uniqueCategories.map((category) => (
              <button
                key={category}
                className={`pdv-category-button ${
                  searchTerm === category ? "active" : ""
                }`}
                // onClick={handleCategoryClick(category)} // Adicionar funcionalidade depois
              >
                {category}
              </button>
            ))}
            {/* Botão para limpar a pesquisa/filtro */}
          </div>

          {/* Tags de categorias selecionadas */}
          <div className="pdv-selected-categories-tags">
            {/* Renderizar as tags dinamicamente aqui */}
            <span className="selected-tag">Categoria 1</span>
            <span className="selected-tag">Categoria 1</span>
            <span className="selected-tag">Categoria 1</span>
            <span className="selected-tag">Categoria 1</span>
            <span className="selected-tag">Categoria 1</span>
            <span className="selected-tag">Categoria 1</span>

            {/* ... mais tags ... */}
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default ProductListFilter;
