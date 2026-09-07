import React, { useEffect, useState, useRef } from "react";
import { 
    Modal, 
    Button, 
    Steps, 
    Input, 
    Card, 
    Space, 
    Typography, 
    Divider, 
    Row, 
    Col, 
    Tag,
    Tooltip,
    Progress
} from "antd";
import { 
    LinkOutlined, 
    FileAddOutlined, 
    ReloadOutlined, 
    CheckCircleOutlined, 
    ArrowLeftOutlined, 
    ArrowRightOutlined,
    LockOutlined,
    UnlockOutlined,
    UnorderedListOutlined
} from "@ant-design/icons";
import { ProdutoNF } from "../../types/NF-e";
import StepSalesConfig from "../nfeCards/StepSalesConfig";


const { Title, Text } = Typography;

interface ProductEntry extends ProdutoNF {
    tempId: number;
    ncm?: string;
}

interface MappingModalProps {
    items: ProductEntry[]; // Fila de itens a serem mapeados
    supplierCnpj: string;
    onMap: (tempId: number, data: any) => void; // Mapeia um item individualmente por vez
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
    items = [],
    onMap,
    onClose,
}) => {
    // Índice atual na fila de lote
    const [currentIndex, setCurrentIndex] = useState(0);
    const isBatch = items.length > 1;
    const currentItem = items[currentIndex] || {};

    const [step, setStep] = useState(0);

    // Identidade do Produto (Painel Esquerdo - resetado a cada item da fila)
    const [draftDesc, setDraftDesc] = useState(currentItem.descricao || "");
    const [draftSku, setDraftSku] = useState(currentItem.sku || "");
    const [draftBrand, setDraftBrand] = useState("");
    const [draftCategory, setDraftCategory] = useState("");
    const [draftNcm, setDraftNcm] = useState(currentItem.ncm || "");
    const [draftCst, setDraftCst] = useState("");

    // Estados de bloqueio de segurança (Cadeados)
    const [isDescEditable, setIsDescEditable] = useState(false);
    const [isSkuEditable, setIsSkuEditable] = useState(false);
    const [isNcmEditable, setIsNcmEditable] = useState(false);

    // Etapa 1: Destino
    const [step1Mode, setStep1Mode] = useState<"EXISTING_DIRECT" | "DRAFT" | null>(null);
    const [existingSearch, setExistingSearch] = useState("");
    const [selectedExisting, setSelectedExisting] = useState<any | null>(null);

    // Etapa 2: Comercialização & Precificação
    const [salesMode, setSalesMode] = useState<"WHOLE_ONLY" | "FRACIONADO_ONLY" | "BOTH" | null>(null);
    const [wholeUnit, setWholeUnit] = useState(currentItem.unidadeMedida || "UN");
    const [wholeMarkup, setWholeMarkup] = useState<number>(60);
    const [wholePrice, setWholePrice] = useState<number>(0);
    const [fracUnit, setFracUnit] = useState("MT");
    const [fracConversion, setFracConversion] = useState<number>(100);
    const [fracMarkup, setFracMarkup] = useState<number>(60);
    const [fracPrice, setFracPrice] = useState<number>(0);

    const searchInputRef = useRef<any>(null);
    const [unitsFromStep, setUnitsFromStep] = useState<SalesUnit[]>([]);

    // Sincroniza os dados do item atual sempre que o currentIndex mudar (avanço da fila)
    useEffect(() => {
        if (currentItem) {
            setDraftDesc(currentItem.descricao || "");
            setDraftSku(currentItem.sku || "");
            setDraftNcm(currentItem.ncm || "");
            setWholeUnit(currentItem.unidadeMedida || "UN");
            setStep1Mode(null);
            setSelectedExisting(null);
            setExistingSearch("");
            setIsDescEditable(false);
            setIsSkuEditable(false);
            setIsNcmEditable(false);
            setStep(0);
            setUnitsFromStep([]);
            setSalesMode(null);
        }
    }, [currentIndex, currentItem]);

    const handleResetCurrent = () => {
        setStep1Mode(null);
        setExistingSearch("");
        setSelectedExisting(null);
        setIsDescEditable(false);
        setIsSkuEditable(false);
        setIsNcmEditable(false);
        setStep(0);
    };

    useEffect(() => {
        if (step1Mode && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [step1Mode]);

    const applyCommercialRounding = (value: number) => {
        const base = Math.floor(value);
        const cents = value - base;
        if (cents < 0.5) return base + 0.5;
        if (cents < 0.9) return base + 0.9;
        return base + 0.99;
    };

    useEffect(() => {
        const cost = currentItem.custo || currentItem.valorUnitario || 0;
        const rawPrice = cost * (1 + wholeMarkup / 100);
        setWholePrice(Number(applyCommercialRounding(rawPrice).toFixed(2)));
    }, [wholeMarkup, currentItem.custo, currentItem.valorUnitario]);

    useEffect(() => {
        const costWhole = currentItem.custo || currentItem.valorUnitario || 0;
        const costFrac = fracConversion > 0 ? costWhole / fracConversion : 0;
        const rawFracPrice = costFrac * (1 + fracMarkup / 100);
        setFracPrice(Number(applyCommercialRounding(rawFracPrice).toFixed(2)));
    }, [fracConversion, fracMarkup, currentItem.custo, currentItem.valorUnitario]);

    const canProceedToNextStep = () => {
        if (step === 0) {
            if (step1Mode === "EXISTING_DIRECT") {
                return selectedExisting !== null;
            }
            if (step1Mode === "DRAFT") {
                return draftDesc.trim() !== "" && draftNcm.trim() !== "";
            }
            return false;
        }

        if (step === 1) {
            if (!salesMode) return false;
            if ((salesMode === "FRACIONADO_ONLY" || salesMode === "BOTH") && (!fracUnit || !fracConversion)) return false;
            return true;
        }
        return true;
    };

    const handleConfirmItem = () => {
        const unitsPayload: SalesUnit[] = unitsFromStep && unitsFromStep.length ? unitsFromStep : [];

        if (step1Mode !== "EXISTING_DIRECT" && !unitsPayload.length) {
            const baseCost = currentItem.custo || currentItem.valorUnitario || 0;
            if (salesMode === "WHOLE_ONLY" || salesMode === "BOTH") {
                unitsPayload.push({
                    type: "WHOLE",
                    unit: wholeUnit,
                    conversion: 1,
                    cost: baseCost,
                    markup: wholeMarkup,
                    price: wholePrice
                });
            }
            if (salesMode === "FRACIONADO_ONLY" || salesMode === "BOTH") {
                unitsPayload.push({
                    type: "FRAC",
                    unit: fracUnit,
                    conversion: fracConversion,
                    cost: fracConversion > 0 ? baseCost / fracConversion : 0,
                    markup: fracMarkup,
                    price: fracPrice
                });
            }
        }

        const payload = {
            mode: step1Mode,
            existingProductId: selectedExisting?.id || null,
            supplierLinkData: {
                sku_fornecedor: currentItem.sku || "",
                ean_fornecedor: currentItem.codigoBarras || null,
                descricao_fornecedor: currentItem.descricao
            },
            salesUnits: unitsPayload,
            draftIdentity: step1Mode === "DRAFT" ? {
                descricao: draftDesc,
                sku: draftSku,
                marca: draftBrand,
                categoria: draftCategory,
                ncm: draftNcm,
                cst: draftCst
            } : null
        };

        // Envia o mapeamento do item atual da fila
        onMap(currentItem.tempId, payload);

        // Avança na fila ou fecha se for o último
        if (currentIndex < items.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose(); // Fila concluída
        }
    };

    const progressPercent = Math.round(((currentIndex) / items.length) * 100);

    return (
        <Modal
            open={true}
            onCancel={onClose}
            width={900}
            footer={null}
            destroyOnClose
            title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: '20px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Title level={4} style={{ margin: 0 }}>
                                {isBatch ? `Mapeamento em Fila (${currentIndex + 1} de ${items.length})` : 'Mapeamento de Produto'}
                            </Title>
                            {isBatch && <Tag color="processing"><UnorderedListOutlined /> Fila Ativa</Tag>}
                        </div>
                        <Text type="secondary" style={{ fontSize: '13px' }}>
                            {isBatch ? 'Processe cada item sequencialmente para agilizar a entrada' : 'Gerenciamento de item recebasdasdido por Nota Fiscal'}
                        </Text>
                    </div>
                    {step1Mode && (
                        <Button 
                            size="small" 
                            danger 
                            icon={<ReloadOutlined />} 
                            onClick={handleResetCurrent}
                        >
                            Resetar Item Atual
                        </Button>
                    )}
                </div>
            }
        >
            {/* Barra de Progresso da Fila (Apenas se for lote) */}
            {isBatch && (
                <div style={{ marginBottom: 12 }}>
                    <Progress percent={progressPercent} status="active" size="small" />
                </div>
            )}

            {/* Stepper Fixo Estável */}
            <div style={{ marginBottom: 16, paddingTop: 4 }}>
                <Steps
                    current={step1Mode === "EXISTING_DIRECT" ? 0 : step}
                    size="small"
                    items={[
                        { title: 'Destino & Vínculo' },
                        { title: 'Comercialização & Precificação' },
                    ]}
                />
            </div>

            <Divider style={{ margin: '12px 0' }} />

            {/* Layout Estável de 2 Colunas */}
            <Row gutter={24} align="top">
                {/* Coluna Esquerda: Dados do Item Atual da Fila */}
                <Col span={10}>
                    <Card 
                        size="small" 
                        title={`📄 Item Atual na Fila (${currentIndex + 1}/${items.length})`} 
                        style={{ backgroundColor: '#fafafa', height: '100%', minHeight: '380px' }}
                    >
                        <Space direction="vertical" size={14} style={{ width: '100%' }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Descrição na Nota</Text>
                                <div style={{ fontWeight: 600, color: '#1f1f1f', wordBreak: 'break-word' }}>{currentItem.descricao}</div>
                            </div>
                            <Row gutter={8}>
                                <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Qtd Nota</Text>
                                    <div style={{ fontWeight: 600 }}>{currentItem.quantidade}</div>
                                </Col>
                                <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Un. Nota</Text>
                                    <div style={{ fontWeight: 600 }}>{currentItem.unidadeMedida}</div>
                                </Col>
                            </Row>
                            <div>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Custo Unitário NF</Text>
                                <div style={{ fontWeight: 600, color: '#d4380d' }}>R$ {(currentItem.valorUnitario || 0).toFixed(2)}</div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Valor Total do Item</Text>
                                <div style={{ fontWeight: 600 }}>R$ {(currentItem.valorTotalItem || 0).toFixed(2)}</div>
                            </div>
                        </Space>
                    </Card>
                </Col>

                {/* Coluna Direita: Conteúdo Dinâmico */}
                <Col span={14}>
                    <div style={{ minHeight: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            {step === 0 && (
                                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                    <Text strong>O que deseja fazer com este item?</Text>
                                    
                                    <Row gutter={10}>
                                        <Col span={12}>
                                            <Card 
                                                hoverable 
                                                size="small" 
                                                onClick={() => setStep1Mode("EXISTING_DIRECT")}
                                                style={{ 
                                                    borderColor: step1Mode === "EXISTING_DIRECT" ? '#1677ff' : '#d9d9d9',
                                                    backgroundColor: step1Mode === "EXISTING_DIRECT" ? '#e6f4ff' : '#ffffff',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Space direction="vertical" size={2}>
                                                    <Text strong><LinkOutlined /> Apenas Vincular</Text>
                                                    <Text type="secondary" style={{ fontSize: '11px' }}>Soma estoque direto (Sem precificação).</Text>
                                                </Space>
                                            </Card>
                                        </Col>
                                        <Col span={12}>
                                            <Card 
                                                hoverable 
                                                size="small" 
                                                onClick={() => { setStep1Mode("DRAFT"); setSelectedExisting(null); }}
                                                style={{ 
                                                    borderColor: step1Mode === "DRAFT" ? '#1677ff' : '#d9d9d9',
                                                    backgroundColor: step1Mode === "DRAFT" ? '#e6f4ff' : '#ffffff',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Space direction="vertical" size={2}>
                                                    <Text strong><FileAddOutlined /> Novo Produto</Text>
                                                    <Text type="secondary" style={{ fontSize: '11px' }}>Criar do zero com precificação.</Text>
                                                </Space>
                                            </Card>
                                        </Col>
                                    </Row>

                                    {step1Mode === "EXISTING_DIRECT" && (
                                        <div style={{ marginTop: 8 }}>
                                            <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: '12px' }}>Buscar produto existente no estoque</Text>
                                            <Input
                                                ref={searchInputRef}
                                                placeholder="Digite o nome do produto..."
                                                value={existingSearch}
                                                onChange={(e) => setExistingSearch(e.target.value)}
                                                style={{ marginBottom: 8 }}
                                            />
                                            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '4px' }}>
                                                <div 
                                                    onClick={() => setSelectedExisting({ id: 2, descricao: "Luva de Raspa Soldador Zanel" })}
                                                    style={{ 
                                                        padding: '8px', 
                                                        cursor: 'pointer', 
                                                        borderRadius: '4px',
                                                        backgroundColor: selectedExisting?.id === 2 ? '#e6f4ff' : 'transparent',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <Text strong={selectedExisting?.id === 2}>Luva de Raspa Soldador Zanel</Text>
                                                    <Tag color="default">Simples</Tag>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {step1Mode === "DRAFT" && (
                                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                            <Text strong style={{ fontSize: '12px', color: '#1677ff' }}>📝 Identidade do Produto</Text>
                                            
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Text type="secondary" style={{ fontSize: '11px' }}>Descrição p/ Sistema</Text>
                                                    <Tooltip title={isDescEditable ? "Bloquear edição" : "Desbloquear para editar"}>
                                                        <Button 
                                                            type="text" 
                                                            size="small" 
                                                            icon={isDescEditable ? <UnlockOutlined style={{ color: '#faad14' }} /> : <LockOutlined style={{ color: '#8c8c8c' }} />}
                                                            onClick={() => setIsDescEditable(!isDescEditable)}
                                                        />
                                                    </Tooltip>
                                                </div>
                                                <Input 
                                                    value={draftDesc} 
                                                    disabled={!isDescEditable} 
                                                    onChange={(e) => setDraftDesc(e.target.value)} 
                                                    size="small" 
                                                />
                                            </div>

                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Text type="secondary" style={{ fontSize: '11px' }}>SKU / Código Interno</Text>
                                                    <Tooltip title={isSkuEditable ? "Bloquear edição" : "Desbloquear para editar"}>
                                                        <Button 
                                                            type="text" 
                                                            size="small" 
                                                            icon={isSkuEditable ? <UnlockOutlined style={{ color: '#faad14' }} /> : <LockOutlined style={{ color: '#8c8c8c' }} />}
                                                            onClick={() => setIsSkuEditable(!isSkuEditable)}
                                                        />
                                                    </Tooltip>
                                                </div>
                                                <Input 
                                                    value={draftSku} 
                                                    disabled={!isSkuEditable} 
                                                    onChange={(e) => setDraftSku(e.target.value)} 
                                                    size="small" 
                                                />
                                            </div>

                                            <Row gutter={8}>
                                                <Col span={8}>
                                                    <Text type="secondary" style={{ fontSize: '10px' }}>Marca</Text>
                                                    <Input placeholder="Opcional" value={draftBrand} onChange={(e) => setDraftBrand(e.target.value)} size="small" />
                                                </Col>
                                                <Col span={8}>
                                                    <Text type="secondary" style={{ fontSize: '10px' }}>Categoria</Text>
                                                    <Input placeholder="Opcional" value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)} size="small" />
                                                </Col>
                                                <Col span={8}>
                                                    <Text type="secondary" style={{ fontSize: '10px' }}>Familia</Text>
                                                    <Input placeholder="Opcional" value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)} size="small" />
                                                </Col>
                                            </Row>

                                            <Row gutter={8}>
                                                <Col span={12}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Text type="secondary" style={{ fontSize: '10px' }}>NCM (Obrigatório)</Text>
                                                        <Tooltip title={isNcmEditable ? "Bloquear edição" : "Desbloquear para editar"}>
                                                            <Button 
                                                                type="text" 
                                                                size="small" 
                                                                style={{ height: '18px', padding: 0 }}
                                                                icon={isNcmEditable ? <UnlockOutlined style={{ color: '#faad14', fontSize: '12px' }} /> : <LockOutlined style={{ color: '#8c8c8c', fontSize: '12px' }} />}
                                                                onClick={() => setIsNcmEditable(!isNcmEditable)}
                                                            />
                                                        </Tooltip>
                                                    </div>
                                                    <Input 
                                                        value={draftNcm} 
                                                        disabled={!isNcmEditable} 
                                                        onChange={(e) => setDraftNcm(e.target.value)} 
                                                        size="small" 
                                                    />
                                                </Col>
                                                <Col span={12}>
                                                    <Text type="secondary" style={{ fontSize: '10px' }}>CST / CSOSN</Text>
                                                    <Input value={draftCst} onChange={(e) => setDraftCst(e.target.value)} size="small" />
                                                </Col>
                                            </Row>
                                        </Space>
                                    )}
                                </Space>
                            )}

                            {step === 1 && step1Mode !== "EXISTING_DIRECT" && (
                                <StepSalesConfig
                                    item={{ custo: currentItem.valorUnitario, unidadeMedida: currentItem.unidadeMedida }}
                                    onChange={(modes: any[]) => {
                                        const units = modes.map(m => ({
                                            type: m.conversion === 1 ? 'WHOLE' : 'FRAC',
                                            unit: m.unit,
                                            conversion: m.conversion,
                                            cost: m.conversion === 1 ? (currentItem.custo || currentItem.valorUnitario || 0) : ((currentItem.custo || currentItem.valorUnitario || 0) / m.conversion),
                                            markup: m.markup,
                                            price: m.price,
                                        } as SalesUnit));
                                        setUnitsFromStep(units);

                                        const hasWhole = units.some(u => u.conversion === 1);
                                        const hasFrac = units.some(u => u.conversion !== 1);
                                        setSalesMode(hasWhole && hasFrac ? 'BOTH' : hasWhole ? 'WHOLE_ONLY' : 'FRACIONADO_ONLY');
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </Col>
            </Row>

            <Divider style={{ margin: '16px 0 12px 0' }} />

            {/* Rodapé Fixo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button onClick={onClose}>Cancelar Fila</Button>
                
                <Space>
                    {step === 1 && (
                        <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(0)}>
                            Voltar
                        </Button>
                    )}
                    
                    {step1Mode === "EXISTING_DIRECT" ? (
                        <Button
                            type="primary"
                            style={{ backgroundColor: '#52c41a' }}
                            icon={<CheckCircleOutlined />}
                            disabled={!canProceedToNextStep()}
                            onClick={handleConfirmItem}
                        >
                            {currentIndex < items.length - 1 ? 'Vincular e Próximo Item ➔' : 'Vincular Último Item'}
                        </Button>
                    ) : step === 0 ? (
                        <Button
                            type="primary"
                            disabled={!canProceedToNextStep()}
                            onClick={() => setStep(1)}
                        >
                            Avançar <ArrowRightOutlined />
                        </Button>
                    ) : (
                        <Button
                            type="primary"
                            style={{ backgroundColor: '#52c41a' }}
                            icon={<CheckCircleOutlined />}
                            disabled={!canProceedToNextStep()}
                            onClick={handleConfirmItem}
                        >
                            {currentIndex < items.length - 1 ? 'Salvar e Próximo Item ➔' : 'Salvar e Finalizar Fila'}
                        </Button>
                    )}
                </Space>
            </div>
        </Modal>
    );
};

export default ProductMappingModal;