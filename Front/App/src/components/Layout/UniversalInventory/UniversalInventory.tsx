import React from 'react';
import styles from './UniversalInventory.module.css';

// 1. Interfaces Simplificadas e Genéricas
interface Column<T> {
  header: string;
  key: keyof T | string;
  render?: (item: T) => React.ReactNode;
  textAlign?: 'left' | 'center' | 'right';
}

interface UniversalInventoryProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  displayMode: 'lista' | 'cards' | 'compact';
  setDisplayMode: (mode: 'lista' | 'cards' | 'compact') => void;
  
  // Paginação e Ordenação controladas pelo Pai
  pagination: {
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    totalPages: number;
  };
  sortOrder: string;
  
  // Callbacks de Ação
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (limit: number) => void;
  onSortChange: (sort: string) => void;
  onRefresh: () => void;
  onAction?: (item: T) => void;
  
  moneyFormatter?: (value: number) => string;
}

const UniversalInventory = <T extends { 
  id: string | number; 
  name: string; 
  price: number; 
  stock: number; 
  imageUrl?: string; 
  sku?: string; 
  category?: string 
}>({
  data,
  columns,
  loading,
  displayMode,
  setDisplayMode,
  pagination,
  sortOrder,
  onPageChange,
  onItemsPerPageChange,
  onSortChange,
  onRefresh,
  onAction,
  moneyFormatter
}: UniversalInventoryProps<T>) => {

  const { totalItems, currentPage, itemsPerPage, totalPages } = pagination;

  return (
    <div className={styles.tableSection} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* 1. TOOLBAR SUPERIOR */}
      <div className={styles.productToolbar}>
        <div className={styles.infoCount}>
          <button className={styles.btnSync} onClick={onRefresh} disabled={loading}>
            {loading ? <span className={styles.loaderInline}></span> : '↺'} Atualizar
          </button>
          <span>{totalItems} itens no total</span>
        </div>

        <div className={styles.actionsGroup}>
          {(['lista', 'cards', 'compact'] as const).map(mode => (
            <button 
              key={mode}
              className={`${styles.modeBtn} ${displayMode === mode ? styles.modeBtnActive : ''}`}
              onClick={() => setDisplayMode(mode)}
            >
              {mode === 'lista' ? '📋 Lista' : mode === 'cards' ? '🗂️ Cards' : '📄 Compacto'}
            </button>
          ))}
        </div>

        <div className={styles.actionsGroup}>
          <select 
            className={styles.modernSelect} 
            value={itemsPerPage} 
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map(val => (
              <option key={val} value={val}>{val} por página</option>
            ))}
          </select>

          <select
            className={styles.modernSelect}
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value)}
            style={{ marginLeft: '10px' }}
          >
            <option value="name_asc">Nome A → Z</option>
            <option value="name_desc">Nome Z → A</option>
            <option value="price_asc">Preço ↑</option>
            <option value="price_desc">Preço ↓</option>
            <option value="stock_asc">Estoque ↑</option>
            <option value="stock_desc">Estoque ↓</option>
          </select>
        </div>
      </div>

      {/* 2. ÁREA DE CONTEÚDO (Otimizada) */}
      <div className={styles.scrollableTableContainer} style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        {data.length === 0 && !loading && (
          <div className={styles.emptyState} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            Nenhum item encontrado.
          </div>
        )}

        {displayMode === 'lista' && data.length > 0 && (
          <table className={styles.partsTable}>
            <thead>
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} style={{ textAlign: col.textAlign || 'left' }}>{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item) => {
                const rowClasses = [];
                if ((item as any).rowClass) rowClasses.push(styles[(item as any).rowClass]);
                if ((item as any).isSelected) rowClasses.push(styles.selectedRow);

                return (
                  <tr key={item.id} className={rowClasses.join(' ')}>
                    {columns.map((col, idx) => (
                      <td key={idx} style={{ textAlign: col.textAlign || 'left' }}>
                        {col.render ? col.render(item) : (item as any)[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {displayMode === 'cards' && data.length > 0 && (
          <div className={styles.cardGrid}>
            {data.map((product) => (
              <div key={product.id} className={styles.productCard}>
                {product.stock <= 5 && <span className={styles.stockBadgeDanger}>Estoque Baixo</span>}
                <div className={styles.cardContent}>
                  <span className={styles.cardCategory}>{product.category}</span>
                  <h4 className={styles.cardTitle}>{product.name}</h4>
                  <div className={styles.cardFooter}>
                    <strong>{moneyFormatter ? moneyFormatter(product.price) : `R$ ${product.price.toFixed(2)}`}</strong>
                    <button className={styles.cardAddBtn} onClick={() => onAction?.(product)}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {displayMode === 'compact' && data.length > 0 && (
          <div className={styles.compactList}>
            {data.map((product) => (
              <div key={product.id} className={styles.compactItem}>
                <div className={styles.compactTextGroup}>
                  <strong>{product.name}</strong>
                  <span className={styles.compactSku}>{product.sku}</span>
                </div>
                <button className={styles.compactAddBtn} onClick={() => onAction?.(product)}>+</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. RODAPÉ DE PAGINAÇÃO CONTROLADA */}
      <div className={styles.paginationFooter}>
        <div className={styles.pageInfo}>
          Página <strong>{currentPage}</strong> de <strong>{totalPages || 1}</strong>
        </div>

        <div className={styles.paginationControls}>
          <button disabled={currentPage === 1} onClick={() => onPageChange(1)}>⏮</button>
          <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>←</button>
          
          <input 
            type="number" 
            className={styles.pageInput} 
            value={currentPage}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val >= 1 && val <= totalPages) onPageChange(val);
            }}
          />

          <button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>→</button>
          <button disabled={currentPage >= totalPages} onClick={() => onPageChange(totalPages)}>⏭</button>
        </div>
      </div>
    </div>
  );
};

export default UniversalInventory;