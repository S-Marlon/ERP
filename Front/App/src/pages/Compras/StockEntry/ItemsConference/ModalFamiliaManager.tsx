import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Select, Input, Radio, Space, Typography, Card, message, Alert, Row, Col, Tag, Collapse } from 'antd';
import { 
  AppstoreOutlined, 
  PlusOutlined, 
  SettingOutlined, 
  TagOutlined, 
  BarcodeOutlined,
  BugOutlined
} from '@ant-design/icons';
import { 
  Item, 
  ItemAttribute, 
  FamiliaAttribute,
  Familia
} from '../types';
import { generateFamiliaId } from '../helpers';
import ModalManageFamilias from './ModalManageFamilias';
import { getFamilias, createFamilia } from '../services/familiaService'; 
import { updateProdutoFamiliaEAtributos } from '../Services/VinculodeFamiliaAtributos'; 

const { Text, Paragraph } = Typography;

interface UnifiedFamiliaModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: Item | null;
  selectedRowKeys?: string[];
  allItems?: Item[];
  familias?: Familia[];
  onSaveMapping: (payload: any) => void;
}

export const ModalFamiliaManager: React.FC<UnifiedFamiliaModalProps> = ({
  isOpen,
  onClose,
  item = null,
  selectedRowKeys = [],
  allItems = [],
  familias = [],
  onSaveMapping,
}) => {
  const isBatchMode = selectedRowKeys.length > 0;

  const [mode, setMode] = useState<'LINK' | 'CREATE'>('LINK');
  const [selectedFamiliaId, setSelectedFamiliaId] = useState<string>('');
  const [loadingSave, setLoadingSave] = useState<boolean>(false);
  
  const [newFamiliaName, setNewFamiliaName] = useState<string>('');
  const [newFamiliaAttributes, setNewFamiliaAttributes] = useState<FamiliaAttribute[]>([]);
  const [newAttrInputName, setNewAttrInputName] = useState<string>('');
  
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [batchAttributeValues, setBatchAttributeValues] = useState<Record<string, Record<string, string>>>({});

  const [familiasOficiais, setFamiliasOficiais] = useState<Familia[]>(familias);
  const [familiasTemporarias, setFamiliasTemporarias] = useState<Familia[]>([]);
  const [loadingFamilias, setLoadingFamilias] = useState(false);
  const [isManageFamiliasOpen, setIsManageFamiliasOpen] = useState(false);

  // 🛠️ Estado para inspecionar o payload no painel de debug visual
  const [debugPayload, setDebugPayload] = useState<any>(null);

  const carregarFamiliasOficiais = async () => {
    try {
      setLoadingFamilias(true);
      const data = await getFamilias();
      if (data) setFamiliasOficiais(data);
    } catch (error) {
      setFamiliasOficiais(familias);
    } finally {
      setLoadingFamilias(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarFamiliasOficiais();
      if (!isBatchMode && item) {
        setMode(item.familiaId ? 'LINK' : 'CREATE');
        setSelectedFamiliaId(item.familiaId || '');
        const initialValues: Record<string, string> = {};
        item.atributosCustomizados?.forEach(attr => {
          initialValues[attr.nome] = attr.valor;
        });
        setAttributeValues(initialValues);
      } else {
        setMode('LINK');
        setSelectedFamiliaId('');
        const initialBatchValues: Record<string, Record<string, string>> = {};
        selectedRowKeys.forEach(key => {
          initialBatchValues[key] = {};
        });
        setBatchAttributeValues(initialBatchValues);
      }
      setNewFamiliaName('');
      setNewFamiliaAttributes([]);
      setLoadingSave(false);
      setDebugPayload(null);
    }
  }, [isOpen, item, selectedRowKeys]);

  const currentSelectedFamilia = useMemo(() => {
    if (mode === 'CREATE') return null;
    return [...familiasOficiais, ...familiasTemporarias].find(f => f.id === selectedFamiliaId) || null;
  }, [mode, selectedFamiliaId, familiasOficiais, familiasTemporarias]);

  const activeAttributesSchema = useMemo(() => {
    if (mode === 'CREATE') return newFamiliaAttributes;
    return currentSelectedFamilia ? currentSelectedFamilia.atributos : [];
  }, [mode, newFamiliaAttributes, currentSelectedFamilia]);

  const generatedDescriptionPreview = useMemo(() => {
    if (isBatchMode) return 'Aplicação em lote (Atributos preenchidos individualmente)';
    const familiaName = mode === 'CREATE' ? newFamiliaName.trim().toUpperCase() : (currentSelectedFamilia?.nome || '');
    if (!familiaName) return 'Aguardando definição da família...';
    const principalAttr = activeAttributesSchema.find(attr => attr.principal);
    if (!principalAttr) return familiaName;
    const principalValue = (attributeValues[principalAttr.nome] || '').trim().toUpperCase();
    return `${familiaName} - ${principalValue || '[VALOR PRINCIPAL EM BRANCO]'}`;
  }, [isBatchMode, mode, newFamiliaName, currentSelectedFamilia, activeAttributesSchema, attributeValues]);

  const handleAddNewAttributeSchema = () => {
    const nomeLimpo = newAttrInputName.trim().toUpperCase();
    if (!nomeLimpo || newFamiliaAttributes.some(a => a.nome === nomeLimpo)) return;
    setNewFamiliaAttributes(prev => [
      ...prev,
      { nome: nomeLimpo, principal: prev.length === 0, ordem: prev.length + 1 }
    ]);
    setNewAttrInputName('');
  };

  const handleSubmit = async () => {
    let targetFamiliaId = selectedFamiliaId;

    try {
      setLoadingSave(true);

      if (mode === 'CREATE') {
        const nomeLimpo = newFamiliaName.trim().toUpperCase();
        if (!nomeLimpo) {
          message.error('Defina o nome da nova família.');
          setLoadingSave(false);
          return;
        }
        if (newFamiliaAttributes.length === 0) {
          message.error('Adicione pelo menos um atributo ao esquema.');
          setLoadingSave(false);
          return;
        }

        const novaFamiliaCriada = await createFamilia({
          nome: nomeLimpo,
          tipoItem: 'PA',
          atributos: newFamiliaAttributes
        });

        targetFamiliaId = String(novaFamiliaCriada.id);
      } else if (!targetFamiliaId) {
        message.error('Selecione uma família existente.');
        setLoadingSave(false);
        return;
      }

      let itemAttributesOverride: ItemAttribute[] = [];
      const batchItemOverrides: Record<string, Array<{ nome: string; valor: string }>> = {};

      if (isBatchMode) {
        for (const key of selectedRowKeys) {
          // 🔍 Encontra o item real na lista usando o tempId
          const targetItem = allItems.find(i => i.tempId === key);
          const realSku = targetItem ? (targetItem.sku || (targetItem as any).codigo || (targetItem as any).nItem) : null;

          if (!realSku) {
            message.error(`Um dos itens selecionados não possui um SKU real definido.`);
            setLoadingSave(false);
            return;
          }

          const itemValues = batchAttributeValues[key] || {};
          const parsedAttrs: Array<{ nome: string; valor: string }> = [];
          for (const attr of activeAttributesSchema) {
            const val = (itemValues[attr.nome] || '').trim().toUpperCase();
            if (!val) {
              message.error(`Informe o valor para "${attr.nome}" no item: ${targetItem?.descricao || key}`);
              setLoadingSave(false);
              return;
            }
            parsedAttrs.push({ nome: attr.nome, valor: val });
          }
          
          // 🚀 Armazena usando o SKU real do banco em vez do tempId ("single-17")
          batchItemOverrides[realSku] = parsedAttrs;
        }
      } else {
        // ... (modo unitário continua igual)
        for (const attr of activeAttributesSchema) {
          const val = (attributeValues[attr.nome] || '').trim().toUpperCase();
          if (!val) {
            message.error(`Informe o valor para o atributo "${attr.nome}".`);
            setLoadingSave(false);
            return;
          }
          itemAttributesOverride.push({ nome: attr.nome, valor: val });
        }
      }

      // 🛠️ Mapeamento robusto do SKU real (evita o envio do tempId)
      const skuReal = item ? (item.sku || (item as any).codigo || (item as any).nItem || item.tempId) : undefined;

      const payloadParaEnviar = {
        isBatch: isBatchMode,
        selectedRowKeys,
        sku: skuReal, 
        familiaId: targetFamiliaId,
        itemAttributesOverride: itemAttributesOverride.length > 0 ? itemAttributesOverride : undefined,
        batchItemOverrides: Object.keys(batchItemOverrides).length > 0 ? batchItemOverrides : undefined,
      };

      // Atualiza o painel de debug na tela antes de enviar
      setDebugPayload(payloadParaEnviar);

      // Persistência Direta via API Comercial
      const resultado = await updateProdutoFamiliaEAtributos(payloadParaEnviar);

      message.success(resultado.message || 'Dados salvos com sucesso!');
      
      onSaveMapping({
        familiaId: targetFamiliaId,
        isBatch: isBatchMode,
        selectedRowKeys,
      });

      onClose();
    } catch (error: any) {
      console.error('Erro no salvamento:', error);
      message.error(error.message || 'Erro interno ao salvar os dados.');
    } finally {
      setLoadingSave(false);
    }
  };

  if (!item && !isBatchMode) return null;

  return (
    <Modal
      title={
        <Space>
          <AppstoreOutlined style={{ color: '#1890ff' }} />
          <span>{isBatchMode ? 'Definir Família em Lote' : 'Vincular Família ao Produto'}</span>
        </Space>
      }
      open={isOpen}
      onCancel={onClose}
      width={isBatchMode ? 850 : 920}
      centered
      confirmLoading={loadingSave}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={loadingSave} style={{ borderRadius: 6 }}>Cancelar</Button>,
        <Button key="submit" type="primary" onClick={handleSubmit} loading={loadingSave} style={{ borderRadius: 6, paddingInline: 24 }}>
          {isBatchMode ? 'Aplicar em Lote' : 'Confirmar Vínculo'}
        </Button>
      ]}
    >
      {isBatchMode ? (
        <Alert
          message="Alteração em Lote com Atributos Individuais"
          description={`${selectedRowKeys.length} produtos selecionados. Preencha os atributos específicos para cada item abaixo.`}
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      ) : (
        <Card size="small" style={{ marginBottom: 20, background: '#fafafa', borderRadius: 8 }}>
          <Paragraph style={{ margin: 0, fontSize: '13px' }}>
            <Text strong>Item:</Text> {item?.descricao}
          </Paragraph>
          <Space size={16} style={{ marginTop: 4, fontSize: '12px' }}>
            <Text type="secondary"><TagOutlined /> <Text strong>SKU Real Detectado:</Text> <Tag color="green">{item?.sku || (item as any)?.codigo || 'Não definido'}</Tag></Text>
            <Text type="secondary"><BarcodeOutlined /> <Text strong>EAN:</Text> {item?.gtin || '-'}</Text>
          </Space>
        </Card>
      )}

      {/* 🛠️ Painel de Debug Visual */}
      <Collapse 
        size="small" 
        style={{ marginBottom: 16, background: '#fffbe6', borderColor: '#ffe58f' }}
        items={[{
          key: 'debug',
          label: <Space><BugOutlined style={{ color: '#faad14' }} /><Text type="warning" strong>Painel de Debug (Payload que será enviado)</Text></Space>,
          children: (
            <pre style={{ fontSize: '11px', background: '#272822', color: '#f8f8f2', padding: 8, borderRadius: 4, maxHeight: 150, overflow: 'auto' }}>
              {debugPayload ? JSON.stringify(debugPayload, null, 2) : 'Clique em "Confirmar Vínculo" para gerar o payload...'}
            </pre>
          )
        }]}
      />

      {/* Seletor de Modo (Existente vs Criar) */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Radio.Group 
          value={mode} 
          onChange={e => setMode(e.target.value)} 
          optionType="button" 
          buttonStyle="solid"
          disabled={loadingSave}
        >
          <Radio.Button value="LINK" style={{ paddingInline: 24 }}>Vincular a Existente</Radio.Button>
          <Radio.Button value="CREATE" style={{ paddingInline: 24 }}>Criar Nova Família</Radio.Button>
        </Radio.Group>
      </div>

      <Row gutter={24}>
        {/* Coluna Esquerda: Listagem interativa de itens em lote com inputs de atributos */}
        {isBatchMode && (
          <Col span={12}>
            <Text strong block style={{ marginBottom: 6, fontSize: '12px' }}>
              Atributos por Item ({selectedRowKeys.length}):
            </Text>
            <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid #d9d9d9', padding: 8, borderRadius: 6, background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allItems.filter(i => selectedRowKeys.includes(i.tempId)).map(si => (
                <Card key={si.tempId} size="small" title={<Text style={{ fontSize: '12px' }} strong>{si.descricao}</Text>} style={{ borderRadius: 6 }}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 6 }}>SKU: {si.sku || si.nItem || si.tempId}</Text>
                  
                  {activeAttributesSchema.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: '11px', fontStyle: 'italic' }}>Selecione ou crie uma família para habilitar os atributos.</Text>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }} size={4}>
                      {activeAttributesSchema.map(attr => (
                        <div key={attr.nome}>
                          <Text style={{ fontSize: '11px' }} strong>{attr.nome} {attr.principal && <span style={{ color: 'red' }}>*</span>}</Text>
                          <Input 
                            size="small"
                            placeholder={`Valor para ${attr.nome}`}
                            value={batchAttributeValues[si.tempId]?.[attr.nome] || ''}
                            disabled={loadingSave}
                            onChange={e => {
                              const val = e.target.value;
                              setBatchAttributeValues(prev => ({
                                ...prev,
                                [si.tempId]: {
                                  ...(prev[si.tempId] || {}),
                                  [attr.nome]: val
                                }
                              }));
                            }}
                          />
                        </div>
                      ))}
                    </Space>
                  )}
                </Card>
              ))}
            </div>
          </Col>
        )}

        {/* Coluna Direita: Seleção ou Criação da Família */}
        <Col span={isBatchMode ? 12 : 24}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'LINK' ? (
              <Card size="small" title="Selecionar Família do Catálogo" style={{ borderRadius: 8 }}>
                <Select
                  showSearch
                  style={{ width: '100%' }}
                  placeholder="Selecione uma família cadastrada"
                  optionFilterProp="children"
                  value={selectedFamiliaId || undefined}
                  onChange={val => setSelectedFamiliaId(val)}
                  loading={loadingFamilias}
                  disabled={loadingSave}
                  options={[...familiasOficiais, ...familiasTemporarias].map(f => ({
                    value: f.id,
                    label: f.nome
                  }))}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => setIsManageFamiliasOpen(true)} disabled={loadingSave}>
                    Gerenciar Catálogo Completo
                  </Button>
                </div>
              </Card>
            ) : (
              <Card size="small" title="Configurar Nova Família" style={{ borderRadius: 8, background: '#f0f5ff', borderColor: '#91d5ff' }}>
                <div style={{ marginBottom: 10 }}>
                  <Text type="secondary" style={{ fontSize: '11px' }}>Nome da Família:</Text>
                  <Input placeholder="Ex: MANGUEIRA HIDRÁULICA" value={newFamiliaName} onChange={e => setNewFamiliaName(e.target.value)} disabled={loadingSave} />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px' }}>Adicionar Atributos:</Text>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input 
                      placeholder="Ex: COR, TAMANHO" 
                      value={newAttrInputName} 
                      onChange={e => setNewAttrInputName(e.target.value)} 
                      onPressEnter={handleAddNewAttributeSchema}
                      disabled={loadingSave}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNewAttributeSchema} disabled={loadingSave}>Add</Button>
                  </Space.Compact>
                </div>
                {newFamiliaAttributes.length > 0 && (
                  <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size={4}>
                    {newFamiliaAttributes.map(attr => (
                      <Tag key={attr.nome} color={attr.principal ? 'blue' : 'default'}>
                        {attr.nome} {attr.principal && '(Principal)'}
                      </Tag>
                    ))}
                  </Space>
                )}
              </Card>
            )}

            {!isBatchMode && (
              <>
                <Card size="small" style={{ background: '#e6f7ff', borderColor: '#91d5ff', borderRadius: 8 }}>
                  <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Preview do Item:</Text>
                  <Text strong style={{ color: '#096dd9', display: 'block' }}>{generatedDescriptionPreview}</Text>
                </Card>

                {activeAttributesSchema.length > 0 && (
                  <Card size="small" title="Valores do Item" style={{ borderRadius: 8 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {activeAttributesSchema.map(attr => (
                        <div key={attr.nome}>
                          <Text style={{ fontSize: '12px' }} strong>{attr.nome} {attr.principal && <span style={{ color: 'red' }}>*</span>}</Text>
                          <Input 
                            value={attributeValues[attr.nome] || ''} 
                            onChange={e => setAttributeValues(prev => ({ ...prev, [attr.nome]: e.target.value }))}
                            placeholder={`Valor para ${attr.nome}`}
                            disabled={loadingSave}
                          />
                        </div>
                      ))}
                    </Space>
                  </Card>
                )}
              </>
            )}
          </div>
        </Col>
      </Row>

      <ModalManageFamilias
        isOpen={isManageFamiliasOpen}
        onClose={() => {
          setIsManageFamiliasOpen(false);
          carregarFamiliasOficiais();
        }}
        items={item ? [item] : []}
      />
    </Modal>
  );
};