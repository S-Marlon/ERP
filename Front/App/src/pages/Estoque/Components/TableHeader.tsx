// src/components/TableHeader.tsx
import React from 'react';
import Typography from '../../../components/ui/Typography/Typography';
import Button from '../../../components/ui/Button/Button';

const TableHeader: React.FC = () => {
interface TableHeaderProps {
  productCount: number;
}

const TableHeader: React.FC<TableHeaderProps> = ({ productCount }) => {
  return (
    <div className="table-header">
      <Typography variant='h2Alt'>{99999} produtos encontrados</Typography>
      <Typography variant='h2Alt'>{productCount} produtos encontrados</Typography>
      <div>
        {/* Lógica de Paginação */}
        <Button variant='warning'>Prev</Button>
        <Button variant='warning'>1</Button>
        <Button variant='warning'><strong>2</strong></Button>
        <Button variant='warning'>3</Button>
        <Button variant='warning'>Post</Button>
      </div>
      <div>
        <section>
          <Button variant='warning'>A+</Button>
          <Button variant='warning'>A-</Button>
        </section>
        <section>
          <Button variant='warning'>20</Button>
         <Typography variant='h2Alt'> por página</Typography> 
        </section>
      </div>
    </div>
  );
};

export default TableHeader;