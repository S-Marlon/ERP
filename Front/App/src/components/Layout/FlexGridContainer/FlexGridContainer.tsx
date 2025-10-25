import React, { useMemo } from 'react';

// Importação do CSS (mantida, mas lembre-se que o foco está nos estilos inline para as props)
import './flesGridContainer.css';

// 1. NOVAS INTERFACES DE ALINHAMENTO FLEXBOX
type JustifyContent = 
    | 'flex-start' 
    | 'flex-end' 
    | 'center' 
    | 'space-between' 
    | 'space-around' 
    | 'space-evenly' 
    | 'stretch';

type AlignItems = 
    | 'flex-start' 
    | 'flex-end' 
    | 'center' 
    | 'baseline' 
    | 'stretch';

type LayoutType = 'flex' | 'grid';

interface FlexGridContainerProps extends React.PropsWithChildren {
    layout: LayoutType;
    gap?: string;
    template?: string; // Para 'grid' (ex: '1fr 2fr') ou 'flex' ('row' | 'column')
    className?: string;
    mobileTemplate?: string; // Para demonstração de responsividade simples

    // 2. NOVAS PROPS PARA FLEXBOX
    justifyContent?: JustifyContent;
    alignItems?: AlignItems;
    flex?: string;
}

/**
 * Componente Contêiner Modular que pode se comportar como Flex ou Grid.
 * Adicionado suporte completo para alinhamento Flexbox.
 */
const FlexGridContainer: React.FC<FlexGridContainerProps> = ({
    layout,
    gap = '15px', // Padrão
    template,
    className = '',
    mobileTemplate,
    // 3. DESESTRUTURAÇÃO DAS NOVAS PROPS
    justifyContent, 
    alignItems, 
    children,
}) => {

    // 4. Geração dos Estilos Dinâmicos (Inline)
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
                // APLICAÇÃO DOS NOVOS ESTILOS FLEXBOX (com fallback para valores padrão se a prop não for fornecida)
                justifyContent: justifyContent || 'flex-start', // Novo! Padrão 'flex-start'
                alignItems: alignItems || 'stretch', // Novo! Padrão 'stretch'
                flex: '1 0 100%'
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
    }, [layout, gap, template, justifyContent, alignItems]); // Incluídas as novas props no array de dependências

    // 5. Montagem da Classe CSS
    const finalClassName = `container-modular-${layout} ${className}`;
    
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