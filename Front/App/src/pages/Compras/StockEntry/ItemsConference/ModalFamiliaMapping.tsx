import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Select, Input, Table, Radio, Space, Typography, Card, Divider, message } from 'antd';
import { 
  Item, 
  Familia, 
  ItemAttribute, 
  FamiliaMappingPayload, 
  FamiliaAttribute 
} from '../types';
import { generateFamiliaId } from '../helpers';

const { Title, Text, Paragraph } = Typography;

interface FamiliaMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  familias: Familia[];
  onSaveFamiliaMapping: (payload: FamiliaMappingPayload) => void;
}

// Substitua a linha de declaração de props/parâmetros por esta:
export const ModalFamiliaMapping: React.FC<FamiliaMappingModalProps> = ({
  isOpen,
  onClose,
  item,
  familias = [], // 👈 Adicione este valor padrão crucial aqui
  onSaveFamiliaMapping,
}) => {
  const [isNewFamilia, setIsNewFamilia] = useState<boolean>(false);
  const [selectedFamiliaId, setSelectedFamiliaId] = useState<string>('');
  const [newFamiliaName, setNewFamiliaName] = useState<string>('');
  const [newFamiliaAttributes, setNewFamiliaAttributes] = useState<FamiliaAttribute[]>([]);
  const [newAttrInputName, setNewAttrInputName] = useState<string>('');
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && item) {
      setIsNewFamilia(!item.familiaId);
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
    if (isNewFamilia || !familias) return null; // 👈 Proteção extra contra undefined
    return familias.find(f => f.id === selectedFamiliaId) || null;
  }, [isNewFamilia, selectedFamiliaId, familias]);

  const activeAttributesSchema = useMemo(() => {
    if (isNewFamilia) {
      return newFamiliaAttributes;
    }
    return currentSelectedFamilia ? currentSelectedFamilia.atributos : [];
  }, [isNewFamilia, newFamiliaAttributes, currentSelectedFamilia]);

  // 📝 GERAÇÃO DO PREVIEW DA DESCRIÇÃO EM TEMPO REAL
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
      message.warning('Este atributo já foi adicionado ao esquema da família.');
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
      title="Vincular Família ao Produto"
      open={isOpen}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancelar
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit}>
          Confirmar Vínculo
        </Button>
      ]}
    >
      <Card size="small" style={{ marginBottom: 16, background: '#f5f5f5' }}>
        <Paragraph style={{ margin: 0 }}>
          <Text strong>Item da NF:</Text> {item.descricao}
        </Paragraph>
        <Paragraph style={{ margin: 0, marginTop: 4 }}>
          <Text strong>NCM:</Text> {item.ncm || '-'} | <Text strong>EAN:</Text> {item.gtin || '-'}
        </Paragraph>
      </Card>

      {/* SWITCH DE SELEÇÃO DE MODO */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Radio.Group 
          value={isNewFamilia} 
          onChange={e => setIsNewFamilia(e.target.value)} 
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value={false}>Escolher Existente</Radio.Button>
          <Radio.Button value={true}>Criar Nova Família</Radio.Button>
        </Radio.Group>
      </div>

      <div style={{ display: 'flex', gap: '24px' }}>
        
        {/* COLUNA ESQUERDA: Configuração ou Criação */}
        <div style={{ flex: 1 }}>
          {!isNewFamilia ? (
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Selecione a Família</label>
              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder="-- Selecione uma família cadastrada --"
                optionFilterProp="children"
                value={selectedFamiliaId || undefined}
                onChange={value => setSelectedFamiliaId(value)}
                options={(familias || []).map(f => ({ value: f.id, label: f.nome }))}
              />
            </div>
          ) : (
            <Card size="small" title="Modo de Criação Ativo">
              <Paragraph type="secondary" style={{ fontSize: '12px' }}>
                Você está criando uma nova família comercial. Defina as características abaixo:
              </Paragraph>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Nome da Nova Família</label>
                <Input
                  value={newFamiliaName}
                  onChange={e => setNewFamiliaName(e.target.value)}
                  placeholder="Ex: AMANCO TEE MARROM"
                />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Esquema de Atributos da Família</Text>
                <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                  <Input
                    value={newAttrInputName}
                    onChange={e => setNewAttrInputName(e.target.value)}
                    placeholder="Ex: BITOLA, COR"
                    onPressEnter={handleAddNewAttributeSchema}
                  />
                  <Button type="primary" onClick={handleAddNewAttributeSchema}>+ Add</Button>
                </Space.Compact>

                {newFamiliaAttributes.length > 0 && (
                  <Table
                    dataSource={newFamiliaAttributes.map((attr, idx) => ({ ...attr, key: attr.nome, index: idx }))}
                    pagination={false}
                    size="small"
                    columns={[
                      { title: 'Atributo', dataIndex: 'nome', key: 'nome' },
                      { 
                        title: 'Key', 
                        key: 'principal', 
                        width: 60, 
                        align: 'center',
                        render: (_, record) => (
                          <Radio
                            checked={!!record.principal}
                            onChange={() => handleSetPrincipalAttribute(record.index)}
                          />
                        )
                      }
                    ]}
                  />
                )}
              </div>
            </Card>
          )}
        </div>

        {/* COLUNA DIREITA: Valores das Variações + Live Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 👁️ ÁREA DE LIVE PREVIEW DA DESCRIÇÃO FINAL */}
          <Card size="small" style={{ background: '#e6f7ff', borderColor: '#91d5ff' }}>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Visualização do Nome do Item na Grade:</Text>
            <Text strong style={{ color: '#096dd9', fontSize: '14px' }}>{generatedDescriptionPreview}</Text>
          </Card>

          {activeAttributesSchema.length > 0 ? (
            <Card size="small" title="Valores deste Item Específico">
              <Paragraph type="secondary" style={{ fontSize: '12px', marginBottom: 12 }}>
                Preencha a variação deste produto na grade:
              </Paragraph>
              <Space direction="vertical" style={{ width: '100%' }}>
                {activeAttributesSchema.map(attr => (
                  <div key={attr.nome}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                      {attr.nome} {attr.principal && <Text type="danger" title="Atributo Principal">*</Text>}
                    </label>
                    <Input
                      value={attributeValues[attr.nome] || ''}
                      onChange={e => handleAttributeValueChange(attr.nome, e.target.value)}
                      placeholder={`Valor para ${attr.nome}`}
                    />
                  </div>
                ))}
              </Space>
            </Card>
          ) : (
            <Card size="small" style={{ textAlign: 'center', padding: '32px 16px', background: '#fafafa' }}>
              <Text type="secondary">Defina ou selecione uma família à esquerda para liberar os campos de variação do item.</Text>
            </Card>
          )}

        </div>
      </div>
    </Modal>
  );
};