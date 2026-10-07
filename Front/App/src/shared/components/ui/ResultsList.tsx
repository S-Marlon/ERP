import React from 'react';

interface ResultsListProps {
    children: React.ReactNode;
}

const ResultsList: React.FC<ResultsListProps> = ({ children }) => {
    // Classe CSS: .cliente-select-results-list (Lidar com maxHeight e overflow)
    return (
        <div className="cliente-select-results-list">
            {children}
        </div>
    );
};

export default ResultsList;