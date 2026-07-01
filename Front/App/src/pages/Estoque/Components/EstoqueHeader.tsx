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
            <div style={{color:'black'}}>
          
            <Button variant='warning' onClick={onAddProduct}><a href='/Estoque/consulta'>Cadastro e Gerenciamento de Produtos</a></Button>
            <Button variant='warning' onClick={onAddProduct}><a href='/Estoque/grupos'>Gerenciar GRUPOS</a></Button>
            <Button variant='warning' onClick={onAddProduct}><a href='/Estoque/categorias'>Gerenciar CATEGORIAS </a></Button>
            <Button variant='warning' onClick={onAddProduct}> <a href='/Estoque/gerenciamento'>Entrada de (NF-E)</a></Button>
            <Button variant='warning' onClick={onAddProduct}> <a href='/Estoque/notas'>Notas Fiscais</a></Button>
            <Button variant='warning' onClick={onAddProduct}> <a href='/Estoque/operacoes'>Consultas e Relatórios (Análise)</a></Button>
            <Button variant='warning' onClick={onAddProduct}> <a href='/Estoque/etiquetagem'>Etiquetagem</a></Button>
            </div>



        </div>
    );
};

export default EstoqueHeader;