import React, { useState, useEffect } from 'react';
import { checkSupplier } from '../../../api/productsApi';

interface SupplierSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const SupplierSearch: React.FC<SupplierSearchProps> = ({ value, onChange, placeholder }) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (value.length >= 3) {
            // Aqui você pode integrar com a API para buscar fornecedores
            // Por enquanto, deixa como está
        }
    }, [value]);

    const styles = {
        container: {
            position: 'relative' as const,
        },
        input: {
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            fontSize: '0.9rem',
        },
        suggestions: {
            position: 'absolute' as const,
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderTop: 'none',
            borderRadius: '0 0 6px 6px',
            maxHeight: '200px',
            overflowY: 'auto' as const,
            zIndex: 10,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        },
        suggestionItem: {
            padding: '8px 12px',
            cursor: 'pointer',
            borderBottom: '1px solid #f3f4f6',
            fontSize: '0.9rem',
        },
    };

    return (
        <div style={styles.container}>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
                placeholder={placeholder || 'CNPJ do fornecedor'}
                style={styles.input}
            />
            {showSuggestions && suggestions.length > 0 && (
                <div style={styles.suggestions}>
                    {suggestions.map((suggestion, idx) => (
                        <div
                            key={idx}
                            style={styles.suggestionItem}
                            onClick={() => {
                                onChange(suggestion);
                                setShowSuggestions(false);
                            }}
                        >
                            {suggestion}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SupplierSearch;
