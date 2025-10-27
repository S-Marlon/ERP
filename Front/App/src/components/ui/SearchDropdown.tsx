import React from 'react';

interface SearchDropdownProps {
    children: React.ReactNode;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({ children }) => {
    // Classe CSS: .cliente-select-dropdown (Lidar com posicionamento e sombra)
    return (
        <div className="cliente-select-dropdown">
            {children}
        </div>
    );
};

export default SearchDropdown;