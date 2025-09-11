    import React from 'react';
import { Product } from '../types';

interface ProductInfoProps {
    product: Product;
    onClose: () => void; // Função para fechar o painel de detalhes
}

const ProductInfo: React.FC<ProductInfoProps> = ({ product, onClose }) => {
    return (
        <div className="product-info-container">

            <div className="product-info-header">
                <div>
                <h2>{product.name}</h2> 
                <p><strong>SKU:</strong> {product.sku}</p>
                </div>
                <button className="close-button" onClick={onClose}>&times;</button>
            </div>
            
            <div className="product-info-content">
                <div className="product-image-wrapper">
                    <img src={product.pictureUrl} alt={product.name} /> 
                </div>
                
                <div className="product-details">
                    
                    <p><strong>Categoria:</strong> {product.category}</p>
                        
                    <p><strong>Preço:</strong> R$ {product.price.toFixed(2)}</p>
                    <p><strong>Estoque:</strong> {product.stock} em estoque</p>
                    <p><strong>Status:</strong> {product.status}</p>
                    <p><strong>Status:</strong> {product.status}</p>
                    
                </div>
                
            </div>

        </div>
    );
};

export default ProductInfo;