import React from 'react';
import '../pages/Estoque.css';

interface ProductFilterProps {
    filters: unknown; // Pode ser tipado com uma interface de filtro mais específica
    onFilterChange: (key: string, value: string) => void;
    onApply: () => void;
}

const ProductFilter: React.FC<ProductFilterProps> = ({ onFilterChange, onApply }) => {
    return (
        <div className="product-filter-container">

            <div className="filter-group">
                <label>Nome Do produto:</label>
                
                <input type="text" name="" id="" />
                <label>SKU Do produto:</label>
                
                <input type="text" name="" id="" />
            </div>
            

            <div className="filter-group">
                <label>Status:</label>
                <select onChange={(e) => onFilterChange('status', e.target.value)}>
                    <option value="">Todos</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Baixo Estoque">Baixo estoque</option>
                </select>
            
                <label>Categoria:</label>
                <select onChange={(e) => onFilterChange('category', e.target.value)}>
                    <option value="">Todos</option>
                    <option value="Categoria 1">Categoria 1</option>
                    <option value="Categoria 2">Categoria 2</option>
                </select>
            </div>
            <div className="filter-group">
                <label>preço:</label>
                <input
                    type="number"
                    placeholder="Min"
                    onChange={(e) => onFilterChange('minPrice', e.target.value)}
                />
                <input
                    type="number"
                    placeholder="Max"
                    onChange={(e) => onFilterChange('maxPrice', e.target.value)}
                />

                </div>
            <div className="filter-group">
            
                <label>Quantidade em estoque:</label>
                <input type="number"
                    placeholder="Min"
                    onChange={(e) => onFilterChange('minStock', e.target.value)}
                />
                <input type="number"
                    placeholder="Max"
                    onChange={(e) => onFilterChange('maxStock', e.target.value)}
                />
            </div>
<div className="filter-group">
                <label>Status:</label>
                <select onChange={(e) => onFilterChange('status', e.target.value)}>
                    <option value="">Todos</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Baixo Estoque">Baixo estoque</option>
                </select>
            
                <label>Categoria:</label>
                <select onChange={(e) => onFilterChange('category', e.target.value)}>
                    <option value="">Todos</option>
                    <option value="Categoria 1">Categoria 1</option>
                    <option value="Categoria 2">Categoria 2</option>
                </select>
            </div>
            <div className="filter-group">
                
            <button onClick={onApply}>Aplicar Filtro</button>
            <div className="filter-info" >
                <button>Resetar Filtro de produto</button>
            </div>
                
            </div>
           
        </div>
    );
};

export default ProductFilter;