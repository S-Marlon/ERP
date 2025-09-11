import React from 'react';
import '../pages/Estoque.css';

interface ProductHeaderProps {
    totalProducts: number;
    foundProducts: number;
    onAddProduct: () => void;
}

const ProductHeader: React.FC<ProductHeaderProps> = ({ foundProducts, onAddProduct }) => {
    return (
        <div className="product-header" >
            {/* <div className="filter-info" >
                <button>Resetar Filtro de produto</button>
                <span>{totalProducts} produtos em registro</span>
            </div> */}
            <h2>Filtro de Produto</h2>
            <div className="header-info">
                <span>{foundProducts} produtos em registro</span>
                <button onClick={onAddProduct}>Adicionar produto</button>
            </div>
        </div>
    );
};

export default ProductHeader;