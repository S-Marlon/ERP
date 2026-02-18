import React from 'react';
import Typography from '../../../components/ui/Typography/Typography';
import Button from '../../../components/ui/Button/Button';

interface ProductHeaderProps {
    totalProducts: number;
    
    onAddProduct: () => void;
}

const EstoqueHeader: React.FC<ProductHeaderProps> = ({  onAddProduct }) => {
    return (
        <div className="product-header" >
            
            <Typography  variant='h1Alt'>Dashboard de estoque</Typography>
            <div className="header-info">
          
            <Button variant='primary' onClick={onAddProduct}><a href='/Estoque/consulta'>Cadastro e Gerenciamento de Produtos</a></Button>
            <Button variant='primary' onClick={onAddProduct}> <a href='/Estoque/gerenciamento'>Movimentação e Operações Diárias</a></Button>
            <Button variant='primary' onClick={onAddProduct}> <a href='/Estoque/operacoes'>Consultas e Relatórios (Análise)</a></Button>
            <Button variant='primary' onClick={onAddProduct}> <a href='/Estoque/etiquetagem'>Etiquetagem</a></Button>
            </div>



        </div>
    );
};

export default EstoqueHeader;