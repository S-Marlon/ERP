import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import styles from './PDV.module.css';
import { SaleItem, CartItem, DisplayMode, ProductBasic } from './types';
import { Product } from '../Estoque/pages/StockInventory/types/Stock_Products';
// No topo do PDV.tsx
import {
  getPdvProducts,
  getPdvCategories,
  validateProductStockPrice,
  // ADICIONE ESTAS LINHAS ABAIXO:
  getPdvBrands,
  getPdvStatuses,
  getAllBasicProducts
} from './services/pdvService';
import { useDebounce } from './hooks/useDebounce';
import { CartAside } from './pages/Cart/CartAside';
import { FinalizarVenda } from './pages/FinalizarVenda';
import Switch from '../../components/ui/Switch';
import EcommerceGallery from '../../components/ui/ImageGallery/EcommerceGallery';
import ImageDisplay from '../../components/ui/ImageGallery/ImageDysplay';
import Badge from '../../components/ui/Badge/Badge';
import EditableField from '../../components/forms/EditableField/EditableField';
import UniversalInventory from '../../components/Layout/UniversalInventory/UniversalInventory';
import OSPanel from './services/OSPanel';
import Button from '../../components/ui/Button/Button';
import FlexGridContainer from '../../components/Layout/FlexGridContainer/FlexGridContainer';



type PDVStep = 'SELECAO' | 'PAGAMENTO';

// Observação: CartItem e SaleItem agora são definidos em types.ts



const MOCK_SERVICES: SaleItem[] = [
  { id: 's1', name: 'Prensagem de Mangueira 1 Trama (R1)', category: 'Hidráulica', price: 20.00, type: 'service' },
  { id: 's2', name: 'Prensagem de Mangueira 2 Tramas (R2) bitolas 1/4" até 5/8" ', category: 'Hidráulica', price: 30.00, type: 'service' },
  { id: 's22', name: 'Prensagem de Mangueira 2 Tramas (R2) bitolas 3/4" até 1.1/4" ', category: 'Hidráulica', price: 40.00, type: 'service' },
  { id: 's23', name: 'Prensagem de Mangueira 2 Tramas (R2) bitolas 1.1/2" e 2" ', category: 'Hidráulica', price: 45.00, type: 'service' },
  { id: 's3', name: 'Prensagem de Mangueira 4 Tramas (R12/R13)', category: 'Alta Pressão', price: 30.00, type: 'service' },
  { id: 's4', name: 'Corte e Montagem de Terminais', category: 'Manutenção', price: 20.00, type: 'service' },
  { id: 's5', name: 'Teste de Estanqueidade e Pressão', category: 'Qualidade', price: 10.00, type: 'service' },
  { id: 's6', name: 'Limpeza Interna de Mangueira (Projétil)', category: 'Manutenção', price: 0.00, type: 'service' },
];

export const PDV: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);


  /* ===== CENTRALIZED STATE FOR SYNC ===== */
  // Core sale state
  const [estagio, setEstagio] = useState<PDVStep>('SELECAO');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cliente, setCliente] = useState('');
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [identificadorCliente, setIdentificadorCliente] = useState("");

  // Display Mode: cards | lista | simplificado
  const [displayMode, setDisplayMode] = useState<DisplayMode>('lista');

  // Cache local de produtos (carregado uma única vez)
  const [productCache, setProductCache] = useState<ProductBasic[]>([]);
  const [cacheLoading, setCacheLoading] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<'parts' | 'services' | 'os'>('parts');
  const [selectedPart, setSelectedPart] = useState<SaleItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Product data
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [pdvResponse, setPdvResponse] = useState<ProductsResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [osItems, setOsItems] = useState<CartItem[]>([]);
  const [osServices, setOsServices] = useState<SaleItem[]>([]);

  const addToOS = (item: SaleItem) => {
    if (item.type === 'service') {
      setOsServices(prev => [...prev, item]);
      return;
    }

    setOsItems(prev => {
      const existing = prev.find(i => i.id === item.id);

      if (existing) {
        return prev.map(i =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }

      return [...prev, { ...item, quantity: 1 }];
    });
  };

  // Categoria selecionada
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  // Filtros avançados
  const [minPrice, setMinPrice] = useState('0');
  const [maxPrice, setMaxPrice] = useState('999999');
  const [minStock, setMinStock] = useState('');
  const [status, setStatus] = useState('Todos');
  const [brand, setBrand] = useState('Todos');

  // Opções dinamicamente carregadas dos filtros
  const [brandOptions, setBrandOptions] = useState<string[]>(['Todos']);
  const [statusOptions, setStatusOptions] = useState<string[]>(['Todos', 'Ativo', 'Inativo']);
  const [unitOptions, setUnitOptions] = useState<string[]>([]);

  const [onlyInStock, setOnlyInStock] = useState(true);
  const [onlyActive, setOnlyActive] = useState(true);

  // Paginação
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Debounce no search
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const handleChangeMode = (mode: "lista" | "cards" | "compact") => {
    if (mode === "lista" || mode === "cards") {
      setDisplayMode(mode);
    }
  };

  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    searchRef.current?.focus();
  }, [cart.length, mostrarModalCliente === false]);

  // OS-specific data
  const [osData, setOsData] = useState({
    equipment: '',
    application: '',
    gauge: '',
    layers: '',
    finalLength: '',
    laborType: 'fixed' as 'fixed' | 'percent' | 'service' | 'per_point' | 'table',
    laborValue: 0,
    selectedServiceId: ''
  });


  // mapear suas categorias para o formato que o react-select espera
  const options = [
    { value: 'Todas', label: 'Todas' },
    ...dynamicCategories.map(cat => ({ value: cat, label: cat }))
  ];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mostrarModalCliente) {
        setMostrarModalCliente(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mostrarModalCliente]);


  // Initialize on mount
  useEffect(() => {
    if (id) {
      // Editar venda existente - aqui você buscaria do back se tiver
      setCliente('Cliente #' + id);
    } else {
      setMostrarModalCliente(true);
    }
  }, [id]);

  // ===== CARREGA CACHE LOCAL DE PRODUTOS (Uma única vez) =====
  useEffect(() => {
    const loadCache = async () => {
      setCacheLoading(true);
      try {
        const basicProducts = await getAllBasicProducts();
        setProductCache(basicProducts);
      } catch (error) {
        console.error('Erro ao carregar cache de produtos:', error);
        setProductCache([]);
      } finally {
        setCacheLoading(false);
      }
    };

    loadCache();
  }, []); // Executa uma única vez no mount

  const confirmarCliente = () => {
    setCliente(identificadorCliente || "Consumidor Final");
    setMostrarModalCliente(false);
  };


  /* ===== CALCULATED STATE (Memoized) ===== */
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  // Subtotal de itens
  const itemsSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  // Mão de obra calculada dinamicamente
  const calculatedLabor = useMemo(() => {
    if (osData.laborType === 'percent') {
      return itemsSubtotal * (osData.laborValue / 100);
    }
    if (osData.laborType === 'service') {
      const service = MOCK_SERVICES.find(s => s.id === osData.selectedServiceId);
      return service ? service.price : 0;
    }
    return osData.laborValue; // fixed
  }, [itemsSubtotal, osData.laborType, osData.laborValue, osData.selectedServiceId]);

  const osTotal = useMemo(() => {
    const itemsTotal = osItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const servicesTotal = osServices.reduce((acc, s) => acc + s.price, 0);

    return itemsTotal + servicesTotal + calculatedLabor;
  }, [osItems, osServices, calculatedLabor]);
  // Total geral (itens + mão de obra)
  const total = useMemo(() => itemsSubtotal + calculatedLabor, [itemsSubtotal, calculatedLabor]);

  /* ===== UNIFIED HANDLERS ===== */
  const updateQuantity = (id: string | number, value: number | string) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const canFractionate = ['MT', 'LT', 'KG', 'M', 'L'].includes(item.unitOfMeasure?.toUpperCase() || '');

        let newQty: number;
        if (typeof value === 'string') {
          newQty = parseFloat(value.replace(',', '.')) || 0;
        } else {
          newQty = item.quantity + value;
        }

        let clampedQty = Math.max(0, newQty);
        if (!canFractionate) {
          clampedQty = Math.floor(clampedQty);
        }

        if (item.type === 'part' && item.stock && clampedQty > item.stock) {
          alert("Quantidade excede o estoque disponível!");
          return item;
        }

        return { ...item, quantity: Number(clampedQty.toFixed(2)) };
      }
      return item;
    }));
  };

  const removeItem = (id: string | number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  type LastScanItem = {
    id: number;
    name: string;
    price: number;
    sku?: string;
    quantity: number;
    img?: string;
  };

  const [lastScan, setLastScan] = useState<LastScanItem | null>(null);


  const handleResetFilters = () => {
    setMinPrice('0');
    setMaxPrice('999999');
    setMinStock('');
    setStatus('Todos');
    setBrand('Todos');
    setSelectedCategory('Todas');
    setSearchTerm('');
    setCurrentPage(1);
    setOnlyInStock(true);
    setOnlyActive(true);
  };

  /* ===== ADD TO CART (DEVE VIR ANTES DE PROCESSBARCODE) ===== */



  const addToCart = useCallback(async (item: SaleItem) => {


    if (item.type === 'part' && item.id) {
      try {
        const validation = await validateProductStockPrice(item.id as number);

        if (!validation) return;

        if (validation.stock <= 0) {
          alert(`Atenção: ${item.name} está sem estoque!`);
          return;
        }

        setCart(prev => {
          const existing = prev.find(i => i.id === item.id);

          if (existing) {
            return prev.map(i =>
              i.id === item.id
                ? { ...i, quantity: i.quantity + 1 }
                : i
            );


          }

          return [
            ...prev,
            {
              ...item,
              stock: validation.stock,
              price: item.price,
              quantity: 1
            }
          ];
        });


        setLastScan({
          id: Date.now(),
          name: item.name,
          price: item.price,
          sku: item.sku,
          quantity: 1,
          img: item.pictureUrl,
        });




      } catch (err) {
        console.error('Erro ao validar produto:', err);
      }
    } else {
      setCart(prev => {
        const existing = prev.find(i => i.id === item.id);

        if (existing) {
          return prev.map(i =>
            i.id === item.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          );
        }

        return [...prev, { ...item, quantity: 1 }];
      });
    }
  }, []);



const beep = () => {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  oscillator.type = 'sine'; // Tipo de onda: sine, square, sawtooth,triangle
  oscillator.frequency.value = 1500; // Hz
  oscillator.connect(ctx.destination); 
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.02); // dura 0.1s
};


useEffect(() => {
  if (lastScan) {
    beep(); // toca beep
  }
}, [lastScan]);


  // --- BUSCA POR CÓDIGO DE BARRAS NO BANCO ---
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
            type: 'part',
            sku: p.sku,
            barcode: p.barcode,
            stock: Number(p.currentStock) || 0,
            unitOfMeasure: p.unitOfMeasure,
            category: p.category,
            status: p.status,
            pictureUrl: p.pictureUrl,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao bipar:', error);
    }
  }, [addToCart]);





  // Hook para captar leitura de código de barras
  useEffect(() => {
    let barcodeAccumulator = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeSinceLastKey = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (timeSinceLastKey > 100) {
        barcodeAccumulator = '';
      }

      if (e.key === 'Enter') {
        if (barcodeAccumulator.length > 3) {
          e.preventDefault();
          processBarcode(barcodeAccumulator); // Dispara a busca no banco
          barcodeAccumulator = '';
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        barcodeAccumulator += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [processBarcode]); // Essencial para pegar a versão atualizada da busca




  const quickCategories = dynamicCategories.slice(0, 2);


  useEffect(() => {
    if (searchTerm.length < 3) return;

    const match = dynamicCategories.find(cat =>
      searchTerm.toLowerCase().includes(cat.toLowerCase())
    );

    if (match) {
      setSelectedCategory(match);
    }
  }, [searchTerm]);

  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        // Busca as categorias baseado na aba ativa
        const type = activeTab === 'parts' ? 'parts' : 'services';
        const data = await getPdvCategories(type);

        // Sempre adiciona "Todas" como a primeira opção
        setDynamicCategories([...data]);
      } catch (e) {
        console.error('Erro ao carregar categorias:', e);
        setDynamicCategories(['Todas', 'Erro ao carregar']);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, [activeTab]); // Recarrega sempre que mudar entre Peças e Serviços

  // Carregar opções de filtros (brands, statuses, units) - uma única vez
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        // Executa as duas buscas ao mesmo tempo para performance
        const [brands, statuses] = await Promise.all([
          getPdvBrands(),
          getPdvStatuses()
        ]);

        // Atualiza os estados apenas se houver retorno
        if (brands && brands.length > 0) {
          setBrandOptions(['Todos', ...brands]);
        }

        if (statuses && statuses.length > 0) {
          setStatusOptions(['Todos', ...statuses]);
        }

      } catch (e) {
        console.error('Erro ao carregar opções de filtros no componente:', e);
        // Fallback em caso de erro para não travar a UI
        setBrandOptions(['Todos']);
        setStatusOptions(['Todos', 'Ativo', 'Inativo']);
      }
    };

    loadFilterOptions();
  }, []);


  const applyIndividualDiscount = (id: string | number, newPrice: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === id) {
        return {
          ...item,
          // Se for o preço original (reset), limpamos o originalPrice, 
          // senão, guardamos o preço antigo para referência futura.
          originalPrice: item.originalPrice || item.price,
          price: newPrice
        };
      }
      return item;
    }));
  };

  // Definição das colunas específica para este contexto (Peças)
  const productColumns = [
    {
      header: 'Codificação',
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
      render: (item: any) => (
        <div>
          {Number(item.stock).toLocaleString('pt-BR')}
          {item.unitOfMeasure && <span> {item.unitOfMeasure}</span>}
        </div>
      )
    },
    {
      header: 'Localização',
      key: 'location',
      render: (item: any) => item.location || '-'
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
          <Button variant='secondary'
            onClick={() => setSelectedPart(item)} // Abre o modal de detalhes do produto
          >
            <span>?</span>
          </Button>
          <Button variant='primary'
            onClick={() => addToCart(item)} // Use a função 'addToCart' que você já criou
          >
            <span>+</span>
          </Button>
        </div>
      ),
      textAlign: 'center' as const
    }
  ];



  // 1. Crie um estado para a ordenação
  const [sortOrder, setSortOrder] = useState('');

  // ===== FILTROS LOCAIS AVANÇADOS - Processamento 100% Client-side =====
  // 1. Simplifique o filteredData (ele apenas formata, não filtra mais)
  const formattedData = useMemo(() => {
    return products.map(p => ({
      ...p,
      price: Number(p.salePrice) || 0,
      stock: Number(p.currentStock) || 0,
      type: 'part' as const,
    }));
  }, [products]);


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


  // 1. Unifique em um único useEffect de busca
  useEffect(() => {
    if (activeTab !== 'parts') return;

    let isMounted = true;
    setLoadingProducts(true);

    const fetchData = async () => {
      try {
        const response = await getPdvProducts(filters);

        if (!isMounted) return;

        setPdvResponse(response);
        setProducts(response.data || []);
      } catch (err) {
        console.error(err);
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setLoadingProducts(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [filters, activeTab]);

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
    onlyActive
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


        <nav className={styles.navContainer}>
          <div className={styles.tabsContainer}>
            <button className={`${styles.tabButton} ${activeTab === 'parts' ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab('parts')}>📦 Peças</button>
            <button className={`${styles.tabButton} ${activeTab === 'os' ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab('os')}>📋 Gerar OS</button>
          </div>


        </nav>
        <div style={{ border: '1px solid #ececec', borderRadius: '0px 0px 8px 8px', padding: '8px', marginBottom: '8px', backgroundColor: '#999' }}>



            {/* CABEÇALHO DA SANFONA - O GATILHO */}
            <div
              onClick={() => setIsFiltersOpen(!isFiltersOpen)} // Abre/Fecha ao clicar na barra
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{isFiltersOpen ? '▼' : '▶'}</span> 🔍 Filtros Avançados
              </h3>

              {/* Botão de Limpar (Sempre visível ou apenas quando aberto, você escolhe) */}
              <button
                onClick={(e) => {
                  e.stopPropagation(); // IMPORTANTE: Impede que o clique no botão feche a sanfona
                  handleResetFilters();
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                ✕ Limpar Todos
              </button>


            </div>






            {/* CONTEÚDO QUE SE OCULTA */}
            {isFiltersOpen && (
              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #f3f4f6',
                transition: 'all 0.3s ease' // Transição suave (opcional)
              }}>
                {/* COLOQUE SEUS INPUTS DE FILTRO AQUI DENTRO */}
                {/* Grid de Filtros - Responsivo */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px'
                }}>
                  {/* Filtro: Faixa de Preço */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#555' }}>💰 Faixa de Preço</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        placeholder="Min"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                      <span style={{ fontSize: '12px', color: '#999' }}>—</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                  </div>

                  {/* Filtro: Estoque Mínimo */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#555' }}>📦 Estoque Mínimo</label>
                    <input
                      type="number"
                      placeholder="Qty mínima"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      style={{
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>

                  {/* Filtro: Marca */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#555' }}>🏷️ Marca</label>
                    <select
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      style={{
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      {brandOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro: Status */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#555' }}>✓ Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      style={{
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      {statusOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>





                  {/* Filtro: Unidade de Medida (Opcional) */}
                  {unitOptions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '500', color: '#555' }}>⚖️ Unidade</label>
                      <select
                        style={{
                          padding: '8px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Todas as unidades</option>
                        {unitOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Indicador de Filtros Ativados */}
                {(minPrice !== '0' || maxPrice !== '999999' || minStock !== '' || brand !== 'Todos' || status !== 'Todos' || sortOrder !== '') && (
                  <div style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    backgroundColor: '#e7f3ff',
                    border: '1px solid #91d5ff',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#0050b3'
                  }}>
                    ✓ {[
                      minPrice !== '0' && `Preço min: R$ ${minPrice}`,
                      maxPrice !== '999999' && `Preço max: R$ ${maxPrice}`,
                      minStock !== '' && `Estoque min: ${minStock}`,
                      brand !== 'Todos' && `Marca: ${brand}`,
                      status !== 'Todos' && `Status: ${status}`,
                      sortOrder !== '' && `Ordenação: ${sortOrder === 'name_asc' ? 'A-Z' :
                        sortOrder === 'name_desc' ? 'Z-A' :
                          sortOrder === 'price_asc' ? 'Preço menor' :
                            sortOrder === 'price_desc' ? 'Preço maior' : sortOrder
                      }`
                    ].filter(Boolean).join(' | ')}
                  </div>
                )}
              </div>
            )}
          </div>









        <div className={styles.gridWrapper}>



          <header className={styles.topHeader} style={{ position: 'relative' }}>


            <div className={styles.searchSection}>
              <EditableField
                label="Busca de Itens"
                showLock={false}
                isDirty={searchTerm !== ''}
                showOriginalValue={false}

                originalValue="" // Adicionei para não dar erro de prop obrigatória
                onRevert={() => setSearchTerm('')}
              >
                <input
                  className={styles.mainInput}
                  ref={searchRef}
                  type="text"
                  placeholder={`Buscar ${activeTab === 'parts' ? 'peças...' : 'serviços...'}`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={activeTab === 'os'}
                />
              </EditableField>
            </div>

            <div className={styles.filterBar}>
              <EditableField
                label="Ordenar por categoria"
                showLock={false}
                isDirty={selectedCategory !== 'Todas'}
                showOriginalValue={false}
                originalValue="Todas"
                onRevert={() => setSelectedCategory('Todas')}
              >



                <div className={styles.categoryWrapper}>
                  {/* SELECT COM BUSCA */}
                  <select
                    value={options.find(option => option.value === selectedCategory)}
                    onChange={(option) => setSelectedCategory(option.value)}
                    options={options}
                    className={styles.categorySelect}
                    classNamePrefix="react-select"
                    isSearchable={true} // habilita a barra de pesquisa
                  />

                  {/* CHIPS RÁPIDOS */}
                  <div className={styles.quickChips}>
                    {quickCategories.map(cat => (
                      <button
                        key={cat}
                        className={`${styles.chip} ${selectedCategory === cat ? styles.chipActive : ''}`}
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>


              </EditableField>
              

            </div>




          </header>


           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',alignItems: 'center', gap: '8px' }}>

            {/* Filtro: Estoque */}
            <EditableField
              label="Com estoque"
              showLock={false}
              isDirty={!onlyInStock}
              showOriginalValue={false}
              originalValue={true}
              onRevert={() => setOnlyInStock(true)}
            >
              <div className={styles.stockToggle}>
                <Switch
                  checked={onlyInStock}
                  // Forçamos a inversão baseada no valor atual
                  onChange={() => setOnlyInStock(prev => !prev)}
                />
              </div>
            </EditableField>

            {/* Filtro: Ativos */}
            <EditableField
              label="Ativos"
              showLock={false}
              isDirty={!onlyActive}
              showOriginalValue={false}
              originalValue={true}
              onRevert={() => setOnlyActive(true)}
            >
              <div className={styles.stockToggle}>
                <Switch
                  checked={onlyActive}
                  onChange={() => setOnlyActive(prev => !prev)}
                />
              </div>
            </EditableField>



            {/* Filtro: Ordenação */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#555' }}>⇅ Ordenar Por</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                style={{
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="">Padrão (A-Z)</option>
                <option value="name_asc">Nome: A-Z</option>
                <option value="name_desc">Nome: Z-A</option>
                <option value="price_asc">Preço: Menor</option>
                <option value="price_desc">Preço: Maior</option>
              </select>
            </div>
          </div>




           

        </div>
{lastScan && (
  <div key={lastScan.id} className={styles.lastScan}>
    <div className={styles.lastScanContent}>
      <span className={styles.check}>✔</span>

      {lastScan.img && (
        <ImageDisplay
          src={lastScan.img}
          className={styles.ImageDisplay}
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
)}


        {/* A TABELA GENÉRICA */}
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
            setCurrentPage(prev => prev);
          }}
          onAction={addToCart} // Integração direta com sua função de carrinho
          moneyFormatter={(val) => money.format(val)}
        />
        {activeTab === 'os' && (
          <OSPanel
            osItems={osItems}
            setOsItems={setOsItems}
            osServices={osServices}
            setOsServices={handleChangeMode}
            osData={osData}
            setOsData={setOsData}
            osTotal={osTotal}
            calculatedLabor={calculatedLabor}
            money={money}
            setCart={setCart}
            setActiveTab={setActiveTab}
          />
        )}

      </main>
      <CartAside
        cart={cart}
        cliente={cliente}
        itemsSubtotal={itemsSubtotal}
        activeTab={activeTab}
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