/**
 * OS ITEM LIST
 * Lista de produtos ou serviços com controles
 */

import React, { useCallback } from 'react';
import type { OSLineItem } from '../../../../types/erp.types';
import styles from '../OSPanel.module.css';

interface OSItemListProps {
  items: OSLineItem[];
  type: 'items' | 'services';
  onAddItem: (item: Omit<OSLineItem, 'id'>) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateItem: (item: OSLineItem) => void;
  money: Intl.NumberFormat;
  readonly?: boolean;
}

const OSItemList: React.FC<OSItemListProps> = ({
  items,
  type,
  onRemoveItem,
  onUpdateItem,
  money,
  readonly = false,
}) => {
  const handleQuantityChange = useCallback(
    (item: OSLineItem, newQuantity: number) => {
      if (newQuantity < 1) return;
      onUpdateItem({ ...item, quantity: newQuantity });
    },
    [onUpdateItem]
  );

  const handlePriceChange = useCallback(
    (item: OSLineItem, newPrice: number) => {
      if (newPrice < 0) return;
      onUpdateItem({ ...item, price: newPrice });
    },
    [onUpdateItem]
  );

  const isEmpty = items.length === 0;
  const heading = type === 'items' ? '📦 Produtos Utilizados' : '🛠️ Serviços Executados';

  return (
    <div className={styles.osItems}>
      <h4>{heading}</h4>

      {isEmpty ? (
        <p style={{ color: '#999', textAlign: 'center', padding: '1rem' }}>
          {type === 'items' ? 'Nenhum produto adicionado' : 'Nenhum serviço adicionado'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map((item) => (
            <div key={item.id} className={styles.osItemRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{item.name}</strong>
                {item.description && (
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>
                    {item.description}
                  </div>
                )}
              </div>

              {type === 'items' && !readonly && (
                <div className={styles.qtyControl}>
                  <button onClick={() => handleQuantityChange(item, item.quantity - 1)}>
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(item, parseFloat(e.target.value) || 1)}
                    readOnly={readonly}
                  />
                  <button onClick={() => handleQuantityChange(item, item.quantity + 1)}>
                    +
                  </button>
                </div>
              )}

              {!readonly && (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price}
                  onChange={(e) => handlePriceChange(item, parseFloat(e.target.value) || 0)}
                  placeholder="Preço"
                  style={{ width: '100px' }}
                  readOnly={readonly}
                />
              )}

              <span style={{ minWidth: '120px', textAlign: 'right' }}>
                {money.format(item.price * item.quantity)}
              </span>

              {!readonly && (
                <button
                  onClick={() => onRemoveItem(item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#e74c3c',
                    cursor: 'pointer',
                    fontSize: '1rem',
                  }}
                  title="Remover"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OSItemList;
