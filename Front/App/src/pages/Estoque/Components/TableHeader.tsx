// src/components/TableHeader.tsx
import React from 'react';

const TableHeader: React.FC = () => {
  return (
    <div className="table-header">
      <div>{99999} produtos encontrados</div>
      <div>
        {/* Lógica de Paginação */}
        <button>°</button>
        <button>1</button>
        <button><strong>2</strong></button>
        <button>3</button>
        <button>°</button>
      </div>
      <div>
        <section>
          <button>A+</button>
          <button>A-</button>
        </section>
        <section>
          <button>20</button>
          por página
        </section>
      </div>
    </div>
  );
};

export default TableHeader;