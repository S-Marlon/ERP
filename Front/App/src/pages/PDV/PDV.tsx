import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styles from './PDV.module.css';
import { AutoPart, CartItem } from './types';

type SaleItem = (AutoPart | { 
  id: string; 
  name: string; 
  price: number; 
  brand?: string; 
  category: string;
}) & { type: 'part' | 'service'; stock?: number };

const MOCK_PARTS: AutoPart[] = [
  { id: '1', name: 'Pastilha de Freio Dianteira', brand: 'Bosch', oemCode: '0204T123', sku: 'PA-1010', compatibility: 'Gol G5/G6', location: 'A-12', price: 145.90, stock: 12 },
  { id: '2', name: 'Filtro de Óleo', brand: 'Fram', oemCode: 'PH5949', sku: 'FO-55', compatibility: 'Motor EA111 VW', location: 'B-03', price: 32.50, stock: 45 },
  { id: '3', name: 'Amortecedor Traseiro', brand: 'Monroe', oemCode: '377456SP', sku: 'AM-99', compatibility: 'Fiat Palio 2008-2015', location: 'D-01', price: 389.00, stock: 4 },
  { id: '4', name: 'Bomba d\'Água', brand: 'Urba', oemCode: 'UB0620', sku: 'BA-202', compatibility: 'Fiat Fire 1.0/1.4', location: 'A-05', price: 189.90, stock: 8 },
];

const MOCK_SERVICES: SaleItem[] = [
  { id: 's1', name: 'Alinhamento e Balanceamento', category: 'Suspensão', price: 120.00, type: 'service' },
  { id: 's2', name: 'Troca de Óleo e Filtro (Mão de Obra)', category: 'Revisão', price: 60.00, type: 'service' },
  { id: 's3', name: 'Limpeza de Sistema de Arrefecimento', category: 'Motor', price: 180.00, type: 'service' },
];

export const PDV: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterBrand, setFilterBrand] = useState('');
  const [activeTab, setActiveTab] = useState<'parts' | 'services'>('parts');
  const [cart, setCart] = useState<(SaleItem & { quantity: number })[]>([]);
  const [selectedPart, setSelectedPart] = useState<AutoPart | null>(null);

  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  // Filtragem
  const filteredData = useMemo(() => {
    if (activeTab === 'parts') {
      return MOCK_PARTS.filter(p => {
        const match = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      p.oemCode.toLowerCase().includes(searchTerm.toLowerCase());
        const brandMatch = filterBrand === '' || p.brand === filterBrand;
        return match && brandMatch;
      }).map(p => ({ ...p, type: 'part' as const }));
    }
    return MOCK_SERVICES.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, filterBrand, activeTab]);

  const addToCart = useCallback((item: SaleItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        if (item.type === 'part' && item.stock && existing.quantity >= item.stock) {
          alert("Estoque insuficiente!"); return prev;
        }
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <div className={styles.container}>
      
      {/* SIDEBAR DE FILTROS */}
      <aside className={`${styles.filterSidebar} ${isFilterOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <h3>Filtros</h3>
          <button onClick={() => setIsFilterOpen(false)} className={styles.btnClose}>✕</button>
        </div>
        <div className={styles.filterContent}>
          <div className={styles.filterGroup}>
            <label>Marca</label>
            <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}>
              <option value="">Todas</option>
              {Array.from(new Set(MOCK_PARTS.map(p => p.brand))).map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <button className={styles.btnClear} onClick={() => {setFilterBrand(''); setSearchTerm('');}}>Limpar</button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <header className={styles.topHeader}>
          <div className={styles.searchContainer}>
            <button className={styles.btnFilterToggle} onClick={() => setIsFilterOpen(!isFilterOpen)}>☰ Filtros</button>
            <input 
              className={styles.mainInput}
              placeholder={`Buscar ${activeTab === 'parts' ? 'peças...' : 'serviços...'}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </header>

        <nav className={styles.tabsContainer}>
          <button className={`${styles.tabButton} ${activeTab === 'parts' ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab('parts')}>📦 Peças</button>
          <button className={`${styles.tabButton} ${activeTab === 'services' ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab('services')}>🛠️ Serviços</button>
        </nav>

        <section className={styles.tableSection}>
          <table className={styles.partsTable}>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Marca</th>
                {activeTab === 'parts' ? <><th>Local</th><th>Estoque</th></> : <th>Categoria</th>}
                <th>Preço</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(item => (
                <tr key={item.id}>
                  <td>
                    <div className={styles.partPrimary}>
                      <strong>{item.name}</strong>
                      {'oemCode' in item && <code>{item.oemCode}</code>}
                    </div>
                  </td>
                  {activeTab === 'parts' ? (
                    <>
                      <td className={styles.location}>                      {item.brand}
</td>
                      <td className={styles.location}>📍 {(item as any).location}</td>
                      <td>{(item as any).stock} un</td>
                    </>
                  ) : (
                    <td><span className={styles.compatibilityBadge}>{(item as any).category}</span></td>
                  )}
                  <td className={styles.price}>{money.format(item.price)}</td>
                  <td className={styles.actions}>
                    {item.type === 'part' && (
                      <button className={styles.btnInfo} onClick={() => setSelectedPart(item as AutoPart)}>ℹ️</button>
                    )}
                    <button className={styles.btnAddToCart} onClick={() => addToCart(item as SaleItem)}>Adicionar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>

      {/* CARRINHO */}
      <aside className={styles.cartAside}>
        <div className={styles.cartHeader}>
          <h2>Carrinho</h2>
          <span className={styles.itemCount}>{cart.length} itens</span>
        </div>
        <div className={styles.cartList}>
          {cart.map(item => (
            <div key={item.id} className={styles.cartItem}>
              <span className={`${styles.typeBadge} ${item.type === 'service' ? styles.badgeService : styles.badgePart}`}>
                {item.type === 'service' ? 'Serviço' : 'Peça'}
              </span>
              <div className={styles.cartItemInfo}>
                <strong>{item.name}</strong>
                <span>{money.format(item.price * item.quantity)}</span>
              </div>
              <div className={styles.cartItemActions}>
                <span>Qtd: {item.quantity}</span>
                <button className={styles.btnRemoveMini} onClick={() => setCart(c => c.filter(i => i.id !== item.id))}>✕</button>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.cartFooter}>
          <strong>Total: {money.format(total)}</strong>
          <button className={styles.btnCheckout} onClick={() => alert('Venda Finalizada')}>Finalizar (F2)</button>
        </div>
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