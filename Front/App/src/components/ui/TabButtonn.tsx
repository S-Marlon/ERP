import React from 'react';

interface TabButtonProps {
    children: React.ReactNode;
    active: boolean;
    onClick: () => void;
    disabled?: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ children, active, onClick, disabled }) => {
    // Classes CSS:
    // .cliente-select-tab-button (Base)
    // .cliente-select-tab-button--active
    const className = `cliente-select-tab-button ${active ? 'cliente-select-tab-button--active' : ''}`;

    return (
        <button
            className={className}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    );
};

export default TabButton;