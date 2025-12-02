// src/pages/StockInventory.tsx
import React, { useState } from 'react';

// --- Interfaces ---
interface Product {
    id: number;
    sku: string;
    name: string;
    category: string;
    currentStock: number;
    minStock: number;
    salePrice: number;
    status: 'Ativo' | 'Inativo';
}

// --- Dados Mock ---
const mockProducts: Product[] = [
    { id: 1001, sku: 'AG-500', name: 'Água Mineral 500ml', category: 'Bebidas', currentStock: 350, minStock: 50, salePrice: 2.50, status: 'Ativo' },
    { id: 1002, sku: 'PAO-FR', name: 'Pão Francês Kg', category: 'Padaria', currentStock: 15, minStock: 30, salePrice: 15.00, status: 'Ativo' },
    { id: 1003, sku: 'AZ-EVO', name: 'Azeite Extra Virgem 500ml', category: 'Mercearia', currentStock: 5, minStock: 10, salePrice: 35.90, status: 'Ativo' },
    { id: 1004, sku: 'CHOC-70', name: 'Chocolate Amargo 70%', category: 'Doces', currentStock: 80, minStock: 20, salePrice: 12.00, status: 'Ativo' },
    { id: 1005, sku: 'LIM-G', name: 'Limão Galego Kg', category: 'Hortifruti', currentStock: 12, minStock: 15, salePrice: 6.99, status: 'Ativo' },
    { id: 1006, sku: 'SERV-P', name: 'Serviço de Entrega Premium', category: 'Serviços', currentStock: 999, minStock: 0, salePrice: 10.00, status: 'Inativo' },
];

const StockInventory: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('Todos');

    const categories = Array.from(new Set(mockProducts.map(p => p.category)));

    const filteredProducts = mockProducts.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              product.sku.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'Todos' || product.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    // Função para determinar a classe de status do estoque
    const getStockStatusStyle = (current: number, min: number): React.CSSProperties => {
        if (current <= 0) return styles.stockCritical;
        if (current <= min) return styles.stockWarning;
        return styles.stockOk;
    };

    const formatCurrency = (value: number): string => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
    
    // Simulação da navegação (substituir por useNavigate em um projeto real)
    const handleEditProduct = (id: number) => {
        alert(`Navegando para a página de edição do Produto ID: ${id}`);
    };

    return (
        <div style={styles.inventoryContainer}>
            <div style={styles.inventoryHeader}>
                <h1 style={styles.inventoryTitle}>📝 Inventário Principal (Lista de Produtos)</h1>
                <button 
                    style={{ ...styles.newProductButton, backgroundColor: '#2563eb' /* blue-600 */ }}
                    onClick={() => alert('Navegando para Nova Página de Cadastro...')}
                >
                    <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>+</span> Novo Produto
                </button>
            </div>

            {/* --- Área de Busca e Filtros --- */}
            <div style={styles.searchFilterArea}>
                <input
                    type="text"
                    placeholder="Buscar por nome ou SKU..."
                    style={styles.searchInput}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                    style={styles.filterSelect}
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                >
                    <option value="Todos">Todas as Categorias</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                <button 
                    style={{ ...styles.newProductButton, backgroundColor: '#4f46e5' /* indigo-600 */ }}
                    onClick={() => alert('Filtros Aplicados!')}
                >
                    Aplicar Filtros
                </button>
            </div>

            {/* --- Tabela de Produtos --- */}
            <div style={styles.inventoryPanel}>
                <div style={styles.tableResponsive}>
                    <table style={styles.dataTable}>
                        <thead>
                            <tr style={styles.tableHead}>
                                <th style={styles.tableTh}>Cód. SKU</th>
                                <th style={styles.tableTh}>Nome do Produto</th>
                                <th style={styles.tableTh}>Categoria</th>
                                <th style={styles.tableTh}>Estoque Atual</th>
                                <th style={styles.tableTh}>Preço de Venda</th>
                                <th style={styles.tableTh}>Status</th>
                                <th style={styles.tableTh}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.length > 0 ? (
                                filteredProducts.map((product) => (
                                    <tr key={product.id} style={styles.tableRow}>
                                        <td style={{ ...styles.tableTd, fontWeight: 500, color: '#1f2937' /* gray-900 */ }}>{product.sku}</td>
                                        <td style={styles.tableTd}>{product.name}</td>
                                        <td style={styles.tableTd}>{product.category}</td>
                                        <td style={{ ...styles.tableTd, ...getStockStatusStyle(product.currentStock, product.minStock) }}>
                                            {product.currentStock}
                                        </td>
                                        <td style={styles.tableTd}>{formatCurrency(product.salePrice)}</td>
                                        <td style={styles.tableTd}>
                                            <span style={product.status === 'Ativo' ? styles.statusActive : styles.statusInactive}>
                                                {product.status}
                                            </span>
                                        </td>
                                        <td style={styles.tableTd}>
                                            <button 
                                                style={styles.editButton} 
                                                onClick={() => handleEditProduct(product.id)}
                                            >
                                                Detalhes/Editar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr style={styles.tableRow}>
                                    <td colSpan={7} style={{ ...styles.tableTd, textAlign: 'center', color: '#6b7280' }}>
                                        Nenhum produto encontrado com os filtros aplicados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

// --- Estilos CSS Puros (Objeto Styles) ---
const styles: { [key: string]: React.CSSProperties } = {
    inventoryContainer: {
        padding: '24px',
        backgroundColor: '#f9fafb',
        minHeight: '100vh',
    },
    inventoryHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
    },
    inventoryTitle: {
        fontSize: '1.875rem',
        fontWeight: 600,
        color: '#1f2937',
    },
    searchFilterArea: {
        display: 'flex',
        gap: '16px',
        marginBottom: '24px',
        alignItems: 'center',
    },
    searchInput: {
        flexGrow: 1,
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '1rem',
    },
    filterSelect: {
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '1rem',
        backgroundColor: 'white',
        minWidth: '200px',
    },
    newProductButton: {
        padding: '10px 16px',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background-color 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    inventoryPanel: {
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
    },
    tableResponsive: {
        overflowX: 'auto',
    },
    dataTable: {
        width: '100%',
        borderCollapse: 'collapse',
    },
    tableHead: {
        backgroundColor: '#f9fafb',
    },
    tableTh: {
        padding: '12px 24px',
        textAlign: 'left',
        whiteSpace: 'nowrap',
        fontSize: '0.75rem',
        fontWeight: 500,
        color: '#6b7280',
        textTransform: 'uppercase',
        borderBottom: '1px solid #e5e7eb',
    },
    tableTd: {
        padding: '16px 24px',
        fontSize: '0.875rem',
        color: '#374151',
        borderBottom: '1px solid #e5e7eb',
    },
    // Estilos de Status do Estoque
    stockOk: {
        color: '#059669', /* text-green-600 */
        fontWeight: 600,
    },
    stockWarning: {
        color: '#d97706', /* text-amber-600 */
        fontWeight: 600,
    },
    stockCritical: {
        color: '#dc2626', /* text-red-600 */
        fontWeight: 600,
    },
    // Estilos de Status Ativo/Inativo
    statusActive: {
        fontSize: '0.75rem',
        padding: '2px 8px',
        borderRadius: '4px',
        border: '1px solid #34d399',
        color: '#065f46',
        backgroundColor: '#ecfdf5',
        fontWeight: 600,
    },
    statusInactive: {
        fontSize: '0.75rem',
        padding: '2px 8px',
        borderRadius: '4px',
        border: '1px solid #9ca3af',
        color: '#4b5563',
        backgroundColor: '#f3f4f6',
        fontWeight: 600,
    },
    editButton: {
        color: '#4f46e5',
        fontWeight: 600,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        transition: 'color 0.15s',
        padding: '0',
    },
};

export default StockInventory;