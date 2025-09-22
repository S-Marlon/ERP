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
  const uniqueCategories = [...new Set(products.map(p => p.category))];

  return (
    <div className="pdv-side-panel">
     

  <div className="pdv-filters-container flex-column">
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
    <div className="pdv-categories-filter">
      <span>Categorias</span>
      <div className="pdv-category-buttons">
        {uniqueCategories.map(category => (
          <button
            key={category}
            className={`pdv-category-button ${searchTerm === category ? 'active' : ''}`}
            // onClick={handleCategoryClick(category)} // Adicionar funcionalidade depois
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
      <div className="pdv-selected-categories-tags">
        {/* Renderizar as tags dinamicamente aqui */}
        <span className="selected-tag">Categoria 1</span>
        {/* ... mais tags ... */}
      </div>
      <span>Sub-Categorias</span>
      <div className="pdv-category-buttons">
        {uniqueCategories.map(category => (
          <button
            key={category}
            className={`pdv-category-button ${searchTerm === category ? 'active' : ''}`}
            // onClick={handleCategoryClick(category)} // Adicionar funcionalidade depois
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

      {/* Tags de categorias selecionadas */}
      <div className="pdv-selected-categories-tags">
        {/* Renderizar as tags dinamicamente aqui */}
        <span className="selected-tag">Categoria 1</span>
        
        {/* ... mais tags ... */}
      </div>
    </div>

    
  </div>


      
    </div>
  );
};

export default ProductListFilter;