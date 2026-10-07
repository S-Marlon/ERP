import React, { useState } from 'react';
import { Card, Input, Button, Space, Typography, message } from 'antd';
import { CopyOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { FamiliaAttribute } from '../types';

const { Text } = Typography;

interface BatchSmartToolbarProps {
  attributes: FamiliaAttribute[];
  selectedRowKeys: string[];
  allItems: any[];
  getItemKey: (item: any) => string;
  onApplyTemplate: (attributeName: string, value: string) => void;
}

export const BatchSmartToolbar: React.FC<BatchSmartToolbarProps> = ({
  attributes,
  selectedRowKeys,
  allItems,
  getItemKey,
  onApplyTemplate,
}) => {
  const [selectedAttrToApply, setSelectedAttrToApply] = useState<string>('');
  const [templateValue, setTemplateValue] = useState<string>('');

  const handleApplyToAll = () => {
    if (!selectedAttrToApply) {
      message.warning('Selecione qual atributo deseja aplicar em massa.');
      return;
    }
    if (!templateValue.trim()) {
      message.warning('Digite o valor que deseja replicar.');
      return;
    }

    onApplyTemplate(selectedAttrToApply, templateValue.trim().toUpperCase());
    message.success(`Atributo "${selectedAttrToApply}" aplicado a todos os ${selectedRowKeys.length} itens!`);
    setTemplateValue('');
  };

  if (attributes.length === 0) return null;

  return (
    <Card 
      size="small" 
      title={<Space><ThunderboltOutlined style={{ color: '#fa8c16' }} /><Text strong>Aplicador Rápido (Universal)</Text></Space>} 
      style={{ marginBottom: 16, background: '#fff7e6', borderColor: '#ffd591', borderRadius: 8 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Text type="secondary" style={{ fontSize: '11px' }}>
          Defina um valor comum (ex: Material: NYLON) para replicar instantaneamente em todos os itens selecionados, ajustando apenas as variações individuais depois.
        </Text>
        <Space.Compact style={{ width: '100%' }}>
          <select 
            style={{ width: '40%', padding: '4px 8px', borderRadius: '6px 0 0 6px', border: '1px solid #d9d9d9', fontSize: '12px' }}
            value={selectedAttrToApply}
            onChange={(e) => setSelectedAttrToApply(e.target.value)}
          >
            <option value="">Selecione o atributo...</option>
            {attributes.map(attr => (
              <option key={attr.nome} value={attr.nome}>{attr.nome}</option>
            ))}
          </select>
          <Input 
            placeholder="Valor universal..." 
            value={templateValue}
            onChange={(e) => setTemplateValue(e.target.value)}
            style={{ width: '45%' }}
          />
          <Button 
            type="primary" 
            style={{ background: '#fa8c16', borderColor: '#fa8c16', borderRadius: '0 6px 6px 0' }}
            icon={<CopyOutlined />}
            onClick={handleApplyToAll}
          >
            Aplicar a Todos
          </Button>
        </Space.Compact>
      </Space>
    </Card>
  );
};