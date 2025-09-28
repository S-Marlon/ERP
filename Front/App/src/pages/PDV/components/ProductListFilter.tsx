import React from "react";
// 1. IMPORTAÇÃO ATUALIZADA: Trazendo o novo tipo Produto
import { Produto } from "../../../types/newtypes"; 

// 2. TIPAGEM CORRIGIDA: Usa o novo tipo Produto[]
interface Props {
  products: Produto[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  // Adicionando um handler para filtrar por categoria, que será usado nos botões
  // O filtro de categoria agora é tratado por uma função separada que será implementada no PDVScreen
  onCategoryClick: (categoryName: string) => void; 
  activeCategory: string; // Para controlar o estado ativo do botão
}

const ProductListFilter: React.FC<Props> = ({
  products,
  searchTerm,
  setSearchTerm,
  onCategoryClick,
  activeCategory,
}) => {
  
  // 3. EXTRAÇÃO DE CATEGORIAS E SUBCATEGORIAS: Usando os novos nomes de propriedade
  const uniqueCategories = [
    ...new Set(products.map((p) => p.categoriaNome).filter((name) => name)),
  ] as string[];

  const uniqueSubCategories = [
    ...new Set(products.map((p) => p.subcategoriaNome).filter((name) => name)),
  ] as string[];


  // Handler para desativar a pesquisa por texto ao clicar na categoria
  const handleCategoryClick = (name: string) => {
    // Aqui você chama a função passada pelo PDVScreen
    onCategoryClick(name);
  };
    
  return (
    <div className="pdv-side-panel">
      <div className="filter-container-column flex-column">
        
        {/* Filtro de Busca por Texto */}
        <div className="pdv-search-filter">
          <fieldset>
            <legend>Busca por Nome</legend>
            <div className="pdv-search-inputs">
              <input
                type="text"
                placeholder="Pesquisar nome do produto"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </fieldset>
        </div>

        {/* Filtro de Preço (Mantido, mas sem integração de estado neste componente) */}
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
                  // Adicione a lógica de estado de preço aqui, se necessário
                />
              </fieldset>
              <fieldset>
                <legend>Max:</legend>
                <input
                  className="min-max-input"
                  type="number"
                  min={0}
                  placeholder="Max"
                  // Adicione a lógica de estado de preço aqui, se necessário
                />
              </fieldset>
            </div>
          </fieldset>
        </div>

        {/* Botões de Categoria */}
        <div className="pdv-categories-filter">
          <span>Categorias</span>
          <div className="pdv-category-buttons">
            {/* Botão Todas */}
            <button
              className={`pdv-category-button ${activeCategory === "" ? "active" : ""}`}
              onClick={() => handleCategoryClick("")}
            >
              Todas
            </button>
            
            {/* Botões de Categorias Únicas */}
            {uniqueCategories.map((category) => (
              <button
                key={category}
                className={`pdv-category-button ${
                  activeCategory === category ? "active" : ""
                }`}
                onClick={() => handleCategoryClick(category)}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Tags (Estáticas, apenas para layout) */}
          <div className="pdv-selected-categories-tags">
            {/* Mantenha estas tags como mock, ou remova-as se não forem tags selecionadas reais */}
            <span className="selected-tag">perifericos</span>
            <span className="selected-tag">FOntes</span>
            {/* ... */}
          </div>
        </div>

        {/* Botões de Sub-Categoria */}
        <div className="pdv-categories-filter">
          <span>Sub-Categorias</span>
          <div className="pdv-category-buttons">
            {/* Botão Todas para Sub-Categoria */}
            <button
              className={`pdv-category-button ${activeCategory === "" ? "active" : ""}`}
              onClick={() => handleCategoryClick("")}
            >
              Todas
            </button>
            
            {/* Botões de Sub-Categorias Únicas */}
            {uniqueSubCategories.map((subCategory) => (
              <button
                key={subCategory}
                className={`pdv-category-button ${
                  activeCategory === subCategory ? "active" : ""
                }`}
                onClick={() => handleCategoryClick(subCategory)}
              >
                {subCategory}
              </button>
            ))}
          </div>

          {/* Tags de subcategorias selecionadas (Estáticas, apenas para layout) */}
          <div className="pdv-selected-categories-tags">
             {/* Mantenha estas tags como mock, ou remova-as se não forem tags selecionadas reais */}
            <span className="selected-tag">Categoria 1</span>
            {/* ... */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductListFilter;