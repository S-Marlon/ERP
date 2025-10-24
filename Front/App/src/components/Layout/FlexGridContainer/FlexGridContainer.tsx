import React, { useMemo } from 'react';

import './flesGridContainer.css';

// Reutilize as interfaces definidas acima

type LayoutType = 'flex' | 'grid';

interface FlexGridContainerProps extends React.PropsWithChildren {
    layout: LayoutType;
    gap?: string;
    template?: string; // Para 'grid' (ex: '1fr 2fr') ou 'flex' ('row' | 'column')
    className?: string;
    mobileTemplate?: string; // Para demonstração de responsividade simples
}

/**
 * Componente Contêiner Modular que pode se comportar como Flex ou Grid.
 * A responsividade é tratada principalmente via CSS ou Media Queries no arquivo de estilo.
 */
const FlexGridContainer: React.FC<FlexGridContainerProps> = ({
    layout,
    gap = '16px', // Padrão
    template,
    className = '',
    mobileTemplate,
    children,
}) => {

    // 1. Geração dos Estilos Dinâmicos (Inline)
    // NOTA: Em produção, o ideal é mover isso para um arquivo CSS Module.
    const containerStyle: React.CSSProperties = useMemo(() => {
        const baseStyle: React.CSSProperties = {
            display: layout,
            gap: gap,
            width: '100%',
        };

        if (layout === 'flex') {
            return {
                ...baseStyle,
                flexDirection: template === 'column' ? 'column' : 'row',
                flexWrap: 'wrap', // Permite que os itens quebrem a linha
                alignItems: 'flex-start',
            };
        }

        if (layout === 'grid') {
            return {
                ...baseStyle,
                // Define as colunas do grid
                gridTemplateColumns: template || 'repeat(2, 1fr)', // Padrão 2 colunas
            };
        }

        return baseStyle;
    }, [layout, gap, template]);

    // 2. Montagem da Classe CSS para Responsividade
    // Usamos uma classe genérica para aplicar media queries externas
    const finalClassName = `container-modular-${layout} ${className}`;
    
    // NOTA DE IMPLEMENTAÇÃO: Para a responsividade baseada em 'mobileTemplate' funcionar 
    // com estilos inline sem uma biblioteca de estilo, precisaríamos de algo 
    // mais complexo (ex: usar useLayoutEffect para injetar media queries).
    // A melhor prática é usar classes CSS.

    return (
        <div 
            className={finalClassName} 
            style={containerStyle}
            // Adicionamos um atributo data- para facilitar a estilização com CSS
            data-layout={layout} 
            data-template={template} 
            data-mobile-template={mobileTemplate}
        >
            {children}
        </div>
    );
};

export default FlexGridContainer;