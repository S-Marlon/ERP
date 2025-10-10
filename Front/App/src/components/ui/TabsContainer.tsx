
// src/components/TabsContainer.tsx
import React, { useState } from 'react';
import { TabItem } from '../../types/tabs';
import TabButton from './TabButton';

// Props do container: recebe um array de objetos TabItem
interface TabsContainerProps {
  tabs: TabItem[];
}

const TabsContainer: React.FC<TabsContainerProps> = ({ tabs }) => {
  // 1. Inicializa o estado com o ID da primeira aba
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || '');

  // Encontra o conteúdo da aba ativa
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // Se não houver abas, retorna null
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="tabs-container">
      
      {/* NAVEGAÇÃO DAS ABAS */}
      <nav role="tablist" style={{ borderBottom: '2px solid #ddd', marginBottom: '20px' }}>
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            label={tab.label}
            isActive={tab.id === activeTabId}
            onClick={() => setActiveTabId(tab.id)} // Atualiza o estado
          />
        ))}
      </nav>

      {/* CONTEÚDO DA ABA */}
      <div className="tab-content" role="tabpanel">
        {activeTab ? activeTab.content : null}
      </div>
      
    </div>
  );
};

export default TabsContainer;