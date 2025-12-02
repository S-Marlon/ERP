// src/pages/StockEntryForm.tsx
import React, { useState } from 'react';

// --- Interfaces ---
interface ProductEntry {
    tempId: number;
    sku: string;
    name: string;
    unitPrice: number;
    quantity: number;
    total: number;
}

// --- Dados Mock (Simulação de itens lidos de uma NF) ---
const mockEntryItems: ProductEntry[] = [
    { tempId: 1, sku: 'AG-500', name: 'Água Mineral 500ml', unitPrice: 1.50, quantity: 200, total: 300.00 },
    { tempId: 2, sku: 'PAO-FR', name: 'Farinha de Trigo Kg', unitPrice: 4.80, quantity: 50, total: 240.00 },
    { tempId: 3, sku: 'CHOC-70', name: 'Chocolate Amargo 70%', unitPrice: 8.50, quantity: 100, total: 850.00 },
];

const StockEntryForm: React.FC = () => {
    const [invoiceNumber, setInvoiceNumber] = useState('NFe 000123456');
    const [supplier, setSupplier] = useState('Distribuidora Central S.A.');
    const [entryDate, setEntryDate] = useState(new Date().toISOString().substring(0, 10));
    const [items, setItems] = useState<ProductEntry[]>(mockEntryItems);

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

    const handleConfirmEntry = () => {
        if (items.length === 0) {
            alert('Não há itens para dar entrada no estoque.');
            return;
        }
        // Lógica de envio para a API (ex: POST /api/stock/entry)
        alert(`Entrada de NF ${invoiceNumber} do fornecedor ${supplier} confirmada! ${items.length} itens adicionados ao estoque.`);
        // Resetar o formulário ou redirecionar
    };

    const handleRemoveItem = (tempId: number) => {
        setItems(items.filter(item => item.tempId !== tempId));
    };

    const formatCurrency = (value: number): string => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>📥 Entrada de Mercadorias (Registro de NF)</h1>

            {/* --- Seção de Importação / Dados da NF --- */}
            <div style={styles.panel}>
                <h2 style={styles.panelTitle}>1. Informações da Nota Fiscal</h2>
                <div style={styles.importArea}>
                    <input type="file" style={styles.fileInput} accept=".xml" id="xml-upload"/>
                    <label htmlFor="xml-upload" style={styles.importButton}>
                        ⬆️ Importar XML da NF-e
                    </label>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                        (Recomendado: Preenche automaticamente os campos abaixo e a lista de produtos)
                    </span>
                </div>

                <div style={styles.formRow}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Nº da Nota Fiscal:</label>
                        <input
                            type="text"
                            value={invoiceNumber}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            style={styles.input}
                        />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Fornecedor:</label>
                        <input
                            type="text"
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            style={styles.input}
                        />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Data da Entrada:</label>
                        <input
                            type="date"
                            value={entryDate}
                            onChange={(e) => setEntryDate(e.target.value)}
                            style={styles.input}
                        />
                    </div>
                </div>
            </div>

            {/* --- Tabela de Itens da Nota --- */}
            <div style={{ ...styles.panel, marginTop: '20px' }}>
                <h2 style={styles.panelTitle}>2. Itens para Entrada no Estoque ({items.length} produtos)</h2>
                
                <div style={styles.tableResponsive}>
                    <table style={styles.dataTable}>
                        <thead>
                            <tr style={styles.tableHead}>
                                <th>SKU</th>
                                <th>Produto (NF)</th>
                                <th>Preço Unitário (Custo)</th>
                                <th>Quantidade</th>
                                <th>Total do Item</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.tempId} style={styles.tableRow}>
                                    <td style={styles.tableCell}>{item.sku}</td>
                                    <td style={{ ...styles.tableCell, fontWeight: 500 }}>{item.name}</td>
                                    <td style={{ ...styles.tableCell, color: '#059669' /* text-green-600 */ }}>
                                        {formatCurrency(item.unitPrice)}
                                    </td>
                                    <td style={styles.tableCell}>{item.quantity}</td>
                                    <td style={{ ...styles.tableCell, fontWeight: 700 }}>
                                        {formatCurrency(item.total)}
                                    </td>
                                    <td style={styles.tableCell}>
                                        <button onClick={() => handleRemoveItem(item.tempId)} style={styles.removeButton}>
                                            Remover
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr style={styles.tableRow}>
                                    <td colSpan={6} style={{ ...styles.tableCell, textAlign: 'center', color: '#6b7280' }}>
                                        Nenhum item carregado. Importe o XML ou adicione manualmente.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- Área de Totais e Confirmação --- */}
            <div style={styles.confirmationArea}>
                <div style={styles.totalsBox}>
                    <p style={styles.totalLine}>
                        <span style={styles.totalLabel}>Total de Itens Físicos:</span>
                        <span style={styles.totalValue}>{totalItems}</span>
                    </p>
                    <p style={{ ...styles.totalLine, borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
                        <span style={{ ...styles.totalLabel, fontWeight: 700 }}>Valor Total da Entrada:</span>
                        <span style={{ ...styles.totalValue, color: '#10b981', fontSize: '1.5rem' }}>
                            {formatCurrency(subtotal)}
                        </span>
                    </p>
                </div>
                
                <button 
                    onClick={handleConfirmEntry} 
                    style={styles.confirmButton}
                    disabled={items.length === 0}
                >
                    ✅ Confirmar Entrada e Atualizar Estoque
                </button>
            </div>
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
    importArea: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        padding: '10px',
        border: '1px dashed #93c5fd',
        backgroundColor: '#eff6ff',
        borderRadius: '6px',
    },
    fileInput: {
        display: 'none',
    },
    importButton: {
        padding: '10px 15px',
        backgroundColor: '#4f46e5',
        color: 'white',
        borderRadius: '6px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background-color 0.15s',
    },
    formRow: {
        display: 'flex',
        gap: '20px',
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
    },
    
    // Estilos da Tabela
    tableResponsive: {
        overflowX: 'auto',
    },
    dataTable: {
        width: '100%',
        borderCollapse: 'collapse',
    },
    tableHead: {
        backgroundColor: '#f9fafb',
        borderBottom: '2px solid #e5e7eb',
    },
    tableRow: {
        borderBottom: '1px solid #e5e7eb',
    },
    tableCell: {
        padding: '12px 16px',
        textAlign: 'left',
        fontSize: '0.875rem',
        color: '#1f2937',
    },
    removeButton: {
        padding: '4px 8px',
        backgroundColor: '#fca5a5',
        color: '#991b1b',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: 600,
    },
    
    // Estilos da Confirmação
    confirmationArea: {
        marginTop: '20px',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        gap: '20px',
    },
    totalsBox: {
        padding: '15px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        backgroundColor: '#ffffff',
        width: '300px',
    },
    totalLine: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '1rem',
        marginBottom: '5px',
    },
    totalLabel: {
        color: '#4b5563',
    },
    totalValue: {
        fontWeight: 600,
    },
    confirmButton: {
        padding: '15px 30px',
        backgroundColor: '#10b981', /* bg-emerald-500 */
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 700,
        cursor: 'pointer',
        fontSize: '1.125rem',
        transition: 'background-color 0.15s',
    },
};

export default StockEntryForm;