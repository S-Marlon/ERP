import { useEffect, useState, useCallback } from "react";
import { searchProducts, fetchCategoriesRaw, saveProductMapping } from '../../../api/productsApi';
import CategoryTree from "../../../Components/CategoryTree";
import Swal from 'sweetalert2';
import FormControl from "../../../../../components/ui/FormControl/FormControl";
import SKUGenerator from "../../StockInventory/_components/SKUGenerator";
import Badge from "../../../../../components/ui/Badge/Badge";
import FlexGridContainer from "../../../../../components/Layout/FlexGridContainer/FlexGridContainer";
import Button from "../../../../../components/ui/Button/Button";

// --- Interfaces ---
interface ProductEntry {
    unitOfMeasure: string;
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
    supplierCnpj: string;
}

interface MappingModalProps {
    item: ProductEntry;
    supplierCnpj: string; // <--- ADICIONE ESTO
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
    overlay: { 
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
        backgroundColor: 'rgba(15, 23, 42, 0.85)', 
        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
        backdropFilter: 'blur(5px)'
    },
    modal: { 
        backgroundColor: '#ffffff', borderRadius: '16px', 
        width: '98%', maxWidth: '1400px', // Aumentado para acomodar a árvore lateral
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
        height: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' 
    },
    header: {
        padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    },
    contentGrid: {
        display: 'grid',
        gridTemplateColumns: '2fr 3fr 2fr', // NF | Cadastro | Árvore
        gap: '5px',
        flex: 1,
        overflow: 'hidden'
    },
    sectionColumn: {
        padding: '24px',
        overflowY: 'auto',
        height: '100%',
        borderRight: '1px solid #f1f5f9'
    },
    footer: {
        padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
        display: 'flex', justifyContent: 'flex-end', gap: '12px'
    },
    inputLabel: {
        display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b',
        marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.025em'
    },
    modernInput: {
        width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
        fontSize: '0.9rem', marginBottom: '16px', outline: 'none', transition: 'all 0.2s'
    }
};

const ProductMappingModal: React.FC<MappingModalProps> = ({ item, onMap, onClose, supplierCnpj }) => {
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
    const [newProductUnit, setNewProductUnit] = useState(item.unitOfMeasure || 'UN');
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

const [isGeneric, setIsGeneric] = useState<boolean>(true);
const [inconsistencyError, setInconsistencyError] = useState<string | null>(null);

// Sincroniza o newProductId com item.sku quando em modo específico, ou limpa quando genérico
useEffect(() => {
    if (!isGeneric) {
        // Modo ESPECÍFICO: o código deve ser o da NF
        setNewProductId(item.sku);
    } else {
        // Modo GENÉRICO: limpa o campo para o usuário digitar um novo código
        setNewProductId('');
    }
}, [isGeneric, item.sku]);


// --- LÓGICA DE VALIDAÇÃO (TRADUTOR) ---
    const identifyProductType = (code: string): 'GENERIC' | 'SPECIFIC' => {
        const cleanCode = code.trim();
        const isEan = /^\d{13}$/.test(cleanCode); // Apenas números, 13 dígitos
        return isEan ? 'SPECIFIC' : 'GENERIC';
    };

    useEffect(() => {
        if (!newProductId) { setInconsistencyError(null); return; }
        
        // Regra de Negócio:
        // - ESPECÍFICO: o código deve ser o da NF (item.sku)
        // - GENÉRICO: o código não pode ser idêntico ao da NF
        
        if (isGeneric) {
            // Modo GENÉRICO: validar que NÃO seja igual ao SKU da NF
            if (newProductId === item.sku) {
                setInconsistencyError('Atenção: Código genérico não pode ser idêntico ao SKU da nota fiscal.');
            } else {
                setInconsistencyError(null);
            }
        } else {
            // Modo ESPECÍFICO: validar que seja igual ao SKU da NF
            if (newProductId !== item.sku) {
                setInconsistencyError('Atenção: Em modo específico, o código deve ser o da nota fiscal.');
            } else {
                setInconsistencyError(null);
            }
        }
    }, [newProductId, isGeneric, item.sku]);

    // --- LÓGICA DE CONFIRMAÇÃO SWAL ---
    const confirmAndSend = async (payload: MappingPayload) => {
        const result = await Swal.fire({
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
                                <th style="${tableThStyle}">UoM</th>

                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="${tableCellStyle}">${payload.original.name}</td>
                                <td style="${tableCellStyle}">${payload.original.sku}</td>
                                <td style="${tableCellStyle}">R$ ${payload.original.unitCost.toFixed(4)}</td>
                                <td style="${tableCellStyle}">${item.unitOfMeasure}</td>

                            </tr>
                        </tbody>
                    </table>

                    <p style="font-weight: bold; color: #38a169; margin-bottom: 5px;">⚙️ PRODUTO NO SISTEMA (DESTINO)</p>
                    <table style="width:100%; border-collapse: collapse;">
                        <thead>
                            <tr style="${tableHeadStyleSys}">
                                <th style="${tableThStyle}">Nome Padrão</th>
                                <th style="${tableThStyle}">descrição Padrão</th>
                                <th style="${tableThStyle}">ID Interno</th>
                                <th style="${tableThStyle}">Categoria</th>
                                <th style="${tableThStyle}">Unid.</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="${tableCellStyle}">${payload.mapped.name}</td>
                                <td style="${tableCellStyle}">${payload.mapped.description}</td>
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
            showLoaderOnConfirm: true, // Habilita o loader no botão do Swal
            preConfirm: async () => {       
            
                try {
                // Aqui chamamos a API que criamos no productsApi.ts
                const response = await saveProductMapping(payload);
                return response; 
            } catch (error: any) {
                Swal.showValidationMessage(`Erro no servidor: ${error.message}`);
            }
        
            
            },
            allowOutsideClick: () => !Swal.isLoading()
        });

        if (result.isConfirmed) {
            // 2. Notifica o componente pai para atualizar a UI local
            onMap(item.tempId, payload);
            
            // 3. Feedback de sucesso e fecha
            await Swal.fire({
                icon: 'success',
                title: 'Sucesso!',
                text: 'Mapeamento salvo e vinculado com sucesso.',
                timer: 1500,
                showConfirmButton: false
            });
            
            onClose();
        }
    };

    // --- HANDLERS ---
   const handleConfirmExisting = useCallback(() => {
    if (!selectedProduct) return;
    confirmAndSend({
        original: { sku: item.sku, name: item.name, unitCost: item.unitCostWithTaxes, description: item.name },
        mapped: { 
            id: selectedProduct.id, 
            name: selectedProduct.name, 
            category: selectedProduct.category, 
            unitOfMeasure: selectedProduct.unitOfMeasure,
            description: selectedProduct.name
        },
        supplierCnpj: supplierCnpj
    });
}, [selectedProduct, item, supplierCnpj]); // Adicione supplierCnpj às dependências


    const handleFinalizeNewProductCreation = useCallback(async () => {
    if (idExistsError || !newProductId.trim() || !newProductName.trim()) {
        alert('Preencha os campos obrigatórios corretamente.');
        return;
    }

        const finalCategory = selectedCategoryShortName || newProductCategory || '';
    confirmAndSend({
        original: { sku: item.sku, name: item.name, unitCost: item.unitCostWithTaxes, description: item.name },
        mapped: { 
            id: newProductId.trim(), 
            name: newProductName.trim(), 
            category: finalCategory, 
            unitOfMeasure: newProductUnit,
            description: newProductName.trim()
        },
        supplierCnpj: supplierCnpj
    });
}, [newProductId, newProductName, newProductUnit, newProductCategory, selectedCategoryShortName, idExistsError, item, supplierCnpj]);

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
        <div style={modalStyles.contentGrid}>
            
            {/* COLUNA 1: REFERÊNCIA NOTA FISCAL */}
            <aside style={{ ...modalStyles.sectionColumn, backgroundColor: '#fcfcfd', width: '300px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <div style={{ padding: '6px', background: '#fee2e2', borderRadius: '6px', color: '#dc2626' }}>📄</div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Dados da Nota Fiscal</h4>
                </div>
                
                <FormControl label="SKU Original" readOnlyDisplay value={item.sku} />
                <FormControl label="Nome na NF" readOnlyDisplay value={item.name} />
                <FormControl label="Custo Unitário" readOnlyDisplay value={`R$ ${item.unitCostWithTaxes.toFixed(4)}`} />
                <FormControl label="Unidade de Medida" readOnlyDisplay value={item.unitOfMeasure} />

                
                
                <div style={{ marginTop: '20px', padding: '15px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400e', lineHeight: '1.4' }}>
                        <strong>Nota:</strong> Estes dados são apenas para referência e não serão alterados no seu sistema.
                    </p>
                </div>
            </aside>

            {/* COLUNA 2: CADASTRO DO PRODUTO (EDIÇÃO) */}
            <main style={modalStyles.sectionColumn}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <div style={{ padding: '6px', background: '#dcfce7', borderRadius: '6px', color: '#16a34a' }}>✏️</div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Informações do Produto no Sistema</h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '5px' }}>
                    

                    
                    <div>
                        <FormControl 
                            label={isGeneric ? "Código Genérico (Interno)" : "Código Específico (EAN)"} 
                            readOnlyDisplay={!isGeneric}
                            value={isGeneric ? newProductId : item.sku} 
                            placeholder={isGeneric ? "Ex: PA-001" : "Ex: 1234567890123"} 
                            onChange={(e) => isGeneric && setNewProductId(e.target.value)}
                        />
                    </div>
                    
                </div>

                <FormControl label="Nome Padrão (Como aparecerá no seu estoque):"
                    value={newProductName}
                    onChange={e => setNewProductName(e.target.value)}
                    placeholder="Ex: Parafuso Sextavado Zincado 1/4"
                />

                <FormControl label="Descrição Detalhada / Observações:" control="textarea"
                    placeholder="Adicione informações técnicas adicionais..."
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                    <FormControl label="NCM" readOnlyDisplay value="8481.80.19" />
                    <FormControl label="CEST" readOnlyDisplay value="01.001.00" />
                    <FormControl label="Origem" readOnlyDisplay value="0 - Nacional" />
                </div>
            </main>

            {/* COLUNA 3: CATEGORIA (ÁRVORE DEDICADA) */}
            <aside style={{ ...modalStyles.sectionColumn, backgroundColor: '#f8fafc', borderRight: 'none', width: '350px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
                    <div style={{ padding: '6px', background: '#e0f2fe', borderRadius: '6px', color: '#0284c7' }}>🌳</div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Classificação Fiscal</h4>
                </div>
                
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '12px' }}>
                    Selecione a categoria hierárquica abaixo:
                </p>

                <div style={{ 
                    background: '#fff', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    overflowY: 'auto'
                }}>
                    <CategoryTree 
                        selectedCategoryId={newProductCategory} 
                        onSelectCategory={setNewProductCategory} 
                        onCategoryNameChange={setSelectedCategoryShortName} 
                    />
                </div>
            </aside>
        </div>
    );

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.modal}>
                
                <header style={modalStyles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>Mapeamento de Novo Produto</h3>
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                            <button 
                                onClick={() => setIsGeneric(true)}
                                style={{ 
                                    padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                    backgroundColor: isGeneric ? '#fff' : 'transparent', color: isGeneric ? '#f97316' : '#64748b',
                                    boxShadow: isGeneric ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                }}
                            >GENÉRICO</button>
                            <button 
                                onClick={() => setIsGeneric(false)}
                                style={{ 
                                    padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                    backgroundColor: !isGeneric ? '#fff' : 'transparent', color: !isGeneric ? '#3b82f6' : '#64748b',
                                    boxShadow: !isGeneric ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                }}
                            >ESPECÍFICO</button>
                        </div>
                    </div>
                    {inconsistencyError && (
                         <Badge color="danger">⚠️ {inconsistencyError}</Badge>
                    )}
                </header>

                {renderNewProductForm()}

                <footer style={modalStyles.footer}>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleFinalizeNewProductCreation}
                        disabled={!!inconsistencyError}
                        loading={isSaving}
                        variant="primary"
                        style={{ backgroundColor: '#4f46e5' }}
                    >
                        Salvar e Mapear Produto
                    </Button>
                </footer>
            </div>
        </div>
    );
};

export default ProductMappingModal;
// TO-DO LISTA DE MELHORIAS FUTURAS:

// depois implementar o fluxo de criação de nova categoria hierárquica

// seletora de quantidade precisa ter medida (PC, UN, KG, LT, MT) e não só número, junto de padronização de acordo com a NF, ex: PC numero inteiros, MT com 2 casas decimais, KG com 3 casas decimais, LT com 3 casas decimais