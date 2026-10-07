// TabPanel.tsx
import React from 'react';

export interface TabPanelProps {
  /** O rótulo ou título que aparecerá no menu de abas. */
  label: string;
  /** O conteúdo da aba. */
  children: React.ReactNode;
}

// Este componente não renderiza nada diretamente, é usado apenas para estruturar os dados.
// O componente VerticalTabs irá ler as propriedades `label` e `children` dele.
const TabPanel: React.FC<TabPanelProps> = ({ children }) => {
  return <>{children}</>;
};

export default TabPanel;