import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Button, 
  Checkbox, 
  Radio, 
  Space, 
  Typography, 
  Modal, 
  Input, 
  Select, 
  InputNumber, 
  Tag, 
  Tooltip, 
  Row, 
  Col,
  Divider,
  Alert
} from 'antd';
import { 
  SettingOutlined, 
  ThunderboltOutlined, 
  CheckOutlined, 
  UndoOutlined, 
  LinkOutlined, 
  DeleteOutlined, 
  FolderAddOutlined,
  EditOutlined,
  PlusOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { GroupMappingModal } from './GroupMappingModal';
import ManageGroupsModal from './ManageGroupsModal';
import GroupEditModal from './GroupEditModal';
import GroupItemsEditModal from './GroupItemsEditModal';
import {
  Item,
  Group,
  ItemAttribute,
  GroupMappingPayload,
  FilterType,
} from './types';

import { generateItemDisplayName, getBorderColorFromGroupId, hasAttributeOverride, generateGroupId } from './helpers';

interface Props {
  items?: Item[];
  groups?: Group[];
  onConfirmItems?: (ids: number[]) => void;
  onUnconfirmItems?: (ids: number[]) => void;
  onMapProducts?: (ids: number[]) => void;
  onRemoveItems?: (ids: number[]) => void;
  onQuantityChange?: (itemId: number, quantity: number) => void;
  onAssignGroupToItem?: (itemId: number, groupId: string) => void;
  onCreateAndAssignGroup?: (itemId: number, groupData: Group) => void;
  onUpdateGroup?: (groupId: string, groupData: Partial<Group>) => void;
  onUnassignGroupFromItem?: (itemId: number) => void;
  onApplyItemAttributeOverride?: (itemId: number, atributos: ItemAttribute[]) => void;
  onBatchAssignGroup?: (itemIds: number[], groupId: string) => void;
  onBatchSaveItemsAttributes?: (updatedItems: { tempId: number; atributosCustomizados: ItemAttribute[] }[]) => void;
}

const { Text, Title } = Typography;

export const ItemsConference: React.FC<Props> = ({
  items: initialItems,
  groups: initialGroups,
  onConfirmItems,
  onUnconfirmItems,
  onMapProducts,
  onRemoveItems,
  onQuantityChange,
  onAssignGroupToItem,
  onCreateAndAssignGroup,
  onUpdateGroup,
  onApplyItemAttributeOverride,
  onBatchAssignGroup,
  onBatchSaveItemsAttributes,
}) => {
  const [localItems, setLocalItems] = useState<Item[]>(initialItems || []);
  const [localGroups, setLocalGroups] = useState<Group[]>(initialGroups || []);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');

  // Modais
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedItemForGroup, setSelectedItemForGroup] = useState<Item | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isBatchAssignOpen, setIsBatchAssignOpen] = useState(false);
  const [isGroupEditModalOpen, setIsGroupEditModalOpen] = useState(false);
  const [groupBeingEdited, setGroupBeingEdited] = useState<Group | null>(null);
  const [isItemsEditOpen, setIsItemsEditOpen] = useState(false);
  const [grupoSelecionadoParaItens, setGrupoSelecionadoParaItens] = useState<Group | null>(null);

  // Estados Lote AntD
  const [batchAssignMode, setBatchAssignMode] = useState<'LINK' | 'CREATE'>('LINK');
  const [batchSelectedGroupId, setBatchSelectedGroupId] = useState<string>('');
  const [batchNewGroupName, setBatchNewGroupName] = useState<string>('');

  useEffect(() => { setLocalItems(initialItems || []); }, [initialItems]);
  useEffect(() => { setLocalGroups(initialGroups || []); }, [initialGroups]);

  // Mapas de performance
  const groupsById = useMemo(() => {
    const map = new Map<string, Group>();
    for (const g of localGroups) map.set(g.id, g);
    return map;
  }, [localGroups]);

  const itemsByGroupId = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of localItems) {
      if (item.grupoId) {
        const list = map.get(item.grupoId) || [];
        list.push(item);
        map.set(item.grupoId, list);
      }
    }
    return map;
  }, [localItems]);

  const pendingItems = useMemo(() => localItems.filter(i => !i.confirmed), [localItems]);
  const confirmedItems = useMemo(() => localItems.filter(i => i.confirmed), [localItems]);
  const divergentItems = useMemo(() => localItems.filter(i => (i.difference ?? 0) !== 0), [localItems]);
  const unmappedItems = useMemo(() => localItems.filter(i => !i.mappedId), [localItems]);

  // Filtragem reativa baseada nas abas
  const filteredItems = useMemo(() => {
    switch (filter) {
      case 'pending': return pendingItems;
      case 'confirmed': return confirmedItems;
      case 'divergent': return divergentItems;
      case 'unmapped': return unmappedItems;
      default: return localItems;
    }
  }, [filter, localItems, pendingItems, confirmedItems, divergentItems, unmappedItems]);

  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Callbacks internos ajustados
  const assignGroupToItem = useCallback((itemId: number, groupId: string) => {
    setLocalItems(prev => prev.map(it => it.tempId === itemId ? { ...it, grupoId: groupId, atributosCustomizados: undefined } : it));
    onAssignGroupToItem?.(itemId, groupId);
  }, [onAssignGroupToItem]);

  const createGroupAndAssign = useCallback((itemId: number, groupData: Group) => {
    setLocalGroups(prev => [...prev, groupData]);
    setLocalItems(prev => prev.map(it => it.tempId === itemId ? { ...it, grupoId: groupData.id, atributosCustomizados: undefined } : it));
    onCreateAndAssignGroup?.(itemId, groupData);
  }, [onCreateAndAssignGroup]);

  const handleOpenGroupModal = (item: Item) => {
    setSelectedItemForGroup(item);
    setIsGroupModalOpen(true);
  };

  const handleSaveGroupMapping = (payload: GroupMappingPayload) => {
    if (!selectedItemForGroup) return;
    if (payload.isNewGroup && payload.groupData) {
      createGroupAndAssign(selectedItemForGroup.tempId, payload.groupData as Group);
    } else if (!payload.isNewGroup) {
      assignGroupToItem(selectedItemForGroup.tempId, payload.groupId);
    }
    if (payload.itemAttributesOverride) {
      applyItemAttributeOverride(selectedItemForGroup.tempId, payload.itemAttributesOverride);
    }
    setIsGroupModalOpen(false);
  };

  const handleLocalBatchSubmit = () => {
    const selectedIdsNumbers = selectedRowKeys.map(k => Number(k));
    if (batchAssignMode === 'LINK') {
      if (!batchSelectedGroupId) return Modal.error({ title: 'Aviso', content: 'Selecione um grupo existente.' });
      selectedIdsNumbers.forEach(id => assignGroupToItem(id, batchSelectedGroupId));
      onBatchAssignGroup?.(selectedIdsNumbers, batchSelectedGroupId);
    } else {
      if (!batchNewGroupName.trim()) return Modal.error({ title: 'Aviso', content: 'Informe o nome do novo grupo.' });
      const newGroup: Group = { id: generateGroupId(), nome: batchNewGroupName.trim().toUpperCase(), atributos: [] };
      setLocalGroups(prev => [...prev, newGroup]);
      selectedIdsNumbers.forEach(id => assignGroupToItem(id, newGroup.id));
      onBatchAssignGroup?.(selectedIdsNumbers, newGroup.id);
    }
    setSelectedRowKeys([]);
    setIsBatchAssignOpen(false);
  };

  const handleQuantityChange = (itemId: number, newQty: number) => {
    const qty = Math.min(999, Math.max(0, newQty));
    setLocalItems(prev => prev.map(it => (it.tempId === itemId ? { ...it, receivedQuantity: qty } : it)));
    onQuantityChange?.(itemId, qty);
  };

  const applyItemAttributeOverride = useCallback((itemId: number, atributos: ItemAttribute[]) => {
    setLocalItems(prev => prev.map(it => it.tempId === itemId ? { ...it, atributosCustomizados: atributos } : it));
    onApplyItemAttributeOverride?.(itemId, atributos);
  }, [onApplyItemAttributeOverride]);

  const updateGroup = useCallback((groupId: string, patch: Partial<Group>) => {
    setLocalGroups(prev => prev.map(g => (g.id === groupId ? { ...g, ...patch } : g)));
    onUpdateGroup?.(groupId, patch);
  }, [onUpdateGroup]);

  const handleEditGroup = (groupId: string) => {
    const group = groupsById.get(groupId);
    if (!group) return;
    setGroupBeingEdited(group);
    setIsGroupEditModalOpen(true);
  };

  const handleEditGroupItems = (groupId: string) => {
    const grupoFound = groupsById.get(groupId);
    if (grupoFound) {
      setGrupoSelecionadoParaItens(grupoFound);
      setIsItemsEditOpen(true);
    }
  };

  const handleSaveGroupEdit = (groupData: Group) => {
    updateGroup(groupData.id, { nome: groupData.nome, atributos: groupData.atributos });
    setIsGroupEditModalOpen(false);
    setGroupBeingEdited(null);
  };

  const handleSaveItemsAttributes = (updatedItems: { tempId: number; atributosCustomizados: ItemAttribute[] }[]) => {
    setLocalItems(prevItems => prevItems.map(item => {
      const updateData = updatedItems.find(u => u.tempId === item.tempId);
      return updateData ? { ...item, atributosCustomizados: updateData.atributosCustomizados, confirmed: true } : item;
    }));
    onBatchSaveItemsAttributes?.(updatedItems);
  };

  // 📋 DEFINIÇÃO DE COLUNAS DA ANT DESIGN TABLE
  const columns: ColumnsType<Item> = [
    {
      title: 'Item',
      dataIndex: 'nItem',
      key: 'nItem',
      sorter: (a, b) => Number(a.nItem || a.tempId || 0) - Number(b.nItem || b.tempId || 0),
      render: (text, record) => {
        const borderColor = record.grupoId ? getBorderColorFromGroupId(record.grupoId) : 'transparent';
        return (
          <div style={{ borderLeft: `4px solid ${borderColor}`, paddingLeft: 8, fontWeight: 'bold' }}>
            {text || record.tempId}
          </div>
        );
      }
    },
    {
      title: 'Cod. Interno',
      dataIndex: 'mappedId',
      key: 'mappedId',
      render: (text, record) => text ? (
        <Tag color="blue">{text}</Tag>
      ) : (
        <Button size="small" type="link" icon={<LinkOutlined />} onClick={() => onMapProducts?.([record.tempId])}>
          Vincular
        </Button>
      )
    },
    { title: 'Cod. Forn.', dataIndex: 'sku', key: 'sku' },
    { title: 'NCM', dataIndex: 'ncm', key: 'ncm', sorter: (a, b) => (a.ncm || '').localeCompare(b.ncm || '') },
    {
      title: 'Produto / Nome no Estoque',
      dataIndex: 'descricao',
      key: 'descricao',
      width: 320,
      sorter: (a, b) => (a.descricao || '').localeCompare(b.descricao || ''),
      render: (_, record) => {
        const group = record.grupoId ? groupsById.get(record.grupoId) : null;
        const displayName = generateItemDisplayName(record, group);
        const hasOverride = hasAttributeOverride(record);
        return (
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 13 }}>{record.descricao}</Text>
            <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
              {displayName} {hasOverride && <Tooltip title="Sobrescrita Ativa">⚡</Tooltip>}
            </Text>
          </Space>
        );
      }
    },
    {
      title: 'Grupo',
      dataIndex: 'grupoId',
      key: 'grupoId',
      sorter: (a, b) => {
        const nameA = a.grupoId ? (groupsById.get(a.grupoId)?.nome || '') : '';
        const nameB = b.grupoId ? (groupsById.get(b.grupoId)?.nome || '') : '';
        return nameA.localeCompare(nameB);
      },
      render: (grupoId, record) => grupoId && groupsById.has(grupoId) ? (
        <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenGroupModal(record)}>Editar</Button>
      ) : (
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => handleOpenGroupModal(record)}>Grupo</Button>
      )
    },
    { title: 'UOM', dataIndex: 'unidadeMedida', key: 'unidadeMedida', render: (text) => <Tag>{text || '-'}</Tag> },
    { title: 'Custo Unit.', dataIndex: 'valorUnitario', key: 'valorUnitario', render: (val) => formatCurrency(val || 0) },
    {
      title: 'Qtd (NF)',
      dataIndex: 'quantidade',
      key: 'quantidade',
      render: (val) => <strong>{val || 0}</strong>
    },
    {
      title: 'Qtd Recebido',
      dataIndex: 'receivedQuantity',
      key: 'receivedQuantity',
      render: (val, record) => (
        <InputNumber
          min={0}
          max={999}
          size="small"
          value={val}
          onChange={(v) => handleQuantityChange(record.tempId, Number(v || 0))}
          style={{ width: 70 }}
        />
      )
    },
    {
      title: 'Dif.',
      key: 'difference',
      render: (_, record) => {
        const quantityNF = record.quantidade || 0;
        const diff = typeof record.difference === 'number' ? record.difference : quantityNF - record.receivedQuantity;
        if (diff === 0) return <Text type="success">0</Text>;
        return diff > 0 ? <Text type="danger">-{diff}</Text> : <Text type="success">+{Math.abs(diff)}</Text>;
      }
    },
    {
      title: 'Total Item',
      key: 'totalItem',
      render: (_, record) => formatCurrency((record.valorUnitario || 0) * record.receivedQuantity)
    },
    {
      title: 'Status',
      key: 'status',
      align: 'center',
      render: (_, record) => {
        const quantityNF = record.quantidade || 0;
        const diff = typeof record.difference === 'number' ? record.difference : quantityNF - record.receivedQuantity;
        if (record.confirmed) return <Tooltip title="Item conferido">✅</Tooltip>;
        if (diff !== 0) return <Tooltip title="Divergência detectada">⚠️</Tooltip>;
        return <Tooltip title="Aguardando conferência">⏳</Tooltip>;
      }
    }
  ];

  return (
    <div style={{ background: '#fff', padding: 20, borderRadius: 8 }}>
      
      {/* HEADER CONTROL AREA */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>4. Conferência de Itens ({localItems.length})</Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => setIsManageModalOpen(true)}>
              Gerenciar Grupos ({localGroups.length})
            </Button>
            <Space style={{ background: '#f5f5f5', padding: '4px 12px', borderRadius: 6, border: '1px solid #d9d9d9' }}>
              <Text size="small"><ThunderboltOutlined style={{ color: '#faad14' }} /> Checkagem turbo</Text>
              <Checkbox title="Checkagem turbo automática por duplo clique." />
            </Space>
          </Space>
        </Col>
      </Row>

      {/* FILTROS E AÇÕES COLETIVAS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <Space wrap style={{ background: '#fafafa', padding: 12, borderRadius: 6, border: '1px solid #f0f0f0', justifyContent: 'space-between' }}>
          <Space wrap>
            <Text strong>{selectedRowKeys.length > 0 ? `${selectedRowKeys.length} selecionado(s)` : 'Nenhum item selecionado'}</Text>
            <Button size="small" type="primary" icon={<CheckOutlined />} disabled={selectedRowKeys.length === 0} onClick={() => { onConfirmItems?.(selectedRowKeys.map(Number)); setSelectedRowKeys([]); }}>Conferir</Button>
            <Button size="small" icon={<UndoOutlined />} disabled={selectedRowKeys.length === 0} onClick={() => { onUnconfirmItems?.(selectedRowKeys.map(Number)); setSelectedRowKeys([]); }}>Desfazer</Button>
            <Button size="small" icon={<LinkOutlined />} disabled={selectedRowKeys.length === 0} onClick={() => onMapProducts?.(selectedRowKeys.map(Number))}>Vincular</Button>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0} onClick={() => { onRemoveItems?.(selectedRowKeys.map(Number)); setSelectedRowKeys([]); }}>Remover</Button>
            <Button size="small" icon={<FolderAddOutlined />} disabled={selectedRowKeys.length === 0} onClick={() => setIsBatchAssignOpen(true)}>Definir Grupo em Lote</Button>
          </Space>

          <Radio.Group value={filter} onChange={(e) => setFilter(e.target.value)} size="small">
            <Radio.Button value="all">Todos ({localItems.length})</Radio.Button>
            <Radio.Button value="pending">Pendentes ({pendingItems.length})</Radio.Button>
            <Radio.Button value="confirmed">Conferidos ({confirmedItems.length})</Radio.Button>
            <Radio.Button value="divergent">Divergências ({divergentItems.length})</Radio.Button>
            <Radio.Button value="unmapped">Sem Vínculo ({unmappedItems.length})</Radio.Button>
          </Radio.Group>
        </Space>
      </div>

      {/* DATA TABLE */}
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        columns={columns}
        dataSource={filteredItems}
        rowKey="tempId"
        size="small"
        bordered
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      {/* ================= MODAL: DEFINIR GRUPO EM LOTE ================= */}
      <Modal
        title="Definir Grupo em Lote"
        open={isBatchAssignOpen}
        onCancel={() => setIsBatchAssignOpen(false)}
        onOk={handleLocalBatchSubmit}
        width={700}
        okText="Aplicar em Lote"
        cancelText="Cancelar"
      >
        <Alert 
          message={`Você está alterando múltiplos itens de uma vez.`} 
          description={`${selectedRowKeys.length} produtos herdarão a parametrização selecionada.`}
          type="info" 
          showIcon 
          style={{ marginTop: 12, marginBottom: 16 }}
        />
        <Row gutter={16}>
          <Col span={10}>
            <Text strong block style={{ marginBottom: 6 }}>Itens a serem alterados:</Text>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #d9d9d9', padding: 8, borderRadius: 4, background: '#fafafa' }}>
              {filteredItems.filter(i => selectedRowKeys.includes(i.tempId)).map(si => (
                <div key={si.tempId} style={{ padding: '2px 0', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <Text type="secondary">{si.nItem || si.tempId}.</Text> {si.descricao}
                </div>
              ))}
            </div>
          </Col>
          <Col span={14}>
            <Radio.Group 
              value={batchAssignMode} 
              onChange={e => setBatchAssignMode(e.target.value)} 
              optionType="button" 
              style={{ width: '100%', marginBottom: 16 }}
            >
              <Radio.Button value="LINK" style={{ width: '50%', textAlign: 'center' }}>Vincular a Existente</Radio.Button>
              <Radio.Button value="CREATE" style={{ width: '50%', textAlign: 'center' }}>Criar Novo Grupo</Radio.Button>
            </Radio.Group>

            {batchAssignMode === 'LINK' ? (
              <div>
                <Text block style={{ marginBottom: 4 }}>Escolha o Grupo Existente</Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Selecione um grupo cadastrado"
                  value={batchSelectedGroupId || undefined}
                  onChange={val => setBatchSelectedGroupId(val)}
                >
                  {localGroups.map(g => (
                    <Select.Option key={g.id} value={g.id}>
                      {g.nome} ({itemsByGroupId.get(g.id)?.length || 0} vinculados)
                    </Select.Option>
                  ))}
                </Select>
              </div>
            ) : (
              <div>
                <Text block style={{ marginBottom: 4 }}>Nome do Novo Grupo</Text>
                <Input 
                  placeholder="Ex: AMANCO TEE MARROM" 
                  value={batchNewGroupName}
                  onChange={e => setBatchNewGroupName(e.target.value)}
                />
                <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                  ⚠️ O esquema de características específicas deverá ser configurado posteriormente.
                </Text>
              </div>
            )}
          </Col>
        </Row>
      </Modal>

      {/* ZONE: EXISTING MODALS CONTROL */}
      <GroupMappingModal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} item={selectedItemForGroup} groups={localGroups} onSaveGroupMapping={handleSaveGroupMapping} />
      <ManageGroupsModal isOpen={isManageModalOpen} onClose={() => setIsManageModalOpen(false)} groups={localGroups} items={localItems} onEditGroup={handleEditGroup} onEditGroupItems={handleEditGroupItems} onDeleteGroup={(groupId: string) => { setLocalGroups(prev => prev.filter(g => g.id !== groupId)); setLocalItems(prev => prev.map(it => it.grupoId === groupId ? { ...it, grupoId: undefined, atributosCustomizados: undefined } : it)); }} />
      <GroupEditModal isOpen={isGroupEditModalOpen} onClose={() => setIsGroupEditModalOpen(false)} grupo={groupBeingEdited} onSave={handleSaveGroupEdit} />
      <GroupItemsEditModal isOpen={isItemsEditOpen} onClose={() => { setIsItemsEditOpen(false); setGrupoSelecionadoParaItens(null); }} grupo={grupoSelecionadoParaItens} items={localItems} onSaveItemsAttributes={handleSaveItemsAttributes} />
    </div>
  );
};

export default ItemsConference;