// src/pages/StockInventory.tsx

import React, { useState, useContext, useEffect } from "react";
import { Product, FilterState } from "../../../../types/types"; // Importando tipos globais (Ajuste o caminho se necessário)

// Importe a função da API
import { searchProducts, searchProductsMapping } from "../../api/productsApi";

// Se você não tem ProductContext/FilterState, remova as linhas abaixo
// import { ProductContext } from "../../../context/ProductContext";
import TableHeader from "./_components/TableHeader";
import ProductFilter from "./_components/ProductFilter";
import ProductDetails from "./_components/ProductDetails";
import NovoProdutoForm from "./_components/NovoProdutoForm";
// import ProductHeader from "../Components/ProductHeader"; // Não usado



// --- Interfaces (Mantenha aqui se 'types/types' for inacessível ou se precisar de uma definição local) ---
// interface Product {
//     id: number;
//     sku: string;
//     name: string;
//     category: string;
//     currentStock: number;
//     minStock: number;
//     salePrice: number;
//     status: 'Ativo' | 'Inativo';
//     fornecedor?: string;
// }

interface Product {
    id: number;
    sku: string;         // Mapeado de codigo_interno
    name: string;        // Mapeado de descricao
    category: string;
    currentStock: number;
    minStock: number;
    salePrice: number;
    status: 'Ativo' | 'Inativo';
    fornecedor?: string;
}

// Assumindo que FilterState existe em outro lugar, mas definindo localmente para evitar erros de compilação
interface FilterState {
    status: string;
    category: string;
    minPrice: number | undefined;
    maxPrice: number;
    minStock: number;
    maxStock: number;
    clientName: string;
    clientEmail: string;
    clientCpf: string;
    clientPhone: string;
    orderNumber: string;
    serviceType: string;
    date: string;
    paymentMethod: string;
}




const StockInventory: React.FC = () => {

    // 1. Estados de Dados e UI

    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('Todos');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);




    // Estados e Funções de Filtro Completo (Não totalmente integrados à lógica da tabela, mas mantidos)
    const [filters, setFilters] = useState<FilterState>({
        status: "", category: "", minPrice: "", maxPrice: "", minStock: "", maxStock: "",
        clientName: "", clientEmail: "", clientCpf: "", clientPhone: "",
        orderNumber: "", serviceType: "", date: "", paymentMethod: "",
    });

    // 2. Efeito de Busca na API com Debounce
    useEffect(() => {
        const fetchProductsData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Agora chamamos a API sempre, mesmo se searchTerm for ""
                const data = await searchProductsMapping(searchTerm);
                setProducts(data);
            } catch (err: any) {
                console.error("Erro ao buscar produtos:", err);
                setError("Erro ao carregar lista de produtos.");
            } finally {
                setIsLoading(false);
            }
        };

        const delayDebounceFn = setTimeout(() => {
            fetchProductsData();
        }, 300); // Debounce um pouco mais rápido

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]); // Dispara sempre que o termo mudar

    const handleFilterChange = (
        key: keyof FilterState,
        value: string | number | boolean
    ) => {
        setFilters((prevFilters) => ({
            ...prevFilters,
            [key]: value,
        }));
    };

    // 3. Filtragem de Categoria (Ainda local, baseada no resultado da API)
    const filteredProducts = products.filter(product => {
        return filterCategory === 'Todos' || product.category === filterCategory;
    });

    // 4. Extração dinâmica de categorias dos produtos que vieram da API
    const categories = Array.from(new Set(products.map(p => p.category)));



    // Funções Auxiliares
    // const getStockStatusStyle = (current: number, min: number): React.CSSProperties => {
    //     if (current <= 0) return styles.stockCritical;
    //     if (current <= min) return styles.stockWarning;
    //     return styles.stockOk;
    // };

    const formatCurrency = (value: number): string => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // NOVA FUNÇÃO: Seleciona o produto e atualiza o estado
    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
    };

    // Função de edição anterior (modificada para apenas um alert, pois a linha agora seleciona)
    const handleEditProductClick = (product: Product) => {
        alert(`Navegando para a página de edição detalhada do Produto ID: ${product.id}`);
    };

    const getStockStatusStyle = (current: number, min: number): React.CSSProperties => {
        if (current <= 0) return { color: '#dc2626', fontWeight: 'bold' }; // Crítico (Vermelho)
        if (current <= min) return { color: '#d97706', fontWeight: 'bold' }; // Alerta (Laranja)
        return { color: '#059669' }; // OK (Verde)
    };

    return (
        <div style={styles.inventoryContainer}>
            <div style={styles.inventoryHeader}>
                <h1 style={styles.inventoryTitle}>📝 Inventário Principal</h1>
                <button
                    style={{ ...styles.newProductButton, backgroundColor: '#2563eb' }}
                    onClick={() => setIsModalOpen(true)}
                >
                    + Novo Produto
                </button>
            </div>

            <div style={styles.searchFilterArea}>
                <input
                    type="text"
                    placeholder="Buscar por nome ou SKU na API..."
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
                <ProductFilter filters={filters} onFilterChange={handleFilterChange} onApply={() => console.log("Aplicar filtros avançados")} onReset={() => console.log("Resetar filtros avançados")} />
                {isLoading && <span style={{ fontSize: '0.8rem', color: '#666' }}>Carregando...</span>}
            </div>

            {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

            <div style={styles.contentArea}>
                <div style={styles.tableColumn}>
                    <TableHeader productCount={filteredProducts.length} />
                    <div style={styles.inventoryPanel}>
                        <div style={styles.tableResponsive}>
                            <table style={styles.dataTable}>
                                <thead>
                                    <tr style={styles.tableHead}>
                                        <th style={styles.tableTh}>#</th>
                                        <th style={styles.tableTh}>Cód. Interno</th>
                                        <th style={styles.tableTh}>Nome</th>
                                        <th style={styles.tableTh}>Unidade</th>
                                        <th style={styles.tableTh}>Estoque</th>
                                        <th style={styles.tableTh}>Preço</th>
                                        <th style={styles.tableTh}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>

                                    {filteredProducts.length > 0 ? (
                                        filteredProducts.map((product, index) => (
                                            <tr
                                                key={product.id}
                                                style={{
                                                    ...styles.tableRow,
                                                    backgroundColor: selectedProduct?.id === product.id ? '#f3f4f6' : 'white',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => handleSelectProduct(product)}
                                            >
                                                {/* Numeração formatada */}
                                                <td style={styles.tableTd}>{(index + 1).toString().padStart(2, '0')}</td>

                                                {/* SKU (Código Interno) */}
                                                <td style={styles.tableTd}>
                                                    <span style={{ fontWeight: 500, color: '#4b5563' }}>{product.sku}</span>
                                                </td>

                                                {/* Nome e Categoria */}
                                                <td style={styles.tableTd}>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span>{product.name}</span>
                                                        <small style={{ color: '#9ca3af', fontSize: '0.7rem' }}>{product.category}</small>
                                                    </div>
                                                </td>


                                                <td style={styles.tableTd}>
                                                    UN
                                                </td>

                                                {/* Estoque com Alerta Visual */}
                                                <td style={{
                                                    ...styles.tableTd,
                                                    ...getStockStatusStyle(product.currentStock, product.minStock)
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {product.currentStock}
                                                        {product.currentStock <= product.minStock && <span>⚠️</span>}
                                                    </div>
                                                </td>

                                                {/* Preço de Venda */}
                                                <td style={styles.tableTd}>{formatCurrency(product.salePrice)}</td>



                                                {/* Status e Ações */}
                                                <td style={styles.tableTd}>
                                                    <span style={product.status === 'Ativo' ? styles.statusActive : styles.statusInactive}>
                                                        {product.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                                {isLoading ? "Carregando produtos..." : "Nenhum produto encontrado."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* <table style={styles.dataTable}>
                                <thead>
                                    <tr style={styles.tableHead}>
                                        <th style={styles.tableTh}>#</th>
                                        <th style={styles.tableTh}>Cód. SKU</th>
                                        <th style={styles.tableTh}>Nome</th>
                                        <th style={styles.tableTh}>Estoque</th>
                                        <th style={styles.tableTh}>Preço</th>
                                        <th style={styles.tableTh}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProducts.length > 0 ? (
                                        filteredProducts.map((product, index) => (
                                            <tr 
                                                key={product.id} 
                                                style={{
                                                    ...styles.tableRow, 
                                                    cursor: 'pointer', 
                                                    backgroundColor: selectedProduct?.id === product.id ? '#eef2ff' : 'white'
                                                }}
                                                onClick={() => setSelectedProduct(product)}
                                            >
                                                <td style={styles.tableTd}>{(index + 1).toString().padStart(2, '0')}</td>
                                                <td style={styles.tableTd}>{product.sku}</td>
                                                <td style={styles.tableTd}>{product.name}</td>
                                                <td style={{ ...styles.tableTd, ...getStockStatusStyle(product.currentStock, product.minStock) }}>
                                                    {product.currentStock}
                                                </td>
                                                <td style={styles.tableTd}>{formatCurrency(product.salePrice)}</td>
                                                <td style={styles.tableTd}>
                                                    <button 
                                                        style={styles.editButton} 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            alert(`Editando ${product.id}`);
                                                        }}
                                                    >
                                                        Editar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} style={{ ...styles.tableTd, textAlign: 'center' }}>
                                                {isLoading ? "Buscando produtos..." : "Nenhum produto encontrado."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table> */}
                        </div>
                    </div>
                </div>

                <div style={styles.detailsColumn}>
                    <ProductDetails
                        product={selectedProduct}
                        onEdit={(p) => alert(`Editando ${p.name}`)}
                    />
                </div>
            </div>
            <NovoProdutoForm
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={(newProd) => {
                    console.log("Novo produto a ser enviado para API:", newProd);
                    // Aqui você chamaria sua função de API de criação
                }}
            />
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

    // NOVOS ESTILOS PARA LAYOUT LADO A LADO
    contentArea: {
        display: 'flex',
        gap: '24px',
        alignItems: 'flex-start',
    },
    tableColumn: {
        flex: 3, // Tabela ocupa 3/4 do espaço
        minWidth: 0,
    },
    detailsColumn: {
        flex: 1, // Detalhes ocupa 1/4 do espaço
        backgroundColor: '#ffffff',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        minHeight: '300px',
        position: 'sticky',
        top: '24px',
    },
    noSelectionMessage: {
        textAlign: 'center',
        padding: '40px 16px',
        color: '#9ca3af',
        fontSize: '1rem',
        fontWeight: 500,
    },
    // FIM DOS NOVOS ESTILOS

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
    tableRow: {
        transition: 'background-color 0.2s',
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