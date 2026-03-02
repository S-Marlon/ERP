import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import styles from './PDV.module.css';
import { AutoPart, SaleItem, CartItem } from './types';
import { searchProducts, Product } from '../../data/api';
import { CartAside } from './pages/Cart/CartAside';
import Button from '../../components/ui/Button/Button';
import ProductFilter from '../../components/forms/search/ProductFilter';
import { FinalizarVenda } from './pages/FinalizarVenda';

type PDVStep = 'SELECAO' | 'PAGAMENTO';

interface FilterState {
  status: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  minStock: string;
  maxStock: string;
  clientName: string;
  clientEmail: string;
  clientCpf: string;
  clientPhone: string;
  orderNumber: string;
  serviceType: string;
  date: string;
  paymentMethod: string;
}

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

  /* ===== CENTRALIZED STATE FOR SYNC ===== */
  // Core sale state
  const [estagio, setEstagio] = useState<PDVStep>('SELECAO');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cliente, setCliente] = useState('');
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [identificadorCliente, setIdentificadorCliente] = useState("");

  // UI state
  const [activeTab, setActiveTab] = useState<'parts' | 'services' | 'os'>('parts');
  const [selectedPart, setSelectedPart] = useState<AutoPart | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Product data
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // OS-specific data
  const [osData, setOsData] = useState({
    equipment: '',
    application: '',
    gauge: '',
    layers: '',
    finalLength: '',
    laborType: 'fixed' as 'fixed' | 'percent' | 'service',
    laborValue: 0,
    selectedServiceId: ''
  });

  // Initialize on mount
  useEffect(() => {
    if (id) {
      // Editar venda existente - aqui você buscaria do back se tiver
      setCliente('Cliente #' + id);
    } else {
      setMostrarModalCliente(true);
    }
  }, [id]);

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

  const handleFilterChange = (key: keyof FilterState, value: string | number | boolean) => {
    // Filters kept for continuity with ProductFilter component
  };

  /* ===== DATA FETCHING ===== */


  useEffect(() => {
    console.log('useEffect triggered: activeTab=', activeTab, 'searchTerm=', searchTerm);
    if (activeTab === 'parts') {
      console.log('Buscando produtos...');
      setLoadingProducts(true);
      searchProducts(searchTerm).then((data) => {
        console.log('Produtos recebidos:', data);
        setProducts(data);
        setLoadingProducts(false);
      }).catch(() => {
        console.log('Erro na busca');
        setProducts([]);
        setLoadingProducts(false);
      });
    } else {
      console.log('Não buscando, aba não é parts');
      setProducts([]);
    }
  }, [searchTerm, activeTab]);

  const filteredData = useMemo(() => {
    if (activeTab === 'os') return [];
    if (activeTab === 'parts') {
      return products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.salePrice,
        brand: '',
        category: p.category,
        type: 'part' as const,
        stock: p.currentStock,
        sku: p.sku,
        unitOfMeasure: p.unitOfMeasure,
        status: p.status,
      })) as CartItem[];
    }
    return MOCK_SERVICES.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) as CartItem[];
  }, [searchTerm, activeTab, products]);

  const addToCart = useCallback((item: SaleItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        if (item.type === 'part' && item.stock && existing.quantity >= item.stock) {
          alert("Estoque insuficiente!");
          return prev;
        }
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);


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



        <nav className={styles.tabsContainer}>
          <button className={`${styles.tabButton} ${activeTab === 'parts' ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab('parts')}>📦 Peças</button>
          <button className={`${styles.tabButton} ${activeTab === 'services' ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab('services')}>🛠️ Serviços</button>
          <button className={`${styles.tabButton} ${activeTab === 'os' ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab('os')}>📋 Gerar OS</button>
        </nav>
        <ProductFilter filters={'obj'} onFilterChange={handleFilterChange} onApply={() => console.log("Aplicar filtros avançados")} onReset={() => console.log("Resetar filtros avançados")} />
        <header className={styles.topHeader}>
          <div className={styles.searchContainer}>
            {/* <button className={styles.btnFilterToggle} onClick={() => setIsFilterOpen(!isFilterOpen)}>
              {isFilterOpen ? '⇠ Ocultar' : '☰ Filtros'}
            </button> */}
            <input
              className={styles.mainInput}
              placeholder={`Buscar ${activeTab === 'parts' ? 'peças...' : 'serviços...'}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={activeTab === 'os'}
            />


          </div>

          <div>


            <select>
              <option value="">Filtrar por Categoria</option>
              {activeTab === 'parts' ? (
                <><option value="Hidráulica">Hidráulica</option>
                  <option value="Pneumática">Pneumática</option>
                  <option value="Elétrica">Elétrica</option>
                  <option value="Automotiva">Automotiva</option></>
              ) : (
                <><option value="Prensagem">Prensagem</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Qualidade">Qualidade</option>
                </>
              )}
            </select>

            <input type="checkbox" id="onlyInStock" />
            <label htmlFor="onlyInStock"> Somente com estoque</label>

            <label className="switch">
              <input type="checkbox" checked/>
                <span className="slider round"></span>
            </label>

            {/* onChange={(e) => setOnlyInStock(e.target.checked)} */}



          </div>
        </header>

        {activeTab === 'os' ? (
          <>
            <ProductFilter filters={filters} onFilterChange={handleFilterChange} onApply={() => console.log("Aplicar filtros avançados")} onReset={() => console.log("Resetar filtros avançados")} />


            <section className={styles.osSection}>
              <div className={styles.osForm}>
                <h2>Configuração da Montagem Hidráulica</h2>

                {/* Identificação da Máquina */}
                <div className={styles.inputGroupRow}>
                  <div className={styles.inputField}>
                    <label>Equipamento / Frota</label>
                    <input
                      placeholder="Ex: Escavadeira PC200 / Lote 04"
                      value={osData.equipment}
                      onChange={e => setOsData({ ...osData, equipment: e.target.value })}
                    />
                  </div>
                  <div className={styles.inputField}>
                    <label>Local de Aplicação</label>
                    <input
                      placeholder="Ex: Comando Central / Lança"
                      value={osData.application}
                      onChange={e => setOsData({ ...osData, application: e.target.value })}
                    />
                  </div>
                </div>

                {/* Especificações da Mangueira (Prensagem) */}
                <div className={styles.specsContainer}>
                  <h4>Especificações de Prensagem</h4>
                  <div className={styles.inputGroupRow}>
                    <div className={styles.inputField}>
                      <label>Bitola (Pol/Dash)</label>
                      <select
                        value={osData.gauge}
                        onChange={e => setOsData({ ...osData, gauge: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        <option value="1/4">1/4" (-04)</option>
                        <option value="3/8">3/8" (-06)</option>
                        <option value="1/2">1/2" (-08)</option>
                        <option value="3/4">3/4" (-12)</option>
                        <option value="1">1" (-16)</option>
                      </select>
                    </div>
                    <div className={styles.inputField}>
                      <label>Nº de Tramas/Reforço</label>
                      <select
                        value={osData.layers}
                        onChange={e => setOsData({ ...osData, layers: e.target.value })}
                      >
                        <option value="1">1 Trama (R1)</option>
                        <option value="2">2 Tramas (R2)</option>
                        <option value="4">4 Espirais (4SH/4SP)</option>
                        <option value="6">6 Espirais (R13/R15)</option>
                      </select>
                    </div>
                    <div className={styles.inputField}>
                      <label>Medida Final (mm)</label>
                      <input
                        type="number"
                        placeholder="Ex: 1250"
                        value={osData.finalLength}
                        onChange={e => setOsData({ ...osData, finalLength: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.laborContainer}>
                  <label>Serviço de Prensagem</label>
                  <div className={styles.laborTypeSelector}>
                    <button
                      className={osData.laborType === 'per_point' ? styles.activeType : ''}
                      onClick={() => setOsData({ ...osData, laborType: 'per_point' })}
                    >R$ Por Terminal</button>
                    <button
                      className={osData.laborType === 'fixed' ? styles.activeType : ''}
                      onClick={() => setOsData({ ...osData, laborType: 'fixed' })}
                    >Valor Fixo Montagem</button>
                    <button
                      className={osData.laborType === 'table' ? styles.activeType : ''}
                      onClick={() => setOsData({ ...osData, laborType: 'table' })}
                    >📋 Tabela por Bitola</button>
                  </div>

                  <div className={styles.laborInputWrapper}>
                    <div className={styles.inputWithIcon}>
                      <span className={styles.currencyBadge}>R$</span>
                      <input
                        type="number"
                        placeholder="Custo da prensagem"
                        value={osData.laborValue}
                        onChange={e => setOsData({ ...osData, laborValue: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    {osData.laborType === 'per_point' && (
                      <span className={styles.infoHelper}>* Multiplicado pelo número de terminais adicionados.</span>
                    )}
                  </div>

                  <p className={styles.laborPreview}>
                    Subtotal do serviço: <strong>{money.format(calculatedLabor)}</strong>
                  </p>
                </div>

                <div className={styles.osInstructions}>
                  <button className={styles.btnTabSwitch} onClick={() => setActiveTab('parts')}>
                    ← Adicionar Mangueira e Terminais (Peças)
                  </button>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className={styles.tableSection}>





            {loadingProducts && <p>Carregando produtos...</p>}<select>
              <option value="">Ordenar por...</option>
              <option value="name_asc">Nome A-Z</option>
              <option value="name_desc">Nome Z-A</option>
              <option value="price_asc">Preço: Menor</option>
              <option value="price_desc">Preço: Maior</option>
            </select>
            <table className={styles.partsTable}>
              <thead>
                <tr>
                  <th>Codigo ID</th>
                  <th >Produto</th>
                  {activeTab === 'parts' ? <><th>Status</th><th>Estoque</th></> : <th>Categoria</th>}
                  <th>Preço</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(item => (
                  <tr key={item.id}>
                    <td>{item.sku || '-'}</td>
                    <td>
                      <div className={styles.partPrimary}>
                        <strong>{item.name}</strong>
                        {'sku' in item && <code>{item.category}</code>}
                      </div>
                    </td>
                    {activeTab === 'parts' ? (
                      <>
                        <td > <div style={{ border: '2px solid green', padding: '4px', color: 'green', borderRadius: '4px', background: '#e6fce8', textAlign: 'center' }}>{item.status}</div></td>
                        <td>{item.stock} {item.unitOfMeasure || 'un'}</td>
                      </>
                    ) : (
                      <td><span className={styles.compatibilityBadge}>{item.category}</span></td>
                    )}
                    <td className={styles.price}>{money.format(item.price)}</td>
                    <td className={styles.actions}>
                      {/* Removido botão de info por enquanto */}
                      <button className={styles.btnAddToCart} onClick={() => addToCart(item as SaleItem)}>Adicionar</button>
                      <Button variant='secondary'>Detalhes</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
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
      />


      <aside className={styles.paymentSidebar}>
        <FinalizarVenda
          onBack={() => setEstagio('SELECAO')}
          total={total}
          cliente={cliente}
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
              <div className={styles.detailGrid}>
                <p><strong>Marca:</strong> {selectedPart.brand}</p>
                <p><strong>OEM:</strong> {selectedPart.oemCode}</p>
                <p><strong>SKU:</strong> {selectedPart.sku}</p>
                <p><strong>Compatibilidade:</strong> {selectedPart.compatibility}</p>
                <p><strong>Estoque:</strong> {selectedPart.stock} un (📍 {selectedPart.location})</p>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <span className={styles.modalPrice}>{money.format(selectedPart.price)}</span>
              <button className={styles.btnModalAdd} onClick={() => { addToCart({ ...selectedPart, type: 'part' }); setSelectedPart(null); }}>
                Adicionar ao Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};