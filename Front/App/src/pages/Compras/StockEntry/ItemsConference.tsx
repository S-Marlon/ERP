import React, { useMemo, useState } from 'react';
import styles from './ItemsConference.module.css';
import { ProdutoNF } from '../../types/NF-e';

type FilterType = 'all' | 'pending' | 'confirmed' | 'divergent' | 'unmapped';

// Interface perfeitamente alinhada com o map realizado no StockEntryForm

// 2. Estenda a interface ProdutoNF adicionando apenas o controle local da tabela

interface Item extends ProdutoNF {
    tempId: number;
    receivedQuantity: number;
    confirmed: boolean;
    mappedId?: string;
    difference: number;
}

interface Props {
    items: Item[];
    onConfirmItems(ids: number[]): void;
    onUnconfirmItems(ids: number[]): void;
    onMapProducts(ids: number[]): void;
    onRemoveItems(ids: number[]): void;
    onToggleItem(itemId: number): void;
    onQuantityChange(itemId: number, quantity: number): void;
}

export const ItemsConference: React.FC<Props> = ({
    items,
    onConfirmItems,
    onUnconfirmItems,
    onMapProducts,
    onRemoveItems,
    onQuantityChange,
}) => {
    const [filter, setFilter] = useState<FilterType>('all');
    const [selected, setSelected] = useState<Set<number>>(new Set());

    // Manipulação de quantidade delegada diretamente ao estado global (Pai)
    const handleQuantityChange = (itemId: number, newQty: number) => {
        const validatedQty = Math.max(0, newQty);
        onQuantityChange(itemId, validatedQty);
    };

    // Filtros calculados em tempo de execução a partir das props atualizadas do pai
    const pendingItems = useMemo(() => items.filter(i => !i.confirmed), [items]);
    const confirmedItems = useMemo(() => items.filter(i => i.confirmed), [items]);
    const divergentItems = useMemo(() => items.filter(i => (i.difference ?? 0) !== 0), [items]);
    const unmappedItems = useMemo(() => items.filter(i => !i.mappedId), [items]);

    const filteredItems = useMemo(() => {
        switch (filter) {
            case 'pending': return pendingItems;
            case 'confirmed': return confirmedItems;
            case 'divergent': return divergentItems;
            case 'unmapped': return unmappedItems;
            default: return items;
        }
    }, [filter, items, pendingItems, confirmedItems, divergentItems, unmappedItems]);

    // Gerenciamento de seleção interna
    const toggleSelection = (id: number) => {
        const next = new Set(selected);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelected(next);
    };

    const toggleSelectAll = () => {
        if (selected.size === filteredItems.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filteredItems.map(i => i.tempId)));
        }
    };

    const selectedIds = [...selected];
    const hasSelection = selected.size > 0;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
            <h2 className={styles.title}>
                4. Conferência de Itens ({items.length})
            </h2>

            {/* Indicadoresa
            <div className={styles.statsGrid}>
                <Stat title="Pendentes" value={pendingItems.length} color="#f59e0b" />
                <Stat title="Conferidos" value={confirmedItems.length} color="#10b981" />
                <Stat title="Divergências" value={divergentItems.length} color="#ef4444" />
                <Stat title="Sem Vínculo" value={unmappedItems.length} color="#6366f1" />
            </div> */}


             <div className={styles.filterGroup}>
                    <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
                        Todos ({items.length})
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


            {/* Filtros e Ações em Lote */}
            <div className={styles.filterContainer}>
                <div className={hasSelection ? styles.bulkActions : styles.bulkActionsDisabled}>
                    <strong>
                        {hasSelection ? `${selected.size} selecionado(s)` : 'Nenhum item selecionado'}
                    </strong>
                    <button style={{color:'black'}} disabled={!hasSelection} onClick={() => { onConfirmItems(selectedIds); setSelected(new Set()); }}>Conferir</button>
                    <button style={{color:'black'}}disabled={!hasSelection} onClick={() => { onUnconfirmItems(selectedIds); setSelected(new Set()); }}>Desfazer</button>
                    <button style={{color:'black'}}disabled={!hasSelection} onClick={() => onMapProducts(selectedIds)}>Vincular</button>
                    <button style={{color:'black'}}disabled={!hasSelection} onClick={() => { onRemoveItems(selectedIds); setSelected(new Set()); }}>Remover</button>
                </div>

              
                <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' ,}}>

Checkagem turbo ⚡
                </span>

                <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' , }}>
                <input type='checkbox' title='Checkagem turbo: Funcionalidade futura: Ao marcar, o sistema pode aplicar regras de conferência automática. podendo ser: ao dobbleclick no status item é marcado como conferido.'/>   {/* Funcionalidade futura: Ao marcar, o sistema pode aplicar regras de conferência automática. podendo ser: ao dobbleclick no status item é marcado como conferido. e ou  */}
                </span>

            </div>

            {/* Tabela de Conferência */}
            <div className={styles.tableResponsive}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ width: '20px' }}>
                                <input
                                    type="checkbox"
                                    checked={filteredItems.length > 0 && selected.size === filteredItems.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th >Item</th> {/* ⬅️ Nova coluna ideal */}
                            <th>Cod. Interno</th>
                            <th style={{ width: '200px' }}>SKU / EAN</th>
                            <th style={{ width: '200px' }}>Produto</th>
                            <th>UOM</th>
                            <th>Custo Unit.</th>
                            <th>Qtd (NF)</th>
                            <th >QTD Recebido</th>
                            <th>Dif.</th>
                            <th>Total Item</th>
                            <th style={{ width: '10px' }}>status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredItems.map(item => {
    // 1. O parser extrai a quantidade correta da NF-e
    const quantityNF = item.quantidade || 0;
    
    // 2. Calcula a diferença de forma dinâmica e segura para evitar NaN
    // Se o pai não calcular a diferença, nós calculamos: Qtd da NF - Qtd Recebida fisicamente
    const currentDifference = typeof item.difference === 'number' 
        ? item.difference 
        : quantityNF - item.receivedQuantity;

    const isDivergent = currentDifference !== 0;

    // 3. Fallbacks seguros com base EXATA no retorno do seu nfeParser
    const unitCost = item.valorCustoReal || item.valorUnitario || 0; 
    const uom = item.unidadeMedida || 'UN';
    
    // 4. O total do item reflete o custo real vezes a quantidade que entrou fisicamente
    const totalItem = unitCost * item.receivedQuantity;

    // Formatador interno de moeda (R$)
    const formatCurrency = (value: number) => 
        value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return (
        <tr key={item.tempId} className={item.confirmed ? styles.rowConfirmed : ''}>
            <td>
                <input
                    type="checkbox"
                    checked={selected.has(item.tempId)}
                    onChange={() => toggleSelection(item.tempId)}
                />
            </td>
            {/* 🔴 EXIBIÇÃO DO NÚMERO DO ITEM DO XML */}
    <td style={{ fontWeight: 'bold', color: '#6b7280', textAlign: 'center' }}>
        {item.nItem || '-'}
    </td>
            <td>
                {item.mappedId ? (
                    <span className={styles.internalCodeBadge}>
                        {item.mappedId}
                    </span>
                ) : (
                    <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => onMapProducts([item.tempId])}
                        title="Clique para vincular a um produto existente"
                    >
                        🔗 Vincular Produto
                    </button>
                )}
            </td>

             <td>{/*{item.sku} /  */} {item.gtin}</td>
            <td>
                <div className={styles.productDesc}>{item.descricao}</div>
            </td>
            <td><span className={styles.uomBadge}>{uom}</span></td>
            <td>{formatCurrency(unitCost)}</td>
            <td><strong>{quantityNF}</strong></td>
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
                        onChange={(e) => handleQuantityChange(item.tempId, parseInt(e.target.value, 10) || 0)}
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
                {isDivergent ? (
                    <span className={currentDifference > 0 ? styles.textDanger : styles.textSuccess}>
                        {currentDifference > 0 ? `-${currentDifference}` : `+${Math.abs(currentDifference)}`}
                    </span>
                ) : (
                    <span className={styles.textSuccess}>0</span>
                )}
            </td>
            <td><strong>{formatCurrency(totalItem)}</strong></td>
            <td style={{ textAlign: 'center', cursor: 'help', fontSize: '1.2rem' }} title={item.confirmed ? 'Item conferido' : isDivergent ? 'Divergência detectada' : 'Aguardando conferência'}>
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
        </div>
    );
};

/* Componentes Auxiliares Fatorados */
const Stat = ({ title, value, color }: { title: string; value: number; color: string }) => (
    <div className={styles.statCard} style={{ borderLeft: `4px solid ${color}` }}>
        <div className={styles.statTitle}>{title}</div>
        <strong className={styles.statValue} style={{ color }}>
            {value}
        </strong>
    </div>
);

const FilterButton = ({ active, children, onClick }: any) => (
    <button
        onClick={onClick}
        className={active ? styles.filterButtonActive : styles.filterButton}
    >
        {children}
    </button>
);