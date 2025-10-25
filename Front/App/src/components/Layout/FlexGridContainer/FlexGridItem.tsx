// FlexGridItem.tsx (CORRIGIDO)

import React, { useMemo } from 'react';
import { MAX_COLUMNS_BASE } from './flexGridConfig';

interface FlexGridItemProps extends React.PropsWithChildren {
    /**
     * Define a largura do item em relação ao MAX_COLUMNS_BASE (padrão 12).
     */
    colSpan?: number; 
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Componente Wrapper para itens dentro de FlexGridContainer.
 */
const FlexGridItem: React.FC<FlexGridItemProps> = ({ 
    colSpan, 
    className = '', 
    style = {}, 
    children 
}) => {

    const itemStyle: React.CSSProperties = useMemo(() => {
        
        // 1. Define quantas colunas o item deve ocupar (padrão é 100%)
        const safeColSpan = colSpan === undefined 
            ? MAX_COLUMNS_BASE 
            : Math.min(Math.max(1, colSpan), MAX_COLUMNS_BASE);
        
        // 2. Calcula a largura percentual (Ex: 6/12 * 100 = 50%)
        const percentageWidth = (safeColSpan / MAX_COLUMNS_BASE) * 100;

        // 3. Aplica estilos para Flexbox (e Grid, caso o pai seja Grid)
        return {
            ...style,
            
            // 💡 CORREÇÃO APLICADA AQUI:
            // O uso de 'calc(% - gap)' não é necessário com o flex-grow: 1.
            // Basta definir o flex-basis como a porcentagem.
            // flex-grow: 1 | flex-shrink: 0 | flex-basis: <largura>%
            flex: `1 0 ${percentageWidth}%`, 
            
            // Lógica Grid (mantida): Faz o item abranger N colunas
            gridColumn: `span ${safeColSpan}`, 
        };
    }, [colSpan, style]);

    return (
        <div 
            className={`flex-grid-item ${className}`}
            style={itemStyle}
            data-col-span={colSpan}
        >
            {children}
        </div>
    );
};

export default FlexGridItem;