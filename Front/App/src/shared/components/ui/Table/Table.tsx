// Table.tsx (Versão Final Otimizada)

import React from 'react';
import { TableColumn, TableProps } from '../../../types/Table.types';
import './Table.css'; // Importa o arquivo CSS

const Table = <T extends Record<string, any>>({
  data,
  columns,
  caption,
  variant = 'default', // Define 'default' como padrão
  onRowClick // Recebe a função de clique na linha
}: TableProps<T>): JSX.Element => {

  // Constrói a string de classes: 'custom-table' é base, 'variant-...' é a variação
  const tableClasses = `custom-table variant-${variant}`;
  
  // Condição para determinar se a linha deve ser clicável
  const isClickable = !!onRowClick;

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
          <tr 
            key={rowIndex}
            // Chama onRowClick se for fornecido
            onClick={isClickable ? () => onRowClick(item) : undefined}
            // Adiciona estilos inline e classes para feedback visual
            style={isClickable ? { cursor: 'pointer' } : undefined}
            className={isClickable ? 'clickable-row' : ''} 
          >
            {columns.map((column: TableColumn<T>) => (
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