// src/pages/StockEntryForm.tsx (APRIMORADO)
import React, { useState, useMemo } from 'react';

// --- Interfaces (adicionando o campo mappedId para simular o mapeamento interno) ---
interface ProductEntry {
    tempId: number;
    sku: string; // SKU do Fornecedor
    mappedId?: string; // ID do produto no sistema (Seu SKU)
    name: string;
    unitPrice: number; // Preço de Custo (com impostos, simplificado)
    quantity: number;
    total: number;
}

// --- Dados Mock (Adicionando Mapeamento e Custo Variável) ---
const mockEntryItems: ProductEntry[] = [
    { tempId: 1, sku: 'AG-500', mappedId: 'PROD-123', name: 'Água Mineral 500ml', unitPrice: 1.50, quantity: 200, total: 300.00 },
    { tempId: 2, sku: 'PAO-FR', mappedId: 'PROD-456', name: 'Farinha de Trigo Kg', unitPrice: 4.80, quantity: 50, total: 240.00 },
    // Este item está sem mapeamento (necessita de ação do usuário)
    { tempId: 3, sku: 'CHOC-70', mappedId: undefined, name: 'Chocolate Amargo 70%', unitPrice: 8.50, quantity: 100, total: 850.00 }, 
];

const StockEntryForm: React.FC = () => {
    const [invoiceNumber, setInvoiceNumber] = useState('NFe 000123456');
    const [supplier, setSupplier] = useState('Distribuidora Central S.A.');
    const [entryDate, setEntryDate] = useState(new Date().toISOString().substring(0, 10));
    const [items, setItems] = useState<ProductEntry[]>(mockEntryItems);

    // --- Cálculos Dinâmicos ---
    const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items]);
    const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
    
    // Verifica se todos os itens estão mapeados antes de confirmar
    const hasUnmappedItems = items.some(item => !item.mappedId);

    const formatCurrency = (value: number): string => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // --- Manipuladores da Tabela ---

    const handleUpdateItem = (tempId: number, field: keyof ProductEntry, value: string | number) => {
        setItems(prevItems => prevItems.map(item => {
            if (item.tempId === tempId) {
                let newItem = { ...item, [field]: value };

                // Recálculo do Total
                if (field === 'quantity' || field === 'unitPrice') {
                    const qty = field === 'quantity' ? Number(value) : item.quantity;
                    const price = field === 'unitPrice' ? Number(value) : item.unitPrice;
                    
                    // Garante que o total é calculado com números válidos
                    newItem.total = isNaN(qty) || isNaN(price) ? 0 : parseFloat((qty * price).toFixed(2));
                }
                return newItem as ProductEntry;
            }
            return item;
        }));
    };
    
    const handleRemoveItem = (tempId: number) => {
        if (window.confirm('Tem certeza que deseja remover este item da lista de entrada?')) {
             setItems(items.filter(item => item.tempId !== tempId));
        }
    };

    const handleMapProduct = (tempId: number) => {
        // Simulação de abertura de modal de busca e mapeamento
        const newMappedId = prompt(`Mapear item ID ${tempId} (SKU Forn: ${items.find(i => i.tempId === tempId)?.sku}). Digite o ID do produto interno (ex: PROD-999):`);
        
        if (newMappedId) {
            handleUpdateItem(tempId, 'mappedId', newMappedId.toUpperCase().trim());
            alert(`Item ${tempId} mapeado para ${newMappedId.toUpperCase().trim()}.`);
        }
    };

    // --- Ação Final ---

    const handleConfirmEntry = () => {
        if (items.length === 0) {
            alert('Não há itens para dar entrada no estoque.');
            return;
        }
        if (hasUnmappedItems) {
            alert('ERRO: Você deve Mapear todos os produtos da NF para produtos internos antes de confirmar a entrada.');
            return;
        }

        // Lógica de envio para a API (ex: POST /api/stock/entry)
        alert(`Entrada de NF ${invoiceNumber} do fornecedor ${supplier} confirmada! ${items.length} itens adicionados e custos atualizados no estoque.`);
        // Resetar o formulário ou redirecionar
    };


    return (
        <div style={styles.container}>
            <h1 style={styles.title}>📥 Entrada de Mercadorias (Registro de NF)</h1>

            {/* ... Seção 1: Informações da Nota Fiscal (sem alteração) ... */}
            <div style={styles.panel}>
                 <h2 style={styles.panelTitle}>1. Informações da Nota Fiscal</h2>
                <div style={styles.importArea}>
                    <input type="file" style={styles.fileInput} accept=".xml" id="xml-upload"/>
                    <label htmlFor="xml-upload" style={styles.importButton}>
                        ⬆️ Importar XML da NF-e
                    </label>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                        (Recomendado: Preenche automaticamente campos e a lista de produtos)
                    </span>
                </div>

                <div style={styles.formRow}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Nº da Nota Fiscal:</label>
                        <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} style={styles.input} />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Fornecedor:</label>
                        <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} style={styles.input} />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Data da Entrada:</label>
                        <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} style={styles.input} />
                    </div>
                </div>
            </div>

            {/* --- Seção 2: Tabela de Itens da Nota (Com Edição e Mapeamento) --- */}
            <div style={{ ...styles.panel, marginTop: '20px' }}>
                <h2 style={styles.panelTitle}>2. Itens para Entrada no Estoque ({items.length} produtos)</h2>
                
                {hasUnmappedItems && (
                    <div style={styles.warningMessage}>
                        ⚠️ Atenção! **{items.filter(i => !i.mappedId).length}** item(ns) precisam de Mapeamento. Use a coluna "Mapeamento" antes de confirmar.
                    </div>
                )}
                
                <div style={styles.tableResponsive}>
                    <table style={styles.dataTable}>
                        <thead>
                            <tr style={styles.tableHead}>
                                <th style={styles.tableTh}>SKU Forn.</th>
                                <th style={styles.tableTh}>Mapeamento (Seu Cód)</th>
                                <th style={styles.tableTh}>Produto (NF)</th>
                                <th style={{ ...styles.tableTh, width: '100px' }}>Preço Unitário (Custo)</th>
                                <th style={{ ...styles.tableTh, width: '80px' }}>Quantidade</th>
                                <th style={{ ...styles.tableTh, width: '100px' }}>Total do Item</th>
                                <th style={styles.tableTh}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.tempId} style={styles.tableRow}>
                                    <td style={styles.tableCell}>{item.sku}</td>
                                    
                                    {/* --- Célula de Mapeamento --- */}
                                    <td style={{ ...styles.tableCell, ...styles.mappingCell }}>
                                        {item.mappedId ? (
                                            <span style={styles.mappedIdBadge}>ID: {item.mappedId}</span>
                                        ) : (
                                            <button 
                                                onClick={() => handleMapProduct(item.tempId)} 
                                                style={styles.mapButton}
                                            >
                                                Mapear Produto
                                            </button>
                                        )}
                                    </td>
                                    
                                    <td style={{ ...styles.tableCell, fontWeight: 500 }}>{item.name}</td>
                                    
                                    {/* --- Edição de Preço Unitário --- */}
                                    <td style={styles.tableCell}>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={item.unitPrice}
                                            onChange={(e) => handleUpdateItem(item.tempId, 'unitPrice', e.target.value)}
                                            style={styles.inputInline}
                                        />
                                    </td>
                                    
                                    {/* --- Edição de Quantidade --- */}
                                    <td style={styles.tableCell}>
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={item.quantity}
                                            onChange={(e) => handleUpdateItem(item.tempId, 'quantity', e.target.value)}
                                            style={styles.inputInline}
                                        />
                                    </td>
                                    
                                    {/* --- Total (Recálculo Automático) --- */}
                                    <td style={{ ...styles.tableCell, fontWeight: 700, color: '#10b981' }}>
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
                                    <td colSpan={7} style={{ ...styles.tableCell, textAlign: 'center', color: '#6b7280' }}>
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
                    // Desabilita se não houver itens ou se houver itens não mapeados
                    disabled={items.length === 0 || hasUnmappedItems} 
                >
                    {hasUnmappedItems ? '🚫 Mapeie os itens primeiro' : '✅ Confirmar Entrada e Atualizar Estoque'}
                </button>
            </div>
        </div>
    );
};

// --- Estilos CSS Puros (Objeto Styles) ---
const styles: { [key: string]: React.CSSProperties } = {
    // ... (Mantendo os estilos de container, title, panel, panelTitle, formRow, inputGroup, label, input)
    // ... (Mantendo os estilos de importArea, fileInput, importButton)
    // ... (Mantendo os estilos de confirmationArea, totalsBox, totalLine, totalLabel, totalValue)
    // ... (Mantendo os estilos de confirmButton, removeButton)
    
    // Adicionando novos e alterando existentes:
    
    container: { padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh', },
    title: { fontSize: '1.875rem', fontWeight: 600, color: '#1f2937', marginBottom: '24px', },
    panel: { backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', },
    panelTitle: { fontSize: '1.25rem', fontWeight: 600, color: '#374151', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', },
    importArea: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', padding: '10px', border: '1px dashed #93c5fd', backgroundColor: '#eff6ff', borderRadius: '6px', },
    fileInput: { display: 'none', },
    importButton: { padding: '10px 15px', backgroundColor: '#4f46e5', color: 'white', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', transition: 'background-color 0.15s', },
    formRow: { display: 'flex', gap: '20px', },
    inputGroup: { flex: 1, display: 'flex', flexDirection: 'column', },
    label: { fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '4px', },
    input: { padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem', },
    
    // Tabela e Células
    tableResponsive: { overflowX: 'auto', },
    dataTable: { width: '100%', borderCollapse: 'collapse', },
    tableHead: { backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', },
    tableTh: { padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', },
    tableRow: { borderBottom: '1px solid #e5e7eb', },
    tableCell: { padding: '8px 16px', textAlign: 'left', fontSize: '0.875rem', color: '#1f2937', verticalAlign: 'middle' },
    removeButton: { padding: '4px 8px', backgroundColor: '#fca5a5', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, },
    confirmButton: { padding: '15px 30px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '1.125rem', transition: 'background-color 0.15s', },
    confirmationArea: { marginTop: '20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: '20px', },
    totalsBox: { padding: '15px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#ffffff', width: '300px', },
    totalLine: { display: 'flex', justifyContent: 'space-between', fontSize: '1rem', marginBottom: '5px', },
    totalLabel: { color: '#4b5563', },
    totalValue: { fontWeight: 600, },

    // NOVOS ESTILOS
    inputInline: { // Estilo para inputs dentro da célula da tabela
        padding: '5px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        width: '100%',
        boxSizing: 'border-box',
    },
    warningMessage: {
        padding: '10px 15px',
        backgroundColor: '#fef3c7', /* bg-amber-100 */
        color: '#b45309', /* text-amber-700 */
        border: '1px solid #fcd34d',
        borderRadius: '6px',
        marginBottom: '15px',
        fontWeight: 500,
    },
    mappingCell: {
        minWidth: '150px',
        textAlign: 'center',
    },
    mapButton: {
        padding: '5px 10px',
        backgroundColor: '#f59e0b', /* bg-amber-500 */
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 600,
    },
    mappedIdBadge: {
        padding: '5px 8px',
        backgroundColor: '#d1fae5', /* bg-green-100 */
        color: '#065f46', /* text-green-800 */
        borderRadius: '4px',
        fontWeight: 600,
        fontSize: '0.8rem',
    }
};

export default StockEntryForm;