// src/components/BotaoVoltar.tsx (Caminho sugerido)
// Exemplo para Button.tsx
import "./ui.css";
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface BotaoVoltarProps {
    // Texto opcional para o botão
    children?: React.ReactNode; 
}

export const BotaoVoltar: React.FC<BotaoVoltarProps> = ({ children = ' ← Voltar' }) => {
    const navigate = useNavigate();

    const handleBack = () => {
        // Usa o método go(-1) para voltar uma entrada no histórico do navegador.
        // É a forma mais segura de retornar à tela anterior, não importa qual fosse.
        navigate(-1); 
    };

    return (
        <button className='botao-voltar'
            onClick={handleBack}
            // Estilos básicos para que pareça um botão de navegação secundário
           
              
        >
            {children}
        </button>
    );
};