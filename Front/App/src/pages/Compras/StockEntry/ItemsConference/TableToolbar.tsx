import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Select, Input, Radio, Space, Typography, Card, Divider, message, Tooltip, Badge } from 'antd';
import { 
  AppstoreOutlined, 
  PlusOutlined, 
  SettingOutlined, 
  InfoCircleOutlined, 
  CheckCircleOutlined,
  TagOutlined,
  BarcodeOutlined
} from '@ant-design/icons';
import { 
  Item, 
  ItemAttribute, 
  FamiliaMappingPayload, 
  FamiliaAttribute,
  Familia,
  AtributoGlobal
} from '../types';
import { generateFamiliaId } from '../helpers';
import ModalEditFamilia from './ModaEditFamilia';
// import ModalManageFamilias from './ModalManageFamilias';
import { getFamilias } from '../services/familiaService';

const { Title, Text, Paragraph } = Typography;

interface TableToolbarProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  familias: Familia[];
  onSaveFamiliaMapping: (payload: FamiliaMappingPayload) => void;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  isOpen,
  onClose,
  item,
  familias = [], 
  onSaveFamiliaMapping,
}) => {
  const [isNewFamilia, setIsNewFamilia] = useState<boolean>(false);
  const [selectedFamiliaId, setSelectedFamiliaId] = useState<string>('');
  const [newFamiliaName, setNewFamiliaName] = useState<string>('');
  const [newFamiliaAttributes, setNewFamiliaAttributes] = useState<FamiliaAttribute[]>([]);
  const [newAttrInputName, setNewAttrInputName] = useState<string>('');
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});

  // Estados de controle dos modais internos
  const [isManageFamiliasOpen, setIsManageFamiliasOpen] = useState(false);
  const [isEditFamiliaOpen, setIsEditFamiliaOpen] = useState(false);
  const [selectedFamiliaIdParaEdicao, setSelectedFamiliaIdParaEdicao] = useState<string | null>(null);
  
  const [familiasOficiais, setFamiliasOficiais] = useState<Familia[]>(familias);
  const [familiasTemporarias, setFamiliasTemporarias] = useState<Familia[]>([]);
  const [atributosGlobais, setAtributosGlobais] = useState<AtributoGlobal[]>([]);
  const [loadingFamilias, setLoadingFamilias] = useState(false);

  // Carregar famílias atualizadas via API
  const carregarFamiliasOficiais = async () => {
    try {
      setLoadingFamilias(true);
      const data = await getFamilias();
      if (data) {
        setFamiliasOficiais(data);
      }
    } catch (error) {
      // Fallback para as props recebidas caso a API falhe
      setFamiliasOficiais(familias);
    } finally {
      setLoadingFamilias(false);
    }
  };

  useEffect(() => {
    setFamiliasOficiais(familias);
  }, [familias]);

  useEffect(() => {
    if (isOpen) {
      carregarFamiliasOficiais();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && item) {
      const hasFamily = Boolean(item.familiaId);
      setIsNewFamilia(!hasFamily);
      setSelectedFamiliaId(item.familiaId || '');
      setNewFamiliaName('');
      setNewFamiliaAttributes([]);
      setNewAttrInputName('');
      
      const initialValues: Record<string, string> = {};
      if (item.atributosCustomizados) {
        item.atributosCustomizados.forEach(attr => {
          initialValues[attr.nome] = attr.valor;
        });
      }
      setAttributeValues(initialValues);
    }
  }, [isOpen, item]);

  const currentSelectedFamilia = useMemo(() => {
    if (isNewFamilia) return null;
    return familiasOficiais.find(f => f.id === selectedFamiliaId) || 
           familiasTemporarias.find(f => f.id === selectedFamiliaId) || 
           null;
  }, [isNewFamilia, selectedFamiliaId, familiasOficiais, familiasTemporarias]);

  const activeAttributesSchema = useMemo(() => {
    if (isNewFamilia) {
      return newFamiliaAttributes;
    }
    return currentSelectedFamilia ? currentSelectedFamilia.atributos : [];
  }, [isNewFamilia, newFamiliaAttributes, currentSelectedFamilia]);

  const generatedDescriptionPreview = useMemo(() => {
    const familiaName = isNewFamilia 
      ? newFamiliaName.trim().toUpperCase() 
      : (currentSelectedFamilia?.nome || '');

    if (!familiaName) return 'Aguardando definição da família...';

    const principalAttr = activeAttributesSchema.find(attr => attr.principal);
    if (!principalAttr) return familiaName;

    const principalValue = (attributeValues[principalAttr.nome] || '').trim().toUpperCase();

    return `${familiaName} - ${principalValue || '[VALOR PRINCIPAL EM BRANCO]'}`;
  }, [isNewFamilia, newFamiliaName, currentSelectedFamilia, activeAttributesSchema, attributeValues]);

  if (!item) return null;

  const handleAttributeValueChange = (nome: string, valor: string) => {
    setAttributeValues(prev => ({ ...prev, [nome]: valor }));
  };

  const handleAddNewAttributeSchema = () => {
    const nomeLimpo = newAttrInputName.trim().toUpperCase();
    if (!nomeLimpo) return;

    if (newFamiliaAttributes.some(attr => attr.nome === nomeLimpo)) {
      message.warning('Este atributo já foi adicionado ao esquema da nova família.');
      return;
    }

    const newAttr: FamiliaAttribute = {
      nome: nomeLimpo,
      principal: newFamiliaAttributes.length === 0,
      ordem: newFamiliaAttributes.length + 1
    };

    setNewFamiliaAttributes(prev => [...prev, newAttr]);
    setNewAttrInputName('');
  };

  const handleOpenEditFamilia = (familiaId: string) => {
    setSelectedFamiliaIdParaEdicao(familiaId);
    setIsEditFamiliaOpen(true);
  };

  const handleSetPrincipalAttribute = (indexToSet: number) => {
    setNewFamiliaAttributes(prev =>
      prev.map((attr, idx) => ({
        ...attr,
        principal: idx === indexToSet
      }))
    );
  };

  const handleSubmit = () => {
    let targetFamiliaId = selectedFamiliaId;
    let createdFamiliaData: Familia | undefined = undefined;

    if (isNewFamilia) {
      const nomeFamiliaLimpo = newFamiliaName.trim().toUpperCase();
      if (!nomeFamiliaLimpo) {
        message.error('Por favor, defina o nome da nova família.');
        return;
      }
      if (newFamiliaAttributes.length === 0) {
        message.error('Por favor, adicione pelo menos um atributo ao esquema da nova família.');
        return;
      }
      targetFamiliaId = generateFamiliaId();
      createdFamiliaData = { id: targetFamiliaId, nome: nomeFamiliaLimpo, atributos: newFamiliaAttributes };
    } else {
      if (!targetFamiliaId) {
        message.error('Por favor, selecione uma família existente.');
        return;
      }
    }

    const itemAttributesOverride: ItemAttribute[] = [];
    let missingValue = false;

    for (const attr of activeAttributesSchema) {
      const valorPreenchido = (attributeValues[attr.nome] || '').trim().toUpperCase();
      if (!valorPreenchido) {
        missingValue = true;
        message.error(`Por favor, informe o valor da variação para o atributo "${attr.nome}".`);
        break;
      }
      itemAttributesOverride.push({
        nome: attr.nome,
        principal: attr.principal,
        valor: valorPreenchido
      });
    }

    if (missingValue) return;

    onSaveFamiliaMapping({
      familiaId: targetFamiliaId,
      isNewFamilia,
      familiaData: createdFamiliaData,
      itemAttributesOverride: itemAttributesOverride.length > 0 ? itemAttributesOverride : undefined
    });
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
          <Space>
            <AppstoreOutlined style={{ color: '#1890ff', fontSize: '20px' }} />
            <div>
              <span style={{ fontSize: '16px', fontWeight: 600 }}>Vincular Família ao Produto</span>
              <div style={{ fontSize: '12px', fontWeight: 400, color: '#8c8c8c' }}>Gerencie o vínculo e atributos comerciais da nota</div>
            </div>
          </Space>
          <Button 
            type="default" 
            size="small" 
            icon={<SettingOutlined />} 
            onClick={() => setIsManageFamiliasOpen(true)}
            style={{ borderRadius: 6 }}
          >
            Gerenciar Catálogo
          </Button>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      width={920}
      centered
      footer={[
        <Button key="cancel" onClick={onClose} style={{ borderRadius: 6 }}>
          Cancelar
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit} style={{ borderRadius: 6, paddingLeft: 24, paddingRight: 24 }}>
          Confirmar Vínculo
        </Button>
      ]}
    >
      {/* Informações do Item Resumidas */}
      <Card size="small" style={{ marginBottom: 20, background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
        <Paragraph style={{ margin: 0, fontSize: '13px' }}>
          <Text strong>Item da NF:</Text> {item.descricao}
        </Paragraph>
        <Space size={16} style={{ marginTop: 6, fontSize: '12px' }}>
          <Text type="secondary"><TagOutlined /> <Text strong>NCM:</Text> {item.ncm || '-'}</Text>
          <Text type="secondary"><BarcodeOutlined /> <Text strong>EAN / GTIN:</Text> {item.gtin || '-'}</Text>
        </Space>
      </Card>

      {/* Seletor de Modo (Existente vs Nova Família) */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Radio.Group 
          value={isNewFamilia} 
          onChange={e => setIsNewFamilia(e.target.value)} 
          optionType="button"
          buttonStyle="solid"
          size="middle"
        >
          <Radio.Button value={false} style={{ borderRadius: '6px 0 0 6px', paddingInline: 24 }}>Escolher Existente</Radio.Button>
          <Radio.Button value={true} style={{ borderRadius: '0 6px 6px 0', paddingInline: 24 }}>Criar Nova Temporária</Radio.Button>
        </Radio.Group>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Coluna Esquerda: Escolha ou Criação de Família */}
        <div style={{ flex: 1 }}>
          {!isNewFamilia ? (
            <Card size="small" title="Seleção no Catálogo" style={{ borderRadius: 8, border: '1px solid #d9d9d9' }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: '13px' }}>Selecione a Família Oficial:</label>
              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder="-- Selecione uma família cadastrada --"
                optionFilterProp="children"
                value={selectedFamiliaId || undefined}
                onChange={value => setSelectedFamiliaId(value)}
                loading={loadingFamilias}
                options={([...familiasOficiais, ...familiasTemporarias]).map(f => ({ value: f.id, label: f.nome }))}
                notFoundContent={<Text type="secondary">Nenhuma família encontrada</Text>}
              />
              
              {selectedFamiliaId && (
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button 
                    type="link" 
                    size="small" 
                    icon={<SettingOutlined />}
                    onClick={() => handleOpenEditFamilia(selectedFamiliaId)}
                  >
                    Editar Estrutura desta Família
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <Card size="small" title="Criar Nova Família Temporária" style={{ borderRadius: 8, border: '1px solid #91d5ff', background: '#f0f5ff' }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '13px' }}>Nome da Nova Família *</label>
                <Input 
                  placeholder="Ex: CAMISA POLO, TENIS ESPORTIVO..." 
                  value={newFamiliaName}
                  onChange={e => setNewFamiliaName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '13px' }}>Adicionar Atributos (Esquema)</label>
                <Space.Compact style={{ width: '100%' }}>
                  <Input 
                    placeholder="Ex: COR, TAMANHO, VOLTAGEM..."
                    value={newAttrInputName}
                    onChange={e => setNewAttrInputName(e.target.value)}
                    onPressEnter={handleAddNewAttributeSchema}
                  />
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNewAttributeSchema}>
                    Adicionar
                  </Button>
                </Space.Compact>
              </div>

              {newFamiliaAttributes.length > 0 && (
                <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #d9d9d9', marginTop: 10 }}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 6 }}>Atributos Configurados (Defina o Principal 🔑):</Text>
                  <Space direction="vertical" style={{ width: '100%' }} size={4}>
                    {newFamiliaAttributes.map((attr, idx) => (
                      <div key={attr.nome} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', padding: '4px 8px', borderRadius: 4 }}>
                        <Space>
                          <Tag color={attr.principal ? 'blue' : 'default'}>{attr.nome}</Tag>
                          {attr.principal && <span style={{ fontSize: '11px', color: '#1890ff' }}>Principal</span>}
                        </Space>
                        {!attr.principal && (
                          <Button type="link" size="small" onClick={() => handleSetPrincipalAttribute(idx)} style={{ fontSize: '11px' }}>
                            Tornar Principal
                          </Button>
                        )}
                      </div>
                    ))}
                  </Space>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Coluna Direita: Preview e Valores Dinâmicos */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card size="small" style={{ background: '#e6f7ff', borderColor: '#91d5ff', borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pré-visualização do Nome Comercial:</Text>
            <Text strong style={{ color: '#096dd9', fontSize: '14px', display: 'block', marginTop: 4 }}>{generatedDescriptionPreview}</Text>
          </Card>

          {activeAttributesSchema.length > 0 ? (
            <Card size="small" title="Preenchimento de Atributos do Item" style={{ borderRadius: 8, border: '1px solid #d9d9d9' }}>
              <Paragraph type="secondary" style={{ fontSize: '12px', marginBottom: 12 }}>
                Preencha os valores correspondentes para este item específico:
              </Paragraph>
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                {activeAttributesSchema.map(attr => (
                  <div key={attr.nome}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '12px' }}>
                      {attr.nome} {attr.principal && <Text type="danger" title="Atributo Principal">*</Text>}
                    </label>
                    <Input
                      value={attributeValues[attr.nome] || ''}
                      onChange={e => handleAttributeValueChange(attr.nome, e.target.value)}
                      placeholder={`Informe o valor para ${attr.nome}`}
                      style={{ borderRadius: 6 }}
                    />
                  </div>
                ))}
              </Space>
            </Card>
          ) : (
            <Card size="small" style={{ textAlign: 'center', padding: '32px 16px', background: '#fafafa', borderRadius: 8, border: '1px dashed #d9d9d9' }}>
              <InfoCircleOutlined style={{ fontSize: '24px', color: '#bfbfbf', marginBottom: 8 }} />
              <Text type="secondary" style={{ display: 'block', fontSize: '13px' }}>Selecione ou crie uma família para liberar os campos de variação do item.</Text>
            </Card>
          )}
        </div>
      </div>

      {/* Modal de Edição Estrutural */}
      <ModalEditFamilia
        isOpen={isEditFamiliaOpen}
        onClose={() => {
          setIsEditFamiliaOpen(false);
          setSelectedFamiliaIdParaEdicao(null);
          carregarFamiliasOficiais();
        }}
        familiaId={selectedFamiliaIdParaEdicao}
        familias={[...familiasOficiais, ...familiasTemporarias]}
        atributosGlobaisDisponiveis={atributosGlobais}
        onSaveSuccess={() => {
          carregarFamiliasOficiais();
        }}
      />

      {/* Modal Gerenciador de Famílias Integrado */}
      <ModalManageFamilias
        isOpen={isManageFamiliasOpen}
        onClose={() => {
          setIsManageFamiliasOpen(false);
          carregarFamiliasOficiais();
        }}
        items={item ? [item] : []}
        onEditFamiliaItems={(familiaId) => {
          setSelectedFamiliaId(familiaId);
          setIsManageFamiliasOpen(false);
        }}
        atributosGlobaisDisponiveis={atributosGlobais}
      />
    </Modal>
  );
};