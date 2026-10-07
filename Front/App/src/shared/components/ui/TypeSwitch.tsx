import React from 'react';

interface TypeSwitchProps {
    children: React.ReactNode;
}

const TypeSwitch: React.FC<TypeSwitchProps> = ({ children }) => {
    // Classe CSS: .cliente-select-type-switch-container
    return (
        <div className="cliente-select-type-switch-container">
            {children}
        </div>
    );
};

export default TypeSwitch;