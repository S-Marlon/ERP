import React from 'react';
import { FilterState } from '../types';

// Define a interface para as props do componente
interface ServiceFilterProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string) => void;
  onClear: () => void;
  onApply: () => void;
}

const ServiceFilter: React.FC<ServiceFilterProps> = ({ 
  filters, 
  onFilterChange, 
  onClear, 
  onApply 
}) => {
  return (
    <div className="filter-container">
      <h2>Filtro de Serviço</h2>
      {/* ... (os mesmos inputs e estrutura de antes) */}
      <div className="filter-section">
        <h3>Cliente</h3>
        <input 
          type="text" 
          placeholder="Nome" 
          value={filters.clientName} 
          onChange={(e) => onFilterChange('clientName', e.target.value)} 
        />
        {/* ... outros inputs com a mesma lógica */}
      </div>

      <div className="filter-actions">
        <button onClick={onClear}>Limpar Campos</button>
        <button onClick={onApply}>Aplicar Filtro</button>
      </div>
    </div>
  );
};

export default ServiceFilter;