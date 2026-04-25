import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import styles from './PDV.module.css';
import { SaleItem } from './types/cart.types';
import { Product } from '../Estoque/pages/StockInventory/types/Stock_Products';
import {
  getPdvProducts,
  getPdvCategories,
  getPdvBrands,
  getPdvStatuses
} from './services/api/products';
import { useDebounce } from './hooks/useDebounce';
import { CartAside } from './pages/Cart/CartAside';
import { FinalizarVenda } from './pages/FinalizarVenda';
import { PDVProvider, usePDV } from './contexts/PDVContext';
import Switch from '../../components/ui/Switch';
import EcommerceGallery from '../../components/ui/ImageGallery/EcommerceGallery';
import ImageDisplay from '../../components/ui/ImageGallery/ImageDysplay';
import Badge from '../../components/ui/Badge/Badge';
import EditableField from '../../components/forms/EditableField/EditableField';
import UniversalInventory from '../../components/Layout/UniversalInventory/UniversalInventory';
import OSPanelAdapter from './components/OSPanelAdapter';
import Button from '../../components/ui/Button/Button';
import { calculateLabor } from './utils/calculations';
import OSListPage from './pages/OSList/OSListPage';
import OSPanelRefactored from './components/OSPanelAdapter';

// Type definitions
type DisplayMode = 'lista' | 'cards' | 'compact';
type Screen = 'pdv' | 'os-list' | 'os-create';

const PDVContent: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  // Get all context state
  const {
    // Cart
    cart,
    addToCart,
    updateQuantity,
    removeItem,
    applyIndividualDiscount,
    // PDV State
    estagio,
    setEstagio,
    cliente,
    identificadorCliente,
    setIdentificadorCliente,
    mostrarModalCliente,
    setMostrarModalCliente,
    confirmarCliente,
    osItems,
    setOsItems,
    osServices,
    setOsServices,
    osData,
    setOsData,
    // Filters from context
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    minStock,
    setMinStock,
    status,
    setStatus,
    brand,
    setBrand,
    sortOrder,
    setSortOrder,
    onlyInStock,
    setOnlyInStock,
    onlyActive,
    setOnlyActive,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    handleResetFilters
  } = usePDV();

  // Local UI state (not in context)

  const [screen, setScreen] = useState<Screen>('pdv');

  const [displayMode, setDisplayMode] = useState<DisplayMode>('lista');
  const [selectedPart, setSelectedPart] = useState<SaleItem | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Debounce search from context
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Type for last scanned item
  type LastScanItem = {
    id: number;
    name: string;
    price: number;
    sku?: string;
    quantity: number;
    img?: string;
  };

  // Local product/category data
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [pdvResponse, setPdvResponse] = useState<{ data: Product[]; pagination: { total: number } } | null>(null);
  const [brandOptions, setBrandOptions] = useState<string[]>(['Todos']);
  const [statusOptions, setStatusOptions] = useState<string[]>(['Todos', 'Ativo', 'Inativo']);
  const [lastScan, setLastScan] = useState<LastScanItem | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);


  const hasActiveFilters = minPrice !== '0' || maxPrice !== '999999' || minStock !== '' || brand !== 'Todos' || status !== 'Todos' || sortOrder !== '';

  // Focus on search when mount or when cart modal closes
  useEffect(() => {
    searchRef.current?.focus();
  }, [cart.length, mostrarModalCliente]);

  // useEffect for key escape on modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mostrarModalCliente) {
        setMostrarModalCliente(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mostrarModalCliente, setMostrarModalCliente]);

  // Initialize on mount
  useEffect(() => {
    if (id) {
      // Editar venda existente - aqui você buscaria do back se tiver
      // setCliente('Cliente #' + id);
    } else {
      setMostrarModalCliente(true);
    }
  }, [id, setMostrarModalCliente]);

  // ===== CARREGA CACHE LOCAL DE PRODUTOS (Uma única vez) =====
  // This is kept for compatibility but not required by new hooks

  /* ===== CALCULATED STATE (Memoized) ===== */
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  // Subtotal de itens
  const itemsSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  // Mão de obra calculada dinamicamente
  const calculatedLabor = useMemo(() => {
    return calculateLabor(osData, itemsSubtotal);
  }, [osData, itemsSubtotal]);

  const osTotal = useMemo(() => {
    const itemsTotal = osItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const servicesTotal = osServices.reduce((acc, s) => acc + s.price, 0);
    return itemsTotal + servicesTotal + calculatedLabor;
  }, [osItems, osServices, calculatedLabor]);

  // Total geral (itens + mão de obra)
  const total = useMemo(() => itemsSubtotal + calculatedLabor, [itemsSubtotal, calculatedLabor]);

  // Beep sound for barcode scanning
  const beep = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 1500; // Hz
    oscillator.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.02); // dura 0.02s
  };

  // Trigger beep when item is scanned
  useEffect(() => {
    if (lastScan) {
      beep();
    }
  }, [lastScan]);


  // Process barcode scan - useCallback to ensure addToCart reference is stable
  const processBarcode = useCallback(async (code: string) => {
    if (!code || code.length < 3) return;
    const cleanCode = code.trim();

    try {
      const response = await getPdvProducts({ searchTerm: cleanCode, limit: 1 });
      if (response?.data?.length > 0) {
        const p = response.data[0];
        const isMatch = p.barcode === cleanCode || p.sku === cleanCode;

        if (isMatch) {
          addToCart({
            id: p.id,
            name: p.name,
            price: Number(p.salePrice) || 0,
            costPrice: Number(p.costPrice) || 0,
            type: 'product',
            sku: p.sku,
            barcode: p.barcode,
            stock: Number(p.currentStock) || 0,
            unitOfMeasure: p.unitOfMeasure,
            category: p.category,
            status: p.status,
            pictureUrl: p.pictureUrl,
          });

          setLastScan({
            id: Date.now(),
            name: p.name,
            price: Number(p.salePrice) || 0,
            sku: p.sku,
            quantity: 1,
            img: p.pictureUrl,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao bipar:', error);
    }
  }, [addToCart, setLastScan]);





  // Hook para captar leitura de código de barras
  useEffect(() => {
    let barcodeAccumulator = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeSinceLastKey = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Reset accumulator if no key in more than 100ms
      if (timeSinceLastKey > 100) {
        barcodeAccumulator = '';
      }

      // Process when Enter is pressed
      if (e.key === 'Enter') {
        if (barcodeAccumulator.length > 3) {
          e.preventDefault();
          processBarcode(barcodeAccumulator);
          barcodeAccumulator = '';
        }
        return;
      }

      // Accumulate printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        barcodeAccumulator += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [processBarcode]);




  // Format categories for select dropdown
  const categoryOptions = [
    { value: 'Todas', label: 'Todas' },
    ...dynamicCategories
      .filter(cat => cat !== 'Todas') // Remove duplicates of 'Todas'
      .map(cat => ({ value: cat, label: cat }))
  ];

  const quickCategories = dynamicCategories.slice(0, 2);


  useEffect(() => {
    if (searchTerm.length < 3) return;

    const match = dynamicCategories.find(cat =>
      searchTerm.toLowerCase().includes(cat.toLowerCase())
    );

    if (match) {
      setSelectedCategory(match);
    }
  }, [searchTerm, dynamicCategories, setSelectedCategory]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        // Busca as categorias baseado na aba ativa
       
        const data = await getPdvCategories(type);

        // Sempre adiciona "Todas" como a primeira opção
        setDynamicCategories([...data]);
      } catch (e) {
        console.error('Erro ao carregar categorias:', e);
        setDynamicCategories(['Todas', 'Erro ao carregar']);
      }
    };

    loadCategories();
  }, [ setDynamicCategories]);

  // All filter options loading
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        // Execute both queries in parallel for performance
        const [brands, statuses] = await Promise.all([
          getPdvBrands(),
          getPdvStatuses()
        ]);

        // Update states only if there's return data
        if (brands && brands.length > 0) {
          // Filter out 'Todos' if it already exists, then add it to front
          const uniqueBrands = brands.filter(b => b !== 'Todos');
          setBrandOptions(['Todos', ...uniqueBrands]);
        }

        if (statuses && statuses.length > 0) {
          // Filter out 'Todos' if it already exists, then add it to front
          const uniqueStatuses = statuses.filter(s => s !== 'Todos');
          setStatusOptions(['Todos', ...uniqueStatuses]);
        }

      } catch (e) {
        console.error('Erro ao carregar opções de filtros no componente:', e);
        // Fallback in case of error
        setBrandOptions(['Todos']);
        setStatusOptions(['Todos', 'Ativo', 'Inativo']);
      }
    };

    loadFilterOptions();
  }, [setBrandOptions, setStatusOptions]);

  // Definição das colunas específica para este contexto (Peças)
  const productColumns = [
    {
      header: 'Codificação-SKU',
      key: 'sku',
      render: (item: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px' }}>
          <span title="SKU"><strong>SKU:</strong> {item.sku || 'N/A'}</span>
          <span title="Barcode" style={{ color: '#666' }}><strong>EAN:</strong> {item.barcode || 'N/A'}</span>
        </div>
      ),
      textAlign: 'left' as const
    },
    {
      header: 'Status',
      key: 'status',
      render: (item: any) => (
        <Badge color={item.status === 'Ativo' ? 'success' : 'danger'}>
          {item.status}
        </Badge>
      ),
      textAlign: 'center' as const
    },
    {
      header: 'Fotos',
      key: 'pictureUrl',
      render: (item: any) => <ImageDisplay src={item.pictureUrl} size="40px" rounded="50%" />
    },
    {
      header: 'Produto',
      key: 'name',
      render: (item: any) =>
        <div className={styles.partPrimary}>
          <strong>{highlightText(item.name, searchTerm)}</strong>
          {'sku' in item && <code>{item.category}</code>}
        </div>

    },
    {
      header: 'Estoque (UoM)',
      key: 'stock',
      render: (item: any) => {
        const stock = Number(item.stock || 0).toLocaleString('pt-BR');
        const unit = item.unitOfMeasure;
        const location = item.location || '-';

        return (
          <div className={styles.stockCell}>
            <div className={styles.stockMain}>
              <span className={styles.stockValue}>{stock}</span>
              {unit && <span className={styles.stockUnit}>{unit}</span>}
            </div>
            <div className={styles.stockLocation}>{location}</div>
          </div>
        );
      }
    },

    {
      header: 'Preço',
      key: 'price',
      render: (item: any) => (
        <span className={styles.price}>
          {/* O Number() aqui é uma camada extra de segurança */}
          {money.format(Number(item.price) || 0)}
        </span>
      ),
      textAlign: 'right' as const
    },
    {
      header: 'Ações',
      key: 'actions',
      render: (item: any) => (
        <div>
          <Button variant='secondary' style={{ padding: '5px' }}
            onClick={() => setSelectedPart(item)} // Abre o modal de detalhes do produto
          >
            <span>?</span>
          </Button>
          <Button variant='primary' style={{ padding: '5px' }}
            onClick={() => addToCart(item)} // Use a função 'addToCart' que você já criou
          >
            <span>+</span>
          </Button>
        </div>
      ),
      textAlign: 'center' as const
    }
  ];

  // ===== FILTROS - Construindo objeto de filtros para API =====
  // Format products for display
  const formattedData = useMemo(() => {
    return products.map(p => ({
      ...p,
      price: Number(p.salePrice) || 0,
      stock: Number(p.currentStock) || 0,
      type: 'part' as const,
    }));
  }, [products]);

  // Build filters object for API
  const filters = useMemo(() => ({
    searchTerm: debouncedSearchTerm || undefined,
    category: selectedCategory !== 'Todas' ? selectedCategory : undefined,
    page: currentPage,
    limit: itemsPerPage,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    minStock: minStock ? parseInt(minStock) : undefined,
    status: status !== 'Todos' ? status : undefined,
    brand: brand !== 'Todos' ? brand : undefined,
    sort: sortOrder || undefined,
    onlyInStock,
    onlyActive
  }), [
    debouncedSearchTerm,
    selectedCategory,
    currentPage,
    itemsPerPage,
    minPrice,
    maxPrice,
    minStock,
    status,
    brand,
    sortOrder,
    onlyInStock,
    onlyActive
  ]);


  // 1. Unified single fetch effect
  useEffect(() => {
    if (screen !== 'pdv') {
      return;
    }

    let isMounted = true;
    setLoadingProducts(true);

    const fetchData = async () => {
      try {
        const response = await getPdvProducts(filters);

        if (!isMounted) return;

        setPdvResponse(response);
        setProducts(response?.data || []);
      } catch (err) {
        console.error('PDV: Error fetching products:', err);
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setLoadingProducts(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [filters, screen, setLoadingProducts, setPdvResponse, setProducts]);

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;

    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');

    const parts = text.split(regex);
    const lowerHighlight = highlight.toLowerCase();

    return parts.map((part, i) =>
      part.toLowerCase() === lowerHighlight ? (
        <mark
          key={i}
          style={{
            backgroundColor: '#ffeb3b',
            padding: '2px',
            borderRadius: '2px'
          }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };


  // Update page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearchTerm,
    selectedCategory,
    minPrice,
    maxPrice,
    minStock,
    status,
    brand,
    onlyInStock,
    onlyActive,
    setCurrentPage
  ]);

  return (
    <div className={`${styles.PDVcontainer} ${estagio === 'PAGAMENTO' ? styles.checkoutActive : ''}`}>

      {/* MODAL DE IDENTIFICAÇÃO (Aparece apenas em Nova Venda) */}
      {mostrarModalCliente && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Identificar Cliente</h3>
            <p>Informe CPF, CNPJ ou Nome para iniciar</p>
            <input
              autoFocus
              type="text"
              className="input-cliente"
              placeholder="000.000.000-00"
              value={identificadorCliente}
              onChange={(e) => setIdentificadorCliente(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmarCliente()}
            />
            <div className="modal-actions">
              <button onClick={confirmarCliente} className="btn-confirmar">Iniciar Venda (Enter)</button>
              <button onClick={confirmarCliente} className="btn-cancelar">Cancelar (ESC)</button>
            </div>
          </div>
        </div>
      )}



      <main className={styles.mainContent}>

        {estagio === 'PAGAMENTO' && <div className={styles.lockOverlay} onClick={() => setEstagio('SELECAO')} />}


        {/* 1. NAVEGAÇÃO DE ABAS */}
        <nav className={styles.navContainer}>
          <div className={styles.tabsContainer}>
            <div className={styles.tabGroup}>
              <button
                className={`${styles.tabButton} ${screen === 'pdv' ? styles.tabButtonActive : ''}`}
                onClick={() => setScreen('pdv')}
              >
                📦 Peças
              </button>

              <button
                className={`${styles.tabButton} ${screen === 'os-list' ? styles.tabButtonActive : ''}`}
                onClick={() => setScreen('os-list')}
              >
                📋 OS
              </button>
            </div>
            {/* Botão de Filtros Avançados (Agora aqui na direita) */}
            <div className={styles.filterActions}>
              {hasActiveFilters && (
                <button className={styles.clearFiltersButton} onClick={handleResetFilters}>
                  Limpar
                </button>
              )}

              {screen === 'pdv' && (
                <button
                  className={`
          ${styles.filterToggleButton} 
          ${isFiltersOpen ? styles.activeFilter : ''} 
          ${hasActiveFilters ? styles.hasFiltersHighlight : ''}
        `}
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                >
                  <span>{isFiltersOpen ? '▼' : '▶'}</span> 🔍 Filtros
                </button>
              )}
            </div>
          </div>
        </nav>

{screen === 'pdv' && (          <>


            {/* 2. BARRA DE FERRAMENTAS (Busca + Estoque + Gatilho de Filtros) */}
            <div className={styles.searchMainWrapper}>
              <div className={styles.searchContainer}>
                {/* Campo de Busca Principal */}
                <div className={styles.inputWrapper}>
                  <input
                    className={styles.mainSearchInput}
                    ref={searchRef}
                    type="text"
                    placeholder={`Pesquisar em ${screen === 'pdv' ? 'Peças' : 'Serviços'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className={styles.clearSearch}>✕</button>
                  )}
                </div>

                {/* Toggle de Estoque Rápido */}
                <div className={styles.quickStockToggle}>
                  <span className={styles.toggleLabel}>Em estoque</span>
                  <Switch checked={onlyInStock} onChange={() => setOnlyInStock(!onlyInStock)} />
                </div>


              </div>

              {/* 3. PAINEL DE FILTROS (Aparece logo abaixo da barra de busca) */}
              {isFiltersOpen && (
                <div className={styles.w}>
                  <div className={styles.filterGrid}>
                    <div className={styles.filterColumn}>
                      <label className={styles.filterLabel}>📂 Categoria</label>
                      <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                        {categoryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <div className={styles.quickChipsInside}>
                        {quickCategories.map(cat => (
                          <button key={cat} onClick={() => setSelectedCategory(cat)}
                            className={`${styles.miniChip} ${selectedCategory === cat ? styles.miniChipActive : ''}`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.filterColumn}>
                      <label className={styles.filterLabel}>💰 Preço e Marca</label>
                      <div className={styles.inputRange}>
                        <input type="number" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                        <input type="number" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
                      </div>
                      <select value={brand} onChange={(e) => setBrand(e.target.value)} style={{ marginTop: '8px' }}>
                        {brandOptions.map(opt => <option key={opt}>{opt}</option>)}
                      </select>
                    </div>

                    <div className={styles.filterColumn}>
                      <label className={styles.filterLabel}>⚙️ Visibilidade</label>
                      <div className={styles.toggleRow}>
                        <span>Somente Ativos</span>
                        <Switch checked={onlyActive} onChange={() => setOnlyActive(!onlyActive)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </>)}
        {/* {lastScan && (
  <div key={lastScan.id} className={styles.lastScan}>
    <div className={styles.lastScanContent}>
      <span className={styles.check}>✔</span>

      {lastScan.img && (
        <ImageDisplay
          src={lastScan.img}
          size="40px"
          rounded="6px"
        />
      )}

      <div className={styles.info}>
        <strong>{lastScan.name}</strong>
        <small>{lastScan.sku || 'Sem código'}</small>
      </div>

      <div className={styles.meta}>
        <span>x{lastScan.quantity}</span>
        <strong>{money.format(lastScan.price)}</strong>
      </div>
    </div>
  </div>
)} */}


        {/* A TABELA GENÉRICA */}
{screen === 'pdv' && (
          <>
            <UniversalInventory
              data={formattedData}
              columns={productColumns}
              loading={loadingProducts}
              displayMode={displayMode}
              setDisplayMode={setDisplayMode} // Agora o modo de exibição é controlado aqui
              sortOrder={sortOrder}

              // Paginação vinda do pdvResponse do seu useEffect
              pagination={{
                totalItems: pdvResponse?.pagination?.total || 0,
                currentPage: currentPage,
                itemsPerPage: itemsPerPage,
                totalPages: Math.ceil((pdvResponse?.pagination?.total || 0) / itemsPerPage)
              }}

              // Callbacks que atualizam os estados do Pai
              onPageChange={(page) => setCurrentPage(page)}
              onItemsPerPageChange={(limit) => {
                setItemsPerPage(limit);
                setCurrentPage(1);
              }}
              onSortChange={(sort) => {
                setSortOrder(sort);
                setCurrentPage(1);
              }}
              onRefresh={() => {
                // Força a atualização disparando o useEffect que depende de filters
                setCurrentPage(1);
              }}
              onAction={addToCart} // Integração direta com sua função de carrinho
              moneyFormatter={(val) => money.format(val)}
            />

          </>)}

        {screen === 'os-list' && (
         <OSListPage
  onCreateOS={() => setScreen('os-create')}
  onBack={() => setScreen('pdv')}
/>
        )}

{screen === 'os-create' && (
            <OSPanelRefactored
            // customerId={clienteId}
            onSubmit={(osItem) => {
              addToCart(osItem);
              setActiveScreen('pdv');
            }}
            onCancel={() => setActiveScreen('os-list')}
            money={money}
          />
        )}

      </main>
      <CartAside
        cart={cart}
        cliente={cliente}
        itemsSubtotal={itemsSubtotal}
        activeTab={screen}
        calculatedLabor={calculatedLabor}
        total={total}
        money={money}
        updateQuantity={updateQuantity}
        removeItem={removeItem}
        onFinalizar={() => setEstagio('PAGAMENTO')}
        onBack={() => setEstagio('SELECAO')}
        estagio={estagio}
        applyIndividualDiscount={applyIndividualDiscount}

      />


      <aside className={styles.paymentSidebar}>
        <FinalizarVenda
          onBack={() => setEstagio('SELECAO')}

          total={total}
          cliente={cliente}
          itens={cart}

        />
      </aside>

      {/* MODAL DE DETALHES (SÓ PARA PEÇAS) */}
      {selectedPart && (
        <div className={styles.modalOverlay} onClick={() => setSelectedPart(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Detalhes: {selectedPart.name}</h2>
              <button onClick={() => setSelectedPart(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {/* Galeria de Imagens */}
              {selectedPart.pictureUrl && (
                <div style={{ marginBottom: '20px' }}>
                  <EcommerceGallery
                    images={selectedPart.pictureUrl.split(',').filter(Boolean)}
                    onValidationError={() => { }}
                    width="50%"
                  />
                </div>
              )}
              <div className={styles.detailGrid}>
                <p><strong>OEM:</strong> {selectedPart.sku || '-'}</p>
                <p><strong>SKU:</strong> {selectedPart.sku || '-'}</p>
                <p><strong>Categoria:</strong> {selectedPart.category || '-'}</p>
                <p><strong>Unidade:</strong> {selectedPart.unitOfMeasure || '-'}</p>
                <p><strong>Status:</strong> {selectedPart.status || '-'}</p>
                <p><strong>Estoque Atual:</strong> {selectedPart.stock || 0} {selectedPart.unitOfMeasure || 'un'}</p>
                <p><strong>Marca:</strong> {selectedPart.brand || '-'}</p>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <span className={styles.modalPrice}>{money.format(selectedPart.price)}</span>
              <button className={styles.btnModalAdd} onClick={() => {
                addToCart(selectedPart);
                setSelectedPart(null);
              }}>
                Adicionar ao Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrapper component that provides context
const PDV: React.FC = () => {
  return (
    <PDVProvider>
      <PDVContent />
    </PDVProvider>
  );
};

export default PDV;