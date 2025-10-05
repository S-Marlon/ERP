// src/types/tabs.ts

/**
 * Define a estrutura de dados para cada aba.
 */
export interface TabItem {
  id: string; // ID único da aba (ex: 'geral', 'atividades')
  label: string; // Rótulo visível na navegação (ex: 'Geral')
  content: React.ReactNode; // O conteúdo que será exibido
}

/**
 * Define as propriedades do componente TabButton.
 */
export interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}