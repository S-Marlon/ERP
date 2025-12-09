// src/pages/StockAdjustmentForm.tsx
import React, { useState } from 'react';

// --- Interfaces ---
interface AdjustmentData {
    productId: string;
    productName: string;
    currentSystemStock: number;
    adjustmentType: 'POSITIVO' | 'NEGATIVO';
    quantity: number;
    reason: string;
    responsible: string;
}

// --- Dados Mock (Simulação de produto selecionado) ---
const mockProduct = {
    id: 'SKU-001',
    name: 'Café em Grãos Premium 1kg',
    systemStock: 150,
};

const StockAdjustmentForm: React.FC = () => {
    const [formData, setFormData] = useState<Omit<AdjustmentData, 'productName' | 'currentSystemStock'>>({
        productId: mockProduct.id,
        adjustmentType: 'NEGATIVO',
        quantity: 0,
        reason: '',
        responsible: 'João da Silva (Gerente)',
    });

    const handleProductSearch = () => {
        // Simulação de busca do produto no sistema
        alert(`Produto ${mockProduct.name} carregado com sucesso.`);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'quantity' ? Math.max(0, parseFloat(value)) : value }));
    };

    const handleAdjustment = (e: React.FormEvent) => {
        e.preventDefault();

        const { adjustmentType, quantity, reason, responsible } = formData;
        
        if (quantity <= 0 || !reason || !responsible) {
            alert('Preencha a quantidade, o motivo e o responsável pelo ajuste.');
            return;
        }

        const action = adjustmentType === 'POSITIVO' ? 'adicionados' : 'removidos';
        const newStock = adjustmentType === 'POSITIVO' 
            ? mockProduct.systemStock + quantity 
            : mockProduct.systemStock - quantity;

        if (adjustmentType === 'NEGATIVO' && quantity > mockProduct.systemStock) {
            alert(`Ajuste NEGATIVO de ${quantity} excede o estoque atual de ${mockProduct.systemStock}. Ajuste a quantidade.`);
            return;
        }

        const confirmation = window.confirm(
            `Confirmar AJUSTE ${adjustmentType}: ${quantity} unidades serão ${action} de "${mockProduct.name}".\n\nNovo Estoque Previsto: ${newStock}`
        );

        if (confirmation) {
            // Lógica de envio para a API (ex: POST /api/stock/adjustment)
            alert('Ajuste registrado com sucesso! O estoque foi atualizado.');
            // Resetar ou redirecionar
            setFormData({
                ...formData,
                adjustmentType: 'NEGATIVO',
                quantity: 0,
                reason: '',
            });
        }
    };

    const getNewStock = (): number => {
        if (formData.adjustmentType === 'POSITIVO') {
            return mockProduct.systemStock + formData.quantity;
        }
        return mockProduct.systemStock - formData.quantity;
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>🔍 Ajuste de Estoque (Auditoria)</h1>
            <p style={styles.subtitle}>Use esta tela para corrigir divergências entre o sistema e a contagem física (Inventário).</p>

            <form onSubmit={handleAdjustment}>
                {/* --- 1. Seleção do Produto --- */}
                <div style={styles.panel}>
                    <h2 style={styles.panelTitle}>1. Identificação do Item</h2>
                    <div style={styles.formRow}>
                        <div style={{ ...styles.inputGroup, flex: 3 }}>
                            <label style={styles.label}>Código SKU / Produto:</label>
                            <div style={styles.inputWithButton}>
                                <input
                                    type="text"
                                    value={formData.productId}
                                    style={styles.input}
                                    readOnly // Simula que o produto foi carregado
                                />
                                <button type="button" onClick={handleProductSearch} style={styles.searchButton}>
                                    Buscar Produto
                                </button>
                            </div>
                        </div>
                        <div style={{ ...styles.inputGroup, flex: 1 }}>
                            <label style={styles.label}>Estoque Atual (Sistema):</label>
                            <input
                                type="text"
                                value={mockProduct.systemStock}
                                style={{ ...styles.input, backgroundColor: '#f3f4f6' }}
                                readOnly
                            />
                        </div>
                    </div>
                    <div style={styles.productDisplay}>
                        Produto Carregado: <span style={styles.productName}>{mockProduct.name}</span>
                    </div>
                </div>

                {/* --- 2. Detalhes do Ajuste --- */}
                <div style={{ ...styles.panel, marginTop: '20px' }}>
                    <h2 style={styles.panelTitle}>2. Tipo e Quantidade do Movimento</h2>
                    <div style={styles.formRow}>
                        
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Tipo de Ajuste:</label>
                            <select
                                name="adjustmentType"
                                value={formData.adjustmentType}
                                onChange={handleChange}
                                style={{ ...styles.input, ...styles.selectInput, backgroundColor: formData.adjustmentType === 'NEGATIVO' ? '#fecaca' : '#d1fae5' }}
                            >
                                <option value="NEGATIVO">(-) Ajuste Negativo (Perda, Roubo, Dano)</option>
                                <option value="POSITIVO">(+) Ajuste Positivo (Encontrado, Estorno, Erro)</option>
                            </select>
                        </div>
                        
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Quantidade a Ajustar:</label>
                            <input
                                type="number"
                                name="quantity"
                                value={formData.quantity || ''}
                                onChange={handleChange}
                                min="1"
                                style={styles.input}
                            />
                        </div>
                        
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Estoque Previsto (Pós-Ajuste):</label>
                            <input
                                type="text"
                                value={getNewStock()}
                                style={{ ...styles.input, fontWeight: 700, backgroundColor: '#e0f2f1' }}
                                readOnly
                            />
                        </div>
                    </div>
                </div>

                {/* --- 3. Motivo e Responsável --- */}
                <div style={{ ...styles.panel, marginTop: '20px' }}>
                    <h2 style={styles.panelTitle}>3. Motivo e Autorização (Obrigatório)</h2>
                    <div style={styles.formRow}>
                        <div style={{ ...styles.inputGroup, flex: 2 }}>
                            <label style={styles.label}>Motivo Detalhado do Ajuste:</label>
                            <textarea
                                name="reason"
                                value={formData.reason}
                                onChange={handleChange}
                                style={styles.textarea}
                                rows={3}
                                required
                            />
                        </div>
                        <div style={{ ...styles.inputGroup, flex: 1 }}>
                            <label style={styles.label}>Responsável pelo Lançamento:</label>
                            <input
                                type="text"
                                name="responsible"
                                value={formData.responsible}
                                onChange={handleChange}
                                style={styles.input}
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* --- Botão de Confirmação --- */}
                <div style={styles.buttonArea}>
                    <button type="submit" style={styles.confirmButton}>
                        💾 Registrar Ajuste de Estoque
                    </button>
                </div>
            </form>
        </div>
    );
};

// --- Estilos CSS Puros (Objeto Styles) ---
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        padding: '24px',
        backgroundColor: '#f9fafb',
        minHeight: '100vh',
    },
    title: {
        fontSize: '1.875rem',
        fontWeight: 600,
        color: '#1f2937',
        marginBottom: '8px',
    },
    subtitle: {
        fontSize: '1rem',
        color: '#4b5563',
        marginBottom: '24px',
    },
    panel: {
        backgroundColor: '#ffffff',
        padding: '24px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    },
    panelTitle: {
        fontSize: '1.25rem',
        fontWeight: 600,
        color: '#374151',
        marginBottom: '16px',
        borderBottom: '1px solid #e5e7eb',
        paddingBottom: '8px',
    },
    formRow: {
        display: 'flex',
        gap: '20px',
        marginBottom: '15px',
    },
    inputGroup: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
    },
    label: {
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#374151',
        marginBottom: '4px',
    },
    input: {
        padding: '10px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '1rem',
        transition: 'border-color 0.15s',
    },
    selectInput: {
        padding: '10px 8px',
    },
    textarea: {
        padding: '10px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '1rem',
        resize: 'vertical',
    },
    inputWithButton: {
        display: 'flex',
    },
    searchButton: {
        padding: '10px 15px',
        backgroundColor: '#4f46e5',
        color: 'white',
        border: 'none',
        borderRadius: '0 6px 6px 0',
        fontWeight: 500,
        cursor: 'pointer',
        marginLeft: '-1px', // Evita borda dupla
    },
    productDisplay: {
        marginTop: '10px',
        fontSize: '1rem',
        color: '#4b5563',
    },
    productName: {
        fontWeight: 700,
        color: '#10b981',
    },
    buttonArea: {
        marginTop: '30px',
        textAlign: 'right',
    },
    confirmButton: {
        padding: '15px 30px',
        backgroundColor: '#f59e0b', /* bg-amber-500 */
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 700,
        cursor: 'pointer',
        fontSize: '1.125rem',
        transition: 'background-color 0.15s',
    },
};

export default StockAdjustmentForm;