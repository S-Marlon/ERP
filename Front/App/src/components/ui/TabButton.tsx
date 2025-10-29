// src/components/TabButton.tsx
import React from 'react';
import './TabButton.css'; // Importa o arquivo CSS

// Define o tipo para as variantes
type TabVariant = 'tab' | 'switch' | 'pill';

/**
 * @interface TabButtonProps
 * Propriedades para o componente TabButton.
 */
interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  /**
   * Define se o botão deve se comportar como uma aba ARIA (role="tab").
   * Padrão: true.
   */
  isTab?: boolean;
  /**
   * Define a variante de estilo do botão.
   * Valores possíveis: 'tab' (padrão), 'switch', 'pill'.
   */
  variant?: TabVariant;
}

const TabButton: React.FC<TabButtonProps> = ({
  label,
  isActive,
  onClick,
  disabled,
  isTab = true,
  variant = 'tab', // Padrão 'tab'
}) => {
  // Constrói a lista de classes CSS
  const classNames = [
    'tab-button', // Classe base
    `tab-button--${variant}`, // Classe da variante (ex: tab-button--switch)
    isActive ? 'tab-button--active' : '', // Classe de estado ativo
    disabled ? 'tab-button--disabled' : '', // Classe de estado desabilitado
  ].filter(Boolean).join(' '); // Filtra vazios e junta com espaço

  // Define os atributos ARIA (Apenas se for um Tab Button real)
  const ariaProps = isTab
    ? {
        role: 'tab',
        'aria-selected': isActive,
      }
    : {}; // Não aplica role/aria-selected se não for uma aba.

  return (
    <button
      className={classNames}
      onClick={onClick}
      disabled={disabled}
      {...ariaProps}
    >
      {label}
    </button>
  );
};

export default TabButton;