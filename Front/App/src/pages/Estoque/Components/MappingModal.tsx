import { useEffect, useState, useCallback } from "react";
// Importação revisada para incluir createNewCategory
import { searchProducts, findOrCreateProduct, getCategories, fetchCategoriesRaw, createNewCategory } from '../services/productsApi';

// --- Interfaces ---
interface ProductEntry {
    tempId: number;
    sku: string; // SKU do Fornecedor (da NF)
    name: string; // Nome do Fornecedor (da NF)
    unitCostWithTaxes: number; // Custo Unitário da NF
}

interface InternalProductData {
    id: string; // ID Padrão do Sistema
    name: string; // Nome Padrão do Sistema (Genérico)
    lastCost: number; // Último Custo Histórico
    category: string; // Full Name da Categoria Padrão
    unitOfMeasure: string; 
}

interface CategoryNode {
    name: string;
    fullName: string; // Ex: 'Material / Componentes'
    parentId?: string; // Nome do Pai (apenas o nó, ex: 'Material')
}

// --- Hook de Debounce ---
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

// Verifica existência do produto no backend (procura por ID/sku)
const checkProductIdExists = async (id: string): Promise<boolean> => {
    try {
        // Nota: A busca pode retornar mais de um item, mas verificamos se há algum match exato de ID/SKU.
        const res = await searchProducts(id);
        if (!Array.isArray(res)) return false;
        return res.some((p: any) => 
            String(p.id ?? '').toUpperCase() === id.toUpperCase() || 
            String(p.sku ?? '').toUpperCase() === id.toUpperCase()
        );
    } catch (err) {
        console.error('checkProductIdExists error', err);
        // Em caso de erro na verificação, assume que não existe (para não bloquear criação)
        return false;
    }
};
// ----------------------------------------------------------------------

// --- Estilos para o Modal ---
const modalStyles: { [key: string]: React.CSSProperties } = {
    
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, },
    modal: { backgroundColor: '#ffffff', padding: '30px', borderRadius: '8px', width: '95%', maxWidth: '1200px', boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)', maxHeight: '90vh', overflowY: 'auto', },
    input: { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '0.95rem', },
    inputError: { border: '1px solid #ef4444', backgroundColor: '#fef2f2' },
    resultsContainer: { maxHeight: '300px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '6px', marginBottom: '15px', },
    resultItem: { padding: '12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.15s', },
    button: { padding: '8px 16px', borderRadius: '6px', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }
};

// --- Componente Principal ---
interface MappingModalProps {
    item: ProductEntry;
    // onMap deve receber o ID mapeado e a Categoria Padrão para vincular.
    onMap: (tempId: number, mappedId: string, category: string) => void;
    onClose: () => void;
    availableCategories?: string[]; // Mantido, embora o componente use a chamada direta
}

const ProductMappingModal: React.FC<MappingModalProps> = ({ item, onMap, onClose }) => {
    // ESTADOS DE BUSCA E SELEÇÃO
    const [searchTerm, setSearchTerm] = useState(item.sku || '');
    const [selectedProduct, setSelectedProduct] = useState<InternalProductData | null>(null);
    const [results, setResults] = useState<InternalProductData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // ESTADOS GERAIS DE CRIAÇÃO
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // ESTADOS DE NOVO PRODUTO
    const [newProductId, setNewProductId] = useState('');
    const [newProductName, setNewProductName] = useState(item.name);
    const [newProductUnit, setNewProductUnit] = useState('UN');
    const [newProductCategory, setNewProductCategory] = useState(''); // Armazena o FULL NAME da categoria selecionada
    const [idExistsError, setIdExistsError] = useState(false);

    // ESTADOS DE CATEGORIA HIERÁRQUICA
    const [availableCats, setAvailableCats] = useState<CategoryNode[]>([]);
    const [isInputtingNewCategory, setIsInputtingNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState(''); // Nome da nova categoria (apenas o nó)
    const [selectedParentId, setSelectedParentId] = useState<string | undefined>(undefined); // ID (name/fullName) do Pai

    const [searchError, setSearchError] = useState<string | null>(null);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [categoriesError, setCategoriesError] = useState<string | null>(null);
    const [categoriesRaw, setCategoriesRaw] = useState<string | null>(null);
        
    // helper: busca com timeout para evitar "buscando..." eterno
    const loadSearchResults = async (term: string) => {
        setIsLoading(true);
        setSearchError(null);
        const timeoutMs = 5000;
        try {
            const p = searchProducts(term);
            const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs));
            const res = await Promise.race([p, timeout]);
            setResults(Array.isArray(res) ? res : []);
            if (!Array.isArray(res) || (Array.isArray(res) && res.length === 0)) {
                setSearchError('Nenhum produto padrão encontrado.');
            }
        } catch (err) {
            const msg = err instanceof Error && err.message === 'timeout' ? 'Tempo de busca excedido.' : (err instanceof Error ? err.message : 'Erro na busca');
            setSearchError(msg);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    // EFEITO 1: Busca de Produtos (Debounced)
    const debouncedSearchTerm = useDebounce(searchTerm, 400);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const termToSearch = !debouncedSearchTerm || debouncedSearchTerm.trim().length === 0 
                ? item.sku || ''
                : debouncedSearchTerm;

            if (termToSearch) {
                await loadSearchResults(termToSearch);
            } else {
                setResults([]);
                setIsLoading(false);
            }
            if (cancelled) return;
        })();
        return () => { cancelled = true; };
    }, [debouncedSearchTerm, item.sku]);

    // EFEITO 2: Carrega Categorias do backend (Refatorado para useCallback)
    const loadCategories = useCallback(async () => {
        setCategoriesLoading(true);
        setCategoriesError(null);
        setCategoriesRaw(null);
        try {
            // first get raw response (so we can show body in errors)
            const raw = await fetchCategoriesRaw();
            setCategoriesRaw(raw.body ?? null);
            if (!raw.ok) throw new Error(`GET /products/categories retornou ${raw.status} ${raw.statusText}`);
            let parsed;
            try { parsed = JSON.parse(raw.body); } catch (e) { throw new Error('Resposta não é JSON válido.'); }
            if (!Array.isArray(parsed)) throw new Error('Resposta JSON inesperada (não é array).');
            const nodes = parsed.map((fullName: string) => {
                const parts = fullName.split(' / ');
                return { name: parts[parts.length - 1], fullName, parentId: parts.length > 1 ? parts[0] : undefined }; // parentId é o nome do primeiro nível (padrão)
            });
            setAvailableCats(nodes);
            // Se não houver categoria selecionada, use a primeira
            if (!newProductCategory && nodes.length > 0) {
                setNewProductCategory(nodes[0].fullName);
            }
            setCategoriesError(null);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setAvailableCats([]);
            setNewProductCategory('');
            setCategoriesError(`Erro ao carregar categorias: ${msg}`);
            console.error('loadCategories error:', err);
        } finally {
            setCategoriesLoading(false);
        }
    }, [newProductCategory]); // Depende do newProductCategory para preservar seleção inicial, mas pode ser removido se preferir resetar

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    // FUNÇÃO: Confirma Mapeamento Existente
    const handleConfirmExisting = useCallback(() => {
        if (!selectedProduct) {
            alert('Por favor, selecione um produto padrão para mapear.');
            return;
        }
        onMap(item.tempId, selectedProduct.id, selectedProduct.category);
        onClose();
    }, [selectedProduct, item.tempId, onMap, onClose]);

    // FUNÇÃO: Inicia o Fluxo de Criação
    const handleCreateNewProductStart = useCallback(() => {
        setIsCreatingNew(true);
        // Sugere ID baseado no SKU da NF
        setNewProductId(item.sku.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase() || 'NOVO-');
        setNewProductName(item.name);
        setNewProductUnit('UN'); 
        
        // Reset de categorias
        setNewCategoryName('');
        setSelectedParentId(undefined);
        setIsInputtingNewCategory(false);
        // Define a categoria inicial baseada na lista carregada
        if (!newProductCategory && availableCats.length > 0) {
            setNewProductCategory(availableCats[0].fullName);
        }
    }, [item.sku, item.name, availableCats, newProductCategory]);

    // FUNÇÃO: FINALIZA CRIAÇÃO E MAPEA
    const handleFinalizeNewProductCreation = useCallback(async () => {
        if (idExistsError) {
            alert('Código padrão já existe. Escolha outro código antes de confirmar.');
            return;
        }
        
        // Validações básicas
        if (!newProductId.trim() || !newProductName.trim() || !newProductUnit || (!isInputtingNewCategory && !newProductCategory)) {
            alert('Preencha todos os campos obrigatórios (ID, Nome, Unidade, Categoria).');
            return;
        }
        if (isInputtingNewCategory && !newCategoryName.trim()) {
            alert('O nome da nova categoria não pode ser vazio.');
            return;
        }

        setIsSaving(true);
        try {
            let finalCategory = newProductCategory;

            // 1. CRIAÇÃO DE NOVA CATEGORIA (SE NECESSÁRIO)
            if (isInputtingNewCategory) {
                const parent = availableCats.find(c => c.fullName === selectedParentId); // Busca o Parent pelo FullName
                const parentFullName = parent ? parent.fullName : undefined;
                
                // Constrói o Full Name final
                finalCategory = parentFullName ? `${parentFullName} / ${newCategoryName.trim()}` : newCategoryName.trim();
                
                // CHAMA A API PARA PERSISTIR A NOVA CATEGORIA
                // O backend deve aceitar o nome do nó e o full name do pai
                await createNewCategory({ 
                    name: newCategoryName.trim(), 
                    parentId: parentFullName 
                });
                
                // Recarrega todas as categorias para atualizar o estado local
                await loadCategories();
            }
            
            // 2. CRIAÇÃO DO PRODUTO PADRÃO (OPCIONAL/MOCKADO)
            // Se você precisa criar o produto no backend antes de mapear,
            // descomente e use a função findOrCreateProduct:
            /*
            const createdProduct = await findOrCreateProduct({
                sku: newProductId.trim(), // Usando o novo ID como SKU temporário para criação
                name: newProductName.trim(),
                unitCost: item.unitCostWithTaxes,
                category: finalCategory,
                // Nota: O backend precisa de mais campos como unitOfMeasure, dependendo da sua API
            });
            const finalProductId = createdProduct.id;
            */
            const finalProductId = newProductId.trim(); // Mantido o mapeamento local simples

            // 3. Apenas altera o item na tabela (mapeia localmente)
            onMap(item.tempId, finalProductId, finalCategory || '');

            // Fecha modal e limpa estado
            setIsSaving(false);
            setIsCreatingNew(false);
            onClose();
        } catch (err) {
            console.error('Erro ao finalizar criação e mapeamento:', err);
            alert('Erro ao finalizar criação: ' + (err instanceof Error ? err.message : String(err)));
            setIsSaving(false);
        }
    }, [
        newProductId, newProductName, newProductUnit, newProductCategory,
        isInputtingNewCategory, newCategoryName, selectedParentId,
        idExistsError, onMap, onClose, item.tempId, item.unitCostWithTaxes,
        availableCats, loadCategories // Dependência de loadCategories é importante aqui!
    ]);

    // Renderização do Novo Produto (Formulário DETALHADO com Hierarquia de Categoria)
    const renderNewProductForm = () => (
        <div style={{ padding: '15px', border: '2px dashed #f97316', borderRadius: '8px', marginTop: '15px' }}>
            <h4 style={{ color: '#f97316', marginTop: 0 }}>➕ Definir **Produto Padrão do Sistema**</h4>

            {/* DADOS NF VS DADOS PADRÃO (LINHA 1) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
                <div style={{ padding: '15px', backgroundColor: '#fffbe6', border: '1px dashed #fcd34d', borderRadius: '6px' }}>
                    <h5 style={{ margin: '0 0 10px 0', color: '#b45309' }}>📄 Dados da Nota Fiscal (Entrada)</h5>
                    <p style={{ margin: '5px 0', fontSize: '0.9rem' ,  color: '#b45309' }}>
                        <span style={{fontWeight:'700'}}>**SKU Fornecedor:** </span>{item.sku}<br/>
                        <span style={{fontWeight:'700'}}>**Nome NF Sugerido:**</span> {item.name}<br/>
                        <span style={{fontWeight:'700'}}>**Custo Unitário:**</span> R$ {item.unitCostWithTaxes.toFixed(4)}
                    </p>
                </div>
                <div style={{ padding: '15px', backgroundColor: '#e0f2f1', border: '1px dashed #047857', borderRadius: '6px' }}>
                    <h5 style={{ margin: '0 0 10px 0', color: '#065f46' }}>⚙️ Dados Padrão (Novo Cadastro)</h5>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem', color:'black' }}>* Código (ID) Padrão:</label>
                    <input
                        type="text"
                        placeholder="Ex: PROD-MTR-001"
                        value={newProductId}
                        onChange={(e) => { setNewProductId(e.target.value.toUpperCase()); setIdExistsError(false); }}
                        style={{ ...modalStyles.input, ...(idExistsError ? modalStyles.inputError : {}), padding: '8px' }}
                        onBlur={() => checkProductIdExists(newProductId).then(setIdExistsError)}
                    />
                    {idExistsError && <p style={{ color: '#ef4444', marginTop: '-10px', fontSize: '0.8rem' }}>🚨 Código Padrão já existe. Escolha outro.</p>}
                </div>
            </div>

            {/* CAMPOS ADICIONAIS DE DETALHAMENTO (LINHA 2) */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem', color:'black' }}>* Nome Padrão do Sistema:</label>
                    <input
                        type="text"
                        placeholder="Nome genérico para uso em diversas NFs"
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        style={{ ...modalStyles.input, padding: '8px' }}
                    />
                </div>
                
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem' }}>* Unidade Padrão:</label>
                    <select
                        value={newProductUnit}
                        onChange={(e) => setNewProductUnit(e.target.value)}
                        style={{ ...modalStyles.input, padding: '8px' }}
                    >
                        <option value="UN">UN (Unidade)</option>
                        <option value="PC">PC (Peça)</option>
                        <option value="KG">KG (Quilograma)</option>
                        <option value="LT">LT (Litro)</option>
                    </select>
                </div>
            </div>

            {/* SELEÇÃO/CRIAÇÃO DE CATEGORIA - FLUXO HIERÁRQUICO */}
            <div style={{ marginTop: '15px', border: '1px solid #ddd', padding: '15px', borderRadius: '6px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', fontSize: '1rem', color:'black' }}>* Categoria Padrão:</label>
                
                {!isInputtingNewCategory ? (
                    // 1. SELEÇÃO DE CATEGORIA EXISTENTE
                    <>
                        <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#4b5563' }}>Selecione a Categoria Padrão existente (Ex: Pai / Filho):</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {categoriesLoading ? (
                                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                    <span style={{ color:'#6b7280' }}>Carregando categorias...</span>
                                    <button onClick={loadCategories} style={{ ...modalStyles.button, backgroundColor:'#0ea5e9' }}>Tentar novamente</button>
                                </div>
                            ) : categoriesError ? (
                                <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'space-between' }}>
                                    <div style={{ color:'#ef4444' }}>{categoriesError}</div>
                                    <div>
                                        <button onClick={loadCategories} style={{ ...modalStyles.button, backgroundColor:'#0ea5e9' }}>Tentar novamente</button>
                                    </div>
                                </div>
                            ) : availableCats.length === 0 ? (
                                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                    <span style={{ color:'#6b7280' }}>-- Nenhuma categoria disponível --</span>
                                    <button onClick={loadCategories} style={{ ...modalStyles.button, backgroundColor:'#0ea5e9' }}>Tentar novamente</button>
                                </div>
                            ) : (
                                <select
                                    value={newProductCategory}
                                    onChange={(e) => setNewProductCategory(e.target.value)}
                                    style={{ ...modalStyles.input, flexGrow: 1, marginBottom: 0 }}
                                >
                                    {availableCats.map(cat => (
                                        <option key={cat.fullName} value={cat.fullName}>
                                            {cat.fullName}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <button 
                                onClick={() => { setIsInputtingNewCategory(true); setNewProductCategory(''); }}
                                style={{ ...modalStyles.button, backgroundColor: '#047857', padding: '8px' }}
                            >
                                ➕ Criar Nova Categoria
                            </button>
                        </div>
                    </>
                ) : (
                    // 2. CRIAÇÃO DE NOVA CATEGORIA (Com seleção de Pai)
                    <>
                        <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#b45309' }}>Defina a Hierarquia da Nova Categoria (Nó Filho):</p>
                        
                        {/* SELECIONAR PAI */}
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Categoria Pai (Opcional, selecione para criar um sub-nível):</label>
                        <select
                            value={selectedParentId || ''}
                            onChange={(e) => setSelectedParentId(e.target.value || undefined)}
                            style={{ ...modalStyles.input, marginBottom: '10px' }}
                        >
                            <option value="">-- Nível Principal (Categoria Raiz) --</option>
                            {availableCats.map(cat => (
                                <option key={cat.fullName} value={cat.fullName}>
                                    {cat.fullName}
                                </option>
                            ))}
                        </select>
                        
                        {/* INSERIR NOME DO NÓ */}
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>* Nome da Nova Categoria (Este Nível):</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                placeholder="Ex: Chaves de Fenda"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                style={{ ...modalStyles.input, flexGrow: 1, marginBottom: 0 }}
                            />
                            <button 
                                onClick={() => { 
                                    setIsInputtingNewCategory(false); 
                                    setSelectedParentId(undefined);
                                    setNewCategoryName('');
                                    // Tenta voltar para uma categoria existente se houver
                                    setNewProductCategory(availableCats.length > 0 ? availableCats[0].fullName : '');
                                }}
                                style={{ ...modalStyles.button, backgroundColor: '#6b7280', padding: '8px' }}
                            >
                                Voltar
                            </button>
                        </div>
                        {/* PRÉ-VISUALIZAÇÃO */}
                        <p style={{ fontSize: '0.85rem', color: '#065f46', marginTop: '5px' }}>
                            {newCategoryName.trim() ? 'Será criada como: ' : 'Pré-visualização do Caminho:'}
                            **{selectedParentId ? availableCats.find(c => c.fullName === selectedParentId)?.fullName : 'Raiz'} / {newCategoryName.trim() || '[Nome do Nó]'}**
                        </p>
                    </>
                )}
            </div>

            {/* FOOTER DE AÇÃO */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 25 }}>
                <button 
                    onClick={() => setIsCreatingNew(false)} 
                    style={{ ...modalStyles.button, backgroundColor: '#6b7280' }}
                    disabled={isSaving}
                >
                    Cancelar / Voltar para Busca
                </button>
                <button 
                    onClick={handleFinalizeNewProductCreation} 
                    style={{ ...modalStyles.button, backgroundColor: '#f97316' }}
                    disabled={
                        isSaving || 
                        idExistsError ||
                        !newProductId.trim() || 
                        !newProductName.trim() || 
                        !newProductUnit ||
                        (isInputtingNewCategory && !newCategoryName.trim()) ||
                        (!isInputtingNewCategory && !newProductCategory)
                    }
                >
                    {isSaving ? 'Salvando...' : 'Confirmar Criação e Mapear NF'}
                </button>
            </div>
        </div>
    );

    // Renderização do Item de Resultado da Busca (Detalhado)
    const renderResultItem = (product: InternalProductData) => (
        <div 
            key={product.id} 
            style={{ 
                ...modalStyles.resultItem, 
                backgroundColor: selectedProduct?.id === product.id ? '#e3f2fd' : 'white',
                color: selectedProduct?.id === product.id ? '#1565c0' : 'black',
                borderLeft: selectedProduct?.id === product.id ? '4px solid #1565c0' : 'none',
                paddingLeft: selectedProduct?.id === product.id ? '8px' : '12px',
                display: 'flex', 
                flexDirection: 'column'
            }}
            onClick={() => setSelectedProduct(product)}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>{product.id} - {product.name}</span>
                <span style={{ color: '#047857', fontSize: '0.9rem' }}>{product.category}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280', marginTop: '4px' }}>
                <span>Unidade Padrão: **{product.unitOfMeasure}**</span>
                <span>Último Custo Histórico: R$ ****</span>
            </div>
        </div>
    );

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.modal}>
                {/* CABEÇALHO COM DETALHES DA NF */}
                <h3 style={{color:'black', borderBottom: '2px solid #f3f4f6', paddingBottom: '10px'}}>
                    🔗 Mapeamento de Produto: **{item.name}**
                </h3>
                <p style={{ color: '#ef4444', fontSize: '1rem', fontWeight: 'bold' }}>
                    ITEM NF: SKU **{item.sku}** | Custo NF: **R$ {item.unitCostWithTaxes.toFixed(4)}**
                </p>
                <hr style={{ margin: '15px 0' }} />
                
                {isCreatingNew ? (
                    renderNewProductForm()
                ) : (
                    <>
                        <p style={{ color: '#4b5563', fontSize: '0.95rem', marginBottom: '15px' }}>
                            **1. BUSCA PADRÃO:** Procure pelo produto interno (padrão) que será vinculado a este item da NF.
                        </p>
                        
                        {/* Campo de Busca */}
                        <input
                            type="text"
                            placeholder="Buscar por ID, Nome Padrão ou Categoria Interna"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setSelectedProduct(null); }}
                            style={modalStyles.input}
                        />

                        {/* Resultados da Busca */}
                        <div style={modalStyles.resultsContainer}>
                            {isLoading ? (
                                <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>⏳ Buscando produtos padrões...</p>
                            ) : results.length > 0 ? (
                                results.map(renderResultItem)
                            ) : (
                                <div style={{ textAlign: 'center', padding: '15px' }}>
                                    <p style={{ color: '#ef4444', marginBottom: '10px' }}>
                                        {searchError || `Nenhum produto padrão encontrado para "${searchTerm}".`}
                                    </p>
                                    <button 
                                        onClick={handleCreateNewProductStart} 
                                        style={{ ...modalStyles.button, backgroundColor: '#f97316' }}
                                    >
                                        ➕ 2. Criar Novo Produto Padrão e Mapear
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Botões de Ação */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                            <button onClick={onClose} style={{ ...modalStyles.button, backgroundColor: '#6b7280' }}>
                                Fechar
                            </button>
                            <button 
                                onClick={handleConfirmExisting} 
                                style={{ 
                                    ...modalStyles.button, 
                                    backgroundColor: selectedProduct ? '#10b981' : '#a7f3d0', 
                                    cursor: selectedProduct ? 'pointer' : 'not-allowed' 
                                }} 
                                disabled={!selectedProduct || isLoading}
                            >
                                ✅ Mapear Item da NF para Produto Selecionado
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ProductMappingModal;