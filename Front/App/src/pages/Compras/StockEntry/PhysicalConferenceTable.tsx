import React, { useMemo, useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Typography, 
  InputNumber, 
  Tag, 
  Tooltip, 
  Row, 
  Col,
  Input
} from 'antd';
import { 
  CheckOutlined, 
  UndoOutlined, 
  BarcodeOutlined,
  SearchOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Item } from './types';

interface PhysicalConferenceModalTableProps {
  items?: Item[];
  onConfirmItems?: (ids: number[]) => void;
  onUnconfirmItems?: (ids: number[]) => void;
  onQuantityChange?: (itemId: number, quantity: number) => void;
}

const { Text, Title } = Typography;

export const PhysicalConferenceTable: React.FC<PhysicalConferenceModalTableProps> = ({
  items: initialItems,
  onConfirmItems,
  onUnconfirmItems,
  onQuantityChange,
}) => {
  const [localItems, setLocalItems] = useState<Item[]>(initialItems || []);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => { 
    setLocalItems(initialItems || []); 
  }, [initialItems]);

  // Filtragem rápida por código de barras, SKU ou descrição direto no modal
  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return localItems;
    const query = searchText.toLowerCase();
    return localItems.filter(i => 
      (i.sku && i.sku.toLowerCase().includes(query)) ||
      (i.descricao && i.descricao.toLowerCase().includes(query)) ||
      (i.ncm && i.ncm.toLowerCase().includes(query))
    );
  }, [localItems, searchText]);

  const handleLocalQuantityChange = (itemId: number, newQty: number) => {
    const qty = Math.min(9999, Math.max(0, newQty));
    setLocalItems(prev => prev.map(it => (it.tempId === itemId ? { ...it, receivedQuantity: qty } : it)));
    onQuantityChange?.(itemId, qty);
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // 📋 COLUNas FOCADAS EM CONFERÊNCIA FÍSICA
  const columns: ColumnsType<Item> = [
    {
      title: 'Item',
      dataIndex: 'nItem',
      key: 'nItem',
      width: 70,
      sorter: (a, b) => Number(a.nItem || a.tempId || 0) - Number(b.nItem || b.tempId || 0),
      render: (text, record) => <Text strong>{text || record.tempId}</Text>
    },
    { 
      title: 'Código / SKU', 
      dataIndex: 'sku', 
      key: 'sku',
      width: 130,
      render: (sku) => <Tag color="default">{sku || 'N/A'}</Tag>
    },
    {
      title: 'Descrição do Produto',
      dataIndex: 'descricao',
      key: 'descricao',
      ellipsis: true,
      render: (text) => <Text strong style={{ fontSize: 13 }}>{text}</Text>
    },
    { 
      title: 'Unid.', 
      dataIndex: 'unidadeMedida', 
      key: 'unidadeMedida', 
      width: 80,
      render: (text) => <Tag>{text || 'UN'}</Tag> 
    },
    {
      title: 'Qtd NF',
      dataIndex: 'quantidade',
      key: 'quantidade',
      width: 90,
      align: 'center',
      render: (val) => <Text style={{ fontSize: 14 }}>{val || 0}</Text>
    },
    {
      title: 'Qtd Recebida (Física)',
      dataIndex: 'receivedQuantity',
      key: 'receivedQuantity',
      width: 140,
      align: 'center',
      render: (val, record) => (
        <InputNumber
          min={0}
          max={9999}
          size="middle"
          value={val}
          autoFocus={false}
          onChange={(v) => handleLocalQuantityChange(record.tempId, Number(v || 0))}
          style={{ width: 90, fontWeight: 'bold', color: '#1890ff' }}
        />
      )
    },
    {
      title: 'Divergência',
      key: 'difference',
      width: 110,
      align: 'center',
      render: (_, record) => {
        const quantityNF = record.quantidade || 0;
        const received = record.receivedQuantity || 0;
        const diff = quantityNF - received;

        if (diff === 0) return <Tag color="success">OK (0)</Tag>;
        return diff > 0 ? (
          <Tooltip title="Falta mercadoria em relação à nota">
            <Tag color="error">Falta: {diff}</Tag>
          </Tooltip>
        ) : (
          <Tooltip title="Excesso de mercadoria recebida">
            <Tag color="warning">Sobra: {Math.abs(diff)}</Tag>
          </Tooltip>
        );
      }
    },
    {
      title: 'Total Unit.',
      dataIndex: 'valorUnitario',
      key: 'valorUnitario',
      width: 110,
      align: 'right',
      render: (val) => formatCurrency(val || 0)
    },
    {
      title: 'Status',
      key: 'status',
      width: 90,
      align: 'center',
      render: (_, record) => {
        if (record.confirmed) return <Tag color="success" icon={<CheckOutlined />}>Conferido</Tag>;
        return <Tag color="default">Pendente</Tag>;
      }
    }
  ];

  return (
    <div style={{ background: '#fff', padding: 4 }}>
      
      {/* BARRA DE AÇÕES RÁPIDAS NO MODAL */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }} gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Space wrap>
            <Text strong>{`${selectedRowKeys.length} selecionado(s)`}</Text>
            <Button 
              type="primary" 
              size="small" 
              icon={<CheckOutlined />} 
              disabled={selectedRowKeys.length === 0} 
              style={{ background: '#52c41a' }}
              onClick={() => { 
                onConfirmItems?.(selectedRowKeys.map(Number)); 
                setSelectedRowKeys([]); 
              }}
            >
              Conferir Lote
            </Button>
            <Button 
              size="small" 
              icon={<UndoOutlined />} 
              disabled={selectedRowKeys.length === 0} 
              onClick={() => { 
                onUnconfirmItems?.(selectedRowKeys.map(Number)); 
                setSelectedRowKeys([]); 
              }}
            >
              Desfazer
            </Button>
          </Space>
        </Col>

        <Col xs={24} md={12} style={{ textAlign: 'right' }}>
          <Input
            placeholder="Filtrar por SKU, Descrição ou NCM..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: '100%', maxWidth: 280 }}
            size="middle"
          />
        </Col>
      </Row>

      {/* TABELA DE CONFERÊNCIA OTIMIZADA */}
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        columns={columns}
        dataSource={filteredItems}
        rowKey="tempId"
        size="middle"
        bordered
        pagination={{ pageSize: 10, showSizeChanger: false }}
      />
    </div>
  );
};

export default PhysicalConferenceTable;