import { API_URL } from '../../../shared/api/config';
import React, { useState, useMemo, useEffect } from 'react';
import { Table, Tag, Space, Button, Modal, Tabs, Input, InputNumber, Select, Switch, Card, Divider, message, Tooltip, Badge, Avatar } from 'antd';
import { SwapOutlined, UserOutlined, ExclamationCircleOutlined, EditOutlined, LinkOutlined, DisconnectOutlined, SearchOutlined, PictureOutlined, ShopOutlined, CheckCircleOutlined } from '@ant-design/icons';
// Importe a sua instância configurada do axios/api
// import api from '../services/api'; 

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
  ficha?: any[];
  dna?: any[];
  grade?: any[];
  [key: string]: any;
}

// 🗂️ SCHEMA CENTRALIZADO DE CAMPOS
export type FieldType = 'text' | 'number' | 'boolean' | 'select';

export interface ErpFieldConfig {
  name: string;
  label: string;
  type: FieldType;
  precision?: number;
  placeholder?: string;
  options?: { label: string; value: string | number }[];
}

export interface ErpTabSchema {
  tabKey: string;
  tabLabel: string;
  fields: ErpFieldConfig[];
}

export const ERP_FIELDS_SCHEMA: ErpTabSchema[] = [
  {
    tabKey: 'geral',
    tabLabel: 'Geral',
    fields: [
      { name: 'variacao', label: 'Nome da Variação (Ex: Azul / G)', type: 'text' },
      { name: 'nome_catalogo', label: 'Nome de Catálogo / Comercial', type: 'text' },
      { name: 'sku', label: 'SKU / Código Interno', type: 'text' },
      { name: 'ean', label: 'Código de Barras (EAN / GTIN)', type: 'text' },
      { name: 'marca', label: 'Marca / Fabricante', type: 'text' },
      { name: 'galeria_fotos', label: 'Galeria de Fotos (URL ID Rápida)', type: 'text' },
      { name: 'status', label: 'Status Ativo', type: 'boolean' },
    ]
  },
  {
    tabKey: 'financeiro',
    tabLabel: 'Financeiro & Suprimentos',
    fields: [
      { name: 'preco_custo', label: 'Preço de Custo (R$)', type: 'number', precision: 2 },
      { name: 'preco_venda', label: 'Preço de Venda (R$)', type: 'number', precision: 2 },
      { name: 'preco_promocional', label: 'Preço Promocional (R$)', type: 'number', precision: 2 },
      { name: 'markup', label: 'Markup (%)', type: 'number', precision: 2 },
      { name: 'fornecedor', label: 'Fornecedor Principal', type: 'text' },
    ]
  },
  {
    tabKey: 'estoque',
    tabLabel: 'Estoque & Logística',
    fields: [
      { name: 'unidade_medida', label: 'Unidade (Ex: UN, KG, PC)', type: 'text' },
      { name: 'estoque_minimo', label: 'Estq. Mínimo', type: 'number' },
      { name: 'peso_kg', label: 'Peso Bruto (Kg)', type: 'number', precision: 2 },
      { name: 'largura_cm', label: 'Largura (cm)', type: 'number', precision: 2 },
      { name: 'altura_cm', label: 'Altura (cm)', type: 'number', precision: 2 },
      { name: 'comprimento_cm', label: 'Comprimento (cm)', type: 'number', precision: 2 },
    ]
  },
  {
    tabKey: 'fiscal',
    tabLabel: 'Fiscal',
    fields: [
      { name: 'ncm', label: 'NCM (Nomenclatura Comum do Mercosul)', type: 'text' },
      { name: 'cest', label: 'CEST', type: 'text' },
      { 
        name: 'origem', 
        label: 'Origem da Mercadoria', 
        type: 'select',
        options: [
          { label: '0 - Nacional', value: 0 },
          { label: '1 - Estrangeira - Importação direta', value: 1 },
          { label: '2 - Estrangeira - Adquirida no mercado interno', value: 2 }
        ]
      },
    ]
  }
];

interface SkuSubTableProps {
  parentItem: { 
    skus?: SkuRow[]; 
    nome_item?: string; 
    descricao?: string;
    nome_catalogo?: string;
    imagem_capa?: string;
    fornecedores?: string[];
  };
  onMoveSkus?: (selectedSkus: SkuRow[], actionType: 'move' | 'ungroup') => void;
  onUpdateSkus?: (updatedSkus: SkuRow[]) => void;
}

export const SkuSubTable: React.FC<SkuSubTableProps> = ({ parentItem, onMoveSkus, onUpdateSkus }) => {
  const initialSkus: SkuRow[] = parentItem?.skus ?? [];
  const [skus, setSkus] = useState<SkuRow[]>(initialSkus);
  const [selectedRowKeys, setSelectedRowKeys] = React.useState<React.Key[]>([]);
  
  const [searchText, setSearchText] = useState<string>('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItems, setEditingItems] = useState<SkuRow[]>([]);

  const [batchTargetField, setBatchTargetField] = useState<string>('marca');
  const [batchTargetValue, setBatchTargetValue] = useState<any>('');

  const [isTabsLinked, setIsTabsLinked] = useState<boolean>(true);
  const [globalActiveTab, setGlobalActiveTab] = useState<string>('geral');
  const [itemActiveTabs, setItemActiveTabs] = useState<Record<number, string>>({});

  

  // 🧬 SINCRONIZA QUANDO O PARENT MUDAR
  useEffect(() => {
    setSkus(parentItem?.skus ?? []);
  }, [parentItem]);



  // 🧬 BUSCA OS ATRIBUTOS (FICHA, DNA, GRADE) SOB DEMANDA PARA CADA SKU
  // 🧬 BUSCA OS ATRIBUTOS (FICHA, DNA, GRADE) SOB DEMANDA PARA CADA SKU
// 🧬 BUSCA OS ATRIBUTOS (FICHA, DNA, GRADE) SOB DEMANDA PARA CADA SKU
  useEffect(() => {
    let isMounted = true;

    async function fetchAtributosForSkus() {
      const currentSkus = parentItem?.skus ?? [];
      if (currentSkus.length === 0) return;

      const updatedSkus = await Promise.all(
        currentSkus.map(async (skuItem) => {
          const identifier = skuItem.sku || skuItem.id_item;
          if (!identifier) return skuItem;

          // Se já tem os atributos carregados, pula a requisição
          if (skuItem.dna && skuItem.grade && skuItem.ficha) return skuItem;

          try {
            const res = await fetch(`${API_URL}/api/catalogo/${identifier}/atributos`);
            const response = await res.json();
            
            const atributosRetorno = response?.atributos || {};

            return {
              ...skuItem,
              ficha: atributosRetorno.ficha || [],
              dna: atributosRetorno.dna || [],
              grade: atributosRetorno.grade || []
            };
          } catch (err) {
            console.error(`❌ Erro ao buscar atributos para o item ${identifier}`, err);
            return skuItem;
          }
        })
      );

      if (isMounted) {
        setSkus(updatedSkus);
      }
    }

    fetchAtributosForSkus();

    return () => {
      isMounted = false;
    };
  }, [parentItem]);

  const filteredSkus = useMemo(() => {
    if (!searchText.trim()) return skus;
    const query = searchText.toLowerCase();
    return skus.filter(item => 
      (item.sku || '').toLowerCase().includes(query) ||
      (item.variacao || '').toLowerCase().includes(query) ||
      (item.marca || '').toLowerCase().includes(query) ||
      (item.nome_catalogo || '').toLowerCase().includes(query)
    );
  }, [skus, searchText]);

  const familyMetrics = useMemo(() => {
    const totalEstoque = skus.reduce((acc, item) => acc + (Number(item.estoque) || 0), 0);
    const mediaPreco = skus.length > 0 ? skus.reduce((acc, item) => acc + (Number(item.preco_venda) || 0), 0) / skus.length : 0;
    return { totalEstoque, mediaPreco };
  }, [skus]);

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
      title: 'Nome / Variação do SKU',
      dataIndex: 'nome_item',
      key: 'nome_item',
      render: (value: string, record: SkuRow) => {
        const nomeSku = value || record.descricao || parentItem?.nome_item || 'Item';
        return `${nomeSku}`;
      }
    },
    {
      title: 'Variações & Atributos',
      dataIndex: 'variacao',
      key: 'variacao',
      render: (value: string, record: SkuRow) => {
        const dnaList = record.dna || [];
        const gradeList = record.grade || [];
        const fichaList = record.ficha || [];

        const hasDetails = dnaList.length > 0 || gradeList.length > 0 || fichaList.length > 0;

       

        return (
          <Space size={[0, 4]} wrap>
            {/* Exibe DNA */}
            {dnaList.map((item: any, idx: number) => (
              <Tooltip title={`DNA-${idx}`}>

              <Tag key={`dna-${idx}`} color="purple">
               {item.nome}: {item.valor}{item.sufixo ? ` ${item.sufixo}` : ''}
              </Tag>
              </Tooltip>

            ))}

            {/* Exibe Grade */}
            {gradeList.map((item: any, idx: number) => (
              <Tooltip title={`grade-${idx}`}>

              <Tag key={`grade-${idx}`} color="cyan">
                {item.nome}: {item.valor}{item.sufixo ? ` ${item.sufixo}` : ''}
              </Tag>
              </Tooltip>
            ))}

            {/* Exibe Ficha (caso queira destacar algo essencial como Material ou Cor caso venham ali) */}
            {/* {fichaList.map((item: any, idx: number) => (
              <Tag key={`ficha-${idx}`} color="default">
                {item.nome}: {item.valor}{item.sufixo ? ` ${item.sufixo}` : ''}
              </Tag>
            ))} */}
          </Space>
        );
      }
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
    {
      title: 'Ação',
      key: 'acao',
      render: (_: any, record: SkuRow) => (
        <Button 
          type="link" 
          size="small" 
          icon={<EditOutlined />}
          onClick={() => {
            setSelectedRowKeys([String(record.sku ?? record.id_item)]);
            setEditingItems([JSON.parse(JSON.stringify(record))]);
            setIsEditModalOpen(true);
          }}
        >
          Editar
        </Button>
      )
    }
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
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      
      {/* 👈 COLUNA ESQUERDA: DADOS DA FAMÍLIA / PRODUTO PAI */}
      <div style={{ flex: '0 0 280px', minWidth: '260px' }}>
        <Card 
          size="small" 
          title={<span style={{ fontSize: '13px' }}><ShopOutlined /> Dados da Família</span>}
          style={{ background: '#fafafa', border: '1px solid #d9d9d9', borderRadius: 8 }}
        >
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <Avatar 
              shape="square" 
              size={80} 
              src={parentItem?.imagem_capa} 
              icon={<PictureOutlined />} 
              style={{ background: '#f0f0f0', color: '#bfbfbf' }} 
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: '11px', color: '#8c8c8c', display: 'block' }}>Nome Principal:</span>
            <strong style={{ fontSize: '13px', color: '#262626' }}>{parentItem?.nome_item || parentItem?.descricao || 'Família sem nome'}</strong>
          </div>

          {parentItem?.nome_catalogo && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: '11px', color: '#8c8c8c', display: 'block' }}>Nome Comercial / Catálogo:</span>
              <span style={{ fontSize: '12px' }}>{parentItem.nome_catalogo}</span>
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: '11px', color: '#8c8c8c', display: 'block' }}>Descrição Geral:</span>
            <span style={{ fontSize: '12px', color: '#595959' }}>{parentItem?.descricao || 'Sem descrição cadastrada.'}</span>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div style={{ fontSize: '11px', color: '#595959', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Total SKUs na Família: <b>{skus.length}</b></span>
            <span>Estoque Consolidado: <b>{familyMetrics.totalEstoque} UN</b></span>
            <span>Média de Preço: <b>R$ {familyMetrics.mediaPreco.toFixed(2)}</b></span>
          </div>
        </Card>
      </div>

      {/* 👉 COLUNA DIREITA: VARIAÇÕES / SKUS E AÇÕES */}
      <div style={{ flex: 1, minWidth: '300px' }}>
        
        {/* 📊 BARRA DE RESUMO & FILTRAGEM */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          marginBottom: 10, flexWrap: 'wrap', gap: 8, background: '#FAFAFA'
        }}>
          <Space size="middle">
            <Badge status="processing" text={<span style={{ fontSize: '12px' }}>Variações Filtradas: <b>{filteredSkus.length}</b></span>} />
          </Space>

          {/* 🔍 Input de Pesquisa Rápida */}
          <Input
            placeholder="Filtrar SKU, Variação ou Marca..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 260 }}
            size="small"
          />

        {/* 🚀 Barra de Ações em Lote */}
          <div style={{
            marginBottom: 10, padding: '8px 12px', background: '#e6f7ff',
            border: '1px solid #91d5ff', borderRadius: 6, display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', width: '100%'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#0050b3' }}>
              {selectedRowKeys.length} selecionado(s)
            </span>
            <Space size="small">
              <Button
                type="primary"
                size="small"
                icon={<SwapOutlined />}
                onClick={() => {
                  const selectedItems = skus.filter(s => selectedRowKeys.includes(String(s.sku ?? s.id_item)));
                  if (onMoveSkus) {
                    onMoveSkus(selectedItems.map(item => ({
                      ...item,
                      nome_item: item.nome_item || parentItem.nome_item || parentItem.descricao || '',
                    })), 'move');
                  }
                }}
              >
                Mover
              </Button>

              <Button
                type="primary"
                ghost
                size="small"
                icon={<EditOutlined />}
                onClick={handleOpenEditModal}
              >
                Edição em Massa
              </Button>

              <Button
                size="small"
                icon={<UserOutlined />}
                danger
                onClick={() => {
                  const selectedItems = skus.filter(s => selectedRowKeys.includes(String(s.sku ?? s.id_item)));
                  Modal.confirm({
                    title: 'Confirmar Desagrupamento',
                    icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
                    content: `Deseja remover ${selectedItems.length} item(ns) desta família?`,
                    okText: 'Sim',
                    okType: 'danger',
                    cancelText: 'Não',
                    onOk() {
                      onMoveSkus ? onMoveSkus(selectedItems, 'ungroup') : message.success('Desagrupado!');
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
        </div>

        {/* Tabela Interna */}
        <Table
          columns={skuColumns}
          dataSource={filteredSkus}
          rowSelection={rowSelection}
          rowKey={(record: SkuRow, index) => String(record.sku ?? record.id_item ?? index)}
          pagination={filteredSkus.length > 5 ? { pageSize: 10, size: 'small' } : false}
          size="small"
          style={{ background: '#fff', borderRadius: 6 }}
        />

        {/* 🚀 MODAL HÍBRIDO DE EDIÇÃO */}
        <Modal
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24, padding: '4px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '15px', fontWeight: 600 }}>Painel de Gestão ERP</span>
                <Tag color="processing" style={{ margin: 0, fontSize: '12px', padding: '2px 8px' }}>
                  {editingItems.length} item(ns) selecionado(s)
                </Tag>
              </div>
              <Tooltip title={isTabsLinked ? "Abas sincronizadas para todos os cards" : "Abas independentes por card"}>
                <Button
                  type={isTabsLinked ? "primary" : "default"}
                  size="small"
                  ghost={!isTabsLinked}
                  icon={isTabsLinked ? <LinkOutlined /> : <DisconnectOutlined />}
                  onClick={() => setIsTabsLinked(!isTabsLinked)}
                >
                  {isTabsLinked ? "Sincronizar Abas" : "Abas Livres"}
                </Button>
              </Tooltip>
            </div>
          }
          open={isEditModalOpen}
          onOk={() => { onUpdateSkus?.(editingItems); setIsEditModalOpen(false); setSelectedRowKeys([]); }}
          onCancel={() => setIsEditModalOpen(false)}
          width={1020}
          okText="Salvar Alterações"
          cancelText="Cancelar"
          okButtonProps={{ type: 'primary', icon: <CheckCircleOutlined /> }}
        >
          {/* Atalho Global / Em Massa */}
          <div style={{ 
            background: '#f0f2f5', 
            padding: '12px 16px', 
            borderRadius: 8, 
            marginBottom: 16, 
            border: '1px solid #d9d9d9',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 8, color: '#1f1f1f', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚡ Atalho de Atualização Rápida em Massa:</span>
              <span style={{ fontWeight: 400, color: '#8c8c8c' }}>(Altera o campo selecionado em todos os itens abaixo simultaneamente)</span>
            </div>
            <Space style={{ width: '100%' }} size="middle">
              <Select
                value={batchTargetField}
                style={{ width: 240 }}
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

          {/* Container Scrollável dos Cards de Edição */}
          <div style={{ maxHeight: '460px', overflowY: 'auto', paddingRight: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {editingItems.map((item, index) => {
                const activeKey = isTabsLinked ? globalActiveTab : (itemActiveTabs[index] || 'geral');

                return (
                  <Card
                    key={item.sku || index}
                    size="small"
                    style={{ border: '1px solid #d9d9d9', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                    title={
                      <Space size="middle">
                        <Tag color="geekblue">{item.sku || 'SKU N/D'}</Tag>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>
                          {item.variacao ? `${item.nome_item || parentItem.nome_item} (${item.variacao})` : 'Item Principal'}
                        </span>
                      </Space>
                    }
                  >
                    <Tabs
                      size="small"
                      activeKey={activeKey}
                      onChange={(key) => {
                        if (isTabsLinked) {
                          setGlobalActiveTab(key);
                        } else {
                          setItemActiveTabs(prev => ({ ...prev, [index]: key }));
                        }
                      }}
                      items={ERP_FIELDS_SCHEMA.map(section => ({
                        key: section.tabKey,
                        label: <span style={{ fontSize: '12px', fontWeight: 500 }}>{section.tabLabel}</span>,
                        children: (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '6px 2px' }}>
                            {section.fields.map(field => (
                              <div key={field.name} style={field.name === 'variacao' || field.name === 'galeria_fotos' ? { gridColumn: 'span 2' } : {}}>
                                <label style={{ fontSize: '11px', fontWeight: 500, color: '#595959', display: 'block', marginBottom: 2 }}>
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
    </div>
  );
};