import { useEffect, useState, useRef } from "react";
import { ProdutoNF } from "../../types/NF-e";
import "./ProductMappingModal.css";
import StepSalesConfig from "./StepSalesConfig";
import FlexGridContainer from "../../../../components/Layout/FlexGridContainer/FlexGridContainer";
import FormControl from "../../../../components/ui/FormControl/FormControl";
import Button from "../../../../components/ui/Button/Button";

interface ProductEntry extends ProdutoNF {
    tempId: number;
    ncm?: string;
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
    conversion: number;
    cost: number;
    markup: number;
    price: number;
}

const ProductMappingModal: React.FC<MappingModalProps> = ({
    item,
    onMap,
    onClose,
}) => {
    const [step, setStep] = useState(1);

    // Identidade do Produto (Painel Esquerdo)
    const [draftDesc, setDraftDesc] = useState(item.descricao || "");
    const [draftSku, setDraftSku] = useState(item.sku || "");
    const [draftBrand, setDraftBrand] = useState("");
    const [draftCategory, setDraftCategory] = useState("");
    const [draftNcm, setDraftNcm] = useState(item.ncm || "");

    // Etapa 1: Destino
    const [step1Mode, setStep1Mode] = useState<"EXISTING" | "EXISTING_PARENT" | "NEW_PARENT" | "DRAFT" | null>(null);
    const [existingSearch, setExistingSearch] = useState("");
    const [selectedExisting, setSelectedExisting] = useState<any | null>(null);

    // Sub-fluxos internos do Produto Simples ("EXISTING")
    const [isDirectLink, setIsDirectLink] = useState(true);
    const [shouldCreateGrade, setShouldCreateGrade] = useState(false);
    const [isLinkToExistingParent, setIsLinkToExistingParent] = useState(false);

    // Estrutura de criação de NOVA grade / Pasta Automática
    const [gradeParentName, setGradeParentName] = useState("");
    const [oldProductVariantName, setOldProductVariantName] = useState("");
    const [newProductVariantName, setNewProductVariantName] = useState("");

    // Caso o produto selecionado na busca principal JÁ TENHA grade active
    const [selectedVariantId, setSelectedVariantId] = useState("");
    const [newVariantName, setNewVariantName] = useState("");
    const [newVariantSku, setNewVariantSku] = useState("");

    // Rota da Aba Primária "Inserir em Pasta Existente" OU do Sub-fluxo de Vínculo com Pasta
    const [parentSearch, setParentSearch] = useState("");
    const [selectedExistingParent, setSelectedExistingParent] = useState<any | null>(null);

    // Etapa 2: Comercialização & Precificação (preservamos estados antigos como fallback)
    const [salesMode, setSalesMode] = useState<"WHOLE_ONLY" | "FRACIONADO_ONLY" | "BOTH" | null>(null);
    const [wholeUnit, setWholeUnit] = useState(item.unidadeMedida || "UN");
    const [wholeMarkup, setWholeMarkup] = useState<number>(60);
    const [wholePrice, setWholePrice] = useState<number>(0);
    const [fracUnit, setFracUnit] = useState("MT");
    const [fracConversion, setFracConversion] = useState<number>(100);
    const [fracMarkup, setFracMarkup] = useState<number>(60);
    const [fracPrice, setFracPrice] = useState<number>(0);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const [unitsFromStep, setUnitsFromStep] = useState<SalesUnit[]>([]);

    // FUNÇÃO PARA CANCELAR TUDO E VOLTAR AO ESTADO INICIAL
    const handleResetAll = () => {
        setStep1Mode(null);
        setExistingSearch("");
        setSelectedExisting(null);
        setIsDirectLink(true);
        setShouldCreateGrade(false);
        setIsLinkToExistingParent(false);
        setGradeParentName("");
        setOldProductVariantName("");
        setNewProductVariantName("");
        setSelectedVariantId("");
        setNewVariantName("");
        setNewVariantSku("");
        setParentSearch("");
        setSelectedExistingParent(null);
        setStep(1);
    };

    // Sincroniza apenas quando o produto selecionado na busca muda de verdade
    useEffect(() => {
        if (selectedExisting) {
            if (!selectedExisting.temGrade) {
                if (!gradeParentName) setGradeParentName(`Família - ${selectedExisting.descricao}`);
                setIsDirectLink(true);
                setShouldCreateGrade(false);
                setIsLinkToExistingParent(false);
            } else {
                setShouldCreateGrade(false);
                setIsLinkToExistingParent(false);
            }
            setSelectedVariantId("");
            setNewVariantName("");
        }
    }, [selectedExisting]);

    // Autofocus inteligente
    useEffect(() => {
        if ((step1Mode === "EXISTING" || step1Mode === "EXISTING_PARENT") && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [step1Mode]);

    // Sincronização inicial de dados da NF
    useEffect(() => {
        setDraftDesc(item.descricao || "");
        setDraftSku(item.sku || "");
        setDraftNcm(item.ncm || "");
    }, [item]);

    // Regras de arredondamento comercial
    const applyCommercialRounding = (value: number) => {
        const base = Math.floor(value);
        const cents = value - base;
        if (cents < 0.5) return base + 0.5;
        if (cents < 0.9) return base + 0.9;
        return base + 0.99;
    };

    useEffect(() => {
        const cost = item.custo || 0;
        const rawPrice = cost * (1 + wholeMarkup / 100);
        setWholePrice(Number(applyCommercialRounding(rawPrice).toFixed(2)));
    }, [wholeMarkup, item.custo]);

    useEffect(() => {
        const costWhole = item.custo || 0;
        const costFrac = fracConversion > 0 ? costWhole / fracConversion : 0;
        const rawFracPrice = costFrac * (1 + fracMarkup / 100);
        setFracPrice(Number(applyCommercialRounding(rawFracPrice).toFixed(2)));
    }, [fracConversion, fracMarkup, item.custo]);

    // Validador de Passos (Avançar)
    const canProceedToNextStep = () => {
        if (step === 1) {
            if (step1Mode === "DRAFT") {
                return draftDesc.trim() !== "" && draftNcm.trim() !== "";
            }

            if (step1Mode === "EXISTING") {
                if (!selectedExisting) return false;

                if (selectedExisting.temGrade) {
                    if (!selectedVariantId) return false;
                    if (selectedVariantId === "NEW_VARIANT" && !newVariantName.trim()) return false;
                    return true;
                }
                return isDirectLink;
            }

            if (step1Mode === "EXISTING_PARENT") {
                return selectedExistingParent !== null && newProductVariantName.trim() !== "";
            }

            if (step1Mode === "NEW_PARENT") {
                if (selectedExisting) {
                    return (
                        gradeParentName.trim() !== "" &&
                        oldProductVariantName.trim() !== "" &&
                        newProductVariantName.trim() !== ""
                    );
                }
                return gradeParentName.trim() !== "" && newProductVariantName.trim() !== "";
            }

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
        // Prefer payload produced by StepSalesConfig when available
        const unitsPayload: SalesUnit[] = unitsFromStep && unitsFromStep.length ? unitsFromStep : [];

        if (!unitsPayload.length) {
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
        }

        const payload = {
            mode: step1Mode,
            existingProductId: selectedExisting?.id || null,
            existingParentId: selectedExistingParent?.id || null,
            supplierLinkData: {
                sku_fornecedor: item.sku || "",
                ean_fornecedor: item.codigoBarras || null,
                descricao_fornecedor: item.descricao
            },
            gradeSetup: (selectedExisting && step1Mode === "NEW_PARENT") ? {
                isExistingParent: false,
                parentName: gradeParentName,
                oldProductVariant: oldProductVariantName,
                newProductVariant: newProductVariantName
            } : null,
            newParentSetup: (step1Mode === "NEW_PARENT" && !selectedExisting) ? {
                parentName: gradeParentName,
                newProductVariant: newProductVariantName
            } : null,
            parentLinkSetup: step1Mode === "EXISTING_PARENT" ? {
                newProductVariant: newProductVariantName
            } : null,
            salesUnits: unitsPayload,
        };

        onMap(item.tempId, payload);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container">

                <header className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                    <div className="header-titles" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ margin: 0 }}>Mapeamento de Produto</h3>
                                <small style={{ display: 'block', color: '#64748b', marginTop: '4px', marginBottom: '8px' }}>
                                    <strong>Item da NF:</strong> {item.descricao}
                                </small>
                            </div>

                            {/* BOTÃO RESETAR TUDO */}
                            {step1Mode && (
                                <button
                                    onClick={handleResetAll}
                                    style={{
                                        background: '#fef2f2',
                                        border: '1px solid #fca5a5',
                                        color: '#dc2626',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                                    title="Limpa todas as seleções e volta para o estado inicial"
                                >
                                    🔄 Resetar Seleção
                                </button>
                            )}
                        </div>

                        <div style={{ 
                            marginTop: '10px', 
                            padding: '10px 14px', 
                            borderRadius: '6px', 
                            fontSize: '0.85rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            transition: 'all 0.3s ease',
                            background: !step1Mode ? '#f1f5f9' 
                                      : step1Mode === 'DRAFT' ? '#eff6ff' 
                                      : step1Mode === 'EXISTING' ? '#f0fdf4' 
                                      : step1Mode === 'NEW_PARENT' ? '#faf5ff' 
                                      : '#fff7ed',
                            border: !step1Mode ? '1px solid #cbd5e1' 
                                  : step1Mode === 'DRAFT' ? '1px solid #bfdbfe' 
                                  : step1Mode === 'EXISTING' ? '1px solid #bbf7d0' 
                                  : step1Mode === 'NEW_PARENT' ? '1px solid #e9d5ff' 
                                  : '1px solid #ffedd5',
                            color: !step1Mode ? '#475569' 
                                 : step1Mode === 'DRAFT' ? '#1e40af' 
                                 : step1Mode === 'EXISTING' ? '#166534' 
                                 : step1Mode === 'NEW_PARENT' ? '#6b21a8' 
                                 : '#c2410c'
                        }}>
                            {!step1Mode && (
                                <span>💡 <strong>Aguardando definição:</strong> Escolha uma opção abaixo para processar este item da nota.</span>
                            )}
                            {step1Mode === "DRAFT" && (
                                <span>🧾 <strong>Modo Rascunho:</strong> Criando um <strong>Novo Produto Isolado</strong> e independente no estoque.</span>
                            )}
                            {step1Mode === "EXISTING" && (
                                <span>
                                    🔗 <strong>Vinculando ao Produto:</strong>{' '}
                                    {selectedExisting ? (
                                        <strong style={{ textTransform: 'uppercase', color: '#14532d', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                                            {selectedExisting.descricao}
                                        </strong>
                                    ) : (
                                        <em style={{ color: '#64748b' }}>Selecione o produto alvo na lista abaixo...</em>
                                    )}
                                </span>
                            )}
                            {step1Mode === "NEW_PARENT" && (
                                <span>
                                    ✨ <strong>Criando Nova Pasta Estrutural:</strong>{' '}
                                    {gradeParentName.trim() ? (
                                        <strong style={{ textTransform: 'uppercase', color: '#581c87', background: '#f3e8ff', padding: '2px 6px', borderRadius: '4px' }}>
                                            {gradeParentName}
                                        </strong>
                                    ) : (
                                        <em style={{ color: '#c084fc' }}>[Digite o nome da pasta organizadora abaixo]</em>
                                    )}
                                    {selectedExisting && <span style={{ color: '#15803d', fontWeight: 600 }}> + Agrupando Produto Antigo</span>}
                                </span>
                            )}
                            {step1Mode === "EXISTING_PARENT" && (
                                <span>
                                    📁 <strong>Inserindo na Pasta Existente:</strong>{' '}
                                    {selectedExistingParent ? (
                                        <strong style={{ textTransform: 'uppercase', color: '#7c2d12', background: '#ffedd5', padding: '2px 6px', borderRadius: '4px' }}>
                                            {selectedExistingParent.descricao}
                                        </strong>
                                    ) : (
                                        <em style={{ color: '#fb923c' }}>Selecione a pasta alvo na busca abaixo...</em>
                                    )}
                                </span>
                            )}
                        </div>
                    </div>
                </header>

                {/* Stepper fixo dentro do header visualmente — mantido aqui para acessibilidade */}
                <div style={{ padding: '10px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div className="stepper-container">
                        <div className={`step-item ${step === 1 ? "active" : ""} ${step > 1 ? "completed" : ""}`}>
                            <div className="step-number">1</div>
                            <span className="step-label">Destino</span>
                        </div>
                        <div className="step-line"></div>
                        <div className={`step-item ${step === 2 ? "active" : ""}`}>
                            <div className="step-number">2</div>
                            <span className="step-label">Comercialização & Precificação</span>
                        </div>
                    </div>
                </div>

                <div className="modal-body">
                    {/* PAINEL ESQUERDO: REFERÊNCIAS */}
                    <div className="panel-left">
                        <h4>📄 Dados da NF (Referência)</h4>
                        <FormControl label="Descrição na Nota" value={item.descricao} readOnlyDisplay />
                        <FlexGridContainer layout="grid" template='repeat(2, 1fr)'>
                            <FormControl label="Qtd Nota" value={item.quantidade} readOnlyDisplay />
                            <FormControl label="Un. Nota" value={item.unidadeMedida} readOnlyDisplay />
                        </FlexGridContainer>
                        <FormControl label="Custo Unitário NF" value={item.valorUnitario} readOnlyDisplay />
                        <FormControl label="Valor total itens" value={item.valorTotalItem} readOnlyDisplay />


                    
                    </div>

                    {/* PAINEL DIREITO: INTERAÇÃO */}
                    <div className="panel-right">
                        {step === 1 && (
                            <div className="step-content">
                                <h4>O que deseja fazer com este item?</h4>

                                <div className="button-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                    <button
                                        className={step1Mode === "EXISTING" ? "active" : ""}
                                        onClick={() => setStep1Mode("EXISTING")}
                                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '10px', height: 'auto' }}
                                    >
                                        <span style={{ fontWeight: '600', marginBottom: '2px' }}>🔗 Vincular a Produto</span>
                                        <small style={{ fontSize: '0.72rem', opacity: 0.8 }}>Item simples ou grade ativa.</small>
                                    </button>

                                    

                                    <button
                                        className={step1Mode === "DRAFT" ? "active" : ""}
                                        onClick={() => { setStep1Mode("DRAFT"); setSelectedExisting(null); }}
                                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '10px', height: 'auto' }}
                                    >
                                        <span style={{ fontWeight: '600', marginBottom: '2px' }}>🧾 Rascunho Rápido</span>
                                        <small style={{ fontSize: '0.72rem', opacity: 0.8 }}>Criar produto simples isolado.</small>
                                    </button>
                                </div>

                                {step1Mode === "EXISTING" && (
                                    <div style={{ marginTop: 16 }} className="search-section">
                                        <FormControl
                                            ref={searchInputRef}
                                            label="Buscar por Nome, Código ou Cód. Barras"
                                            value={existingSearch}
                                            placeholder="Digite o nome do produto..."
                                            onChange={(e) => setExistingSearch(e.target.value)}
                                        />

                                        <div className="results-list" style={{ marginTop: 12, maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                            <div
                                                className={`product-item ${selectedExisting?.id === 2 ? 'selected' : ''}`}
                                                onClick={() => setSelectedExisting({ id: 2, descricao: "Luva de Raspa Soldador Zanel", temGrade: false })}
                                                style={{ padding: '8px', cursor: 'pointer', background: selectedExisting?.id === 2 ? '#eff6ff' : 'transparent' }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                                    <strong>Luva de Raspa Soldador Zanel</strong>
                                                    <span style={{ color: '#64748b', fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>📦 Simples</span>
                                                </div>
                                            </div>
                                        </div>

                                                                                              <span style={{ fontSize: '0.9rem' }}>🔗 <strong>Apenas Vincular:</strong> Mesmo item físico mas fornecedor diferente, somará estoque diretamente.</span>

                                                SE FOR associado, não terá a parte de Comercialização & Precificação


                              
                                    </div>
                                )}
                                {step1Mode === "DRAFT" && (
                                        <div className="product-id-block" style={{ marginTop: '16px' }}>
                            <div className="product-id-title">📝 Identidade do Produto (Ajustável)</div>
                            <FormControl label="Descrição p/ Sistema" value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} />
                            <FormControl label="SKU / Código Interno" value={draftSku} onChange={(e) => setDraftSku(e.target.value)} />
                            <FlexGridContainer layout="grid" template='repeat(3, 1fr)'>
                                <FormControl label="Marca" value={draftBrand} placeholder="Opcional" onChange={(e) => setDraftBrand(e.target.value)} />
                                <FormControl label="Categoria" value={draftCategory} placeholder="Opcional" onChange={(e) => setDraftCategory(e.target.value)} />
                                <FormControl label="Grupo" value={draftCategory} placeholder="Opcional" onChange={(e) => setDraftCategory(e.target.value)} />
                            </FlexGridContainer>
                            <FormControl label="NCM (Obrigatório para Venda)" value={draftNcm} required={step1Mode === "DRAFT"} onChange={(e) => setDraftNcm(e.target.value)} />
                            <FormControl label="CST (Obrigatório para Venda)" value={draftNcm} required={step1Mode === "DRAFT"} onChange={(e) => setDraftNcm(e.target.value)} />
                                
                        </div>
                                )}

                                {(step1Mode === "NEW_PARENT" || step1Mode === "EXISTING_PARENT") && (
                                    <div style={{ marginTop: 16 }} className="search-section">
                                        <div className="grade-setup-container" style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>

                                            {selectedExisting ? (
                                                <>
                                                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem', color: '#166534' }}>
                                                        ⚙️ <strong>Transformando em Grade:</strong> Você está criando uma nova pasta para agrupar o produto antigo (<strong>{selectedExisting.descricao}</strong>) e este item da nota como variações.
                                                    </div>

                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>CRIANDO NOVA PASTA</span>
                                                    <div style={{ marginBottom: '14px' }}>
                                                        <FormControl
                                                            label="Nome da Nova Pasta Organizadora (Nome Mãe)"
                                                            placeholder="Ex: Luvas de Raspa Cano Longo"
                                                            value={gradeParentName}
                                                            onChange={(e) => setGradeParentName(e.target.value)}
                                                        />
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                                                        <FormControl
                                                            label="Variação do Produto Antigo"
                                                            placeholder="Ex: Tam M"
                                                            value={oldProductVariantName}
                                                            onChange={(e) => setOldProductVariantName(e.target.value)}
                                                        />
                                                        <FormControl
                                                            label="Variação deste Item da Nota"
                                                            placeholder="Ex: Tam G"
                                                            value={newProductVariantName}
                                                            onChange={(e) => setNewProductVariantName(e.target.value)}
                                                        />
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                 a
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 2 && (
                            <StepSalesConfig
                                item={{ custo: item.valorUnitario, unidadeMedida: item.unidadeMedida }}
                                onChange={(modes) => {
                                    // map modes to SalesUnit shape for confirm
                                    const units = modes.map(m => ({
                                        type: m.conversion === 1 ? 'WHOLE' : 'FRAC',
                                        unit: m.unit,
                                        conversion: m.conversion,
                                        cost: m.conversion === 1 ? (item.custo || 0) : ((item.custo || 0) / m.conversion),
                                        markup: m.markup,
                                        price: m.price,
                                    } as SalesUnit));
                                    setUnitsFromStep(units);

                                    // derive simple salesMode for existing validations
                                    const hasWhole = units.some(u => u.conversion === 1);
                                    const hasFrac = units.some(u => u.conversion !== 1);
                                    setSalesMode(hasWhole && hasFrac ? 'BOTH' : hasWhole ? 'WHOLE_ONLY' : 'FRACIONADO_ONLY');
                                }}
                            />
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    {step === 2 && (
                        <Button variant="secondary" onClick={() => setStep(1)}>Voltar</Button>
                    )}
                    {step === 1 ? (
                        <span title={!canProceedToNextStep() ? "Preencha todos os campos obrigatórios para avançar" : ""}>
                            <Button 
                                variant="primary" 
                                disabled={!canProceedToNextStep()} 
                                onClick={() => setStep(2)}
                            >
                                Avançar
                            </Button>
                        </span>
                    ) : (
                        <span title={!canProceedToNextStep() ? "Preencha todos os campos obrigatórios para confirmar" : ""}>
                            <Button
                                variant="success"
                                disabled={!canProceedToNextStep()}
                                onClick={handleConfirm}
                            >
                                Confirmar Mapeamento
                            </Button>
                        </span>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ProductMappingModal;
