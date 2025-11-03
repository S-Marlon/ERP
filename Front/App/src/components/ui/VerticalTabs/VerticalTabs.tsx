// VerticalTabs.tsx
import React, { useState, useMemo } from 'react';
import TabPanel, { TabPanelProps } from '../TabPanel';
import styles from './VerticalTabs.module.css'; // Importa os estilos

interface VerticalTabsProps {
  /**
   * Os componentes TabPanel que definem as abas e o conteúdo.
   */
  children: React.ReactElement<TabPanelProps> | React.ReactElement<TabPanelProps>[];
  /**
   * O índice da aba que deve ser ativa por padrão. Padrão: 0 (primeira aba).
   */
  defaultActiveIndex?: number;
}

const VerticalTabs: React.FC<VerticalTabsProps> = ({ children, defaultActiveIndex = 0 }) => {
  // Use o estado para rastrear o índice da aba ativa
  const [activeIndex, setActiveIndex] = useState(defaultActiveIndex);

  // Mapeia os children (que devem ser <TabPanel>) para extrair as props
  const tabs = useMemo(() => {
    // Garante que children é um array de elementos React válidos
    const childrenArray = React.Children.toArray(children).filter(
      (child): child is React.ReactElement<TabPanelProps> =>
        React.isValidElement(child) && (child.type as React.FC<any>).name === TabPanel.name
    );

    return childrenArray.map(child => ({
      label: child.props.label,
      content: child.props.children,
    }));
  }, [children]);


  return (
    <div className={styles.tabsContainer}>
      {/* Coluna de Navegação (Abas Verticais) */}
      <div className={styles.tabList}>
        {tabs.map((tab, index) => (
          <button
            key={index}
            className={`${styles.tabButton} ${index === activeIndex ? styles.active : ''}`}
            onClick={() => setActiveIndex(index)}
            role="tab"
            aria-selected={index === activeIndex}
            aria-controls={`tabpanel-${index}`}
            id={`tab-${index}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Coluna de Conteúdo (Painel Ativo) */}
      <div className={styles.tabContent}>
        {tabs.map((tab, index) => (
          <div
            key={index}
            className={styles.tabPanel}
            role="tabpanel"
            id={`tabpanel-${index}`}
            aria-labelledby={`tab-${index}`}
            hidden={index !== activeIndex}
          >
            {index === activeIndex && tab.content}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VerticalTabs;
export { TabPanel }; // Exporta o TabPanel para ser usado como child