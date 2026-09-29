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
  Progress,
  Select
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
  UnorderedListOutlined,
  WarningOutlined
} from "@ant-design/icons";
import { ProdutoNF } from "../../types/NF-e";

const { Title, Text } = Typography;
const { Option } = Select;

interface ProductEntry extends ProdutoNF {
  tempId: number;
  ncm?: string;
}

interface MappingModalProps {
  items: ProductEntry[];
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
  items = [],
  onMap,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isBatch = items.length > 1;
  const currentItem = items[currentIndex] || {};

  const [step, setStep] = useState(0);

  // Identidade do Recurso (`itens_core`)
  const [draftTipoRecurso, setDraftTipoRecurso] = useState<string>("PRODUTO");
  const [draftCommercialName, setDraftCommercialName] = useState(currentItem.descricao || "");
  const [draftInternalName, setDraftInternalName] = useState(currentItem.descricao || "");
  const [draftInternalSku, setDraftInternalSku] = useState(currentItem.sku || "");
  const [draftCommercialSku, setDraftCommercialSku] = useState("");
  const [draftUnidade, setDraftUnidade] = useState<number | undefined>(1);

  // Estados de bloqueio de segurança (Cadeados) - Padrão bloqueado (false)
  const [isInternalNameEditable, setIsInternalNameEditable] = useState(false);
  const [isInternalSkuEditable, setIsInternalSkuEditable] = useState(false);

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

  // Sincroniza os dados do item atual sempre que o currentIndex mudar
  useEffect(() => {
    if (currentItem) {
      setDraftCommercialName(currentItem.descricao || "");
      setDraftInternalName(currentItem.descricao || "");
      setDraftInternalSku(currentItem.sku || "");
      setDraftCommercialSku("");
      setDraftTipoRecurso("PRODUTO");
      setDraftUnidade(1);
      setWholeUnit(currentItem.unidadeMedida || "UN");
      setStep1Mode(null);
      setSelectedExisting(null);
      setExistingSearch("");
      setIsInternalNameEditable(false);
      setIsInternalSkuEditable(false);
      setStep(0);
      setUnitsFromStep([]);
      setSalesMode(null);
    }
  }, [currentIndex, currentItem]);

  const handleResetCurrent = () => {
    setStep1Mode(null);
    setExistingSearch("");
    setSelectedExisting(null);
    setIsInternalNameEditable(false);
    setIsInternalSkuEditable(false);
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
        return (
          draftCommercialName.trim() !== "" && 
          draftInternalName.trim() !== "" && 
          draftInternalSku.trim() !== "" && 
          draftTipoRecurso !== ""
        );
      }
      return false;
    }

    if (step === 1) {
      // Como o módulo está desativado no step 1, permitimos avançar se escolheu DRAFT ou EXISTING
      return true;
    }
    return true;
  };

  const handleConfirmItem = () => {
    const unitsPayload: SalesUnit[] = unitsFromStep && unitsFromStep.length ? unitsFromStep : [];

    const baseCost = currentItem.custo || currentItem.valorUnitario || 0;

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
        tipo_recurso: draftTipoRecurso,
        nome_comercial: draftCommercialName,
        nome_interno: draftInternalName,
        sku_interno: draftInternalSku,
        sku_comercial: draftCommercialSku,
        id_unidade: draftUnidade,
        custo_unitario_base: baseCost,
        unidade_xml: currentItem.unidadeMedida
      } : null
    };

    onMap(currentItem.tempId, payload);

    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const progressPercent = Math.round(((currentIndex) / items.length) * 100);

  return (
    <Modal
      open={true}
      onCancel={onClose}
      width={1200}
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
              {isBatch ? 'Processe cada item sequencialmente para agilizar a entrada' : 'Gerenciamento de item recebido por Nota Fiscal'}
            </Text>
          </div>

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
      {isBatch && (
        <div style={{ marginBottom: 12 }}>
          <Progress percent={progressPercent} status="active" size="small" />
        </div>
      )}

      <Divider style={{ margin: '12px 0' }} />

      <Row gutter={12} align="top">
        <Col span={8}>
          <Card 
            size="small" 
            title={`📄 Item Atual na Fila (${currentIndex + 1}/${items.length})`} 
            style={{ backgroundColor: '#fafafa', height: '100%', minHeight: '420px' }}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Descrição na Nota</Text>
                <div style={{ fontWeight: 600, color: '#1f1f1f', wordBreak: 'break-word', fontSize: '12px' }}>
                  {currentItem.descricao}
                </div>
              </div>

              <Row gutter={8}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>NCM</Text>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: '#595959' }}>{currentItem.ncm || '—'}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>CFOP</Text>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: '#595959' }}>{currentItem.cfop || '—'}</div>
                </Col>
              </Row>

              <Row gutter={8}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Qtd Nota</Text>
                  <div style={{ fontWeight: 600, fontSize: '12px' }}>{currentItem.quantidade} {currentItem.unidadeMedida}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Valor Total Item</Text>
                  <div style={{ fontWeight: 600, fontSize: '12px' }}>R$ {(currentItem.valorTotalItem || 0).toFixed(2)}</div>
                </Col>
              </Row>

              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Composição Financeira (Unitário)</Text>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#8c8c8c' }}>Custo Nota:</span>
                  <span>R$ {(currentItem.valorUnitario || 0).toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#8c8c8c' }}>IPI (Unit.):</span>
                  <span>R$ {((currentItem.valorIpi || 0) / (currentItem.quantidade || 1)).toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', borderTop: '1px dashed #e8e8e8', paddingTop: 4, marginTop: 2 }}>
                  <strong style={{ color: '#1f1f1f' }}>Custo Final Unitário:</strong>
                  <strong style={{ color: '#d4380d' }}>
                    R$ {(currentItem.valorUnitario || 0).toFixed(2)}
                  </strong>
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col span={16}>
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
                          <Text strong><FileAddOutlined /> Novo Recurso / Item</Text>
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
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <Text strong style={{ fontSize: '12px', color: '#1677ff' }}>
                        📝 Identidade do Recurso (`itens_core` & Custo Base)
                      </Text>

                      {/* LINHA 1: Nome Interno x Nome Comercial */}
                      <Row gutter={8}>
                        <Col span={12}>
                          <div style={{ padding: '8px 10px', backgroundColor: '#f0f5ff', border: '1px solid #1677ff', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text strong style={{ fontSize: '11px', color: '#1677ff' }}>Nome Interno (XML) *</Text>
                              <Tooltip title={isInternalNameEditable ? "Bloquear edição" : "Desbloquear para editar"}>
                                <Button 
                                  type="text" 
                                  size="small" 
                                  icon={isInternalNameEditable ? <UnlockOutlined style={{ color: '#faad14' }} /> : <LockOutlined style={{ color: '#8c8c8c' }} />}
                                  onClick={() => setIsInternalNameEditable(!isInternalNameEditable)}
                                />
                              </Tooltip>
                            </div>
                            <Input 
                              value={draftInternalName} 
                              disabled={!isInternalNameEditable} 
                              onChange={(e) => setDraftInternalName(e.target.value)} 
                              size="small" 
                              style={{ marginTop: 2 }}
                              placeholder="Nome extraído da NF"
                            />
                          </div>
                        </Col>
                        <Col span={12}>
                          <div style={{ padding: '8px 10px', backgroundColor: '#f5f5f5', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
                            <Text strong style={{ fontSize: '11px', color: '#595959' }}>Nome Comercial (Opcional)</Text>
                            <Input 
                              value={draftCommercialName} 
                              onChange={(e) => setDraftCommercialName(e.target.value)} 
                              size="small" 
                              style={{ marginTop: 2 }}
                              placeholder="Definido na revisão posterior"
                            />
                          </div>
                        </Col>
                      </Row>

                      {/* LINHA 2: Tipo de Recurso e Unidade (Crua do XML) + Custo Base */}
                      <Row gutter={8}>
                        <Col span={8}>
                          <div style={{ padding: '8px 10px', backgroundColor: '#f0f5ff', border: '1px solid #1677ff', borderRadius: '6px' }}>
                            <Text strong style={{ fontSize: '11px', color: '#1677ff' }}>Tipo de Recurso *</Text>
                            <Select 
                              value={draftTipoRecurso} 
                              onChange={setDraftTipoRecurso} 
                              size="small" 
                              style={{ width: '100%', marginTop: 2 }}
                            >
                              <Option value="PRODUTO">Produto / Revenda</Option>
                              <Option value="ATIVO">Ativo / Imobilizado</Option>
                              <Option value="CONSUMO">Consumo Interno</Option>
                              <Option value="INSUMO">Insumo / Matéria-Prima</Option>
                              <Option value="SERVICO">Serviço</Option>
                            </Select>
                          </div>
                        </Col>
                        <Col span={8}>
                          <div style={{ padding: '8px 10px', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px' }}>
                            <Text strong style={{ fontSize: '11px', color: '#52c41a' }}>Unidade (XML) 🔒</Text>
                            <Input 
                              value={currentItem.unidadeMedida || ''} 
                              disabled 
                              size="small" 
                              style={{ marginTop: 2 }}
                              placeholder="Ex: UN, PC, CX"
                            />
                          </div>
                        </Col>
                        <Col span={8}>
                          <div style={{ padding: '8px 10px', backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '6px' }}>
                            <Text strong style={{ fontSize: '11px', color: '#d4b106' }}>Custo Unit. (NF) 🔒</Text>
                            <Input 
                              value={`R$ ${(currentItem.custo || currentItem.valorUnitario || 0).toFixed(2)}`} 
                              disabled 
                              size="small" 
                              style={{ marginTop: 2 }}
                              placeholder="R$ 0,00"
                            />
                          </div>
                        </Col>
                      </Row>

                      {/* LINHA 3: SKU Customizado (Gerado/Editável) */}
                      <Row gutter={8}>
                        <Col span={24}>
                          <div style={{ padding: '8px 10px', backgroundColor: '#f0f5ff', border: '1px solid #1677ff', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text strong style={{ fontSize: '11px', color: '#1677ff' }}>SKU Customizado *</Text>
                              <Tooltip title={isInternalSkuEditable ? "Bloquear edição" : "Desbloquear para editar manualmente"}>
                                <Button 
                                  type="text" 
                                  size="small" 
                                  icon={isInternalSkuEditable ? <UnlockOutlined style={{ color: '#faad14' }} /> : <LockOutlined style={{ color: '#8c8c8c' }} />}
                                  onClick={() => setIsInternalSkuEditable(!isInternalSkuEditable)}
                                />
                              </Tooltip>
                            </div>
                            <Input 
                              value={draftInternalSku} 
                              disabled={!isInternalSkuEditable} 
                              onChange={(e) => setDraftInternalSku(e.target.value)} 
                              size="small" 
                              style={{ marginTop: 2 }}
                              placeholder="Gerado automaticamente"
                            />
                            <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginTop: 2 }}>
                              Identificador único para o estoque core.
                            </Text>
                          </div>
                        </Col>
                      </Row>
                    </Space>
                  )}
                </Space>
              )}

              {step === 1 && step1Mode !== "EXISTING_DIRECT" && (
                <Card 
                  size="small" 
                  style={{ background: '#4b5563', color: 'white', border: 'none', borderRadius: '6px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <WarningOutlined style={{ color: '#faad14' }} />
                    <Text strong style={{ color: 'white', fontSize: '12px' }}>
                      Módulo de Precificação Momentaneamente Desabilitado
                    </Text>
                  </div>
                  <Text style={{ color: '#e5e7eb', fontSize: '11px' }}>
                    Módulo inativo para agilizar o processo de inserção de nota e testes. Os preços de venda e margens serão calculados posteriormente.
                  </Text>
                </Card>
              )}
            </div>
          </div>
        </Col>
      </Row>

      <Divider style={{ margin: '16px 0 12px 0' }} />

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