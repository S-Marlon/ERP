import React from "react";
// 1. IMPORTAÇÃO ATUALIZADA: Trazendo o novo tipo Produto
import { Produto } from "../../../types/newtypes"; 
import Card from "../../../components/ui/Card/Card";
import Fieldset from "../../../components/ui/Fieldset/Fieldset";
import FormControl from "../../../components/ui/FormControl/FormControl";
import Button from "../../../components/ui/Button/Button";

import Badge from "../../../components/ui/Badge/Badge";

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
    <Card>
      <div className="filter-container-column flex-column">
        
        {/* Filtro de Busca por Texto */}
          <Fieldset legend="Busca por Nome">
              <FormControl
              label=""
                type="text"
                placeholder="Pesquisar nome do produto"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
          </Fieldset>

        {/* Filtro de Preço (Mantido, mas sem integração de estado neste componente) */}
          <Fieldset legend="Preço">
            <div className="min-max-group">
              <Fieldset legend="Min:">
                <FormControl
                  className="min-max-input"
                  type="number"
                  min={0}
                  placeholder="Min"
                  // Adicione a lógica de estado de preço aqui, se necessário
                />
              </Fieldset>
              <Fieldset legend="Max">
                <FormControl
                  className="min-max-input"
                  type="number"
                  min={0}
                  placeholder="Max"
                  // Adicione a lógica de estado de preço aqui, se necessário
                />
              </Fieldset>
            </div>
          </Fieldset>

        {/* Botões de Categoria */}
        <div className="pdv-categories-filter">
          <span>Categorias</span>
          <div className="pdv-category-buttons">
            {/* Botão Todas */}
            <Button variant="primary"
              className={`pdv-category-button ${activeCategory === "" ? "active" : ""}`}
              onClick={() => handleCategoryClick("")}
            >
              Todas
            </Button>
            
            {/* Botões de Categorias Únicas */}
            {uniqueCategories.map((category) => (
              <Button variant="primary"
                key={category}
                className={`pdv-category-button ${
                  activeCategory === category ? "active" : ""
                }`}
                onClick={() => handleCategoryClick(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          {/* Tags (Estáticas, apenas para layout) */}
          <div className="pdv-selected-categories-tags">
            {/* Mantenha estas tags como mock, ou remova-as se não forem tags selecionadas reais */}
            <Badge className="selected-tag">perifericos</Badge>
            <Badge className="selected-tag">Fontes</Badge>
            {/* ... */}
          </div>
        </div>

        {/* Botões de Sub-Categoria */}
        <div className="pdv-categories-filter">
          <span>Sub-Categorias</span>
          <div className="pdv-category-buttons">
            {/* Botão Todas para Sub-Categoria */}
            <Button
              className={`pdv-category-button ${activeCategory === "" ? "active" : ""}`}
              onClick={() => handleCategoryClick("")}
            >
              Todas
            </Button>
            
            {/* Botões de Sub-Categorias Únicas */}
            {uniqueSubCategories.map((subCategory) => (
              <Button
                key={subCategory}
                className={`pdv-category-button ${
                  activeCategory === subCategory ? "active" : ""
                }`}
                onClick={() => handleCategoryClick(subCategory)}
              >
                {subCategory}
              </Button>
            ))}
          </div>

          {/* Tags de subcategorias selecionadas (Estáticas, apenas para layout) */}
          <div className="pdv-selected-categories-tags">
             {/* Mantenha estas tags como mock, ou remova-as se não forem tags selecionadas reais */}
            <Badge className="selected-tag">Categoria 1</Badge>
            {/* ... */}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProductListFilter;