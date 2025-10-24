// Table.tsx (Atualizado)

import React from 'react';
import { TableColumn, TableProps } from './Table.types';
import './Table.css'; // Importa o arquivo CSS

const Table = <T extends Record<string, any>>({
  data,
  columns,
  caption,
  variant = 'default' // Define 'default' como padrão
}: TableProps<T>): JSX.Element => {

  // Constrói a string de classes: 'custom-table' é base, 'variant-...' é a variação
  const tableClasses = `custom-table variant-${variant}`;

  return (
    // Usa a classe CSS base e a classe de variante
    <table className={tableClasses}>
      {/* 1. Legenda (Opcional) */}
      {caption && <caption>{caption}</caption>}

      {/* 2. Cabeçalho da Tabela */}
      <thead>
        <tr>
          {columns.map((column: TableColumn<T>) => (
            <th key={column.key as string}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>

      {/* 3. Corpo da Tabela */}
      <tbody>
        {data.map((item: T, rowIndex: number) => (
          <tr key={rowIndex}>
            {columns.map((column: TableColumn<T>, colIndex: number) => (
              <td key={`${column.key as string}-${rowIndex}`}>
                {/* Verifica se existe uma função de renderização customizada */}
                {column.render
                  ? column.render(item)
                  : (item[column.key] as React.ReactNode)
                }
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default Table;