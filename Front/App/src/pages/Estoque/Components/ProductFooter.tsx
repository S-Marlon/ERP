import React from 'react';
import "../Estoque.css";

interface ProductFooterProps {
    totalProducts: number;
    foundProducts: number;
    onAddProduct: () => void;
}

const ProductFooter: React.FC<ProductFooterProps> = () => {
    return (
        <div>
          <span>

          data:
          </span>
          
          <span>

          informações: link
          </span>

<span>

            feito por Marlon.
</span>
        caso de uso: controle de estoque.
        duvida contato: 
          
        </div>
    );
};

export default ProductFooter;