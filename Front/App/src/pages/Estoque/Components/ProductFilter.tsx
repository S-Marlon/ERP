// src/components/filters/CollapsibleFilterContainer.tsx

import React, { useState } from 'react';

// --- Interfaces e Dados Mock (Mantidas do ProductFilter) ---
interface FilterState {
    name?: string;
    sku?: string;
    category?: string;
    unitOfMeasure?: string;
    supplier?: string;
    minPrice?: number;
    maxPrice?: number;
    minStock?: number;
    maxStock?: number;
    status?: string;
}

interface CollapsibleContainerProps {
    filters: FilterState;
    onFilterChange: (key: keyof FilterState, value: string | number | undefined) => void;
    onApply: () => void;
    onReset: () => void;
}

const formatOptions = (items: string[]) => 
  items.map(item => ({ value: item, label: item }));

const categoryOptions = formatOptions(['Eletrônicos', 'Vestuário', 'Livros', 'Hortifruti']);
const uomOptions = formatOptions(['Caixa', 'Pacote', 'Unidade', 'Kg', 'Litro']); 
const supplierOptions = formatOptions(['SOLAI', 'KORAX', 'LENZ', 'DISTRIBUIDORA A']);
const statusOptions = formatOptions(['Ativo', 'Inativo', 'Baixo Estoque', 'Esgotado']);

// --- Sub-Componente de Filtro (Embeddado) ---
const ProductFilter: React.FC<CollapsibleContainerProps> = ({
    filters, 
    onFilterChange,
    onApply,
    onReset, 
}) => {

    // Função auxiliar central para garantir tipos corretos e limpar valores vazios (undefined)
    const handleChange = (key: keyof FilterState, value: string | number) => {
        const numericKeys = ['minPrice', 'maxPrice', 'minStock', 'maxStock'];
        
        if (numericKeys.includes(key as string)) {
            const numericValue = Number(value);
            // Se o campo estiver vazio (''), envia `undefined` para limpar o filtro numérico
            if (value === '') {
                onFilterChange(key, undefined); 
            } else if (!isNaN(numericValue)) {
                onFilterChange(key, numericValue);
            }
        } else {
            // Para strings e selects, envia `undefined` se for a opção "Todos" ou string vazia
            const finalValue = (value === 'Todos' || value === '') ? undefined : String(value);
            onFilterChange(key, finalValue);
        }
    };

    return (
        <div style={filterStyles.formLayout}>
            
            {/* 1. Nome, Fornecedor e Status */}
            <div style={filterStyles.filterGroup}>
                <div style={filterStyles.inputColumn}>
                    <label style={filterStyles.label}>Nome/SKU:</label>
                    <input 
                        type="text" 
                        placeholder="Buscar nome ou SKU..." 
                        style={filterStyles.input}
                        value={filters.name || ''}
                        onChange={(e) => handleChange("name", e.target.value)} 
                    />
                </div>
                <div style={filterStyles.inputColumn}>
                    <label style={filterStyles.label}>Fornecedor:</label>
                    <select 
                        style={filterStyles.select}
                        value={filters.supplier || ''}
                        onChange={(e) => handleChange("supplier", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {supplierOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div style={filterStyles.inputColumn}>
                    <label style={filterStyles.label}>Status do Estoque:</label>
                    <select 
                        style={filterStyles.select}
                        value={filters.status || ''}
                        onChange={(e) => handleChange("status", e.target.value)}
                    >
                        <option value="">Todos</option>
                        {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
            </div>

            {/* 2. Categorias e Unidades */}
            <div style={filterStyles.filterGroup}>
                <div style={filterStyles.inputColumn}>
                    <label style={filterStyles.label}>Categoria Principal:</label>
                    <select 
                        style={filterStyles.select}
                        value={filters.category || ''}
                        onChange={(e) => handleChange("category", e.target.value)}
                    >
                        <option value="">Todas</option>
                        {categoryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div style={filterStyles.inputColumn}>
                    <label style={filterStyles.label}>Unidade de Medida (UoM):</label>
                    <select 
                        style={filterStyles.select}
                        value={filters.unitOfMeasure || ''}
                        onChange={(e) => handleChange("unitOfMeasure", e.target.value)}
                    >
                        <option value="">Todas</option>
                        {uomOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
            </div>

            {/* 3. Faixa de Preço e Estoque */}
            <div style={filterStyles.filterGroup}>
                <div style={filterStyles.rangeGroup}>
                    <label style={filterStyles.label}>Preço Mín/Máx:</label>
                    <div style={filterStyles.minMaxGroup}>
                        <input 
                            type="number" 
                            placeholder="Min" 
                            style={filterStyles.input}
                            value={filters.minPrice || ''}
                            onChange={(e) => handleChange("minPrice", e.target.value)}
                        />
                        <input 
                            type="number" 
                            placeholder="Max" 
                            style={filterStyles.input}
                            value={filters.maxPrice || ''}
                            onChange={(e) => handleChange("maxPrice", e.target.value)}
                        />
                    </div>
                </div>
                <div style={filterStyles.rangeGroup}>
                    <label style={filterStyles.label}>Estoque Mín/Máx:</label>
                    <div style={filterStyles.minMaxGroup}>
                        <input 
                            type="number" 
                            placeholder="Min" 
                            style={filterStyles.input}
                            value={filters.minStock || ''}
                            onChange={(e) => handleChange("minStock", e.target.value)}
                        />
                        <input 
                            type="number" 
                            placeholder="Max" 
                            style={filterStyles.input}
                            value={filters.maxStock || ''}
                            onChange={(e) => handleChange("maxStock", e.target.value)}
                        />
                    </div>
                </div>
            </div>
            
            {/* 4. Botões de Ação */}
            <div style={filterStyles.actionButtonsContainer}>
                <button 
                    style={filterStyles.resetButton}
                    onClick={onReset}
                >
                    🧹 Limpar Filtros
                </button>
                <button 
                    style={filterStyles.applyButton}
                    onClick={onApply}
                >
                    ✅ Aplicar Filtros (Buscar)
                </button>
            </div>
        </div>
    );
};


// --- Componente Principal Retrátil ---
const CollapsibleFilterContainer: React.FC<CollapsibleContainerProps> = (props) => {
    // Estado para controlar se o conteúdo está recolhido (true) ou expandido (false)
    const [isCollapsed, setIsCollapsed] = useState(true);

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <div style={collapsibleStyles.container}>
            
            {/* --- Cabeçalho Clicável --- */}
            <div 
                onClick={toggleCollapse} 
                style={collapsibleStyles.header}
                title={isCollapsed ? "Clique para expandir os filtros" : "Clique para recolher os filtros"}
            >
                <h3 style={collapsibleStyles.headerTitle}>
                    Filtros Avançados de Inventário
                </h3>
                <span style={collapsibleStyles.toggleIcon}>
                    {isCollapsed ? '🔽 Abrir Filtros' : '🔼 Fechar Filtros'}
                </span>
            </div>

            {/* --- Conteúdo Retrátil (O Filtro Real) --- */}
            <div style={isCollapsed ? collapsibleStyles.contentCollapsed : collapsibleStyles.contentExpanded}>
                <ProductFilter {...props} />
            </div>
        </div>
    );
};


// --- Estilos do Componente Retrátil ---
const collapsibleStyles: { [key: string]: React.CSSProperties } = {
    container: {
        width: '100%',
        backgroundColor: '#ffffff',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    header: {
        padding: '15px 20px',
        backgroundColor: '#f3f4f6', 
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        margin: 0,
        fontSize: '1.1rem',
        fontWeight: 600,
        color: '#1f2937',
    },
    toggleIcon: {
        fontSize: '0.9rem',
        color: '#4f46e5',
        fontWeight: 500,
        userSelect: 'none',
    },
    // CSS para o efeito recolher/expandir
    contentExpanded: {
        maxHeight: '1000px', // Suficientemente grande para o conteúdo
        opacity: 1,
        padding: '20px', 
        transition: 'max-height 0.5s ease-in-out, opacity 0.3s ease-in',
    },
    contentCollapsed: {
        maxHeight: '0',
        opacity: 0,
        overflow: 'hidden',
        padding: '0 20px', // Padding 0 para fechar bem
        transition: 'max-height 0.5s ease-in-out, opacity 0.3s ease-out',
    }
};

// --- Estilos do Formulário de Filtro (Embeddado) ---
const filterStyles: { [key: string]: React.CSSProperties } = {
    formLayout: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    filterGroup: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', // Layout responsivo
        gap: '20px',
    },
    inputColumn: {
        display: 'flex',
        flexDirection: 'column',
    },
    label: {
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#4b5563',
        marginBottom: '4px',
    },
    input: {
        padding: '10px',
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        fontSize: '1rem',
    },
    select: {
        padding: '10px',
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        fontSize: '1rem',
        backgroundColor: 'white',
    },
    rangeGroup: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
    },
    minMaxGroup: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
    },
    actionButtonsContainer: {
        paddingTop: '15px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
    },
    applyButton: {
        padding: '10px 20px',
        backgroundColor: '#4f46e5',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    resetButton: {
        padding: '10px 20px',
        backgroundColor: '#f3f4f6',
        color: '#4b5563',
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        fontWeight: 600,
        cursor: 'pointer',
    }
};

export default CollapsibleFilterContainer;