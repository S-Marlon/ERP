import { useEffect, useState, useRef } from "react";
import { ProdutoNF } from "../../utils/nfeParser";
import "./ProductMappingModal.css";
import StepSalesConfig from "./StepSalesConfig";
import FlexGridContainer from "../../../../components/Layout/FlexGridContainer/FlexGridContainer";
import FormControl from "../../../../components/ui/FormControl/FormControl";
import Button from "../../../../components/ui/Button/Button";

interface ProductEntry extends ProdutoNF {
    tempId: number;
}

interface MappingModalProps {
    item: ProductEntry;
    supplierCnpj: string;
    onMap: (tempId: number, data: any) => void;
    onClose: () => void;
}

interface SalesUnit {
    type: "WHOLE" | "FRAC";
    unit: string;
    conversion: number; // Quantos fracionados tem dentro da unidade padrão (ex: 100 metros)
    cost: number;       // Custo proporcional calculado
    markup: number;     // Markup específico desta unidade
    price: number;      // Preço de venda calculado ou manual
}

const ProductMappingModal: React.FC<MappingModalProps> = ({
    item,
    onMap,
    onClose,
}) => {
    const [step, setStep] = useState(1);
    
    // Identidade do Produto (Rascunho) - Agora na Esquerda
    const [draftDesc, setDraftDesc] = useState(item.descricao || "");
    const [draftSku, setDraftSku] = useState(item.sku || "");
    const [draftBrand, setDraftBrand] = useState("");
    const [draftCategory, setDraftCategory] = useState("");

    // Etapa 1: Destino
    const [step1Mode, setStep1Mode] = useState<"EXISTING" | "DRAFT" | null>(null);
    const [existingSearch, setExistingSearch] = useState("");
    const [existingResults, setExistingResults] = useState<any[]>([]);
    const [selectedExisting, setSelectedExisting] = useState<any | null>(null);

    // Etapa 2: Comercialização & Precificação Dinâmica
    const [salesMode, setSalesMode] = useState<"WHOLE_ONLY" | "FRACIONADO_ONLY" | "BOTH" | null>(null);
    
    // Unidade Fechada (Whole)
    const [wholeUnit, setWholeUnit] = useState(item.unidadeMedida || "UN");
    const [wholeMarkup, setWholeMarkup] = useState<number>(60);
    const [wholePrice, setWholePrice] = useState<number>(0);

    // Unidade Fracionada (Frac)
    const [fracUnit, setFracUnit] = useState("MT");
    const [fracConversion, setFracConversion] = useState<number>(100); // Ex: 100 metros no rolo
    const [fracMarkup, setFracMarkup] = useState<number>(60);
    const [fracPrice, setFracPrice] = useState<number>(0);

    const [selectedVariantId, setSelectedVariantId] = useState(""); // Guarda a variante escolhida ou "NEW_VARIANT"
    const [newVariantName, setNewVariantName] = useState("");       // Guarda o nome da nova variante (ex: "GG")
    const [newVariantSku, setNewVariantSku] = useState("");         // Guarda o SKU específico da variante

    const searchInputRef = useRef<HTMLInputElement>(null);

    const applyCommercialRounding = (value: number) => {
        const base = Math.floor(value);
        const cents = value - base;
        if (cents < 0.5) return base + 0.5;
        if (cents < 0.9) return base + 0.9;
        return base + 0.99;
    };

    // Recalcula o preço da unidade fechada automaticamente se o markup mudar
    useEffect(() => {
        const cost = item.custo || 0;
        const rawPrice = cost * (1 + wholeMarkup / 100);
        setWholePrice(Number(applyCommercialRounding(rawPrice).toFixed(2)));
    }, [wholeMarkup, item.custo]);

    // Recalcula o preço do fracionado automaticamente se a conversão ou markup mudarem
    useEffect(() => {
        const costWhole = item.custo || 0;
        const costFrac = fracConversion > 0 ? costWhole / fracConversion : 0;
        const rawFracPrice = costFrac * (1 + fracMarkup / 100);
        setFracPrice(Number(applyCommercialRounding(rawFracPrice).toFixed(2)));
    }, [fracConversion, fracMarkup, item.custo]);

    useEffect(() => {
        setDraftDesc(item.descricao || "");
        setDraftSku(item.sku || "");
        setDraftBrand("");
        setDraftCategory("");
    }, [item]);

    useEffect(() => {
        if (step1Mode === "EXISTING" && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [step1Mode]);

    const canProceedToNextStep = () => {
        if (step === 1) {
            if (step1Mode === "EXISTING") {
                // Se o produto tem grade, obriga a selecionar uma variante existente ou preencher os dados da nova
                if (selectedExisting?.temGrade) {
                    if (!selectedVariantId) return false;
                    if (selectedVariantId === "NEW_VARIANT" && !newVariantName) return false;
                }
                return selectedExisting !== null;
            }
            if (step1Mode === "DRAFT") return true;
            return false;
        }
        if (step === 2) {
            if (!salesMode) return false;
            if ((salesMode === "FRACIONADO_ONLY" || salesMode === "BOTH") && (!fracUnit || !fracConversion)) return false;
            return true;
        }
        return true;
    };

    const handleConfirm = () => {
        const unitsPayload: SalesUnit[] = [];

        if (salesMode === "WHOLE_ONLY" || salesMode === "BOTH") {
            unitsPayload.push({
                type: "WHOLE",
                unit: wholeUnit,
                conversion: 1,
                cost: item.custo || 0,
                markup: wholeMarkup,
                price: wholePrice
            });
        }

        if (salesMode === "FRACIONADO_ONLY" || salesMode === "BOTH") {
            unitsPayload.push({
                type: "FRAC",
                unit: fracUnit,
                conversion: fracConversion,
                cost: fracConversion > 0 ? (item.custo || 0) / fracConversion : 0,
                markup: fracMarkup,
                price: fracPrice
            });
        }

        const payload = {
            mode: step1Mode,
            existingProductId: selectedExisting?.id || null,
            isDraft: step1Mode === "DRAFT",
            productData: {
                descricao: draftDesc,
                sku: draftSku,
                marca: draftBrand,
                categoria: draftCategory
            },
            // === NOVO: Dados de Grade/Variação incluídos no Payload ===
            variantData: selectedExisting?.temGrade ? {
                selectedVariantId: selectedVariantId,
                isNewVariant: selectedVariantId === "NEW_VARIANT",
                newVariantName: selectedVariantId === "NEW_VARIANT" ? newVariantName : null,
                newVariantSku: selectedVariantId === "NEW_VARIANT" ? newVariantSku : null
            } : null,
            salesUnits: unitsPayload,
        };

        onMap(item.tempId, payload);
    };

    const handleResetAll = () => {
        setStep(1);
        setSalesMode(null);
        setStep1Mode(null);
        setSelectedExisting(null);
        setExistingSearch("");
        setWholeMarkup(60);
        setFracConversion(100);
        setFracMarkup(60);
        // === NOVO: Resetando os estados de variação ===
        setSelectedVariantId("");
        setNewVariantName("");
        setNewVariantSku("");
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <header className="modal-header">
                    <div className="header-titles">
                        <h3>Mapeamento de Produto</h3>
                        <small>Item da NF: {item.descricao}</small>
                    </div>
                </header>

                <div className="stepper-container">
                    <div className={`step-item ${step === 1 ? "active" : ""} ${step > 1 ? "completed" : ""}`}>
                        <div className="step-number">1</div>
                        <span className="step-label">Destino</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step-item ${step === 2 ? "active" : ""}`}>
                        <div className="step-number">2</div>
                        <span className="step-label">Comercialização & Precificação Direta</span>
                    </div>
                </div>

                <div className="modal-body">
                    {/* LEFT PANEL */}
                    <div className="panel-left">
                        <h4>📄 Dados da NF (Referência)</h4>
                        <FormControl label="Descrição na Nota" value={item.descricao} readOnlyDisplay />
                        
                        <FlexGridContainer layout="grid" template='repeat(2, 1fr)'>
                            <FormControl label="Qtd Nota" value={item.quantidade} readOnlyDisplay />
                            <FormControl label="Un. Nota" value={item.unidadeMedida} readOnlyDisplay />
                        </FlexGridContainer>
                        <FormControl label="Custo Unitário NF" value={`R$ ${item.custo?.toFixed(2)}`} readOnlyDisplay />

                        <div className="product-id-block" style={{ marginTop: '16px' }}>
                            <div className="product-id-title">📝 Identidade do Produto (Ajustável)</div>
                            
                            <FormControl 
                                label="Descrição p/ Sistema" 
                                value={draftDesc} 
                                onChange={(e) => setDraftDesc(e.target.value)} 
                            />
                            <FormControl 
                                label="SKU / Código Interno" 
                                value={draftSku} 
                                onChange={(e) => setDraftSku(e.target.value)} 
                            />
                            <FlexGridContainer layout="grid" template='repeat(2, 1fr)'>
                                <FormControl 
                                    label="Marca" 
                                    value={draftBrand} 
                                    placeholder="Opcional"
                                    onChange={(e) => setDraftBrand(e.target.value)} 
                                />
                                <FormControl 
                                    label="Categoria" 
                                    value={draftCategory} 
                                    placeholder="Opcional"
                                    onChange={(e) => setDraftCategory(e.target.value)} 
                                />
                            </FlexGridContainer>
                        </div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div className="panel-right">
                        
                        {/* ETAPA 1 */}
                        {step === 1 && (
                            <div className="step-content">
                                <h4>O que deseja fazer com este item?</h4>
                                <div className="button-group">
                                    <button
                                        className={step1Mode === "EXISTING" ? "active" : ""}
                                        onClick={() => setStep1Mode("EXISTING")}
                                    >
                                        🔗 Vincular a Produto Existente
                                    </button>
                                    <button
                                        className={step1Mode === "DRAFT" ? "active" : ""}
                                        onClick={() => setStep1Mode("DRAFT")}
                                    >
                                        🧾 Criar Novo Rascunho Rápido
                                    </button>
                                </div>

                                {step1Mode === "EXISTING" && (
                                    <div style={{ marginTop: 16 }} className="search-section">
                                        <FormControl
                                            ref={searchInputRef}
                                            label="Buscar por Nome, Código ou Cód. Barras"
                                            value={existingSearch}
                                            placeholder="Digite para pesquisar..."
                                            onChange={(e) => setExistingSearch(e.target.value)}
                                        />
                                        
                                        <div className="results-list" style={{ marginTop: 12, maxHeight: '220px', overflowY: 'auto' }}>
                                            <div 
                                                className={`product-item ${selectedExisting?.id === 1 ? 'selected' : ''}`}
                                                onClick={() => setSelectedExisting({ id: 1, descricao: draftDesc, temGrade: true })}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                                    <strong>{draftDesc} (Produto Pai Cadastrado)</strong>
                                                    <span style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>95% Match</span>
                                                </div>
                                                <small style={{ color: 'var(--text-muted)' }}>Este produto possui controle de grade (Variações)</small>
                                            </div>
                                        </div>

                                        {/* === SEÇÃO DE VARIANTES === */}
                                        {selectedExisting?.temGrade && (
                                            <div className="variant-selection-block" style={{ marginTop: 16, padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <h5 style={{ margin: '0 0 10px 0', color: '#334155' }}>👕 Este item é qual variação/grade?</h5>
                                                
                                                {/* Seletor de Variante */}
                                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                                    <select 
                                                        value={selectedVariantId} 
                                                        onChange={(e) => setSelectedVariantId(e.target.value)}
                                                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                                    >
                                                        <option value="">-- Selecione uma variação existente --</option>
                                                        <option value="v1">Tamanho P (Estoque: 5)</option>
                                                        <option value="v2">Tamanho M (Estoque: 12)</option>
                                                        <option value="v3">Tamanho G (Estoque: 0)</option>
                                                        <option value="NEW_VARIANT">➕ Cadastrar Nova Variação para este produto...</option>
                                                    </select>
                                                </div>

                                                {/* Input condicional para nova variação */}
                                                {selectedVariantId === "NEW_VARIANT" && (
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <FormControl 
                                                                label="Nome da Nova Variação" 
                                                                placeholder="Ex: GG, XG, 42, Vermelho..." 
                                                                value={newVariantName}
                                                                onChange={(e) => setNewVariantName(e.target.value)}
                                                            />
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <FormControl 
                                                                label="Código/SKU da Variação (Opcional)" 
                                                                placeholder="Ex: CAM-AZ-GG" 
                                                                value={newVariantSku}
                                                                onChange={(e) => setNewVariantSku(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {/* === FIM SEÇÃO DE VARIANTES === */}

                                    </div>
                                )}

                                {step1Mode === "DRAFT" && (
                                    <div className="badge-ok" style={{ marginTop: 16 }}>
                                        🧾 Tudo pronto. Na próxima etapa definiremos os preços de venda deste novo item.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ETAPA 2 */}
                        {step === 2 && (
    <div className="step-content">
        <StepSalesConfig 
            item={item}
            salesMode={salesMode}
            setSalesMode={setSalesMode}
            wholeUnit={wholeUnit}
            wholeMarkup={wholeMarkup}
            setWholeMarkup={setWholeMarkup}
            wholePrice={wholePrice}
            setWholePrice={setWholePrice}
            fracUnit={fracUnit}
            setFracUnit={setFracUnit}
            fracConversion={fracConversion}
            setFracConversion={setFracConversion}
            fracMarkup={fracMarkup}
            setFracMarkup={setFracMarkup}
            fracPrice={fracPrice}
            setFracPrice={setFracPrice}
        />
    </div>
)}
                    </div>
                </div>

                <footer className="modal-footer">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>

                    {step > 1 && (
                        <Button variant="secondary" onClick={() => setStep(step - 1)} style={{ marginLeft: 8 }}>
                            Voltar
                        </Button>
                    )}

                    {step < 2 && (
                        <Button 
                            variant="primary" 
                            disabled={!canProceedToNextStep()} 
                            onClick={() => setStep(step + 1)} 
                            style={{ marginLeft: 8 }}
                        >
                            Avançar para Precificação
                        </Button>
                    )}

                    {step === 2 && (
                        <Button 
                            variant="primary" 
                            disabled={!canProceedToNextStep()} 
                            onClick={handleConfirm} 
                            style={{ marginLeft: 8 }}
                        >
                            Salvar Item
                        </Button>
                    )}

                    {step === 2 && (
                        <Button 
                            variant="primary" 
                            disabled={!canProceedToNextStep()} 
                            onClick={() => {
                                handleConfirm();
                                handleResetAll();
                            }} 
                            style={{ marginLeft: 8 }}
                        >
                            Salvar e Ir para Próximo da NF →
                        </Button>
                    )}
                </footer>
            </div>
        </div>
    );
};

export default ProductMappingModal;