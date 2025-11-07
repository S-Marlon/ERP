import React from "react";
import "../Estoque.css";
import { FilterState } from "../../../types/types";
import Card from "../../../components/ui/Card/Card";
import FormControl from "../../../components/ui/FormControl/FormControl"; // Componente agora gerencia SELECTs
import Fieldset from "../../../components/ui/Fieldset/Fieldset";
import Typography from "../../../components/ui/Typography/Typography";
import Button from "../../../components/ui/Button/Button";

// --- OPÇÕES DE FILTRO ---
const formatOptions = (items: string[]) => 
  items.map(item => ({ value: item, label: item }));

export const categoryOptions = formatOptions(['Eletrônicos', 'Vestuário', 'Livros']);
export const subCategoryOptions = formatOptions(['Caixa', 'Pacote', 'Unidade']); // Exemplo
export const supplierOptions = formatOptions(['SOLAI', 'KORAX', 'LENZ']);
export const statusOptions = formatOptions(['Ativo', 'Inativo', 'Baixo Estoque']);
// A opção 'Todos' será adicionada automaticamente dentro do FormControl

// Tipagem mantida
interface ProductFilterProps {
 filters: FilterState; 
 onFilterChange: (key: keyof FilterState, value: string | number | boolean) => void;
 onApply: () => void;
  onReset: () => void; 
}

const ProductFilter: React.FC<ProductFilterProps> = ({
  filters, 
  onFilterChange,
  onApply,
  onReset, 
}) => {

  // Função auxiliar para garantir que o valor do input/select seja enviado corretamente
  const handleChange = (key: keyof FilterState, value: string | number) => {
    // Converte para number se o campo for de preço ou estoque
    const finalValue = (key.includes('Price') || key.includes('Stock')) 
      ? Number(value) 
      : String(value);
    onFilterChange(key, finalValue);
  };

  return (
    <Card className="filter-container-row">
      
      {/* 1. Nome e SKU (usando FormControl type="text") */}
      <div className="filter-group">
        <FormControl 
          label="Nome Do Produto:" 
          placeholder="Digite o produto desejado" 
          type="text" 
          name="name" 
          value={filters.name || ''}
          onChange={(e) => handleChange("name", e.target.value)} 
        />

        <FormControl 
          label="SKU Do Produto:" 
          placeholder="Digite o SKU desejado" 
          type="text" 
          name="sku" 
          value={filters.sku || ''}
          onChange={(e) => handleChange("sku", e.target.value)} 
        />
      </div>

      {/* 2. Categoria e Sub-Categoria (usando FormControl control="select") */}
      <div className="filter-group">
        
        <FormControl
          label="Categoria:"
          name="category"
          control="select" // 👈 Define como SELECT
          value={filters.category || ''}
          options={categoryOptions} // 👈 Passa as opções formatadas
          onChange={(e) => handleChange("category", e.target.value)}
        />

        <FormControl
          label="Sub-Categoria:"
          name="subCategory"
          control="select" // 👈 Define como SELECT
          value={filters.subCategory || ''}
          options={subCategoryOptions} // 👈 Passa as opções
          onChange={(e) => handleChange("subCategory", e.target.value)}
        />
      </div>

      {/* 3. Preço de Venda (Min/Max) e Fornecedor */}
      <div className="filter-group">
        <Typography>Preço de Venda:</Typography>
        <div className="min-max-group">
          
          <Fieldset legend="Min:">
            <FormControl
              className="min-max-input"
              type="number"
              placeholder="Min"
              name="minPrice"
              value={filters.minPrice || ''}
              onChange={(e) => handleChange("minPrice", e.target.value)}
            />
          </Fieldset>

          <Fieldset legend="Max:">
            <FormControl
              className="min-max-input"
              type="number"
              placeholder="Max"
              name="maxPrice"
              value={filters.maxPrice || ''}
              onChange={(e) => handleChange("maxPrice", e.target.value)}
            />
          </Fieldset>
        </div>

        {/* Filtro Fornecedor (usando FormControl control="select") */}
        <FormControl
          label="Fornecedor:"
          name="supplier"
          control="select" // 👈 Define como SELECT
          value={filters.supplier || ''}
          options={supplierOptions} // 👈 Passa as opções
          onChange={(e) => handleChange("supplier", e.target.value)}
        />
      </div>

      {/* 4. Estoque (Min/Max) e Status */}
      <div className="filter-group">
        <Typography>Quantidade em estoque:</Typography>
        <div className="min-max-group">
          
          <Fieldset legend="Min:">
            <FormControl
              className="min-max-input"
              type="number"
              placeholder="Min"
              name="minStock"
              value={filters.minStock || ''}
              onChange={(e) => handleChange("minStock", e.target.value)}
            />
          </Fieldset>

          <Fieldset legend="Max:">
            <FormControl
              className="min-max-input"
              type="number"
              placeholder="Max"
              name="maxStock"
              value={filters.maxStock || ''}
              onChange={(e) => handleChange("maxStock", e.target.value)}
            />
          </Fieldset>
        </div>
        
        {/* Filtro Status (usando FormControl control="select") */}
        <FormControl
          label="Status:"
          name="status"
          control="select" // 👈 Define como SELECT
          value={filters.status || ''}
          options={statusOptions} // 👈 Passa as opções
          onChange={(e) => handleChange("status", e.target.value)}
        />
      </div>
      
      {/* 5. Botões de Ação */}
      <div className="filter-group action-buttons">
        <Button onClick={onApply}>Aplicar Filtro</Button>
        <Button variant="secondary" onClick={onReset}>Resetar Filtro</Button>
      </div>

    </Card>
  );
};

export default ProductFilter;