// src/components/TabButton.tsx
import React from 'react';
import { TabButtonProps } from '../types/tabs';

// O estilo pode ser definido em um arquivo CSS separado ou como JSS/TSX
const styles: { [key: string]: React.CSSProperties } = {
  button: {
    padding: '10px 15px',
    border: 'none',
    borderRadius: '0',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '1em',
    color: '#666',
    borderBottom: '5px solid transparent',
    fontWeight: 'normal',
    transition: 'all 0.3s',
  },
  active: {
    color: '#007BFF',
    borderBottomColor: '#007BFF',
    fontWeight: 'bold',
  },
};

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => {
  return (
    <button
      style={{ ...styles.button, ...(isActive ? styles.active : {}) }}
      onClick={onClick}
      aria-selected={isActive}
      role="tab"
    >
      {label}
    </button>
  );
};

export default TabButton;