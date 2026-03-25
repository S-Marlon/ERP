import React, { useState, useContext, useEffect } from "react";
import { Product } from './types/Stock_Products';


// Importe a função da API
import { getProducts } from "./service/productService";

// import { ProductContext } from "../../../context/ProductContext";
import ProductDetails from "./_components/ProductDetails";
import NovoProdutoForm from "./_components/NovoProdutoForm";
import ImageDisplay from "../../../../components/ui/ImageGallery/ImageDysplay";
import UniversalInventory from "../../../../components/Layout/UniversalInventory/UniversalInventory";


// Componentes
// import ProductHeader from "../Components/ProductHeader"; // Não usado



const StockInventory: React.FC = () => {

    // 1. Estados de Dados e UI

    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('Todos');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);


    
  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;

    // Escapa caracteres especiais e cria uma Regex global e insensível a maiúsculas
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} style={{ backgroundColor: '#ffeb3b', padding: '2px', borderRadius: '2px' }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };


  // 2. Funções de Auxílio e Formatação
    const formatCurrency = (value: number): string => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };


  


    const columns = [
        { header: 'ID', key: 'id' },
        { header: 'SKU', key: 'sku' },
        {
            header: 'Status', key: 'status', render: (item: Product) => (
                <span style={{
                    ...(item.status === 'Ativo' ? styles.statusActive : styles.statusInactive),
                    fontSize: '0.7rem',
                    padding: '2px 8px'
                }}>
                    {item.status}
                </span>
            )
        },
        {
            header: 'Imagem', key: 'pictureUrl', render: (item: Product) => (
                <ImageDisplay src={item.pictureUrl
                    ? item.pictureUrl

                    : 'https://via.placeholder.com/60?text=Sem+Imagem'}
                    size="60px"
                    rounded="50%"
                />
            )
        },
        { header: 'Produto & Marca & Categoria', key: 'name', render: (item: Product) => (
             <div >
                      <strong style={styles.partPrimaryStrong}>{highlightText(item.name, searchTerm)}</strong>
                      {'sku' in item && <code style={styles.partPrimaryCode}>{item.category}</code>}
                    </div>
        ) },
        { header: 'Marca', key: 'brand' },
        {
            header: 'Estoque',
            key: 'stock',
            render: (item: Product) => (
                <span style={item.currentStock <= 5 ? { color: 'red', fontWeight: 'bold' } : {}}>
                    {item.currentStock} un
                </span>
            )
        },
        {
            header: 'Custo Médio',
            key: 'costPrice',
            render: (item: Product) => {
               <span>  
                {item.costPrice}
</span>

            }
        },
        {
            header: 'Preço',
            key: 'price',
            render: (item: Product) => {
<span>  
                {item.salePrice}
</span>
            }
        },
        {
            header: 'Fornecedor',
            key: 'supplier',
            render: (item: Product) => item.suppliers || 'N/A'
        },
        {
            header: 'Ações',
            key: 'actions',
            render: (item: Product) => (
                <button onClick={() => handleSelectProduct(item)} style={styles.editButton}>
                    👁️ Detalhes
                </button>
            )
        }
    ];



// 4. Busca de Dados
    useEffect(() => {
        const fetchProductsData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getProducts(searchTerm);
                setProducts(Array.isArray(data) ? data : []);
            } catch (err) {
                setError("Erro ao carregar lista de produtos.");
            } finally {
                setIsLoading(false);
            }
        };

        const delayDebounceFn = setTimeout(() => fetchProductsData(), 300);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    // 5. Filtragem Local (Categoria)
    const filteredProducts = products.filter(product => {
        return filterCategory === 'Todos' || product.category === filterCategory;
    });

    const categories = Array.from(new Set(products.map(p => p.category)));

    const handleSelectProduct = async (product: Product) => {
        try {
            const detailed = await getProductById(product.id);
            setSelectedProduct(detailed);
        } catch (err) {
            setSelectedProduct(product);
        }
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
                        {isLoading && <span style={{ fontSize: '0.8rem', color: '#666' }}>Carregando...</span>}
                    </div>
                    <div style={styles.inventoryPanel}>
                        <div style={styles.tableResponsive}>

                            <div style={styles.inventoryPanel}>
                                {/* O UniversalInventory agora cuida da busca, paginação e filtros de ordenação */}
                                <UniversalInventory<Product>
                                              data={filteredProducts}
                                    columns={columns}
                                    displayMode="lista"
                                    moneyFormatter={formatCurrency}
                                    onAdd={handleSelectProduct} // Se quiser que o "+" selecione o produto

                                />
                            </div>


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

    partPrimaryStrong: { // Ajustado para nome de objeto
        display: 'block',
        fontSize: '0.95rem',
    },
    partPrimaryCode: { 
        fontSize: '0.75rem',
        background: '#f1f5f9',
        padding: '2px 4px',
        borderRadius: '4px',
        color: 'var(--primary)',
    },

};

export default StockInventory;