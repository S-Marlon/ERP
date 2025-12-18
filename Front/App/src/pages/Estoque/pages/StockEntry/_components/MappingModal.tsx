import { useEffect, useState, useCallback } from "react";
import { searchProducts, fetchCategoriesRaw } from '../../../api/productsApi';
import CategoryTree from "../../../Components/CategoryTree";
import Swal from 'sweetalert2';

// --- Interfaces ---
interface ProductEntry {
    tempId: number;
    sku: string; // SKU do Fornecedor (da NF)
    name: string; // Nome do Fornecedor (da NF)
    unitCostWithTaxes: number; // Custo Unitário da NF
}

interface InternalProductData {
    id: string;
    name: string;
    lastCost: number;
    category: string;
    unitOfMeasure: string;
}

interface CategoryNode {
    name: string;
    fullName: string;
    parentId?: string;
}

// Interface de saída para o componente pai
export interface MappingPayload {
    original: {
        sku: string;
        name: string;
        unitCost: number;
    };
    mapped: {
        id: string;
        name: string;
        category: string;
        unitOfMeasure: string;
    };
}

interface MappingModalProps {
    item: ProductEntry;
    onMap: (tempId: number, data: MappingPayload) => void;
    onClose: () => void;
}

// --- Estilos Auxiliares para Tabelas do Swal ---
const tableThStyle = 'border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2; color: black; font-size: 0.85rem;';
const tableCellStyle = 'border: 1px solid #ddd; padding: 8px; text-align: left; color: #333; font-size: 0.85rem;';
const tableHeadStyleNF = 'background-color: #5a67d8; color: white;'; 
const tableHeadStyleSys = 'background-color: #38a169; color: white;';

// --- Hook de Debounce ---
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
};

// --- Estilos do Modal Principal ---
const modalStyles: { [key: string]: React.CSSProperties } = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modal: { backgroundColor: '#ffffff', padding: '30px', borderRadius: '8px', width: '95%', maxWidth: '1200px', boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)', maxHeight: '90vh', overflowY: 'auto' },
    input: { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '0.95rem' },
    inputError: { border: '1px solid #ef4444', backgroundColor: '#fef2f2' },
    resultsContainer: { maxHeight: '300px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '6px', marginBottom: '15px' },
    resultItem: { padding: '12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.15s' },
    button: { padding: '8px 16px', borderRadius: '6px', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }
};

const ProductMappingModal: React.FC<MappingModalProps> = ({ item, onMap, onClose }) => {
    // ESTADOS
    const [searchTerm, setSearchTerm] = useState(item.sku || '');
    const [selectedProduct, setSelectedProduct] = useState<InternalProductData | null>(null);
    const [results, setResults] = useState<InternalProductData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // ESTADOS NOVO PRODUTO
    const [newProductId, setNewProductId] = useState('');
    const [newProductName, setNewProductName] = useState(item.name);
    const [newProductUnit, setNewProductUnit] = useState('UN');
    const [newProductCategory, setNewProductCategory] = useState<string | null>(null);
    const [selectedCategoryShortName, setSelectedCategoryShortName] = useState<string | null>(null);
    const [idExistsError, setIdExistsError] = useState(false);

    // ESTADOS CATEGORIAS
    const [availableCats, setAvailableCats] = useState<CategoryNode[]>([]);
    const [isInputtingNewCategory, setIsInputtingNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [selectedParentId, setSelectedParentId] = useState<string | undefined>(undefined);
    
    const [searchError, setSearchError] = useState<string | null>(null);
    const [categoriesLoading, setCategoriesLoading] = useState(false);

    // --- LÓGICA DE CONFIRMAÇÃO SWAL ---
    const confirmAndSend = (payload: MappingPayload) => {
        Swal.fire({
            title: 'Confirmar Mapeamento',
            icon: 'info',
            width: 850,
            html: `
                <div style="text-align: left; font-family: sans-serif;">
                    <p style="font-weight: bold; color: #5a67d8; margin-bottom: 5px;">📄 ITEM DA NOTA FISCAL (ORIGEM)</p>
                    <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="${tableHeadStyleNF}">
                                <th style="${tableThStyle}">Nome Item NF</th>
                                <th style="${tableThStyle}">SKU Fornecedor</th>
                                <th style="${tableThStyle}">Custo Unit.</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="${tableCellStyle}">${payload.original.name}</td>
                                <td style="${tableCellStyle}">${payload.original.sku}</td>
                                <td style="${tableCellStyle}">R$ ${payload.original.unitCost.toFixed(4)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <p style="font-weight: bold; color: #38a169; margin-bottom: 5px;">⚙️ PRODUTO NO SISTEMA (DESTINO)</p>
                    <table style="width:100%; border-collapse: collapse;">
                        <thead>
                            <tr style="${tableHeadStyleSys}">
                                <th style="${tableThStyle}">Nome Padrão</th>
                                <th style="${tableThStyle}">ID Interno</th>
                                <th style="${tableThStyle}">Categoria</th>
                                <th style="${tableThStyle}">Unid.</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="${tableCellStyle}">${payload.mapped.name}</td>
                                <td style="${tableCellStyle}">${payload.mapped.id}</td>
                                <td style="${tableCellStyle}">${payload.mapped.category}</td>
                                <td style="${tableCellStyle}">${payload.mapped.unitOfMeasure}</td>
                            </tr>
                        </tbody>
                    </table>
                    <br>
                    <p style="text-align: center; font-weight: bold; font-size: 1.1rem;">Deseja confirmar este vínculo?</p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '✅ Salvar Mapeamento',
            cancelButtonText: '↩️ Revisar',
            confirmButtonColor: '#38a169',
            cancelButtonColor: '#5a67d8',
        }).then((result) => {
            if (result.isConfirmed) {
                onMap(item.tempId, payload);
                onClose();
            }
        });
    };

    // --- HANDLERS ---
    const handleConfirmExisting = useCallback(() => {
        if (!selectedProduct) return;
        confirmAndSend({
            original: { sku: item.sku, name: item.name, unitCost: item.unitCostWithTaxes },
            mapped: { 
                id: selectedProduct.id, 
                name: selectedProduct.name, 
                category: selectedProduct.category, 
                unitOfMeasure: selectedProduct.unitOfMeasure 
            }
        });
    }, [selectedProduct, item]);

    const handleFinalizeNewProductCreation = useCallback(async () => {
        if (idExistsError || !newProductId.trim() || !newProductName.trim()) {
            alert('Preencha os campos obrigatórios corretamente.');
            return;
        }

        const finalCategory = selectedCategoryShortName || newProductCategory || '';
        confirmAndSend({
            original: { sku: item.sku, name: item.name, unitCost: item.unitCostWithTaxes },
            mapped: { 
                id: newProductId.trim(), 
                name: newProductName.trim(), 
                category: finalCategory, 
                unitOfMeasure: newProductUnit 
            }
        });
    }, [newProductId, newProductName, newProductUnit, newProductCategory, selectedCategoryShortName, idExistsError, item]);

    // --- BUSCA E CATEGORIAS (MANTIDOS DO ORIGINAL) ---
    const loadCategories = useCallback(async () => {
        setCategoriesLoading(true);
        try {
            const raw = await fetchCategoriesRaw();
            const parsed = JSON.parse(raw.body);
            const nodes = parsed.map((fullName: string) => {
                const parts = fullName.split(' / ');
                return { name: parts[parts.length - 1], fullName, parentId: parts.length > 1 ? parts[0] : undefined };
            });
            setAvailableCats(nodes);
            if (!newProductCategory && nodes.length > 0) setNewProductCategory(nodes[0].fullName);
        } catch (err) {
            console.error(err);
        } finally {
            setCategoriesLoading(false);
        }
    }, [newProductCategory]);

    useEffect(() => { loadCategories(); }, [loadCategories]);

    const debouncedSearch = useDebounce(searchTerm, 400);
    useEffect(() => {
        if (!debouncedSearch) return;
        setIsLoading(true);
        searchProducts(debouncedSearch)
            .then(res => setResults(Array.isArray(res) ? res : []))
            .finally(() => setIsLoading(false));
    }, [debouncedSearch]);

    // --- RENDERS ---
    const renderNewProductForm = () => (
        <div style={{ padding: '15px', border: '2px dashed #f97316', borderRadius: '8px', marginTop: '15px' }}>
            <h4 style={{ color: '#f97316', marginTop: 0 }}>➕ Definir Novo Produto Padrão</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px',color: '#4b5563' }}>
                <div style={{ padding: '15px', backgroundColor: '#fffbe6', borderRadius: '6px' }}>
                    <h5 style={{ margin: '0 0 10px 0', color: '#b45309' }}>📄 Dados da Nota Fiscal</h5>
                    <p style={{ fontSize: '0.9rem', color: '#b45309' }}>
                        <strong>SKU NF:</strong> {item.sku}<br/>
                        <strong>Nome NF:</strong> {item.name}
                    </p>
                </div>
                <div style={{ padding: '15px', backgroundColor: '#e0f2f1', borderRadius: '6px' }}>
                    <h5 style={{ margin: '0 0 10px 0', color: '#065f46' }}>⚙️ Dados para Cadastro</h5>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'black' }}>ID Padrão:</label>
                    <input 
                        style={{ ...modalStyles.input, ...(idExistsError ? modalStyles.inputError : {}) }} 
                        value={newProductId} 
                        onChange={e => setNewProductId(e.target.value.toUpperCase())}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                <input style={modalStyles.input} placeholder="Nome Padrão" value={newProductName} onChange={e => setNewProductName(e.target.value)} />
                <select style={modalStyles.input} value={newProductUnit} onChange={e => setNewProductUnit(e.target.value)}>
                    <option value="UN">UN</option><option value="PC">PC</option><option value="KG">KG</option>
                </select>
            </div>

            <div style={{ marginTop: '10px', padding: '10px', border: '1px solid #ddd' }}>
                <CategoryTree 
                    selectedCategoryId={newProductCategory} 
                    onSelectCategory={setNewProductCategory} 
                    onCategoryNameChange={setSelectedCategoryShortName} 
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button onClick={() => setIsCreatingNew(false)} style={{ ...modalStyles.button, backgroundColor: '#6b7280' }}>Voltar</button>
                <button onClick={handleFinalizeNewProductCreation} style={{ ...modalStyles.button, backgroundColor: '#f97316' }}>Mapear Novo Produto</button>
            </div>
        </div>
    );

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.modal}>
                <h3 style={{ color: 'black', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
                    🔗 Mapeamento de Produto: <span style={{ color: '#5a67d8' }}>{item.name}</span>
                </h3>

                {isCreatingNew ? renderNewProductForm() : (
                    <>
                        <p style={{ color: '#4b5563', marginBottom: '10px' }}>Busque o produto interno correspondente:</p>
                        <input 
                            style={modalStyles.input} 
                            placeholder="Buscar por ID ou Nome..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                        <div style={modalStyles.resultsContainer}>
                            {isLoading ? <p style={{color: '#4b5563', padding: '20px', textAlign: 'center' }}>Buscando...</p> : 
                             results.length > 0 ? results.map(prod => (
                                <div 
                                    key={prod.id} 
                                    onClick={() => setSelectedProduct(prod)}
                                    style={{ ...modalStyles.resultItem, backgroundColor: selectedProduct?.id === prod.id ? '#e3f2fd' : 'white', color: '#4b5563' }}
                                >
                                    <strong>{prod.id} - {prod.name}</strong> | <small>{prod.category}</small>
                                </div>
                             )) : (
                                <div style={{ padding: '20px', textAlign: 'center' }}>
                                    <p style={{color: '#4b5563'}}>Nenhum produto encontrado.</p>
                                    <button onClick={() => setIsCreatingNew(true)} style={{ ...modalStyles.button, backgroundColor: '#f97316' }}>➕ Criar Novo Produto</button>
                                </div>
                             )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={onClose} style={{ ...modalStyles.button, backgroundColor: '#6b7280' }}>Fechar</button>
                            <button 
                                onClick={handleConfirmExisting} 
                                disabled={!selectedProduct} 
                                style={{ ...modalStyles.button, backgroundColor: selectedProduct ? '#10b981' : '#ccc' }}
                            >
                                ✅ Confirmar Mapeamento
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ProductMappingModal;

// primeiro arrumar a nova seletora de categorias => selecionar categoria pai antes das subcategorias

// depois implementar a insersção do produto da nota no BD

// depois implementar o fluxo de criação de nova categoria hierárquica

// seletora de quantidade precisa ter medida (PC, UN, KG, LT, MT) e não só número, junto de padronização de acordo com a NF, ex: PC numero inteiros, MT com 2 casas decimais, KG com 3 casas decimais, LT com 3 casas decimais