// src/components/Sidebar.tsx
import './Header.css';

import { colors, darkColors } from '../../../styles/colors';
import { BotaoVoltar } from '../../ui/BotaoVoltar';

// Define os tipos das propriedades (props) que o componente vai receber
interface HeaderProps {
  title: string; // O título da página, obrigatório
  headerHeight: number; // A altura do cabeçalho, obrigatória
  showBackButton?: boolean; // Booleano opcional para mostrar ou esconder o botão de voltar
  onBackButtonClick?: () => void; // A função que será chamada ao clicar no botão de voltar
  onThemeToggle: () => void; // A função para alternar entre modo claro e escuro, obrigatória
  isDarkMode: boolean; // Booleano para saber o estado atual do tema
}

const Header: React.FC<HeaderProps> = ({ title,
  onThemeToggle,
  isDarkMode }) => {
    
    // Escolhe a paleta de cores com base no tema atual
  const themeColors = isDarkMode ? darkColors : colors;

  return (
    <div className="header" style={{
          backgroundColor: isDarkMode ? themeColors.primary : themeColors.primary,
          color: isDarkMode ? '#f3f4f6' : '#1f2937', 
        }}>

      
            <BotaoVoltar />
           
      <h1 style={{alignContent: 'center', fontSize:"1.3rem"}}>{title}</h1>
                
                <div>

                <button>A-</button>
                <button>A+</button>
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

    </div>
  );
};

export default Header;
