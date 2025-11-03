import React, { FC } from 'react';
import { ButtonGroupProps } from './ButtonTypes';
// 🚨 Mude o caminho abaixo para o local real do seu componente Button
import Button from '../Button/Button'; 
import './ButtonGroup.css'; 

// Componente principal do Grupo de Botões
const ButtonGroup: FC<ButtonGroupProps> = ({ buttons }) => {
  return (
    // O container mantém a estilização para agrupar e espaçar os botões
    <div className="button-group-container">
      {buttons.map((button) => (
        // Usamos as props diretamente da interface GroupButton, que
        // é compatível com o seu componente Button.
        <Button 
          key={button.id}
          variant={button.variant}
          onClick={button.onClick}
          loading={button.loading}
          disabled={button.disabled}
          active={button.active}
        >
          {/* A label é o children do seu componente Button */}
          {button.label} 
        </Button>
      ))}
    </div>
  );
};

export default ButtonGroup;