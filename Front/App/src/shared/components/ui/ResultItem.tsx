import React from 'react';

interface ResultItemProps {
    children: React.ReactNode;
    selected: boolean;
    onClick: () => void;
}

const ResultItem: React.FC<ResultItemProps> = ({ children, selected, onClick }) => {
    // Classes CSS:
    // .cliente-select-result-item (Base)
    // .cliente-select-result-item--selected
    const className = `cliente-select-result-item ${selected ? 'cliente-select-result-item--selected' : ''}`;

    return (
        <div className={className} onClick={onClick}>
            {children}
        </div>
    );
};

export default ResultItem;