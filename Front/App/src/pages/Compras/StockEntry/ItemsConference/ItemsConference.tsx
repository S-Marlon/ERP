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
Tag,
Tooltip,
Row,
Col,
InputNumber,
Alert,
Descriptions,
Divider,
Statistic
} from 'antd';
import {
SettingOutlined,
ThunderboltOutlined,
CheckOutlined,
UndoOutlined,
LinkOutlined,
DeleteOutlined,
FolderAddOutlined,
PlusOutlined,
InfoCircleOutlined,
DollarOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

// Substitua o import antigo de ManageGroupsModal por:
import ManageFamiliasModal from './ModalManageFamilias'; // ou './ManageFamiliasModal' se renomeou o arquivo
import { ModalFamiliaMapping } from './ModalFamiliaMapping';

import ManageGroupsModal from './ModalManageFamilias';
import GroupEditModal from './GroupEditModal';
import GroupItemsEditModal from './GroupItemsEditModal';
import {
Item,
Group,
ItemAttribute,
GroupMappingPayload,
FilterType,
} from '../types';

import { generateItemDisplayName, hasAttributeOverride, generateGroupId } from '../helpers';

interface Props {
items?: Item[];
groups?: Group[];
onConfirmItems?: (ids: string[] | number[]) => void;
onUnconfirmItems?: (ids: string[] | number[]) => void;
onMapProducts?: (ids: string[] | number[]) => void;
onRemoveItems?: (ids: string[] | number[]) => void;
onAssignGroupToItem?: (itemId: string | number, groupId: string) => void;
onCreateAndAssignGroup?: (itemId: string | number, groupData: Group) => void;
onUpdateGroup?: (groupId: string, groupData: Partial<Group>) => void;
onUnassignGroupFromItem?: (itemId: string | number) => void;
onApplyItemAttributeOverride?: (itemId: string | number, atributos: ItemAttribute[]) => void;
onBatchAssignGroup?: (itemIds: (string | number)[], groupId: string) => void;
onBatchSaveItemsAttributes?: (updatedItems: { tempId: string | number; atributosCustomizados: ItemAttribute[] }[]) => void;
onQuantityChange?: (tempId: string, newReceivedQty: number) => void;
onToggleItem?: (tempId: string, confirmed: boolean) => void;
}

const { Text, Title } = Typography;

export const ItemsConference: React.FC<Props> = ({
items: initialItems,
groups: initialGroups,
onConfirmItems,
onUnconfirmItems,
onMapProducts,
onRemoveItems,
onAssignGroupToItem,
onCreateAndAssignGroup,
onUpdateGroup,
onApplyItemAttributeOverride,
onBatchAssignGroup,
onBatchSaveItemsAttributes,
onQuantityChange,
onToggleItem,
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

const [barcodeModalVisible, setBarcodeModalVisible] = useState(false);
const [selectedItemForBarcode, setSelectedItemForBarcode] = useState<any>(null);
const [inputValue, setInputValue] = useState('');

// Abre o modal e guarda qual item está sendo editado
const openBarcodeInputModal = (record: any) => {
  setSelectedItemForBarcode(record);
  setInputValue('');
  setBarcodeModalVisible(true);
};

// Salva o código de barras no item correspondente no estado da tabela
const handleSaveCustomGtin = () => {
  if (!inputValue.trim()) {
    message.warning("Digite ou bipa um código de barras válido.");
    return;
  }

  // Identificador único do produto (ex: cProd ou chave do item)
  const targetId = selectedItemForBarcode.prod?.cProd || selectedItemForBarcode.cProd;

  setItems((prevItems: any[]) =>
    prevItems.map((item) => {
      const currentId = item.prod?.cProd || item.cProd;
      if (currentId === targetId) {
        return { ...item, customGtin: inputValue.trim() };
      }
      return item;
    })
  );

  message.success("Código de barras vinculado com sucesso!");
  setBarcodeModalVisible(false);
};

// Modal de Detalhes do Item (clique no 'i')
const [isItemDetailsModalOpen, setIsItemDetailsModalOpen] = useState(false);
const [itemForDetails, setItemForDetails] = useState<Item | null>(null);

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

const pendingItems = useMemo(() => localItems.filter(i => !i.isConfirmed && !i.confirmed), [localItems]);
const confirmedItems = useMemo(() => localItems.filter(i => i.isConfirmed || i.confirmed), [localItems]);
const divergentItems = useMemo(() => localItems.filter(i => (i.difference ?? 0) !== 0), [localItems]);
const unmappedItems = useMemo(() => localItems.filter(i => !i.mappedId && !i.sku), [localItems]);

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
const assignGroupToItem = useCallback((itemId: string | number, groupId: string) => {
setLocalItems(prev => prev.map(it => (it.tempId === itemId || it.nItem === itemId) ? { ...it, grupoId: groupId, atributosCustomizados: undefined } : it));
onAssignGroupToItem?.(itemId, groupId);
}, [onAssignGroupToItem]);

const createGroupAndAssign = useCallback((itemId: string | number, groupData: Group) => {
setLocalGroups(prev => [...prev, groupData]);
setLocalItems(prev => prev.map(it => (it.tempId === itemId || it.nItem === itemId) ? { ...it, grupoId: groupData.id, atributosCustomizados: undefined } : it));
onCreateAndAssignGroup?.(itemId, groupData);
}, [onCreateAndAssignGroup]);

const handleOpenGroupModal = (item: Item) => {
setSelectedItemForGroup(item);
setIsGroupModalOpen(true);
};

const handleOpenItemDetails = (item: Item) => {
setItemForDetails(item);
setIsItemDetailsModalOpen(true);
};

const handleBarcodeScan = (scannedCode: string) => {
  // Procura se o código escaneado bate com o cEAN do XML ou com o customGtin cadastrado anteriormente
  const foundIndex = items.findIndex(item => {
    const p = item.prod || item;
    return p.cEAN === scannedCode || item.customGtin === scannedCode;
  });

  if (foundIndex !== -1) {
    // Incrementa automaticamente a quantidade recebida ou destaca a linha na tela!
    message.success(`Item encontrado: ${items[foundIndex].prod?.xProd || 'Produto'}`);
    // Opcional: focar na linha ou incrementar a quantidade recebida
  } else {
    message.warning(`Nenhum produto encontrado com o código: ${scannedCode}`);
  }
};



const handleSaveGroupMapping = (payload: GroupMappingPayload) => {
if (!selectedItemForGroup) return;
const targetId = selectedItemForGroup.tempId;
if (payload.isNewGroup && payload.groupData) {
createGroupAndAssign(targetId, payload.groupData as Group);
} else if (!payload.isNewGroup) {
assignGroupToItem(targetId, payload.groupId);
}
if (payload.itemAttributesOverride) {
applyItemAttributeOverride(targetId, payload.itemAttributesOverride);
}
setIsGroupModalOpen(false);
};

const handleLocalBatchSubmit = () => {
if (batchAssignMode === 'LINK') {
if (!batchSelectedGroupId) return Modal.error({ title: 'Aviso', content: 'Selecione um grupo existente.' });
selectedRowKeys.forEach(id => assignGroupToItem(id, batchSelectedGroupId));
onBatchAssignGroup?.(selectedRowKeys, batchSelectedGroupId);
} else {
if (!batchNewGroupName.trim()) return Modal.error({ title: 'Aviso', content: 'Informe o nome do novo grupo.' });
const newGroup: Group = { id: generateGroupId(), nome: batchNewGroupName.trim().toUpperCase(), atributos: [] };
setLocalGroups(prev => [...prev, newGroup]);
selectedRowKeys.forEach(id => assignGroupToItem(id, newGroup.id));
onBatchAssignGroup?.(selectedRowKeys, newGroup.id);
}
setSelectedRowKeys([]);
setIsBatchAssignOpen(false);
};

const applyItemAttributeOverride = useCallback((itemId: string | number, atributos: ItemAttribute[]) => {
setLocalItems(prev => prev.map(it => (it.tempId === itemId || it.nItem === itemId) ? { ...it, atributosCustomizados: atributos } : it));
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

const handleSaveItemsAttributes = (updatedItems: { tempId: string | number; atributosCustomizados: ItemAttribute[] }[]) => {
setLocalItems(prevItems => prevItems.map(item => {
const updateData = updatedItems.find(u => u.tempId === item.tempId || u.tempId === item.nItem);
return updateData ? { ...item, atributosCustomizados: updateData.atributosCustomizados, isConfirmed: true, confirmed: true } : item;
}));
onBatchSaveItemsAttributes?.(updatedItems);
};

// 📋 DEFINIÇÃO DE COLUNAS
const columns: ColumnsType<Item> = [
{
title: (
<Space size={8}>
<Checkbox
indeterminate={
selectedRowKeys.length > 0 && selectedRowKeys.length < filteredItems.length
}
checked={
filteredItems.length > 0 && selectedRowKeys.length === filteredItems.length
}
onChange={(e) => {
if (e.target.checked) {
setSelectedRowKeys(filteredItems.map(i => i.tempId));
} else {
setSelectedRowKeys([]);
}
}}
/>
<span>Item</span>
</Space>
),
key: 'itemCombined',
width: 70,
render: (_, record) => {
const isSelected = selectedRowKeys.includes(record.tempId);
return (
<Space size={8} align="center">
<Checkbox 
checked={isSelected} 
onChange={(e) => {
if (e.target.checked) {
setSelectedRowKeys([...selectedRowKeys, record.tempId]);
} else {
setSelectedRowKeys(selectedRowKeys.filter(key => key !== record.tempId));
}
}} 
/>
<span style={{ fontWeight: 'bold' }}>
{record.nItem || record.tempId}
</span>
</Space>
);
}
},
{
title: 'Cod. Interno',
  width: 100,
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


{
  title: 'Código / EAN',
  key: 'productInfo',
  width: 150,
  render: (_, record: any) => {
    const prodData = record.prod || record;
    const gtin = prodData.cEAN && prodData.cEAN !== 'SEM GTIN' ? prodData.cEAN : null;
    
    // Supondo que você possa ter salvo um gtin customizado no estado local ou no record
    const customGtin = record.customGtin || null; 

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Text type="secondary" style={{ fontSize: 10 }}>Cód: {prodData.cProd}</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

          
          
          {gtin ? (
            <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>GTIN: {gtin}</Tag>
          ) : customGtin ? (
            <Tag color="success" style={{ fontSize: 10, margin: 0 }}>GTIN (Manual): {customGtin}</Tag>
          ) : (
            <Tag 
  color="warning" 
  style={{ fontSize: 10, margin: 0, cursor: 'pointer' }}
  onClick={() => openBarcodeInputModal(record)}
>
  ⚠️ Sem GTIN (Clique para bipar)
</Tag>
          )}
        </div>
      </div>
    );
  }
},

{
title: 'Produto / Familia',
dataIndex: 'descricao',
key: 'descricao',
width: 400,
render: (_, record) => {
const group = record.grupo ? groupsById.get(record.grupoId) : null;

return (
<Space direction="vertical" size={2}>
<Text strong style={{ fontSize: 13 }}>{record.nome || record.descricao}</Text>
<Space size={4}>
{group ? (
<Tag color="cyan" style={{ cursor: 'pointer' }} onClick={() => handleOpenGroupModal(record)}>
Família: {group.nome}
</Tag>
) : (
<Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => handleOpenGroupModal(record)}>
Vincular Família
</Button>
)}
</Space>
</Space>
);
}
},
  
{ title: 'UOM' ,width: 70, dataIndex: 'unidade', key: 'unidade', render: (text) => <Tag>{text || '-'}</Tag> },
{
title: 'Qtd. Conferência',
key: 'quantitiesConference',
align: 'center',
width: 150,
render: (_, record) => {
const nfQty = record.quantidade || 0;
const receivedQty = record.receivedQuantity !== undefined ? record.receivedQuantity : nfQty;
const diff = record.difference ?? (receivedQty - nfQty);

return (
<div style={{ background: '#fcfcfc', padding: '2px 4px', borderRadius: 4, border: '1px solid #f0f0f0' }}>
<Space size={4} align="center">
<div style={{ textAlign: 'center' }}>
<Text type="secondary" style={{ fontSize: 9, display: 'block', lineHeight: 1 }}>NF</Text>
<Text strong style={{ fontSize: 11 }}>{nfQty}</Text>
</div>
<Text type="secondary">/</Text>
<div style={{ textAlign: 'center' }}>
<Text type="secondary" style={{ fontSize: 9, display: 'block', lineHeight: 1 }}>Rec.</Text>
<InputNumber
size="small"
min={0}
value={receivedQty}
onChange={(newVal) => newVal !== null && onQuantityChange?.(String(record.tempId), newVal)}
style={{ width: 55 }}
/>
</div>
<div style={{ textAlign: 'center', minWidth: 28 }}>
<Text type="secondary" style={{ fontSize: 9, display: 'block', lineHeight: 1 }}>Dif.</Text>
{diff > 0 ? (
<Tag color="orange" style={{ margin: 0, fontSize: 10 }}>+{diff}</Tag>
) : diff < 0 ? (
<Tag color="red" style={{ margin: 0, fontSize: 10 }}>{diff}</Tag>
) : (
<Tag color="green" style={{ margin: 0, fontSize: 10 }}>0</Tag>
)}
</div>
</Space>
</div>
);
}
},
{
  title: 'Composição',
  key: 'costComposition',
  width: 140,
  render: (_, record: any) => {
    const prodData = record.prod || record; 
    const quantidade = Number(prodData.qCom || record.quantidade || 1);
    const valorProd = Number(prodData.vProd || 0);
    const unitBase = quantidade > 0 ? valorProd / quantidade : 0;

    const imposto = record.imposto || {};

    const freightVal = Number(prodData.vFrete || record.freightAdded || 0);
    const freightUnit = quantidade > 0 ? freightVal / quantidade : 0;

    const ipiVal = Number(imposto.ipi?.vIPI || prodData.vIPI || 0);
    const ipiUnit = quantidade > 0 ? ipiVal / quantidade : 0;

    const stObj = imposto.icmsSt || imposto.ICMSST || imposto.icms || {};
    const stVal = Number(stObj.vICMSST || stObj.VICMSST || stObj.vST || imposto.vBCST || prodData.vST || 0);
    const stUnit = quantidade > 0 ? stVal / quantidade : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#8c8c8c' }}>Base:</span>
          <Text style={{ fontSize: 11 }}>{formatCurrency(unitBase)}</Text>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#8c8c8c' }}>Frete:</span>
          {freightUnit > 0 ? (
            <Text type="success" style={{ fontSize: 11 }}>+{formatCurrency(freightUnit)}</Text>
          ) : (
            <Text type="secondary" style={{ fontSize: 10 }}>—</Text>
          )}
        </div>

        {ipiUnit > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#8c8c8c' }}>IPI:</span>
            <Text type="warning" style={{ fontSize: 11 }}>+{formatCurrency(ipiUnit)}</Text>
          </div>
        )}

        {stUnit > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#8c8c8c' }}>ST:</span>
            <Text type="secondary" style={{ fontSize: 11 }}>+{formatCurrency(stUnit)}</Text>
          </div>
        )}
      </div>
    );
  }
},
{
title: 'Custo & Total',
key: 'costAndTotal',
width: 140,
render: (_, record: any) => {
const prodData = record.prod || record;
const imposto = record.imposto || {};

const nfQty = Number(prodData.qCom || record.quantidade || 1);
const valorProd = Number(prodData.vProd || 0);
const unitBase = nfQty > 0 ? valorProd / nfQty : 0;

const freightUnit = (Number(prodData.vFrete || record.freightAdded || 0)) / nfQty;
const ipiUnit = (Number(imposto.ipi?.vIPI || prodData.vIPI || 0)) / nfQty;
const stUnit = (Number(imposto.icmsSt?.vICMSST || imposto.vBCST || prodData.vST || 0)) / nfQty;

const finalUnitCost = unitBase + freightUnit + ipiUnit;

const activeQty = record.receivedQuantity ?? nfQty;
const totalItemAmount = finalUnitCost * activeQty;

return (
<div style={{ lineHeight: '1.3' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
<span style={{ fontSize: 10, color: '#8c8c8c' }}>UN:</span>
<Text strong style={{ color: '#52c41a', fontSize: 12 }}>{formatCurrency(finalUnitCost)}</Text>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
<span style={{ fontSize: 10, color: '#8c8c8c' }}>Tot ({activeQty}):</span>
<Text strong style={{ fontSize: 12 }}>{formatCurrency(totalItemAmount)}</Text>
</div>
</div>
);
}
},
{
title: 'Ações',
key: 'status',
align: 'center',
width: 80,
render: (_, record) => {
const isConf = record.isConfirmed || record.confirmed;
const diff = record.difference || 0;

return (
<Space size={2}>
{isConf ? (
<Tooltip title="Item conferido">
<Button 
type="text" 
size="small" 
icon={<CheckOutlined style={{ color: '#52c41a' }} />} 
onClick={() => onToggleItem?.(String(record.tempId), false)} 
/>
</Tooltip>
) : (
<Tooltip title="Pendente">
<Button 
type="text" 
size="small" 
icon={<InfoCircleOutlined style={{ color: diff !== 0 ? '#faad14' : '#bfbfbf' }} />} 
onClick={() => onToggleItem?.(String(record.tempId), true)} 
/>
</Tooltip>
)}
<Tooltip title="Ver detalhes completos de custos e impostos">
<Button 
type="text" 
size="small" 
icon={<InfoCircleOutlined style={{ color: '#1890ff' }} />} 
onClick={() => handleOpenItemDetails(record)}
/>
</Tooltip>
</Space>
);
}
}
];

return (
<div style={{ background: '#fff', padding: 0, borderRadius: 8 }}>

{/* HEADER CONTROL AREA */}
<Row justify="space-between" align="middle" style={{ marginBottom: 6 }}>
<Col>
<Title level={4} style={{ margin: 0 }}>4. Conferência de Itens ({localItems.length})</Title>
</Col>
<Col>
<Space>
<Button icon={<SettingOutlined />} onClick={() => setIsManageModalOpen(true)}>
  Gerenciar Famílias ({localGroups.length})
</Button>
<Space style={{ background: '#f5f5f5', padding: '4px 12px', borderRadius: 6, border: '1px solid #d9d9d9' }}>
<Text style={{ fontSize: 12 }}><ThunderboltOutlined style={{ color: '#faad14' }} /> Checkagem turbo</Text>
<Checkbox />
</Space>
</Space>
</Col>
</Row>

{/* FILTROS E AÇÕES COLETIVAS */}
<div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
<Space wrap style={{ background: '#fafafa', padding: 6, borderRadius: 6, border: '1px solid #f0f0f0', justifyContent: 'space-between' }}>
<Space wrap>
<Text strong>{`${selectedRowKeys.length} selecionado(s)`}</Text>
<Button size="small" type="primary" icon={<CheckOutlined />} disabled={selectedRowKeys.length === 0} onClick={() => { onConfirmItems?.(selectedRowKeys); setSelectedRowKeys([]); }}>Conferir</Button>
<Button size="small" icon={<UndoOutlined />} disabled={selectedRowKeys.length === 0} onClick={() => { onUnconfirmItems?.(selectedRowKeys); setSelectedRowKeys([]); }}>Desfazer</Button>
<Button size="small" icon={<LinkOutlined />} disabled={selectedRowKeys.length === 0} onClick={() => onMapProducts?.(selectedRowKeys)}>Vincular</Button>
<Button size="small" danger icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0} onClick={() => { onRemoveItems?.(selectedRowKeys); setSelectedRowKeys([]); }}>Remover</Button>
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
columns={columns}
dataSource={filteredItems}
rowKey="tempId"
size="small"
bordered
pagination={{ pageSize: 50, showSizeChanger: true }}
summary={() => {
if (filteredItems.length === 0) return null;

const totals = filteredItems.reduce(
  (acc, record: any) => {
    const prodData = record.prod || record;
    const imposto = record.imposto || {};

    const nfQty = Number(prodData.qCom || record.quantidade || 1);
    const receivedQty = record.receivedQuantity !== undefined ? record.receivedQuantity : nfQty;
    const diff = record.difference ?? (receivedQty - nfQty);

    const valorProd = Number(prodData.vProd || 0);
    const totalNfAmount = valorProd;

    // Captura dos totais da linha
    const freightVal = Number(prodData.vFrete || record.freightAdded || 0);
    const ipiVal = Number(imposto.ipi?.vIPI || prodData.vIPI || 0);

    const stObj = imposto.icmsSt || imposto.ICMSST || imposto.icms || {};
    const stVal = Number(stObj.vICMSST || stObj.VICMSST || stObj.vST || imposto.vBCST || prodData.vST || 0);

    return {
      nfQty: acc.nfQty + nfQty,
      recQty: acc.recQty + receivedQty,
      diff: acc.diff + diff,
      totalNfAmount: acc.totalNfAmount + totalNfAmount,
      totalFrete: acc.totalFrete + freightVal,
      totalEncargos: acc.totalEncargos + ipiVal,
      totalIcmsSt: acc.totalIcmsSt + stVal,
      count: acc.count + 1,
    };
  },
  { 
    nfQty: 0, 
    recQty: 0, 
    diff: 0, 
    totalNfAmount: 0, 
    totalFrete: 0, 
    totalEncargos: 0, 
    totalIcmsSt: 0, 
    count: 0 
  }
);

// 🎯 Total Final (Rec) calculado de forma direta e exata somando os blocos da nota:
const totalReceivedAmountFinal = totals.totalNfAmount + totals.totalFrete + totals.totalEncargos + totals.totalIcmsSt;

return (
<Table.Summary fixed>
<Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
{/* 1. Item */}
<Table.Summary.Cell index={0}>
<Text style={{ fontSize: 11 }}>Totais ({totals.count})</Text>
</Table.Summary.Cell>

{/* 2. Cod. Interno */}
<Table.Summary.Cell index={1} />

{/* 3. EAN / SKU */}
<Table.Summary.Cell index={2} />

{/* 4. Produto / Nome */}
<Table.Summary.Cell index={3}>
<Text type="secondary" style={{ fontSize: 11 }}>Soma da Seleção:</Text>
</Table.Summary.Cell>

{/* 5. UOM */}
<Table.Summary.Cell index={4} />

{/* 6. Qtd. Conferência (NF / Rec / Dif) */}
<Table.Summary.Cell index={5} align="center">
<div style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between', gap: 4 }}>
<span>NF: {totals.nfQty}</span>
<span>Rec: {totals.recQty}</span>
<span style={{ color: totals.diff !== 0 ? '#fa8c16' : '#52c41a' }}>
Dif: {totals.diff > 0 ? `+${totals.diff}` : totals.diff}
</span>
</div>
</Table.Summary.Cell>

{/* 7. Composição */}
<Table.Summary.Cell index={6}>
  <Text type="secondary" style={{ fontSize: 10 }}>Total Produtos:</Text>
  <div style={{ fontSize: 11, color: '#595959' }}>{formatCurrency(totals.totalNfAmount)}</div>

  {totals.totalFrete > 0 && (
    <>
      <Text type="secondary" style={{ fontSize: 10 }}>Total Frete:</Text>
      <div style={{ fontSize: 11, color: '#595959' }}>{formatCurrency(totals.totalFrete)}</div>
    </>
  )}

  {totals.totalEncargos > 0 && (
    <>
      <Text type="secondary" style={{ fontSize: 10 }}>Total IPI:</Text>
      <div style={{ fontSize: 11, color: '#595959' }}>{formatCurrency(totals.totalEncargos)}</div>
    </>
  )}

  {totals.totalIcmsSt > 0 && (
    <>
      <Text type="secondary" style={{ fontSize: 10 }}>Total ICMS-ST:</Text>
      <div style={{ fontSize: 11, color: '#595959' }}>{formatCurrency(totals.totalIcmsSt)}</div>
    </>
  )}
</Table.Summary.Cell>

{/* 8. Custo & Total */}
<Table.Summary.Cell index={7}>
  <Text type="secondary" style={{ fontSize: 10 }}>Total Final (Rec):</Text>
  <div style={{ fontSize: 12, color: '#52c41a', fontWeight: 'bold' }}>
    {formatCurrency(totalReceivedAmountFinal)}
  </div>
</Table.Summary.Cell>

{/* 9. Ações */}
<Table.Summary.Cell index={8} />
</Table.Summary.Row>
</Table.Summary>
);
}}
/>

{/* ================= MODAL: DETALHES DE COMPOSIÇÃO DE CUSTO E TRIBUTOS ================= */}
<Modal
  title="Vincular Código de Barras (GTIN)"
  open={barcodeModalVisible}
  onOk={handleSaveCustomGtin}
  onCancel={() => setBarcodeModalVisible(false)}
  okText="Vincular"
  cancelText="Cancelar"
  destroyOnClose
>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 0' }}>
    <div>
      <Text type="secondary">Produto:</Text>
      <div><Text strong>{selectedItemForBarcode?.prod?.xProd || selectedItemForBarcode?.xProd}</Text></div>
    </div>
    
    <div>
      <Text type="secondary">Código Interno (Cód):</Text>
      <div><Text>{selectedItemForBarcode?.prod?.cProd || selectedItemForBarcode?.cProd}</Text></div>
    </div>

    <div>
      <Text strong>Bipe ou digite o código de barras da caixa:</Text>
      <Input
        autoFocus
        placeholder="Ex: 7891023456789"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onPressEnter={handleSaveCustomGtin}
        style={{ marginTop: 6 }}
      />
    </div>
  </div>
</Modal>
<Modal
title={
<Space>
<DollarOutlined style={{ color: '#52c41a' }} />
<span>Composição Detalhada do Custo — Item #{itemForDetails?.nItem || itemForDetails?.tempId}</span>
</Space>
}
open={isItemDetailsModalOpen}
onCancel={() => setIsItemDetailsModalOpen(false)}
footer={[
<Button key="close" type="primary" onClick={() => setIsItemDetailsModalOpen(false)}>
Fechar
</Button>
]}
width={880}
destroyOnClose
>
{itemForDetails && (() => {
const prod = (itemForDetails as any).prod || itemForDetails;
const imposto = (itemForDetails as any).imposto || {};

const qtd = Number(prod.qCom || itemForDetails.quantidade || 1);
const totalProd = Number(prod.vProd || 0);
const unitBase = qtd > 0 ? totalProd / qtd : 0;

const freightPortion = Number(prod.vFrete || itemForDetails.freightAdded || 0);
const freightUnit = qtd > 0 ? freightPortion / qtd : 0; 

const ipiObj = imposto.ipi?.IPITrib || imposto.ipi || {};
const ipiPortion = Number(ipiObj.vIPI || prod.vIPI || 0);
const ipiUnit = qtd > 0 ? ipiPortion / qtd : 0;

const stObj = imposto.icmsSt || imposto.ICMSST || {};
const stPortion = Number(stObj.vICMSST || stObj.VICMSST || imposto.vBCST || prod.vST || 0);
const stUnit = qtd > 0 ? stPortion / qtd : 0;

const finalUnitCost = unitBase + freightUnit + ipiUnit + stUnit;

const icmsKey = Object.keys(imposto.icms || imposto.ICMS || {})[0];
const icmsData = imposto.icms?.[icmsKey] || imposto.ICMS?.[icmsKey] || imposto.icms || {};
const pisData = imposto.pis?.PISAliq || imposto.PIS?.pisaliq || imposto.pis || {};
const cofinsData = imposto.cofins?.COFINSAliq || imposto.COFINS?.cofinsaliq || imposto.cofins || {};
const ibsData = imposto.ibsCbs?.gIBSCBS || imposto.IBSCBS?.gIBSCBS || imposto.ibsCbs || {};

return (
<div>
<Alert
message={<Text strong style={{ fontSize: 14 }}>{prod.xProd || itemForDetails.descricao}</Text>}
description={
<Space size="large" style={{ marginTop: 6 }} wrap>
<Text type="secondary">SKU: <Text strong>{prod.cProd || itemForDetails.sku || 'N/A'}</Text></Text>
<Text type="secondary">EAN: <Text strong>{prod.cEAN || itemForDetails.ean || 'N/A'}</Text></Text>
<Text type="secondary">NCM: <Text strong>{prod.NCM || itemForDetails.ncm || 'N/A'}</Text></Text>
{prod.CEST && <Text type="secondary">CEST: <Text strong>{prod.CEST}</Text></Text>}
{prod.CFOP && <Text type="secondary">CFOP: <Text strong>{prod.CFOP}</Text></Text>}
</Space>
}
type="info"
style={{ marginBottom: 16 }}
/>

<div style={{ background: '#fafafa', padding: 12, borderRadius: 6, border: '1px solid #f0f0f0', marginBottom: 16 }}>
<Title level={5} style={{ marginTop: 0, marginBottom: 8, color: '#1890ff' }}>
📊 Composição do Custo Unitário
</Title>
<Row gutter={16}>
<Col span={6}>
<Statistic
title="Valor Base (NF)"
value={unitBase}
precision={2}
prefix="R$"
valueStyle={{ fontSize: 14 }}
/>
</Col>
<Col span={6}>
<Statistic
title="(+) Frete Rateado"
value={freightUnit}
precision={2}
prefix="R$"
valueStyle={{ fontSize: 14, color: freightUnit > 0 ? '#1890ff' : undefined }}
/>
</Col>
<Col span={6}>
<Statistic
title="(+) Encargos (IPI/ST)"
value={ipiUnit + stUnit}
precision={2}
prefix="R$"
valueStyle={{ fontSize: 14, color: (ipiUnit + stUnit) > 0 ? '#fa8c16' : undefined }}
/>
</Col>
<Col span={6}>
<Statistic
title="(=) Custo Unitário Final"
value={finalUnitCost}
precision={2}
prefix="R$"
valueStyle={{ fontSize: 16, fontWeight: 'bold', color: '#52c41a' }}
/>
</Col>
</Row>
</div>

<Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
<Descriptions.Item label="Quantidade Comercializada">
<Tag color="blue">{qtd} {prod.uCom || itemForDetails.unidade || 'UN'}</Tag> (vUnCom: {Number(prod.vUnCom || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
</Descriptions.Item>
<Descriptions.Item label="Quantidade Tributável">
<Tag color="cyan">{prod.qTrib || qtd} {prod.uTrib || prod.uCom || 'UN'}</Tag> (vUnTrib: {Number(prod.vUnTrib || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
</Descriptions.Item>
<Descriptions.Item label="Valor Bruto dos Produtos (vProd)">
{Number(totalProd).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Descriptions.Item>
<Descriptions.Item label="Valor Total da Tag do Item (vItem)">
{Number(itemForDetails.valorTotal || itemForDetails.vItem || totalProd).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Descriptions.Item>
<Descriptions.Item label="Frete Alocado ao Item">
{Number(freightPortion).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Descriptions.Item>
<Descriptions.Item label="IPI (Trib / Enq)">
{Number(ipiPortion).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} <Text type="secondary">(CST: {ipiObj.CST || 'N/A'} | Alíq: {ipiObj.pIPI ? `${ipiObj.pIPI}%` : '0%'})</Text>
</Descriptions.Item>
<Descriptions.Item label="Substituição Tributária (ST)">
{Number(stPortion).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Descriptions.Item>
<Descriptions.Item label="Código EAN Tributável">
{prod.cEANTrib || prod.cEAN || 'N/A'}
</Descriptions.Item>
{prod.vDesc ? (
<Descriptions.Item label="Desconto Aplicado" span={2}>
{Number(prod.vDesc).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Descriptions.Item>
) : null}
{prod.infAdProd ? (
<Descriptions.Item label="Informações Adicionais do Item" span={2}>
<Text italic>{prod.infAdProd}</Text>
</Descriptions.Item>
) : null}
</Descriptions>

<Title level={5} style={{ marginBottom: 8, fontSize: 13, color: '#595959' }}>
🛡️ Detalhamento Tributário e Fiscais Detectados no XML
</Title>
<Descriptions bordered size="small" column={1}>
<Descriptions.Item label="ICMS">
{icmsData.CST || icmsData.CSOSN ? (
<Space wrap>
<Tag color="purple">CST/CSOSN: {icmsData.CST || icmsData.CSOSN}</Tag>
<Tag>Origem: {icmsData.orig ?? '0'}</Tag>
<Tag>Base (vBC): {Number(icmsData.vBC || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>
<Tag>Alíquota: {icmsData.pICMS ? `${icmsData.pICMS}%` : '0%'}</Tag>
<Tag color="green">Valor (vICMS): {Number(icmsData.vICMS || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>
</Space>
) : (
<Text type="secondary">Nenhum detalhe de ICMS mapeado para este item.</Text>
)}
</Descriptions.Item>

<Descriptions.Item label="PIS / COFINS">
<Space wrap>
{pisData.vPIS || pisData.CST ? (
<Tag color="blue">PIS - CST: {pisData.CST || 'N/A'} | Base: {Number(pisData.vBC || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Vl: {Number(pisData.vPIS || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>
) : null}
{cofinsData.vCOFINS || cofinsData.CST ? (
<Tag color="geekblue">COFINS - CST: {cofinsData.CST || 'N/A'} | Base: {Number(cofinsData.vBC || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Vl: {Number(cofinsData.vCOFINS || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>
) : null}
{!pisData.vPIS && !cofinsData.vPIS && <Text type="secondary">Sem dados de PIS/COFINS estruturados no item.</Text>}
</Space>
</Descriptions.Item>

{Object.keys(ibsData).length > 0 && (
<Descriptions.Item label="IBS / CBS (Reforma Tributária)">
<Space wrap>
<Tag color="volcano">CST: {imposto.IBSCBS?.CST || '000'} | vBC: {Number(ibsData.vBC || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>
{ibsData.vCBS && <Tag>vCBS: {Number(ibsData.vCBS).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>}
{ibsData.vIBS && <Tag>vIBS: {Number(ibsData.vIBS).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>}
{ibsData.vIBSUF && <Tag>vIBS UF: {Number(ibsData.vIBSUF).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>}
</Space>
</Descriptions.Item>
)}
</Descriptions>
</div>
);
})()}
</Modal>

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

{/* ======================================================== */}
      {/* 🧩 RENDERIZAÇÃO DOS MODAIS (COLOQUE ISSO ANTES DO ÚLTIMO DIV) */}
      {/* ======================================================== */}

      {/* 1. Modal de Mapeamento de Família por Item */}
      {selectedItemForGroup && (
        <ModalFamiliaMapping
          isOpen={isGroupModalOpen}
          onClose={() => setIsGroupModalOpen(false)}
          item={selectedItemForGroup}
          groups={localGroups}
          onSave={handleSaveGroupMapping}
        />
      )}

      {/* 2. Modal de Gerenciamento Geral de Famílias */}
      <ManageFamiliasModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        familias={localGroups}
        items={localItems}
        onCreateFamilia={() => setIsManageModalOpen(false)}
        onEditFamilia={handleEditGroup}
        onEditFamiliaItems={handleEditGroupItems}
        onDeleteFamilia={(id) => {
          setLocalGroups(prev => prev.filter(g => g.id !== id));
        }}
      />

      {/* 3. Modal de Edição de Estrutura da Família */}
      {groupBeingEdited && (
        <GroupEditModal
          isOpen={isGroupEditModalOpen}
          onClose={() => {
            setIsGroupEditModalOpen(false);
            setGroupBeingEdited(null);
          }}
          group={groupBeingEdited}
          onSave={handleSaveGroupEdit}
        />
      )}

      {/* 4. Modal de Preenchimento da Grade de Itens */}
      {grupoSelecionadoParaItens && (
        <GroupItemsEditModal
          isOpen={isItemsEditOpen}
          onClose={() => {
            setIsItemsEditOpen(false);
            setGrupoSelecionadoParaItens(null);
          }}
          group={grupoSelecionadoParaItens}
          items={itemsByGroupId.get(grupoSelecionadoParaItens.id) || []}
          onSave={handleSaveItemsAttributes}
        />
      )}

      {/* 5. Modal de Inserção de Código de Barras */}
      <Modal
        title="Inserir Código de Barras Manual"
        open={barcodeModalVisible}
        onOk={handleSaveCustomGtin}
        onCancel={() => setBarcodeModalVisible(false)}
        okText="Salvar"
        cancelText="Cancelar"
      >
        <p>Informe o GTIN/Código de barras correto para o item:</p>
        <Input
          placeholder="Ex: 7891020304050"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          autoFocus
        />
      </Modal>
<ManageGroupsModal isOpen={isManageModalOpen} onClose={() => setIsManageModalOpen(false)} groups={localGroups} items={localItems} onEditGroup={handleEditGroup} onEditGroupItems={handleEditGroupItems} onDeleteGroup={(groupId: string) => { setLocalGroups(prev => prev.filter(g => g.id !== groupId)); setLocalItems(prev => prev.map(it => it.grupoId === groupId ? { ...it, grupoId: undefined, atributosCustomizados: undefined } : it)); }} />
<GroupEditModal isOpen={isGroupEditModalOpen} onClose={() => setIsGroupEditModalOpen(false)} grupo={groupBeingEdited} onSave={handleSaveGroupEdit} />
<GroupItemsEditModal isOpen={isItemsEditOpen} onClose={() => { setIsItemsEditOpen(false); setGrupoSelecionadoParaItens(null); }} grupo={grupoSelecionadoParaItens} items={localItems} onSaveItemsAttributes={handleSaveItemsAttributes} />
</div>
);
};

export default ItemsConference;