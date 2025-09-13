import React from "react";
import "../Estoque.css";
import { FilterState } from "../../../types/types";

interface ProductFilterProps {
  filters: FilterState; // Pode ser tipado com uma interface de filtro mais específica
  onFilterChange: (key: keyof FilterState, value: string | number | boolean) => void;
  onApply: () => void;
}

const ProductFilter: React.FC<ProductFilterProps> = ({
  onFilterChange,
  onApply,
}) => {
  return (
    <div className="product-filter-container">
      <div className="filter-group">
        <label>Nome Do produto:</label>

        <input type="text" name="" id="" />
        <label>SKU Do produto:</label>

        <input type="text" name="" id="" />
      </div>

      <div className="filter-group">
        <label>Categoria:</label>
        <select onChange={(e) => onFilterChange("category", e.target.value)}>
          <option value="">Todos</option>
          <option value="Categoria 1">Categoria 1</option>
          <option value="Categoria 2">Categoria 2</option>
        </select>

        <label>Sub-Categoria:</label>
        <select onChange={(e) => onFilterChange("status", e.target.value)}>
          <option value="">Todos</option>
          <option value="Ativo">Ativo</option>
          <option value="Inativo">Inativo</option>
          <option value="Baixo Estoque">Baixo estoque</option>
        </select>
      </div>
      <div className="filter-group">
        <label>Preço de Venda:</label>
        <div className="min-max-group">
          
          <fieldset>

          <legend>Min:</legend>

          <input
            className="min-max-input"
            type="number"
            min={0}
            placeholder="Min"
            onChange={(e) => onFilterChange("minPrice", e.target.value)}
          />
          </fieldset>

          <fieldset>
            
          <legend>Max:</legend>

          <input
            className="min-max-input"
            type="number"
            min={0}
            placeholder="Max"
            onChange={(e) => onFilterChange("maxPrice", e.target.value)}
          />
          </fieldset>
        </div>

        <label>Fornecedor:</label>
        <select onChange={(e) => onFilterChange("status", e.target.value)}>
          <option value="">Todos</option>
          <option value="Ativo">SOLAI</option>
          <option value="Inativo">KORAX</option>
          <option value="Baixo Estoque">LENZ</option>
        </select>
      </div>

      <div className="filter-group">

        <label>Quantidade em estoque:</label>
        <div className="min-max-group">
          
          <fieldset>

          <legend>Min:</legend>

          <input
            className="min-max-input"
            type="number"
            min={0}
            placeholder="Min"
            onChange={(e) => onFilterChange("minPrice", e.target.value)}
          />
          </fieldset>

          <fieldset>
            
          <legend>Max:</legend>

          <input
            className="min-max-input"
            type="number"
            min={0}
            placeholder="Max"
            onChange={(e) => onFilterChange("maxPrice", e.target.value)}
          />
          </fieldset>
        </div>
        

        <label>Status:</label>
        <select onChange={(e) => onFilterChange("category", e.target.value)}>
          <option value="">Todos</option>
          <option value="Categoria 1">Categoria 1</option>
          <option value="Categoria 2">Categoria 2</option>
        </select>
      </div>
      <div className="filter-group">
        <button onClick={onApply}>Aplicar Filtro</button>
        <div className="filter-info">
          <button>Resetar Filtro de produto</button>
        </div>
      </div>
    </div>
  );
};

export default ProductFilter;