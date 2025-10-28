// src/components/TabButton.tsx
import React from 'react';

// Assumindo que você tem uma interface TabButtonProps no seu projeto:
// interface TabButtonProps {
//   label: string;
//   isActive: boolean;
//   onClick: () => void;
//   disabled?: boolean;
//   isTab?: boolean; // Nova propriedade para determinar se é uma aba ARIA
// }

// O estilo pode ser definido em um arquivo CSS separado ou como JSS/TSX
const styles: { [key: string]: React.CSSProperties } = {
  button: {
    padding: '10px 10px',
    border: 'none',
    borderRadius: '0',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '1em',
    color: '#666',
    borderBottom: '5px solid transparent',
    fontWeight: 'normal',
    transition: 'all 0.2s ease-in-out', // Adicionado transição para melhor UX
    minWidth: '80px', // Opcional: Para dar uma largura mínima
  },
  active: {
    color: '#007BFF',
    borderBottomColor: '#007BFF',
    fontWeight: 'bold',
  },
  // Estilo para o TypeSwitch (sem borda inferior, mas ainda ativo/inativo)
  switch: {
    padding: '8px 15px',
    border: 'none',
    borderBottom: 'none',
  },
  switchActive: {
    backgroundColor: '#007BFF',
    color: 'white',
    // Remove a borda inferior, usa cor de fundo
    borderBottomColor: 'transparent', 
  },
};

// Adicionei 'isTab' e 'variant' à desestruturação para flexibilidade máxima.
const TabButton: React.FC<any> = ({ label, isActive, onClick, disabled, isTab = true, variant = 'tab' }) => {
  
  // 1. Define os estilos base com base no variant (tab ou switch)
  let baseStyle = styles.button;
  let activeStyle = styles.active;

  if (variant === 'switch') {
    // Mescla o estilo padrão com o estilo de switch
    baseStyle = { ...styles.button, ...styles.switch };
    activeStyle = { ...styles.active, ...styles.switchActive };
  }

  // 2. Mescla o estilo base com o estilo ativo, se necessário
  const combinedStyle = {
    ...baseStyle,
    ...(isActive ? activeStyle : {}),
  };

  // 3. Define os atributos ARIA (Apenas se for um Tab Button real)
  const ariaProps = isTab
    ? {
        role: 'tab',
        'aria-selected': isActive,
      }
    : {}; // Não aplica role/aria-selected se não for uma aba.

  return (
    <button
      style={combinedStyle}
      onClick={onClick}
      disabled={disabled}
      {...ariaProps} // Aplica as propriedades ARIA condicionalmente
    >
      {label}
    </button>
  );
};

export default TabButton;