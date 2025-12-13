// src/components/Sidebar.tsx
import React, { useState, useEffect } from 'react'; // Importe useState e useEffect
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

const Header: React.FC<HeaderProps> = ({ 
    title,
    onThemeToggle,
    isDarkMode 
}) => {
    
    // 1. **USESTATE** - Estado para armazenar a data/hora atual
    const [currentTime, setCurrentTime] = useState(new Date());

    // 2. **USEEFFECT** - Configura o intervalo para atualizar o estado `currentTime` a cada segundo
    useEffect(() => {
        // Define o intervalo para chamar a função de atualização a cada 1000ms (1 segundo)
        const timerId = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        // Função de limpeza (cleanup) do useEffect.
        // Isso é crucial para limpar o intervalo quando o componente é desmontado,
        // evitando vazamentos de memória (memory leaks).
        return () => {
            clearInterval(timerId);
        };
    }, []); // O array vazio [] como dependência garante que o efeito rode apenas na montagem

    // Escolhe a paleta de cores com base no tema atual
    const themeColors = isDarkMode ? darkColors : colors;
    
    // Formata a data/hora do estado `currentTime`
    const formattedDateTime = currentTime.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // Garante formato 24h
    });


    return (
        <div className="header" style={{
            backgroundColor: themeColors.primary, // Usa a cor primária do tema
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

                    {/* 3. **EXIBIÇÃO** - Usa a variável formatada que é atualizada pelo useEffect */}
                    Data e Hora: - {formattedDateTime} -

                </div>                 

        </div>
    );
};

export default Header;