// src/pages/StockInventory.tsx

import React, { useState, useContext, useEffect } from "react";
import { Product } from './types/Stock_Products';


// Importe a função da API
import { getProducts } from "./service/productService";

// Se você não tem ProductContext/FilterState, remova as linhas abaixo
// import { ProductContext } from "../../../context/ProductContext";
import TableHeader from "./_components/TableHeader";
import ProductFilter from "../../../../components/forms/search/ProductFilter";
import ProductDetails from "./_components/ProductDetails";
import NovoProdutoForm from "./_components/NovoProdutoForm";
import ImageDisplay from "../../../../components/ui/ImageGallery/ImageDysplay";
// import ProductHeader from "../Components/ProductHeader"; // Não usado





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
                // Enviamos o searchTerm exatamente como está (mesmo vazio "")
                const data = await getProducts(searchTerm);
                setProducts(Array.isArray(data) ? data : []);
            } catch (err: any) {
                console.error("Erro ao buscar produtos:", err);
                setError("Erro ao carregar lista de produtos.");
            } finally {
                setIsLoading(false);
            }
        };

        const delayDebounceFn = setTimeout(() => {
            fetchProductsData();
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]); // searchTerm vazio agora dispara a busca normalmente

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
    const handleSelectProduct = async (product: Product) => {
        // ao clicar num produto, buscamos o registro completo (inclui estoque atual atualizado)
        try {
            const detailed = await getProductById(product.id);
            setSelectedProduct(detailed);
        } catch (err: any) {
            console.error('Falha ao carregar produto detalhado:', err);
            // fallback para o objeto simples caso a chamada falhe
            setSelectedProduct(product);
        }
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



            {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

            <div style={styles.contentArea}>
                <div style={styles.tableColumn}>
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
                    <TableHeader productCount={filteredProducts.length} />
                    <div style={styles.inventoryPanel}>
                        <div style={styles.tableResponsive}>
                            <table style={styles.dataTable}>
                                <thead style={styles.tableHead}>
    <tr style={styles.tableHead}>
        <th style={styles.tableTh}>ID</th>
        <th style={styles.tableTh}>Código / GTIN</th>
        <th style={styles.tableTh}>Imagem</th>
        <th style={styles.tableTh}>Produto & Marca & Categoria </th>
        <th style={styles.tableTh}>Estoque (UdM)</th>
        <th style={styles.tableTh}>Custo Médio</th>
        <th style={styles.tableTh}>Venda (Markup)</th>
        <th style={styles.tableTh}>Últ. Fornecedor</th>
        <th style={styles.tableTh}>Status</th>
    </tr>
</thead>
                                <tbody>
    {filteredProducts.length > 0 ? (
        filteredProducts.map((product, index) => {
            // Lógica para cor do estoque
            const isStockLow = product.currentStock <= product.minStock;
            
            return (
                <tr
                    key={product.id}
                    style={{
                        ...styles.tableRow,
                        backgroundColor: selectedProduct?.id === product.id ? '#f3f4f6' : 'white',
                        cursor: 'pointer'
                    }}
                    onClick={() => handleSelectProduct(product)}
                >
                    {/* # - Numeração formatada */}
                    <td style={styles.tableTd}>{(index + 1).toString().padStart(2, '0')}</td>

                    {/* Cód. Interno */}
                    <td style={styles.tableTd}>
                        <span style={{ fontWeight: 500, color: '#4b5563' }}>{product.sku}</span>
                        {product.barcode && (
                            <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{product.barcode}</div>
                        )}
                    </td>

                    {/* Imagem */}
                    <td style={styles.tableTd}>
                        
                            <ImageDisplay src={product.pictureUrl}  size="60px"
                            rounded="50%" />
                        
                    </td>



                    {/* Nome & Categoria */}
                    <td style={styles.tableTd}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 500 }}>{product.name}</span>
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                <small style={{ color: '#9ca3af', fontSize: '0.7rem' }}>{product.category || 'Sem Categoria'}</small>
                                {product.brand && (
                                    <small style={{ color: '#6366f1', fontSize: '0.7rem', fontWeight: 'bold' }}>• {product.brand}</small>
                                )}
                            </div>
                        </div>
                    </td>

                    {/* Unidade */}
                    <td style={styles.tableTd}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>

                            <span style={{ 
                                fontWeight: 'bold', 
                                color: isStockLow ? '#ef4444' : '#10b981' 
                            }}>
                                {Number(product.currentStock).toLocaleString('pt-BR')}
                            </span>
                            {isStockLow && (
                                <span title={`Estoque crítico! Mínimo: ${product.minStock}`} style={{ cursor: 'help' }}>⚠️</span>
                            )}
                            ({product.unitOfMeasure || 'UN'})
                        </div>
                    </td>

                   

                    {/* Coluna de Custo Médio */}
<td style={styles.tableTd}>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ color: '#6b7280' }}>
            R$ {formatCurrency(product.costPrice || 0)}
        </span>
        {/* <small style={{ fontSize: '0.6rem', color: '#9ca3af' }}>Custo Médio</small> */}
    </div>
</td>

{/* Coluna de Preço de Venda (Já ajustada para mostrar a margem real) */}
<td style={styles.tableTd}>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 600, color: '#111827' }}>
            R$ {formatCurrency(product.salePrice)}
        </span>
        <small style={{ 
            color: '#059669', 
            fontSize: '0.65rem', 
            fontWeight: 'bold' 
        }}>
            {/* Cálculo de Margem Simples: (Venda - Custo) / Venda */}
            Margem: {product.costPrice > 0 
                ? (((product.salePrice - product.costPrice) / product.salePrice) * 100).toFixed(0) 
                : 0}%

            
        </small>
    </div>
</td>   

                  

                    

                    {/* Fornecedores */}
                    <td style={styles.tableTd}>
                        {product.suppliers ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                <span style={{
                                    backgroundColor: '#eff6ff',
                                    color: '#1d4ed8',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid #bfdbfe',
                                    fontSize: '0.75rem',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {product.suppliers.split(',')[0]}
                                    {product.suppliers.split(',').length > 1 && (
                                        <span style={{ fontWeight: 'bold', marginLeft: '4px' }}>
                                            +{product.suppliers.split(',').length - 1}
                                        </span>
                                    )}
                                </span>
                            </div>
                        ) : (
                            <span style={{ color: '#d1d5db', fontSize: '0.75rem' }}>-</span>
                        )}
                    </td>

                    {/* Status */}
                    <td style={styles.tableTd}>
                        <span style={{
                            ...(product.status === 'Ativo' ? styles.statusActive : styles.statusInactive),
                            fontSize: '0.7rem',
                            padding: '2px 8px'
                        }}>
                            {product.status}
                        </span>
                    </td>
                </tr>
            );
        })
    ) : (
        <tr>
            <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                {isLoading ? "Buscando dados no servidor..." : "Nenhum produto cadastrado com este critério."}
            </td>
        </tr>
    )}
</tbody>
                            </table>


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
    display: 'grid',
    // O segredo está no minmax(0, ...) para ambas as colunas
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
    gap: '20px',
    alignItems: 'flex-start',
    width: '100%',
    overflow: 'hidden', // Evita que o grid vaze para fora do container principal
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
        padding: '8px 20px',
        textAlign: 'center',
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
        padding: '12px 20px',
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