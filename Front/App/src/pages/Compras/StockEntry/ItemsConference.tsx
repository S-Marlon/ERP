import React, { useMemo, useState, useCallback, useEffect } from 'react';
import styles from './ItemsConference.module.css';
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

// ➕ Definição das colunas que permitem ordenação
type SortKey = 'nItem' | 'ncm' | 'descricao' | 'grupoId' | 'unidadeMedida';
type SortDirection = 'asc' | 'desc';

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

  useEffect(() => {
    setLocalItems(initialItems || []);
  }, [initialItems]);

  useEffect(() => {
    setLocalGroups(initialGroups || []);
  }, [initialGroups]);



  const [isEanModalOpen, setIsEanModalOpen] = useState(false);
const [selectedItemForEan, setSelectedItemForEan] = useState<Item | null>(null);
const [tempEanInput, setTempEanInput] = useState('');

  const [filter, setFilter] = useState<FilterType>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedItemForGroup, setSelectedItemForGroup] = useState<Item | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isBatchAssignOpen, setIsBatchAssignOpen] = useState(false);
  const [isGroupEditModalOpen, setIsGroupEditModalOpen] = useState(false);
  const [groupBeingEdited, setGroupBeingEdited] = useState<Group | null>(null);

  const [batchAssignMode, setBatchAssignMode] = useState<'LINK' | 'CREATE'>('LINK');
  const [batchSelectedGroupId, setBatchSelectedGroupId] = useState<string>('');
  const [batchNewGroupName, setBatchNewGroupName] = useState<string>('');

  const [isItemsEditOpen, setIsItemsEditOpen] = useState(false);
  const [grupoSelecionadoParaItens, setGrupoSelecionadoParaItens] = useState<Group | null>(null);

  // 📦 NOVOS ESTADOS: Controladores de ordenação da tabela
  const [sortKey, setSortKey] = useState<SortKey | null>('nItem'); // Padrão: Ordenar por Item sequencial
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Mapas otimizados
  const groupsById = useMemo(() => {
    const map = new Map<string, Group>();
    for (const g of localGroups) {
      map.set(g.id, g);
    }
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

  // Filtros de Itens
  const pendingItems = useMemo(() => localItems.filter(i => !i.confirmed), [localItems]);
  const confirmedItems = useMemo(() => localItems.filter(i => i.confirmed), [localItems]);
  const divergentItems = useMemo(() => localItems.filter(i => (i.difference ?? 0) !== 0), [localItems]);
  const unmappedItems = useMemo(() => localItems.filter(i => !i.mappedId), [localItems]);

  // 🔄 LÓGICA DE ORDENAÇÃO E FILTRAGEM ACUMULADA
  const filteredAndSortedItems = useMemo(() => {
    // 1. Aplica o filtro de status primeiro
    let itemsResult: Item[] = [];
    switch (filter) {
      case 'pending': itemsResult = [...pendingItems]; break;
      case 'confirmed': itemsResult = [...confirmedItems]; break;
      case 'divergent': itemsResult = [...divergentItems]; break;
      case 'unmapped': itemsResult = [...unmappedItems]; break;
      default: itemsResult = [...localItems]; break;
    }

    // 2. Se houver uma chave de ordenação selecionada, ordena a lista resultante
    if (sortKey) {
      itemsResult.sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';

        // Tratamento customizado para campos específicos
        if (sortKey === 'grupoId') {
          // Ordena pelo nome textual do grupo associado, não pela Hash do ID
          valA = a.grupoId ? (groupsById.get(a.grupoId)?.nome || '') : '';
          valB = b.grupoId ? (groupsById.get(b.grupoId)?.nome || '') : '';
        } else if (sortKey === 'nItem') {
          // Garante ordenação numérica pura para o ID/Linha do Item
          valA = Number(a.nItem || a.tempId || 0);
          valB = Number(b.nItem || b.tempId || 0);
        } else {
          // Fallback para strings padrões (NCM, Descrição, UOM)
          valA = (a[sortKey] as string || '').toString().trim().toUpperCase();
          valB = (b[sortKey] as string || '').toString().trim().toUpperCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return itemsResult;
  }, [filter, localItems, pendingItems, confirmedItems, divergentItems, unmappedItems, sortKey, sortDirection, groupsById]);

const handleOpenEanModal = (item: Item) => {
  setSelectedItemForEan(item);
  setTempEanInput(item.gtin || '');
  setIsEanModalOpen(true);
};

const handleSaveEan = () => {
  if (!selectedItemForEan) return;
  
  // Atualiza o EAN no estado local dos itens
  setLocalItems(prev =>
    prev.map(it =>
      it.tempId === selectedItemForEan.tempId
        ? { ...it, gtin: tempEanInput.trim() }
        : it
    )
  );

  // Opcional: Se você tiver um callback vindo do backend/props, chame-o aqui
  // onUpdateItemEan?.(selectedItemForEan.tempId, tempEanInput.trim());

  setIsEanModalOpen(false);
  setSelectedItemForEan(null);
};




  // Handler para disparar a inversão ou troca de coluna ordenada
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      // Se clicou na mesma coluna, inverte a ordem
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // Se clicou em uma coluna nova, define como ascendente
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Pequeno auxiliar visual para os cabeçalhos das colunas
  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ' ⇅';
    return sortDirection === 'asc' ? ' 🔼' : ' 🔽';
  };

  // ===================================================================
  // FUNÇÕES PRINCIPAIS E CALLBACKS
  // ===================================================================

  const assignGroupToItem = useCallback((itemId: number, groupId: string) => {
    setLocalItems(prev =>
      prev.map(it =>
        it.tempId === itemId
          ? { ...it, grupoId: groupId, atributosCustomizados: undefined }
          : it
    ));
    onAssignGroupToItem?.(itemId, groupId);
  }, [onAssignGroupToItem]);

  const createGroupAndAssign = useCallback((itemId: number, groupData: Group) => {
    setLocalGroups(prev => [...prev, groupData]);
    setLocalItems(prev =>
      prev.map(it =>
        it.tempId === itemId
          ? { ...it, grupoId: groupData.id, atributosCustomizados: undefined }
          : it
    ));
    onCreateAndAssignGroup?.(itemId, groupData);
  }, [onCreateAndAssignGroup]);

  const updateGroup = useCallback((groupId: string, patch: Partial<Group>) => {
    setLocalGroups(prev =>
      prev.map(g => (g.id === groupId ? { ...g, ...patch } : g))
    );
    onUpdateGroup?.(groupId, patch);
  }, [onUpdateGroup]);

  const applyItemAttributeOverride = useCallback(
    (itemId: number, atributos: ItemAttribute[]) => {
      setLocalItems(prev =>
        prev.map(it =>
          it.tempId === itemId
            ? { ...it, atributosCustomizados: atributos }
            : it
        )
      );
      onApplyItemAttributeOverride?.(itemId, atributos);
    },
    [onApplyItemAttributeOverride]
  );

  // ===================================================================
  // HANDLERS DE UI E EVENTOS
  // ===================================================================

  const handleEditGroupItems = (groupId: string) => {
    const grupoFound = groupsById.get(groupId);
    if (grupoFound) {
      setGrupoSelecionadoParaItens(grupoFound);
      setIsItemsEditOpen(true);
    }
  };

  const handleSaveItemsAttributes = (
    updatedItems: { tempId: number; atributosCustomizados: ItemAttribute[] }[]
  ) => {
    setLocalItems(prevItems =>
      prevItems.map(item => {
        const updateData = updatedItems.find(u => u.tempId === item.tempId);
        if (updateData) {
          return {
            ...item,
            atributosCustomizados: updateData.atributosCustomizados,
            confirmed: true,
          };
        }
        return item;
      })
    );
    onBatchSaveItemsAttributes?.(updatedItems);
  };

  const handleQuantityChange = (itemId: number, newQty: number) => {
    const qty = Math.max(0, newQty);
    setLocalItems(prev =>
      prev.map(it => (it.tempId === itemId ? { ...it, receivedQuantity: qty } : it))
    );
    onQuantityChange?.(itemId, qty);
  };

  const toggleSelection = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredAndSortedItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredAndSortedItems.map(i => i.tempId)));
    }
  };

  const selectedIds = useMemo(() => [...selected], [selected]);
  const hasSelection = selected.size > 0;

  const openBatchAssign = useCallback(() => {
    if (!hasSelection) return;
    setBatchAssignMode('LINK');
    setBatchSelectedGroupId('');
    setBatchNewGroupName('');
    setIsBatchAssignOpen(true);
  }, [hasSelection]);

  const handleLocalBatchSubmit = () => {
    const selectedItems = filteredAndSortedItems.filter(i => selected.has(i.tempId));

    if (batchAssignMode === 'LINK') {
      if (!batchSelectedGroupId) {
        alert('Por favor, selecione um grupo existente.');
        return;
      }
      const targetGroup = groupsById.get(batchSelectedGroupId);
      if (!targetGroup) {
        alert('Grupo não encontrado.');
        return;
      }

      for (const item of selectedItems) {
        assignGroupToItem(item.tempId, batchSelectedGroupId);
      }
      onBatchAssignGroup?.(selectedItems.map(it => it.tempId), batchSelectedGroupId);
    } else if (batchAssignMode === 'CREATE') {
      if (!batchNewGroupName.trim()) {
        alert('Por favor, informe o nome do novo grupo.');
        return;
      }

      const newGroup: Group = {
        id: generateGroupId(),
        nome: batchNewGroupName.trim().toUpperCase(),
        atributos: [],
      };

      setLocalGroups(prev => [...prev, newGroup]);

      for (const item of selectedItems) {
        assignGroupToItem(item.tempId, newGroup.id);
      }
      onBatchAssignGroup?.(selectedItems.map(it => it.tempId), newGroup.id);
    }

    setSelected(new Set());
    setIsBatchAssignOpen(false);
  };

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

  const handleEditGroup = (groupId: string) => {
    const group = groupsById.get(groupId);
    if (!group) return;
    setGroupBeingEdited(group);
    setIsGroupEditModalOpen(true);
  };

  const handleSaveGroupEdit = (groupData: Group) => {
    updateGroup(groupData.id, {
      nome: groupData.nome,
      atributos: groupData.atributos,
    });
    setIsGroupEditModalOpen(false);
    setGroupBeingEdited(null);
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>4. Conferência de Itens ({localItems.length})</h2>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.manageGroupsBtn}
            onClick={() => setIsManageModalOpen(true)}
          >
            ⚙️ Gerenciar Grupos ({localGroups.length})
          </button>
        </div>

        <div className={styles.filterGroup}>
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
            Todos ({localItems.length})
          </FilterButton>
          <FilterButton active={filter === 'pending'} onClick={() => setFilter('pending')}>
            Pendentes ({pendingItems.length})
          </FilterButton>
          <FilterButton active={filter === 'confirmed'} onClick={() => setFilter('confirmed')}>
            Conferidos ({confirmedItems.length})
          </FilterButton>
          <FilterButton active={filter === 'divergent'} onClick={() => setFilter('divergent')}>
            Divergências ({divergentItems.length})
          </FilterButton>
          <FilterButton active={filter === 'unmapped'} onClick={() => setFilter('unmapped')}>
            Sem Vínculo ({unmappedItems.length})
          </FilterButton>
        </div>
      </div>

      {/* BATCH ASSIGN MODAL */}
      {isBatchAssignOpen && (
        <div className={styles.batchModalOverlay}>
          <div className={styles.batchModalContainer}>
            <div className={styles.batchHeader}>
              <h3 className={styles.batchTitle}>Definir Grupo em Lote</h3>
              <span className={styles.batchCountBadge}>{selected.size} itens selecionados</span>
            </div>

            <div className={styles.batchBodyGrid}>
              <div className={styles.leftColumn}>
                <div className={styles.selectedItemsPreview}>
                  <div className={styles.previewHeader}>
                    <span>Itens da NF que serão alterados</span>
                  </div>
                  <ul className={styles.selectedItemsList}>
                    {filteredAndSortedItems
                      .filter(i => selected.has(i.tempId))
                      .map(si => (
                        <li key={si.tempId} className={styles.selectedItemRow}>
                          <span className={styles.previewIndex}>{si.nItem || si.tempId}.</span>
                          <span className={styles.previewDesc} title={si.descricao}>
                            {si.descricao}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>

              <div className={styles.rightColumn}>
                <div className={styles.modeSwitchContainer}>
                  <button
                    type="button"
                    className={`${styles.switchBtn} ${batchAssignMode === 'LINK' ? styles.switchBtnActive : ''}`}
                    onClick={() => setBatchAssignMode('LINK')}
                  >
                    Vincular a Existente
                  </button>
                  <button
                    type="button"
                    className={`${styles.switchBtn} ${batchAssignMode === 'CREATE' ? styles.switchBtnActive : ''}`}
                    onClick={() => setBatchAssignMode('CREATE')}
                  >
                    Criar Novo Grupo
                  </button>
                </div>

                {batchAssignMode === 'LINK' ? (
                  <div className={styles.formGroup}>
                    <label htmlFor="batchSelectGroup">Escolha o Grupo Existente</label>
                    <select
                      id="batchSelectGroup"
                      value={batchSelectedGroupId}
                      onChange={e => setBatchSelectedGroupId(e.target.value)}
                      className={styles.selectFull}
                    >
                      <option value="">-- selecione um grupo cadastrado --</option>
                      {localGroups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.nome} ({itemsByGroupId.get(g.id)?.length || 0} itens vinculados)
                        </option>
                      ))}
                    </select>
                    <p className={styles.inputHelpText}>
                      Os itens selecionados herdarão o esquema de atributos deste grupo.
                    </p>
                  </div>
                ) : (
                  <div className={styles.creativeGroupCard}>
                    <div className={styles.cardHeaderNotice}>
                      <h5>Modo de Criação Coletiva</h5>
                      <p>Você está gerando uma nova grade para estes {selected.size} produtos de uma vez só.</p>
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="batchNewGroupNameInput">Nome do Novo Grupo</label>
                      <input
                        id="batchNewGroupNameInput"
                        value={batchNewGroupName}
                        onChange={e => setBatchNewGroupName(e.target.value)}
                        className={styles.inputFull}
                        placeholder="Ex: AMANCO TEE MARROM"
                      />
                    </div>
                    <p className={styles.cardHelpText}>
                      ⚠️ <strong>Nota:</strong> O esquema de características específicas deve ser ajustado individualmente.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.batchActions}>
              <button className={styles.btnNeutral} onClick={() => setIsBatchAssignOpen(false)}>
                Cancelar
              </button>
              <button className={styles.btnPrimary} onClick={handleLocalBatchSubmit}>
                Aplicar em Lote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILTROS E AÇÕES EM LOTE */}
      <div className={styles.filterContainer}>
        <div className={hasSelection ? styles.bulkActions : styles.bulkActionsDisabled}>
          <strong>{hasSelection ? `${selected.size} selecionado(s)` : 'Nenhum item selecionado'}</strong>
          <button
            disabled={!hasSelection}
            onClick={() => {
              onConfirmItems?.(selectedIds);
              setSelected(new Set());
            }}
          >
            Conferir
          </button>
          <button
            disabled={!hasSelection}
            onClick={() => {
              onUnconfirmItems?.(selectedIds);
              setSelected(new Set());
            }}
          >
            Desfazer
          </button>
          <button disabled={!hasSelection} onClick={() => onMapProducts?.(selectedIds)}>
            Vincular
          </button>
          <button
            disabled={!hasSelection}
            onClick={() => {
              onRemoveItems?.(selectedIds);
              setSelected(new Set());
            }}
          >
            Remover
          </button>
          <button disabled={!hasSelection} onClick={openBatchAssign}>
            Definir Grupo em Lote
          </button>
        </div>

        <div className={styles.turboContainer}>
          <span className={styles.turboLabel}>Checkagem turbo ⚡</span>
          <input
            type="checkbox"
            className={styles.turboCheck}
            title="Checkagem turbo automática por duplo clique."
          />
        </div>
      </div>

      {/* TABELA PRINCIPAL ORDENÁVEL */}
      <div className={styles.tableResponsive}>
        <table className={styles.table}>
          <thead>
            <tr>
              {/* 1. Ordenação por Nro Item */}
              <th >
                <input
                  type="checkbox"
                  checked={filteredAndSortedItems.length > 0 && selected.size === filteredAndSortedItems.length}
                  onChange={toggleSelectAll}
                  onClick={e => e.stopPropagation()} // impede disparar a ordenação ao clicar no checkbox geral
                />
                <span>Item{renderSortIndicator('nItem')}</span>
              </th>
              <th>Cod. Interno</th>
              <th>SKU</th>
              
              {/* 2. Ordenação por NCM */}
              <th className={styles.sortableHeader} onClick={() => handleSort('ncm')}>
                NCM{renderSortIndicator('ncm')}
              </th>
              <th>EAN</th>
              
              {/* 3. Ordenação por Produto / Descrição */}
              <th style={{ width: '320px' }} className={styles.sortableHeader} onClick={() => handleSort('descricao')}>
                Produto / Nome no Estoque{renderSortIndicator('descricao')}
              </th>
              
              {/* 4. Ordenação por Grupo Estrutural */}
              <th className={styles.sortableHeader} onClick={() => handleSort('grupoId')}>
                Grupo{renderSortIndicator('grupoId')}
              </th>
              
              {/* 5. Ordenação por UOM (Unidade de Medida) */}
              <th className={styles.sortableHeader} onClick={() => handleSort('unidadeMedida')}>
                UOM{renderSortIndicator('unidadeMedida')}
              </th>
              
              <th>Custo Unit.</th>
              <th>Qtd (NF)</th>
              <th>QTD Recebido</th>
              <th>Dif.</th>
              <th>Total Item</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedItems.map(item => {
              const quantityNF = item.quantidade || 0;
              const currentDifference =
                typeof item.difference === 'number' ? item.difference : quantityNF - item.receivedQuantity;
              const isDivergent = currentDifference !== 0;
              const unitCost = item.valorUnitario || 0;
              const totalItem = unitCost * item.receivedQuantity;

              const group = item.grupoId ? groupsById.get(item.grupoId) : null;
              const displayName = generateItemDisplayName(item, group);
              const borderColor = item.grupoId ? getBorderColorFromGroupId(item.grupoId) : undefined;
              const hasOverride = hasAttributeOverride(item);

              return (
                <tr
                  key={item.tempId}
                  className={`${item.confirmed ? styles.rowConfirmed : ''} ${item.grupoId ? styles.rowWithGroup : ''}`}
                >
                  <td
                    className={styles.tdItemCell}
                    style={item.grupoId ? { borderLeft: `0px solid ${borderColor}` } : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(item.tempId)}
                      onChange={() => toggleSelection(item.tempId)}
                    />
                    <span className={styles.boldIndex}>{item.nItem || '-'}</span>
                  </td>

                  <td>
                    {item.mappedId ? (
                      <span className={styles.internalCodeBadge}>{item.mappedId}</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => onMapProducts?.([item.tempId])}
                      >
                        🔗 Vincular Produto
                      </button>
                    )}
                  </td>
                  <td>{item.sku || '-'}</td>
                  <td>{item.ncm || '-'}</td>
                  <td>
  {item.gtin || (
    <button 
      type="button" 
      className={styles.linkButton} // reaproveitando classe existente ou crie uma nova
      onClick={() => handleOpenEanModal(item)}
    >
      ⚡ Bipar EAN
    </button>
  )}
</td>
                  <td className={styles.productAndStockCell}>
                    <div className={styles.productLine} title={item.descricao}>
                      <div className={styles.productDesc}>{item.descricao}</div>
                    </div>
                    <div className={styles.stockLine}>
                      <span
                        className={`${styles.stockName} ${item.confirmed ? styles.stockNameConfirmed : ''}`}
                        style={hasOverride ? { fontStyle: 'italic' } : undefined}
                      >
                        {displayName}
                        {hasOverride && ' ⚡'}
                      </span>
                    </div>
                  </td>
                  <td>
                    {item.grupoId && group ? (
                      <button
                        type="button"
                        className={styles.editGroupBtn}
                        onClick={() => handleOpenGroupModal(item)}
                      >
                        ✏️ Editar Vínculo
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.addGroupBtn}
                        onClick={() => handleOpenGroupModal(item)}
                      >
                        ➕ Adicionar Grupo
                      </button>
                    )}
                  </td>
                  <td>
                    <span className={styles.uomBadge}>{item.unidadeMedida || '-'}</span>
                  </td>
                  <td>{formatCurrency(unitCost)}</td>
                  <td>
                    <strong>{quantityNF}</strong>
                  </td>
                  <td>
                    <div className={styles.quantitySelector}>
                      <button
                        type="button"
                        className={styles.quantityButton}
                        onClick={() => handleQuantityChange(item.tempId, item.receivedQuantity - 1)}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className={styles.quantityInput}
                        value={item.receivedQuantity}
                        onChange={e => handleQuantityChange(item.tempId, parseInt(e.target.value, 10) || 0)}
                      />
                      <button
                        type="button"
                        className={styles.quantityButton}
                        onClick={() => handleQuantityChange(item.tempId, item.receivedQuantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        isDivergent
                          ? currentDifference > 0
                            ? styles.textDanger
                            : styles.textSuccess
                          : styles.textSuccess
                      }
                    >
                      {isDivergent
                        ? currentDifference > 0
                          ? `-${currentDifference}`
                          : `+${Math.abs(currentDifference)}`
                        : '0'}
                    </span>
                  </td>
                  <td>
                    <strong>{formatCurrency(totalItem)}</strong>
                  </td>
                  <td
                    className={styles.tdStatus}
                    title={
                      item.confirmed
                        ? 'Item conferido'
                        : isDivergent
                        ? 'Divergência detectada'
                        : 'Aguardando conferência'
                    }
                  >
                    <span className={`${styles.statusIcon} ${isDivergent ? styles.iconDivergent : ''}`}>
                      {item.confirmed ? '✅' : isDivergent ? '⚠️' : '⏳'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODALS RENDER ZONE */}
      <GroupMappingModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        item={selectedItemForGroup}
        groups={localGroups}
        onSaveGroupMapping={handleSaveGroupMapping}
      />
      
      <ManageGroupsModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        groups={localGroups}
        items={localItems}
        onEditGroup={handleEditGroup}
        onEditGroupItems={handleEditGroupItems}
        onDeleteGroup={(groupId: string) => {
          setLocalGroups(prev => prev.filter(g => g.id !== groupId));
          setLocalItems(prev =>
            prev.map(it =>
              it.grupoId === groupId
                ? { ...it, grupoId: undefined, atributosCustomizados: undefined }
                : it
            )
          );
        }}
      />
      
      <GroupEditModal
        isOpen={isGroupEditModalOpen}
        onClose={() => setIsGroupEditModalOpen(false)}
        grupo={groupBeingEdited}
        onSave={handleSaveGroupEdit}
      />

      <GroupItemsEditModal
        isOpen={isItemsEditOpen}
        onClose={() => {
          setIsItemsEditOpen(false);
          setGrupoSelecionadoParaItens(null);
        }}
        grupo={grupoSelecionadoParaItens}
        items={localItems}
        onSaveItemsAttributes={handleSaveItemsAttributes}
      />



      {/* =================================================================== */}
      {/* MODAL DE BIPAGEM / EDIÇÃO DE EAN */}
      {/* =================================================================== */}
      {isEanModalOpen && selectedItemForEan && (
        <div className={styles.batchModalOverlay}>
          <div className={styles.batchModalContainer} style={{ maxWidth: '450px' }}>
            <div className={styles.batchHeader}>
              <h3 className={styles.batchTitle}>Bipar / Inserir Código EAN</h3>
            </div>
            
            <div style={{ padding: '16px 0' }}>
              <p style={{ marginBottom: '8px', fontSize: '14px', color: '#555' }}>
                <strong>Produto:</strong> {selectedItemForEan.descricao}
              </p>
              
              <div className={styles.formGroup}>
                <label htmlFor="eanInput">Código de Barras (GTIN/EAN)</label>
                <input
                  id="eanInput"
                  type="text"
                  autoFocus
                  className={styles.inputFull}
                  value={tempEanInput}
                  onChange={e => setTempEanInput(e.target.value)}
                  placeholder="Aponte o leitor ou digite o EAN"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleSaveEan();
                    }
                  }}
                />
              </div>
            </div>

            <div className={styles.batchActions}>
              <button 
                type="button" 
                className={styles.btnNeutral} 
                onClick={() => {
                  setIsEanModalOpen(false);
                  setSelectedItemForEan(null);
                }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className={styles.btnPrimary} 
                onClick={handleSaveEan}
              >
                Salvar Código
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
      /**
 * FUNÇÃO: Gerenciamento e Bipagem de EAN (GTIN)
 * * 🔍 CENÁRIO 1: Produto SEM GTIN no cadastro e na NF-e
 * -> Ação: Exibe o botão "⚡ Bipar EAN".
 * -> Comportamento: Abre o modal, dá auto-focus no input, aguarda o bipe e salva o GTIN no item.
 * * 📄 CENÁRIO 2: Produto JÁ TEM GTIN vindo da NF-e (ou já cadastrado)
 * -> Ação: Não exibe o botão de bipar.
 * -> Comportamento: Exibe o código EAN formatado textualmente na célula (bloqueado para edição direta ali).
 * * ⚡ CENÁRIO 3: Se o produto JÁ TEM GTIN e for BIPADO globalmente (Leitura Rápida)
 * -> Ação: Executa uma função de "Foco/Scroll" ou "Checkagem Turbo".
 * -> Comportamento: O sistema rola a tela até o produto, aplica um efeito visual (blink/highlight) 
 * e incrementa +1 automaticamente na "Qtd Recebido" (Checkagem Turbo).
 */



    
  );
};

interface FilterButtonProps {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}

const FilterButton: React.FC<FilterButtonProps> = ({ active, children, onClick }) => (
  <button onClick={onClick} className={active ? styles.filterButtonActive : styles.filterButton}>
    {children}
  </button>
);

export default ItemsConference;