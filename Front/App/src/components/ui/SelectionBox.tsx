import React from 'react';

interface SelectionBoxProps {
    children: React.ReactNode;
    status: 'placeholder' | 'selected'; // Define a aparência
    isSearchVisible: boolean; // Indica se a busca está aberta
    onClick: () => void;
}

const SelectionBox: React.FC<SelectionBoxProps> = ({ children, status, isSearchVisible, onClick }) => {
    // Classes CSS:
    // .cliente-select-selection-box (Base)
    // .cliente-select-selection-box--placeholder
    // .cliente-select-selection-box--selected
    // .cliente-select-selection-box--active (se a busca estiver visível)
    const className = `cliente-select-selection-box cliente-select-selection-box--${status} ${isSearchVisible ? 'cliente-select-selection-box--active' : ''}`;

    return (
        <div className={className} onClick={onClick}>
            {children}
        </div>
    );
};

export default SelectionBox;