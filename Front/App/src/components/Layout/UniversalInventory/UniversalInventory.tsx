import React, { useState, useEffect } from 'react';
import styles from './UniversalInventory.module.css';
import { getPdvProducts } from '../../../pages/PDV/services/pdvService';
import ImageDisplay from '../../ui/ImageGallery/ImageDysplay';

// Interfaces
interface Column<T> {
  header: string;
  key: string;
  render?: (item: T) => React.ReactNode;
  textAlign?: 'left' | 'center' | 'right';
}

interface UniversalInventoryProps<T> {
  data?: T[];
  columns: Column<T>[];
  displayMode?: 'lista' | 'cards' | 'compact';
  onAction?: (item: T) => void;
  onAdd?: (item: T) => void;
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
  data: parentData,
  displayMode: initialDisplayMode,
  columns,
  onAdd,
  onAction,
  moneyFormatter
}: UniversalInventoryProps<T>) => {
  
  // 1. Estados de Dados e Paginação
  const [pdvResponse, setPdvResponse] = useState<any>({ data: parentData || [], pagination: { total: parentData?.length || 0 } });
  const [products, setProducts] = useState<T[]>(parentData || []);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [displayMode, setDisplayMode] = useState(initialDisplayMode || 'lista');
  const [sortOrder, setSortOrder] = useState('');

  // 2. Estados de Filtro (Necessários para o handleSync não quebrar)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');

  // 3. Função de Busca de Dados
  const handleSync = async () => {
    // Se há dados do parent, não fazer fetch
    if (parentData && parentData.length > 0) {
      return;
    }
    
    setLoadingProducts(true);
    try {
      const filters = {
        searchTerm: searchTerm || undefined,
        category: selectedCategory !== 'Todas' ? selectedCategory : undefined,
        page: currentPage,
        limit: itemsPerPage,
        sort: sortOrder || undefined
      };
      
      const response = await getPdvProducts(filters);
      setPdvResponse(response);
      setProducts(response.data || []);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Sincroniza dados do parent quando mudam
  useEffect(() => {
    if (parentData && parentData.length > 0) {
      setProducts(parentData);
      setPdvResponse({ data: parentData, pagination: { total: parentData.length } });
      setCurrentPage(1);
    }
  }, [parentData]);

  // Sincroniza automaticamente quando a página ou filtros mudam (apenas se não há dados do parent)
  useEffect(() => {
    if (!parentData || parentData.length === 0) {
      handleSync();
    }
  }, [currentPage, itemsPerPage, sortOrder]);

  // Respeita displayMode do parent quando mudar
  useEffect(() => {
    if (initialDisplayMode && initialDisplayMode !== displayMode) {
      setDisplayMode(initialDisplayMode);
    }
  }, [initialDisplayMode]);

  const totalPages = Math.ceil((pdvResponse.pagination?.total || 0) / itemsPerPage);
  const handleAction = onAdd || onAction;

  return (
    <div className={styles.tableSection} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* 1. TOOLBAR SUPERIOR */}
      <div className={styles.productToolbar}>
        <div className={styles.infoCount}>
          <button className={styles.btnSync} onClick={handleSync} disabled={loadingProducts}>
            {loadingProducts ? <span className={styles.loaderInline}></span> : '↺'} Atualizar
          </button>
          <span>{pdvResponse.pagination?.total || 0} produtos no total</span>
        </div>

        <div className={styles.actionsGroup}>
          <button 
            className={`${styles.modeBtn} ${displayMode === 'lista' ? styles.modeBtnActive : ''}`}
            onClick={() => setDisplayMode('lista')}
          >
            📋 Lista
          </button>
          <button 
            className={`${styles.modeBtn} ${displayMode === 'cards' ? styles.modeBtnActive : ''}`}
            onClick={() => setDisplayMode('cards')}
          >
            🗂️ Cards
          </button>
          <button 
            className={`${styles.modeBtn} ${displayMode === 'compact' ? styles.modeBtnActive : ''}`}
            onClick={() => setDisplayMode('compact')}
          >
            📄 Compacto
          </button>
        </div>

        <div className={styles.actionsGroup}>
          <select 
            className={styles.modernSelect} 
            value={itemsPerPage} 
            onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
            }}
          >
            <option value={10}>10 por página</option>
            <option value={20}>20 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>

          <select className={styles.modernSelect} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="">⇅ Ordenar por</option>
            <option value="name_asc">Nome: A-Z</option>
                  <option value="name_desc">Nome: Z-A</option>
            <option value="price_desc">Preço: Maior</option>
                  <option value="price_asc">Preço: Menor</option>

          </select>
        </div>
      </div>

      {/* 2. ÁREA DE CONTEÚDO */}
      <div className={styles.scrollableTableContainer}>
        {displayMode === 'lista' ? (
          <table className={styles.partsTable}>
            <thead>
              <tr>
                {columns?.map((col, idx) => (
                  <th key={idx} style={{ textAlign: col.textAlign || 'left' }}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item.id} className={item.stock <= 5 ? styles.lowStock : ''}>
                  {columns?.map((col, idx) => (
                    <td key={idx} style={{ textAlign: col.textAlign || 'left' }}>
                      {col.render ? col.render(item) : (item as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : displayMode === 'cards' ? (
          
   <div className={styles.cardGrid}>
  {products.map((product) => (
    <div key={product.id} className={styles.productCard}>
      {/* Badge de Alerta (opcional) */}
      {product.stock <= 5 && <span className={styles.stockBadgeDanger}>Estoque Baixo</span>}
      
      <div className={styles.productImageContainer}>
        {/* INSIRA SEU COMPONENTE DE IMAGEM AQUI */}
        
        {/* Exemplo: <SeuComponenteDeImagem src={product.imageUrl} alt={product.name} /> */}
      </div>

      <div className={styles.cardContent}>
        <div className={styles.cardHeader}>
          <span className={styles.cardCategory}>{product.category}</span>
          <h4 className={styles.cardTitle}>{product.name}</h4>
        </div>
        
        <div className={styles.cardFooter}>
          <div className={styles.priceContainer}>
            <span className={styles.priceLabel}>Preço unitário</span>
            <strong className={styles.priceValue}>
              {moneyFormatter ? moneyFormatter(product.price) : `R$ ${product.price.toFixed(2)}`}
            </strong>
          </div>
          
          <button 
            className={styles.cardAddBtn} 
            onClick={() => handleAction?.(product)}
            aria-label="Adicionar produto"
          >
            +
          </button>
        </div>
      </div>
    </div>
  ))}
</div>

        ) : (
          <div className={styles.compactList}>
  {products.map((product) => (
    <div key={product.id} className={styles.compactItem}>
      <div className={styles.compactMainInfo}>
        <span className={styles.compactSku}>{product.sku || 'N/A'}</span>
        <div className={styles.compactTextGroup}>
          <strong className={styles.compactName}>{product.name}</strong>
          <span className={styles.compactCategoryBadge}>{product.category}</span>
        </div>
      </div>
      
      <div className={styles.compactMetrics}>
        <div className={styles.compactMetricItem}>
          <span className={styles.label}>Estoque</span>
          <span className={`${styles.value} ${product.stock <= 5 ? styles.lowStockText : ''}`}>
            {product.stock} un
          </span>
        </div>
        <div className={styles.compactMetricItem}>
          <span className={styles.label}>Preço</span>
          <span className={styles.compactPrice}>
            {moneyFormatter ? moneyFormatter(product.price) : `R$ ${product.price.toFixed(2)}`}
          </span>
        </div>
        <button className={styles.compactAddBtn} onClick={() => handleAction?.(product)}>
          <span>+</span>
        </button>
      </div>
    </div>
  ))}
</div>
        ) }   

      </div>

      {/* 3. RODAPÉ DE PAGINAÇÃO */}
      <div className={styles.paginationFooter}>
        <div className={styles.pageInfo}>
          📄 Página <strong>{currentPage}</strong> de <strong>{totalPages || 1}</strong> 
          <span style={{ marginLeft: '10px', opacity: 0.6 }}>|</span>
          Exibindo <strong>{products.length}</strong> itens
        </div>

        <div className={styles.paginationControls}>
          <button 
            className={styles.btnPage} 
            onClick={() => setCurrentPage(1)} 
            disabled={currentPage === 1}
          > ⏮ </button>
          
          <button 
            className={styles.btnPage} 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
            disabled={currentPage === 1}
          > ← Anterior </button>

          <input 
            type="number" 
            className={styles.pageInput} 
            value={currentPage} 
            min="1"
            max={totalPages}
            onChange={(e) => {
              const val = Number(e.target.value);
              if(val >= 1 && val <= totalPages) setCurrentPage(val);
            }}
          />

          <button 
            className={styles.btnPage} 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
            disabled={currentPage >= totalPages}
          > Próximo → </button>

          <button 
            className={styles.btnPage} 
            onClick={() => setCurrentPage(totalPages)} 
            disabled={currentPage >= totalPages}
          > ⏭ </button>
        </div>
      </div>
    </div>
  );
};

export default UniversalInventory;