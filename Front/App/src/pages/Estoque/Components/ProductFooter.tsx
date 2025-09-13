import React from 'react';
import "../Estoque.css";

interface ProductFooterProps {
    totalProducts: number;
    foundProducts: number;
    onAddProduct: () => void;
}

const ProductFooter: React.FC<ProductFooterProps> = () => {
    return (
        <div className="product-footer">
          
          data:
          
          informações: link

            feito por Marlon.
        caso de uso: controle de estoque.
        duvida contato: 
          
        </div>
    );
};

export default ProductFooter;