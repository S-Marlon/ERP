import React from 'react';
import "../Estoque.css";
import Typography from '../../../components/ui/Typography/Typography';
import Button from '../../../components/ui/Button/Button';

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
            <Typography  variant='h1Alt'>Dashboard de estoque</Typography>
            <div className="header-info">
                <span>{foundProducts} produtos em registro</span>
                <a href='/Estoque/consulta'>Adicionar produto</a>
                <a href='/Estoque/gerenciamento'>Registrar Entrada</a>
                <a href='/Estoque/operacoes'>Inventário</a>
            </div>


<div>

            <Button variant='warning' onClick={onAddProduct}><a href='/Estoque/consulta'>Cadastro e Gerenciamento de Produtos</a></Button>
            <Button variant='warning' onClick={onAddProduct}> <a href='/Estoque/gerenciamento'>Movimentação e Operações Diárias</a></Button>
            <Button variant='warning' onClick={onAddProduct}> <a href='/Estoque/operacoes'>Consultas e Relatórios (Análise)</a></Button>
</div>
        </div>
    );
};

export default ProductHeader;