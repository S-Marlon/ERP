import React, { useState } from 'react';
import { Table, Tag, Space, Button, Modal, Tabs, Input, InputNumber, Select, Switch, Card, Divider, message, Tooltip } from 'antd';
import { SwapOutlined, UserOutlined, ExclamationCircleOutlined, EditOutlined, LinkOutlined, DisconnectOutlined } from '@ant-design/icons';

interface SkuRow {
  key?: string;
  id_item?: number;
  nome_item?: string;
  sku?: string;
  variacao?: string;
  estoque?: number;
  preco_venda?: number;
  marca?: string;
  status?: string;
  ncm?: string;
  peso_kg?: number;
  [key: string]: any; 
}

// 🗂️ SCHEMA CENTRALIZADO DE CAMPOS (Escalável para dezenas de campos)
const ERP_FIELDS_SCHEMA = [
  {
    tabKey: 'geral',
    tabLabel: 'Geral',
    fields: [
      { name: 'marca', label: 'Marca / Fabricante', type: 'text' },
      { name: 'status', label: 'Status Ativo', type: 'boolean' },
    ]
  },
  {
    tabKey: 'financeiro',
    tabLabel: 'Financeiro',
    fields: [
      { name: 'preco_venda', label: 'Preço Venda (R$)', type: 'number', precision: 2 },
      { name: 'markup', label: 'Markup (%)', type: 'number', precision: 2 },
    ]
  },
  {
    tabKey: 'estoque',
    tabLabel: 'Estoque & Logística',
    fields: [
      { name: 'estoque_minimo', label: 'Estq. Mínimo', type: 'number' },
      { name: 'peso_kg', label: 'Peso (Kg)', type: 'number', precision: 2 },
    ]
  },
  {
    tabKey: 'fiscal',
    tabLabel: 'Fiscal',
    fields: [
      { name: 'ncm', label: 'NCM', type: 'text' },
      { name: 'cest', label: 'CEST', type: 'text' },
    ]
  }
];

interface SkuSubTableProps {
  parentItem: { skus?: SkuRow[]; nome_item?: string; descricao?: string };
  onMoveSkus?: (selectedSkus: SkuRow[], actionType: 'move' | 'ungroup') => void;
  onUpdateSkus?: (updatedSkus: SkuRow[]) => void;
}

export const SkuSubTable: React.FC<SkuSubTableProps> = ({ parentItem, onMoveSkus, onUpdateSkus }) => {
  const skus: SkuRow[] = parentItem?.skus ?? [];
  const [selectedRowKeys, setSelectedRowKeys] = React.useState<React.Key[]>([]);

  // Estados do Modal de Edição Avançada
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItems, setEditingItems] = useState<SkuRow[]>([]);
  
  // Controle de Lote
  const [batchTargetField, setBatchTargetField] = useState<string>('marca');
  const [batchTargetValue, setBatchTargetValue] = useState<any>('');

  // 🚀 Estado para aba ativa global (quando vinculado) ou individual por índice
  const [isTabsLinked, setIsTabsLinked] = useState<boolean>(true);
  const [globalActiveTab, setGlobalActiveTab] = useState<string>('geral');
  const [itemActiveTabs, setItemActiveTabs] = useState<Record<number, string>>({});

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  const skuColumns = [
    { 
      title: 'SKU', 
      dataIndex: 'sku', 
      key: 'sku', 
      render: (value: string) => <Tag color="blue">{value || '-'}</Tag> 
    },
    { 
      title: 'Produto / Variação', 
      key: 'nome_item', 
      render: (_: any, record: SkuRow) => 
        (record.nome_item || record.descricao || record.nome || parentItem?.nome_item || '--') + ' ' + (record.variacao || 'Principal')
    },
    { 
      title: 'Variação', 
      dataIndex: 'variacao', 
      key: 'variacao', 
      render: (value: string) => value ? <Tag color="cyan">{value}</Tag> : 'Principal' 
    },
    { 
      title: 'Marca', 
      dataIndex: 'marca', 
      key: 'marca', 
      render: (value: string) => value || 'Própria' 
    },
    { 
      title: 'Preço', 
      dataIndex: 'preco_venda', 
      key: 'preco_venda', 
      render: (value: number) => `R$ ${(Number(value) || 0).toFixed(2)}` 
    },
    { 
      title: 'Estoque', 
      dataIndex: 'estoque', 
      key: 'estoque', 
      render: (value: number) => `${Number(value) || 0} UN` 
    },
  ];

  const handleOpenEditModal = () => {
    const selectedItems = skus.filter(s => selectedRowKeys.includes(String(s.sku || s.id_item)));
    setEditingItems(JSON.parse(JSON.stringify(selectedItems)));
    setIsEditModalOpen(true);
  };

  const handleApplyBatch = () => {
    if (batchTargetValue === undefined || batchTargetValue === '') return;
    setEditingItems(prev => prev.map(item => ({ ...item, [batchTargetField]: batchTargetValue })));
    message.success(`Campo alterado em lote com sucesso!`);
  };

  const renderFieldComponent = (fieldConfig: any, value: any, onChange: (val: any) => void) => {
    switch (fieldConfig.type) {
      case 'number':
        return <InputNumber value={value} precision={fieldConfig.precision} style={{ width: '100%' }} onChange={onChange} />;
      case 'boolean':
        return <Switch checked={!!value} onChange={onChange} />;
      case 'text':
      default:
        return <Input value={value || ''} onChange={(e) => onChange(e.target.value)} />;
    }
  };

  const allFieldsFlat = ERP_FIELDS_SCHEMA.flatMap(group => group.fields);
  const currentBatchFieldConfig = allFieldsFlat.find(f => f.name === batchTargetField) || allFieldsFlat[0];

  return (
    <div>
      {/* 🚀 Barra de Ações em Lote */}
      {selectedRowKeys.length > 0 && (
        <div style={{ 
          marginBottom: 12, padding: '10px 14px', background: '#e6f7ff', 
          border: '1px solid #91d5ff', borderRadius: 8, display: 'flex', 
          justifyContent: 'space-between', alignItems: 'center' 
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0050b3' }}>
            {selectedRowKeys.length} variação(ões) selecionada(s) nesta família
          </span>
          <Space size="small">
            <Button 
              type="primary" 
              size="small" 
              icon={<SwapOutlined />}
              onClick={() => {
                const selectedItems = skus.filter(s => selectedRowKeys.includes(String(s.sku || s.id_item)));
                onMoveSkus?.(selectedItems, 'move');
              }}
            >
              Mover para outra Família
            </Button>

            <Button 
              type="primary"
              ghost
              size="small" 
              icon={<EditOutlined />}
              onClick={handleOpenEditModal}
            >
              Edição Avançada em Pilha
            </Button>

            <Button 
              size="small" 
              icon={<UserOutlined />}
              danger
              onClick={() => {
                const selectedItems = skus.filter(s => selectedRowKeys.includes(String(s.sku || s.id_item)));
                Modal.confirm({
                  title: 'Confirmar Desagrupamento',
                  icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
                  content: `Deseja realmente remover ${selectedItems.length} item(ns) desta família e transformá-lo(s) em produtos individuais?`,
                  okText: 'Sim, desagrupar',
                  okType: 'danger',
                  cancelText: 'Cancelar',
                  onOk() {
                    onMoveSkus ? onMoveSkus(selectedItems, 'ungroup') : message.success('Itens desagrupados!');
                    setSelectedRowKeys([]);
                  },
                });
              }}
            >
              Desagrupar
            </Button>

            <Button size="small" onClick={() => setSelectedRowKeys([])}>
              Limpar
            </Button>
          </Space>
        </div>
      )}

      {/* Tabela Interna */}
      <Table
        columns={skuColumns}
        dataSource={skus}
        rowSelection={rowSelection}
        rowKey={(record: SkuRow, index) => String(record.sku ?? record.id_item ?? index)}
        pagination={false}
        size="small"
        style={{ background: '#fff', borderRadius: 6 }}
      />

      {/* 🚀 MODAL HÍBRIDO REFINADO COM UX/UI MODERNA E ABAS VINCULADAS */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
            <span>Painel ERP — Editando {editingItems.length} item(ns) em Pilha</span>
            <Tooltip title={isTabsLinked ? "Abas vinculadas: Mudar a aba em um altera todos simultaneamente" : "Abas livres: Cada item navega independentemente"}>
              <Button 
                type={isTabsLinked ? "primary" : "default"} 
                size="small"
                ghost={!isTabsLinked}
                icon={isTabsLinked ? <LinkOutlined /> : <DisconnectOutlined />}
                onClick={() => setIsTabsLinked(!isTabsLinked)}
              >
                {isTabsLinked ? "Abas Vinculadas (Sync)" : "Abas Livres"}
              </Button>
            </Tooltip>
          </div>
        }
        open={isEditModalOpen}
        onOk={() => { onUpdateSkus?.(editingItems); setIsEditModalOpen(false); setSelectedRowKeys([]); }}
        onCancel={() => setIsEditModalOpen(false)}
        width={980}
        okText="Salvar Todas as Alterações"
        cancelText="Cancelar"
      >
        <p style={{ color: '#666', marginBottom: 14, fontSize: '13px' }}>
          Utilize o aplicador rápido no topo para alterações em massa, ou navegue pelas abas nos cartões abaixo para ajustes cirúrgicos.
        </p>

        {/* 📦 PAINEL DE APLICAÇÃO EM LOTE RÁPIDO */}
        <div style={{ background: '#f8f9fa', padding: '12px 16px', borderRadius: 8, marginBottom: 16, border: '1px solid #e9ecef' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 8, color: '#444' }}>
            ⚡ Atalho de Alteração Global em Massa:
          </span>
          <Space style={{ width: '100%' }} size="middle">
            <Select 
              value={batchTargetField} 
              style={{ width: 220 }} 
              onChange={(val) => { setBatchTargetField(val); setBatchTargetValue(''); }}
              options={ERP_FIELDS_SCHEMA.map(group => ({
                label: group.tabLabel,
                options: group.fields.map(f => ({ label: f.label, value: f.name }))
              }))}
            />
            <div style={{ flex: 1 }}>
              {renderFieldComponent(currentBatchFieldConfig, batchTargetValue, setBatchTargetValue)}
            </div>
            <Button type="primary" onClick={handleApplyBatch}>Aplicar a Todos</Button>
          </Space>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {/* 🥞 GRID DE CARTÕES EM DUAS COLUNAS */}
        <div style={{ maxHeight: '440px', overflowY: 'auto', paddingRight: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {editingItems.map((item, index) => {
              // Define qual aba este card específico deve mostrar
              const activeKey = isTabsLinked ? globalActiveTab : (itemActiveTabs[index] || 'geral');

              return (
                <Card 
                  key={item.sku || index} 
                  size="small" 
                  style={{ 
                    marginBottom: 0, 
                    border: '1px solid #d9d9d9', 
                    borderRadius: 8, 
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)' 
                  }}
                  title={
                    <Space size="middle">
                      <Tag color="geekblue" style={{ fontSize: '12px', padding: '2px 8px' }}>{item.sku || 'SKU N/D'}</Tag>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#262626' }}>
                        {item.variacao ? `Variação: ${item.variacao}` : 'Produto Principal'}
                      </span>
                    </Space>
                  }
                >
                  <Tabs 
                    size="small"
                    activeKey={activeKey}
                    onChange={(key) => {
                      if (isTabsLinked) {
                        setGlobalActiveTab(key); // Se vinculado, muda de todos
                      } else {
                        setItemActiveTabs(prev => ({ ...prev, [index]: key })); // Se livre, muda só deste
                      }
                    }}
                    items={ERP_FIELDS_SCHEMA.map(section => ({
                      key: section.tabKey,
                      label: <span style={{ fontSize: '13px', fontWeight: 500 }}>{section.tabLabel}</span>,
                      children: (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 16px', padding: '6px 2px' }}>
                          {section.fields.map(field => (
                            <div key={field.name}>
                              <label style={{ fontSize: '11px', fontWeight: 500, color: '#595959', display: 'block', marginBottom: 4 }}>
                                {field.label}:
                              </label>
                              {renderFieldComponent(
                                field, 
                                item[field.name], 
                                (val) => setEditingItems(prev => prev.map((it, i) => i === index ? { ...it, [field.name]: val } : it))
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    }))}
                  />
                </Card>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
};