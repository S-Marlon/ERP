import { useEffect, useState, useMemo, useCallback } from "react";

// --- Interface de Entrada (Simulada) ---
// Adapte esta interface para a sua necessidade real (ex: dados da NF)
interface ProductEntry {
    tempId: number;
    sku: string;
    name: string;
    unitCostWithTaxes: number;
}

// --- Interface para Dados Internos ---
interface InternalProductData {
    id: string;
    name: string;
    lastCost: number;
    category: string;
}

// --- Hook de Debounce para a Busca (Importante para performance!) ---
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        // Define um timeout para atualizar o valor debounced
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Limpa o timeout anterior se o valor mudar
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

// --- Simulação de Busca de Produto Interno (Com Latência Simulado) ---
const searchInternalProducts = (query: string): Promise<InternalProductData[]> => {
    return new Promise((resolve) => {
        // Simula uma latência de rede
        setTimeout(() => {
            const normalizedQuery = query.toLowerCase().trim();
            
            // Dados de exemplo
            const mockData: InternalProductData[] = [
                { id: 'PROD-101A', name: 'Parafuso Allen M8', lastCost: 0.15, category: 'Material' },
                { id: 'PROD-202B', name: 'Motor DC 12V', lastCost: 55.90, category: 'Insumo' },
                { id: 'SERV-100', name: 'Manutenção Preventiva', lastCost: 0, category: 'Serviço' },
                { id: 'PROD-900', name: 'Óleo Lubrificante 1L', lastCost: 12.50, category: 'Material' },
            ];

            if (!normalizedQuery) {
                // Se a busca for vazia, retorna os 3 primeiros
                return resolve(mockData.slice(0, 3)); 
            }

            const filtered = mockData.filter(p => 
                p.id.toLowerCase().includes(normalizedQuery) || 
                p.name.toLowerCase().includes(normalizedQuery)
            );

            resolve(filtered);

        }, 500); // 500ms de latência
    });
};

// --- Estilos para o Modal (Refatorados para Constante) ---
const modalStyles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 1000,
    },
    modal: {
        backgroundColor: '#ffffff', padding: '30px', borderRadius: '8px',
        width: '90%', maxWidth: '700px',
        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)', maxHeight: '85vh', overflowY: 'auto',
    },
    input: {
        width: '100%', padding: '12px', marginBottom: '15px',
        borderRadius: '6px', border: '1px solid #ccc',
        boxSizing: 'border-box', fontSize: '1rem',
    },
    resultsContainer: {
        maxHeight: '250px', overflowY: 'auto', 
        border: '1px solid #e0e0e0', borderRadius: '6px', marginBottom: '15px',
    },
    resultItem: {
        padding: '12px', cursor: 'pointer',
        borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.15s',
    },
    button: {
        padding: '10px 20px', borderRadius: '6px', border: 'none',
        color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem'
    }
};

// --- Componente de Modal de Mapeamento ---
interface MappingModalProps {
    item: ProductEntry;
    onMap: (tempId: number, mappedId: string, category: string) => void;
    onClose: () => void;
    availableCategories: string[]; // Não foi usado, mas mantido para contexto
}

const MappingModal: React.FC<MappingModalProps> = ({ item, onMap, onClose }) => {
    // Estado de Busca e Seleção
    const [searchTerm, setSearchTerm] = useState(item.sku || '');
    const [selectedProduct, setSelectedProduct] = useState<InternalProductData | null>(null);
    const [results, setResults] = useState<InternalProductData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Estado para o fluxo de "Novo Produto"
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newCategory, setNewCategory] = useState('');

    // Aplicando Debounce
    const debouncedSearchTerm = useDebounce(searchTerm, 400); 

    // Efeito para a Busca (disparado apenas quando o termo 'debounced' muda)
    useEffect(() => {
        const fetchProducts = async () => {
            setIsLoading(true);
            setSelectedProduct(null); // Limpa seleção ao iniciar nova busca
            try {
                const fetchedResults = await searchInternalProducts(debouncedSearchTerm);
                setResults(fetchedResults);
            } catch (error) {
                console.error("Erro ao buscar produtos internos:", error);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProducts();
    }, [debouncedSearchTerm]);

    // Função para confirmar o mapeamento
    const handleConfirm = useCallback(() => {
        if (!selectedProduct) {
            alert('Por favor, selecione um produto da lista.');
            return;
        }
        // Retorna o mappedId e a categoria (para o A1 automático)
        onMap(item.tempId, selectedProduct.id, selectedProduct.category);
        onClose();
    }, [selectedProduct, item.tempId, onMap, onClose]);

    // Simulação do fluxo de criação de novo produto
    const handleCreateNewProduct = useCallback(() => {
        // 🚨 Na vida real, isso abriria um formulário ou chamaria uma API de geração
        setIsCreatingNew(true);
        // Pré-selecionar uma categoria (por exemplo, a primeira da lista de disponíveis ou 'Material')
        setNewCategory('Material'); 
    }, []);


    // Renderização do Novo Produto (se o estado estiver ativo)
    const renderNewProductForm = () => (
        <div style={{ padding: '15px', border: '2px dashed #f97316', borderRadius: '6px', marginTop: '15px' }}>
            <h4 style={{ color: '#f97316', marginTop: 0 }}>➕ Criar Novo Produto a partir da NF</h4>
            <p><strong>Nome Sugerido:</strong> {item.name}</p>
            <p><strong>SKU Sugerido:</strong> {item.sku}</p>

            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Categoria Interna:
            </label>
            <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={modalStyles.input}
            >
                {/* 🚨 Use availableCategories aqui */}
                <option value="Material">Material</option>
                <option value="Insumo">Insumo</option>
                <option value="Serviço">Serviço</option>
                <option value="Ativo">Ativo</option>
            </select>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 15 }}>
                <button onClick={() => setIsCreatingNew(false)} style={{ ...modalStyles.button, backgroundColor: '#6b7280' }}>
                    Voltar
                </button>
                <button 
                    onClick={() => {
                        // Simula o ID retornado pela API
                        const newId = `AUTO-PROD-${Date.now() % 1000}`; 
                        onMap(item.tempId, newId, newCategory);
                        onClose();
                    }} 
                    style={{ ...modalStyles.button, backgroundColor: '#f97316' }}
                    disabled={!newCategory}
                >
                    Confirmar Criação e Mapear
                </button>
            </div>
        </div>
    );

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.modal}>
                <h3 style={{color:'black'}}>🔗 Mapear Produto: **{item.name}**</h3>
                <p style={{ color: '#4b5563', fontSize: '0.95rem' }}>
                    SKU Fornecedor: **{item.sku}** | Custo Unitário NF: **R$ {item.unitCostWithTaxes.toFixed(4)}**
                </p>
                <hr style={{ margin: '15px 0' }} />
                
                {isCreatingNew ? (
                    renderNewProductForm()
                ) : (
                    <>
                        {/* Campo de Busca */}
                        <input
                            type="text"
                            placeholder="Buscar por ID ou Nome Interno"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={modalStyles.input}
                        />

                        {/* Resultados da Busca */}
                        <div style={modalStyles.resultsContainer}>
                            {isLoading ? (
                                <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                                    ⏳ Buscando produtos internos...
                                </p>
                            ) : results.length > 0 ? (
                                results.map(product => (
                                    <div 
                                        key={product.id} 
                                        style={{ 
                                            ...modalStyles.resultItem, 
                                            backgroundColor: selectedProduct?.id === product.id ? '#e0f2f1' : 'white',
                                            color: selectedProduct?.id === product.id ? '#187db7ff' : 'black',
                                            borderLeft: selectedProduct?.id === product.id ? '4px solid #047857' : 'none',
                                            paddingLeft: selectedProduct?.id === product.id ? '8px' : '12px',
                                        }}
                                        onClick={() => setSelectedProduct(product)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                            <span>ID: {product.id} - {product.name}</span>
                                            <span style={{ color: '#047857' }}>{product.category}</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px' }}>
                                            Último Custo Interno: R$ {product.lastCost.toFixed(2)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '15px' }}>
                                    <p style={{ color: '#ef4444', marginBottom: '10px' }}>
                                        Nenhum produto interno encontrado para "{searchTerm}".
                                    </p>
                                    <button 
                                        onClick={handleCreateNewProduct} 
                                        style={{ 
                                            ...modalStyles.button, 
                                            backgroundColor: '#f97316' // Laranja para "Novo"
                                        }}
                                    >
                                        ➕ Gerar e Criar Novo Produto
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Botões de Ação */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                            <button onClick={onClose} style={{ ...modalStyles.button, backgroundColor: '#6b7280' }}>
                                Cancelar
                            </button>
                            <button 
                                onClick={handleConfirm} 
                                style={{ 
                                    ...modalStyles.button, 
                                    backgroundColor: selectedProduct ? '#10b981' : '#a7f3d0', 
                                    cursor: selectedProduct ? 'pointer' : 'not-allowed' 
                                }} 
                                disabled={!selectedProduct || isLoading}
                            >
                                Mapear e Confirmar
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default MappingModal;