import React, { useMemo } from 'react';

// Importação do CSS
import './flexGridContainer.css';

// 1. NOVAS INTERFACES DE ALINHAMENTO  FLEXBOX
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

    // NOVO: Prop para mudar a cor de fundo (Estilo Inline)
    backgroundColor?: string;

    // 2. PROPS PARA FLEXBOX
    justifyContent?: JustifyContent;
    alignItems?: AlignItems;
    flex?: string;
}

/**
 * Componente Contêiner Modular que pode se comportar como Flex ou Grid.
 * Adicionado suporte completo para alinhamento Flexbox e cor de fundo personalizável.
 */
const FlexGridContainer: React.FC<FlexGridContainerProps> = ({
    layout,
    gap = '0px', // Padrão
    template,
    className = '',
    mobileTemplate,
    // 3. DESESTRUTURAÇÃO DAS NOVAS PROPS
    justifyContent,
    alignItems,
    backgroundColor, // NOVO: Desestruturação da nova prop
    children,
}) => {

    // 4. Geração dos Estilos Dinâmicos (Inline)
    const containerStyle: React.CSSProperties = useMemo(() => {
        const baseStyle: React.CSSProperties = {
            display: layout,
            gap: gap,
            width: '100%',
            // NOVO: Aplica a cor de fundo se fornecida
            backgroundColor: backgroundColor,
        };

        if (layout === 'flex') {
            return {
                ...baseStyle,
                flexDirection: template === 'column' ? 'column' : 'row',
                flexWrap: 'wrap', // Permite que os itens quebrem a linha
                // APLICAÇÃO DOS NOVOS ESTILOS FLEXBOX
                justifyContent: justifyContent || 'flex-start',
                alignItems: alignItems || 'stretch',
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
    }, [layout, gap, template, justifyContent, alignItems, backgroundColor]); // NOVO: Incluída backgroundColor

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