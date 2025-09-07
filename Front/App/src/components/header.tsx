// src/components/Sidebar.tsx
import './Header.css';

import { colors, darkColors } from '../styles/colors';

// Define os tipos das propriedades (props) que o componente vai receber
interface HeaderProps {
  title: string; // O título da página, obrigatório
  headerHeight: number; // A altura do cabeçalho, obrigatória
  showBackButton?: boolean; // Booleano opcional para mostrar ou esconder o botão de voltar
  onBackButtonClick?: () => void; // A função que será chamada ao clicar no botão de voltar
  onThemeToggle: () => void; // A função para alternar entre modo claro e escuro, obrigatória
  isDarkMode: boolean; // Booleano para saber o estado atual do tema
}

const Header: React.FC<HeaderProps> = ({ title, onBackButtonClick,
  onThemeToggle,
  isDarkMode }) => {
    
    // Escolhe a paleta de cores com base no tema atual
  const themeColors = isDarkMode ? darkColors : colors;

  return (
    <div className="header" style={{
          backgroundColor: isDarkMode ? themeColors.primary : themeColors.primary,
          color: isDarkMode ? '#f3f4f6' : '#1f2937', 
        }}>

      <button 
            onClick={onBackButtonClick}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid',
              borderColor: isDarkMode ? '#d1d5db' : '#4b5563',
              color: isDarkMode ? '#d1d5db' : '#4b5563',
             
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ← Voltar
          </button>
      <h3>{title}</h3>

      <button
        onClick={onThemeToggle}
        style={{
          backgroundColor: isDarkMode ? '#374151' : themeColors.backgroundLight,
          color: isDarkMode ? '#f3f4f6' : '#1f2937',
          border: 'none',
          
          borderRadius: '10px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        {isDarkMode ? '🌙 Modo Escuro' : '☀️ Modo Claro'}
      </button>
    </div>
  );
};

export default Header;
