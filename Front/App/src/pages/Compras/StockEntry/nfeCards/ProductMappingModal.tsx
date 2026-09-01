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
  Tooltip
} from "antd";
import { 
  LinkOutlined, 
  FileAddOutlined, 
  ReloadOutlined, 
  CheckCircleOutlined, 
  ArrowLeftOutlined, 
  ArrowRightOutlined,
  LockOutlined,
  UnlockOutlined
} from "@ant-design/icons";
import { ProdutoNF } from "../../types/NF-e";
import StepSalesConfig from "./StepSalesConfig";

const { Title, Text } = Typography;

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
    const [step, setStep] = useState(0);

    // Identidade do Produto (Painel Esquerdo)
    const [draftDesc, setDraftDesc] = useState(item.descricao || "");
    const [draftSku, setDraftSku] = useState(item.sku || "");
    const [draftBrand, setDraftBrand] = useState("");
    const [draftCategory, setDraftCategory] = useState("");
    const [draftNcm, setDraftNcm] = useState(item.ncm || "");
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
    const [wholeUnit, setWholeUnit] = useState(item.unidadeMedida || "UN");
    const [wholeMarkup, setWholeMarkup] = useState<number>(60);
    const [wholePrice, setWholePrice] = useState<number>(0);
    const [fracUnit, setFracUnit] = useState("MT");
    const [fracConversion, setFracConversion] = useState<number>(100);
    const [fracMarkup, setFracMarkup] = useState<number>(60);
    const [fracPrice, setFracPrice] = useState<number>(0);

    const searchInputRef = useRef<any>(null);
    const [unitsFromStep, setUnitsFromStep] = useState<SalesUnit[]>([]);

    const handleResetAll = () => {
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

    useEffect(() => {
        setDraftDesc(item.descricao || "");
        setDraftSku(item.sku || "");
        setDraftNcm(item.ncm || "");
        setIsDescEditable(false);
        setIsSkuEditable(false);
        setIsNcmEditable(false);
    }, [item]);

    const applyCommercialRounding = (value: number) => {
        const base = Math.floor(value);
        const cents = value - base;
        if (cents < 0.5) return base + 0.5;
        if (cents < 0.9) return base + 0.9;
        return base + 0.99;
    };

    useEffect(() => {
        const cost = item.custo || item.valorUnitario || 0;
        const rawPrice = cost * (1 + wholeMarkup / 100);
        setWholePrice(Number(applyCommercialRounding(rawPrice).toFixed(2)));
    }, [wholeMarkup, item.custo, item.valorUnitario]);

    useEffect(() => {
        const costWhole = item.custo || item.valorUnitario || 0;
        const costFrac = fracConversion > 0 ? costWhole / fracConversion : 0;
        const rawFracPrice = costFrac * (1 + fracMarkup / 100);
        setFracPrice(Number(applyCommercialRounding(rawFracPrice).toFixed(2)));
    }, [fracConversion, fracMarkup, item.custo, item.valorUnitario]);

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

    const handleConfirm = () => {
        const unitsPayload: SalesUnit[] = unitsFromStep && unitsFromStep.length ? unitsFromStep : [];

        if (step1Mode !== "EXISTING_DIRECT" && !unitsPayload.length) {
            const baseCost = item.custo || item.valorUnitario || 0;
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
                sku_fornecedor: item.sku || "",
                ean_fornecedor: item.codigoBarras || null,
                descricao_fornecedor: item.descricao
            },
            salesUnits: unitsPayload,
        };

        onMap(item.tempId, payload);
    };

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
                        <Title level={4} style={{ margin: 0 }}>Mapeamento de Produto</Title>
                        <Text type="secondary" style={{ fontSize: '13px' }}>
                            Gerenciamento de item recebido por Nota Fiscal
                        </Text>
                    </div>
                    {step1Mode && (
                        <Button 
                            size="small" 
                            danger 
                            icon={<ReloadOutlined />} 
                            onClick={handleResetAll}
                        >
                            Resetar Seleção
                        </Button>
                    )}
                </div>
            }
        >
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
                {/* Coluna Esquerda: Âncora Fixa de Referência */}
                <Col span={10}>
                    <Card 
                        size="small" 
                        title="📄 Dados da NF (Referência)" 
                        style={{ backgroundColor: '#fafafa', height: '100%', minHeight: '380px' }}
                    >
                        <Space direction="vertical" size={14} style={{ width: '100%' }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Descrição na Nota</Text>
                                <div style={{ fontWeight: 600, color: '#1f1f1f', wordBreak: 'break-word' }}>{item.descricao}</div>
                            </div>
                            <Row gutter={8}>
                                <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Qtd Nota</Text>
                                    <div style={{ fontWeight: 600 }}>{item.quantidade}</div>
                                </Col>
                                <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Un. Nota</Text>
                                    <div style={{ fontWeight: 600 }}>{item.unidadeMedida}</div>
                                </Col>
                            </Row>
                            <div>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Custo Unitário NF</Text>
                                <div style={{ fontWeight: 600, color: '#d4380d' }}>R$ {(item.valorUnitario || 0).toFixed(2)}</div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Valor Total do Item</Text>
                                <div style={{ fontWeight: 600 }}>R$ {(item.valorTotalItem || 0).toFixed(2)}</div>
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
                                            
                                            {/* Descrição com Cadeado de Segurança */}
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

                                            {/* SKU com Cadeado de Segurança */}
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
                                                    <Text type="secondary" style={{ fontSize: '10px' }}>Grupo</Text>
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
                                                    <Text type="secondary" style={{ fontSize: '10px' }}>CST (Obrigatório)</Text>
                                                    <Input value={draftCst} onChange={(e) => setDraftCst(e.target.value)} size="small" />
                                                </Col>
                                            </Row>
                                        </Space>
                                    )}
                                </Space>
                            )}

                            {step === 1 && step1Mode !== "EXISTING_DIRECT" && (
                                <StepSalesConfig
                                    item={{ custo: item.valorUnitario, unidadeMedida: item.unidadeMedida }}
                                    onChange={(modes: any[]) => {
                                        const units = modes.map(m => ({
                                            type: m.conversion === 1 ? 'WHOLE' : 'FRAC',
                                            unit: m.unit,
                                            conversion: m.conversion,
                                            cost: m.conversion === 1 ? (item.custo || item.valorUnitario || 0) : ((item.custo || item.valorUnitario || 0) / m.conversion),
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
                <Button onClick={onClose}>Cancelar</Button>
                
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
                            onClick={handleConfirm}
                        >
                            Confirmar Vínculo Direto
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
                            onClick={handleConfirm}
                        >
                            Confirmar Mapeamento
                        </Button>
                    )}
                </Space>
            </div>
        </Modal>
    );
};

export default ProductMappingModal;