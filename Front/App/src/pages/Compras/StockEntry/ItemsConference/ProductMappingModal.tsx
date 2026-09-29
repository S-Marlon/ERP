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
  Select,
  Spin,
  Empty,
  InputNumber
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
import { TIPOS_RECURSO, TIPO_RECURSO_PADRAO, getTipoRecursoConfig } from "../tipoRecurso";
import { buscarItensCatalogo, ItemCatalogoBusca } from "../../api/comprasApi";
import ProductCommercialSalesConfig from "../../../Catalogo/pages/ProductPricingModule/ProductCommercialSalesConfig";
import type { SalvarConfigPayload } from "../../../Catalogo/pages/ProductPricingModule/configVendas.api";

const { Title, Text } = Typography;
const { Option } = Select;

// Formato real dos itens montados no StockEntryForm (initialItems)
interface ProductEntry {
  tempId: string | number;
  nItem?: string | number;
  sku?: string;
  ean?: string;
  descricao?: string;
  ncm?: string;
  unidade?: string;
  quantidade?: number;
  valorUnitario?: number;      // custo unitário efetivo (com frete/IPI/ST)
  valorBaseUnitario?: number;  // custo unitário da nota (vProd / qCom)
  valorTotal?: number;
  ipi?: number;
  tipoRecurso?: string;
  prod?: { CFOP?: string; [key: string]: unknown };
}

export interface MappingPayload {
  mode: "EXISTING_DIRECT" | "DRAFT" | null;
  existingProductId: number | null;
  existingProduct: { sku: string; nome: string; tipo_recurso: string } | null;
  supplierLinkData: {
    sku_fornecedor: string;
    ean_fornecedor: string | null;
    descricao_fornecedor: string;
  };
  salesUnits: SalesUnit[];
  // Como a unidade da NF vira estoque: 1 unidade_compra = fator x unidade_base
  conversaoCompra: {
    unidade_compra: string;
    unidade_base: string;
    fator: number;
  };
  // Item novo: unidades de venda e faixas de preço (gravadas na aprovação da Staging)
  configVendas: SalvarConfigPayload | null;
  draftIdentity: {
    tipo_recurso: string;
    nome_comercial: string;
    nome_interno: string;
    sku_interno: string;
    sku_comercial: string;
    id_unidade: number | undefined;
    custo_unitario_base: number;
    unidade_xml: string | undefined;
  } | null;
}

// Identificador exibido no pai: ID do produto vinculado ou, para item novo, o SKU customizado
// (o ID real é gerado por AUTO_INCREMENT quando o item for criado no banco)
export const getMappedId = (mapping: MappingPayload): number | string | null =>
  mapping.mode === "EXISTING_DIRECT"
    ? mapping.existingProduct?.sku || mapping.existingProductId
    : mapping.draftIdentity?.sku_interno || null;

interface MappingModalProps {
  items: ProductEntry[];
  supplierCnpj: string;
  onMap: (tempId: string | number, data: MappingPayload) => void;
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

const EMPTY_ITEM: ProductEntry = { tempId: "" };

const ProductMappingModal: React.FC<MappingModalProps> = ({
  items = [],
  onMap,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isBatch = items.length > 1;
  const currentItem: ProductEntry = items[currentIndex] ?? EMPTY_ITEM;

  const [step, setStep] = useState(0);

  // Identidade do Recurso (`itens_core`)
  const [draftTipoRecurso, setDraftTipoRecurso] = useState<string>(currentItem.tipoRecurso || TIPO_RECURSO_PADRAO);
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
  const [selectedExisting, setSelectedExisting] = useState<ItemCatalogoBusca | null>(null);
  const [searchResults, setSearchResults] = useState<ItemCatalogoBusca[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Conversão de compra: unidade da NF -> unidade base de estoque
  const [convUnidadeBase, setConvUnidadeBase] = useState<string>(currentItem.unidade || "UN");
  const [convFator, setConvFator] = useState<number>(1);
  const [configVendasRascunho, setConfigVendasRascunho] = useState<SalvarConfigPayload | null>(null);

  const searchInputRef = useRef<any>(null);
  const [unitsFromStep, setUnitsFromStep] = useState<SalesUnit[]>([]);

  // Sincroniza os dados do item atual sempre que o currentIndex mudar
  useEffect(() => {
    if (currentItem) {
      setDraftCommercialName(currentItem.descricao || "");
      setDraftInternalName(currentItem.descricao || "");
      setDraftInternalSku(currentItem.sku || "");
      setDraftCommercialSku("");
      setDraftTipoRecurso(currentItem.tipoRecurso || TIPO_RECURSO_PADRAO);
      setDraftUnidade(1);
      setStep1Mode(null);
      setSelectedExisting(null);
      setExistingSearch("");
      setSearchResults([]);
      setConvUnidadeBase((currentItem.unidade || "UN").toUpperCase());
      setConvFator(1);
      setConfigVendasRascunho(null);
      setIsInternalNameEditable(false);
      setIsInternalSkuEditable(false);
      setStep(0);
      setUnitsFromStep([]);
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

  useEffect(() => {
    if (step1Mode !== "EXISTING_DIRECT") return;
    const termo = existingSearch.trim();
    if (termo.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    const timer = setTimeout(() => {
      buscarItensCatalogo(termo, 1, controller.signal)
        .then(resultados => {
          setSearchResults(resultados);
          setSearchError(null);
        })
        .catch(err => {
          if (err.name === "AbortError") return;
          setSearchResults([]);
          setSearchError(err.message || "Erro ao buscar itens.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [existingSearch, step1Mode]);

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
      // Conversão de compra válida; item novo precisa da configuração de vendas montada
      if (!(convFator > 0) || !convUnidadeBase.trim()) return false;
      if (step1Mode === "DRAFT") return configVendasRascunho !== null;
      return true;
    }
    return true;
  };

  const handleConfirmItem = () => {
    const unitsPayload: SalesUnit[] = unitsFromStep && unitsFromStep.length ? unitsFromStep : [];

    const baseCost = currentItem.valorUnitario || 0;

    const payload: MappingPayload = {
      mode: step1Mode,
      existingProductId: step1Mode === "EXISTING_DIRECT" ? selectedExisting?.id ?? null : null,
      existingProduct: step1Mode === "EXISTING_DIRECT" && selectedExisting ? {
        sku: selectedExisting.sku,
        nome: selectedExisting.name,
        tipo_recurso: selectedExisting.tipoRecurso
      } : null,
      supplierLinkData: {
        sku_fornecedor: currentItem.sku || "",
        ean_fornecedor: currentItem.ean || null,
        descricao_fornecedor: currentItem.descricao || ""
      },
      salesUnits: unitsPayload,
      conversaoCompra: {
        unidade_compra: (currentItem.unidade || "UN").toUpperCase(),
        unidade_base: convUnidadeBase.trim().toUpperCase(),
        fator: convFator
      },
      configVendas: step1Mode === "DRAFT" ? configVendasRascunho : null,
      draftIdentity: step1Mode === "DRAFT" ? {
        tipo_recurso: draftTipoRecurso,
        nome_comercial: draftCommercialName.trim(),
        nome_interno: draftInternalName.trim(),
        sku_interno: draftInternalSku.trim(),
        sku_comercial: draftCommercialSku.trim(),
        id_unidade: draftUnidade,
        custo_unitario_base: baseCost,
        unidade_xml: currentItem.unidade
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
              current={step}
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
                  <div style={{ fontSize: '11px', fontWeight: 500, color: '#595959' }}>{currentItem.prod?.CFOP || '—'}</div>
                </Col>
              </Row>

              <Row gutter={8}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Qtd Nota</Text>
                  <div style={{ fontWeight: 600, fontSize: '12px' }}>{currentItem.quantidade} {currentItem.unidade}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Valor Total Item</Text>
                  <div style={{ fontWeight: 600, fontSize: '12px' }}>R$ {(currentItem.valorTotal || 0).toFixed(2)}</div>
                </Col>
              </Row>

              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Composição Financeira (Unitário)</Text>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#8c8c8c' }}>Custo Nota:</span>
                  <span>R$ {(currentItem.valorBaseUnitario || 0).toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#8c8c8c' }}>IPI (Unit.):</span>
                  <span>R$ {((currentItem.ipi || 0) / (currentItem.quantidade || 1)).toFixed(2)}</span>
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
                      <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: '12px' }}>Buscar item existente no catálogo</Text>
                      <Input
                        ref={searchInputRef}
                        placeholder="SKU, nome, variação ou marca (mín. 2 caracteres)"
                        value={existingSearch}
                        onChange={(e) => setExistingSearch(e.target.value)}
                        allowClear
                        style={{ marginBottom: 8 }}
                      />
                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '4px', minHeight: 60 }}>
                        {isSearching ? (
                          <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
                        ) : searchError ? (
                          <Text type="danger" style={{ fontSize: 12, padding: 8, display: 'block' }}>{searchError}</Text>
                        ) : searchResults.length === 0 ? (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={existingSearch.trim().length < 2 ? "Digite para buscar no catálogo" : "Nenhum item encontrado"}
                            style={{ margin: '8px 0' }}
                          />
                        ) : (
                          searchResults.map(result => {
                            const isSelected = selectedExisting?.id === result.id;
                            const tipo = getTipoRecursoConfig(result.tipoRecurso);
                            return (
                              <div
                                key={result.id}
                                onClick={() => {
                                  setSelectedExisting(result);
                                  setConvUnidadeBase((result.unitOfMeasure || currentItem.unidade || "UN").toUpperCase());
                                }}
                                style={{
                                  padding: '6px 8px',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  backgroundColor: isSelected ? '#e6f4ff' : 'transparent',
                                  border: isSelected ? '1px solid #91caff' : '1px solid transparent',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 8
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <Text strong={isSelected} style={{ fontSize: 12, display: 'block' }} ellipsis>{result.name}</Text>
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    {result.sku}
                                    {result.variacao && result.variacao !== 'Principal' ? ` · ${result.variacao}` : ''}
                                    {result.marca ? ` · ${result.marca}` : ''}
                                  </Text>
                                </div>
                                <Space size={4}>
                                  {result.status !== 'ATIVO' && <Tag color="red">{result.status}</Tag>}
                                  <Tag color={tipo.color} style={{ margin: 0 }}>{tipo.short}</Tag>
                                </Space>
                              </div>
                            );
                          })
                        )}
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
                              {TIPOS_RECURSO.map(t => (
                                <Option key={t.value} value={t.value}>{t.label}</Option>
                              ))}
                            </Select>
                          </div>
                        </Col>
                        <Col span={8}>
                          <div style={{ padding: '8px 10px', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px' }}>
                            <Text strong style={{ fontSize: '11px', color: '#52c41a' }}>Unidade (XML) 🔒</Text>
                            <Input 
                              value={currentItem.unidade || ''} 
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
                              value={`R$ ${(currentItem.valorUnitario || 0).toFixed(2)}`} 
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

              {step === 1 && (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <div style={{ padding: '8px 10px', backgroundColor: '#f9f0ff', border: '1px solid #d3adf7', borderRadius: '6px' }}>
                      <Text strong style={{ fontSize: '11px', color: '#722ed1' }}>Conversão de Compra (NF → Estoque) *</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 12 }}>1 <b>{(currentItem.unidade || 'UN').toUpperCase()}</b> na nota =</Text>
                        <InputNumber
                          size="small"
                          min={0.000001}
                          value={convFator}
                          onChange={(v) => setConvFator(Number(v) || 0)}
                          style={{ width: 90 }}
                        />
                        {step1Mode === "EXISTING_DIRECT" && selectedExisting?.unitOfMeasure ? (
                          <Tag color="purple" style={{ margin: 0 }}>{convUnidadeBase}</Tag>
                        ) : (
                          <Input
                            size="small"
                            value={convUnidadeBase}
                            maxLength={10}
                            onChange={(e) => setConvUnidadeBase(e.target.value.toUpperCase())}
                            style={{ width: 70 }}
                            placeholder="UN"
                          />
                        )}
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          (unidade base de estoque{step1Mode === "EXISTING_DIRECT" && selectedExisting?.unitOfMeasure ? ' do item' : ''})
                        </Text>
                      </div>
                      {convFator > 0 && (
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                          Esta nota: {currentItem.quantidade || 0} {(currentItem.unidade || 'UN').toUpperCase()} → <b>{Number(((currentItem.quantidade || 0) * convFator).toFixed(4))} {convUnidadeBase || '?'}</b> no estoque
                          {' '}· custo por {convUnidadeBase || '?'}: R$ {((currentItem.valorUnitario || 0) / convFator).toFixed(4)}
                        </Text>
                      )}
                    </div>

                  {step1Mode === "DRAFT" ? (
                    <ProductCommercialSalesConfig
                      rascunho={{
                        unidadeBase: convUnidadeBase,
                        unidadeCompra: (currentItem.unidade || "UN").toUpperCase(),
                        fatorCompra: convFator,
                        custoUnidadeCompra: (currentItem.valorUnitario || 0),
                        nomeItem: draftInternalName
                      }}
                      onRascunhoChange={setConfigVendasRascunho}
                    />
                  ) : (
                    <Card size="small" style={{ borderRadius: 6 }}>
                      <Space direction="vertical" size={4}>
                        <Text strong style={{ fontSize: 12 }}>
                          🔗 {selectedExisting?.name} <Text type="secondary" style={{ fontSize: 11 }}>({selectedExisting?.sku})</Text>
                        </Text>
                        <Text style={{ fontSize: 12 }}>
                          Custo desta entrada por {convUnidadeBase || '?'}: <b>R$ {convFator > 0 ? ((currentItem.valorUnitario || 0) / convFator).toFixed(4) : '—'}</b>
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          O preço de venda deste item segue o custo gerencial já configurado. Se esta entrada mudar o custo,
                          o item fica sinalizado como defasado e o gestor decide se atualiza o preço.
                        </Text>
                      </Space>
                    </Card>
                  )}
                </Space>
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

          {step === 0 ? (
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
              {step1Mode === "EXISTING_DIRECT"
                ? (currentIndex < items.length - 1 ? 'Vincular e Próximo Item ➔' : 'Vincular Último Item')
                : (currentIndex < items.length - 1 ? 'Salvar e Próximo Item ➔' : 'Salvar e Finalizar Fila')}
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  );
};

export default ProductMappingModal;