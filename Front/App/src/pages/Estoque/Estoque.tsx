// src/pages/EstoquePage.tsx

import React, { useState } from 'react';
import ProductHeader from './Components/ProductHeader';
import ProductFilter from './Components/ProductFilter';
import ProductTable from './Components/ProductTable';
import { Product } from '../../types/types';
import './Estoque.css';
import ProductInfo from './Components/ProductInfo';

// Dados de exemplo
const mockProducts: Product[] = [
    {
        id: '1', sku: 'PROD-001', name: 'Teclado Gamer', pictureUrl: 'url_teclado',
        category: 'Periféricos', stock: 15, status: 'Ativo', price: 250.00
    },
    {
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },
    {
        id: '2', sku: 'PROD-002', name: 'Mangueira hidraulica R1AT, 1/4 Solai', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mangueira automotiva j188, ar condicionado, 3/8', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },{
        id: '2', sku: 'PROD-002', name: 'Mouse Sem Fio', pictureUrl: 'url_mouse',
        category: 'Periféricos', stock: 5, status: 'Baixo Estoque', price: 80.00
    },
    // ... mais produtos
];

const EstoquePage: React.FC = () => {
    const [products, setProducts] = useState<Product[]>(mockProducts);
    
    const [filters, setFilters] = useState({
        status: '',
        category: '',
        minPrice: '',
        maxPrice: '',
        minStock: '',
        maxStock: '',
    });

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    

   

    const handleApplyFilter = () => {
        const filteredList = mockProducts.filter(product => {
            // Lógica de filtro aqui
            return (
                (filters.status === '' || product.status === filters.status) &&
                (filters.category === '' || product.category === filters.category)
                // ... adicione as outras lógicas de filtro
            );
        });
        setProducts(filteredList);
    };

    // const handleResetFilters = () => {
    //     setFilters({
    //         status: '', category: '', minPrice: '', maxPrice: '', minStock: '', maxStock: ''
    //     });
    //     setProducts(mockProducts);
    // };

    const handleAddProduct = () => {
        console.log('Adicionar produto!');
        // Lógica para abrir um modal ou navegar para outra página
    };

    return (
        <div className="estoque-container">
            <ProductHeader
                totalProducts={mockProducts.length}
                foundProducts={products.length}
                onAddProduct={handleAddProduct}
            />
            <div className="content-grid">
                <div className="product-filter">
                    <ProductFilter
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onApply={handleApplyFilter}
                    />
                </div>
                
                <div className="product-table-wrapper">
                    <ProductTable products={products} />
                </div>
                <div className="product-info">
                    
                    {/* Painel de detalhes do produto pode ser adicionado aqui */}
                    <ProductInfo product={products[0]} onClose={() => {}} />
                    
                    
                </div>
            </div>
            <ProductHeader
                totalProducts={mockProducts.length}
                foundProducts={products.length}
                onAddProduct={handleAddProduct}
            />
        </div>
    );
};

export default EstoquePage;