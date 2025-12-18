// src/components/TableHeader.tsx
import React from 'react';
import Typography from '../../../../../components/ui/Typography/Typography';
import Button from '../../../../../components/ui/Button/Button';

// 1. Define the props interface
interface TableHeaderProps {
  productCount: number;
}

// 2. Define the functional component using the interface
// The error-causing lines have been removed.
const TableHeader: React.FC<TableHeaderProps> = ({ productCount }) => {
  return (
    <div className="table-header">
      {/* <Typography variant='h2Alt'>{99999} produtos encontrados</Typography> // Removed duplicate line */}
        {/* Lógica de Paginação */}
        <Button variant='warning'>Prev</Button>
        <Button variant='warning'>1</Button>
        <Button variant='warning'>**2**</Button>
        <Button variant='warning'>3</Button>
        <Button variant='warning'>Post</Button>
     
        
          <Button variant='warning'>A+</Button>
          <Button variant='warning'>A-</Button>
          <Button variant='warning'>20</Button>
          <Typography variant='h4'>{productCount} produtos por página</Typography> 
    </div>
  );
};

export default TableHeader;