import React, { useCallback, useMemo, useState } from 'react';
import styles from './OSPanelRefactored.module.css';
import { CartItem } from '../types/cart.types';

type LaborType = 'per_point' | 'fixed' | 'table';

interface OSData {
  equipment: string;
  application: string;
  gauge: string;
  layers: string;
  finalLength: number;
  laborType: LaborType;
  laborValue: number;
}

interface OSPanelRefactoredProps {
  customerId: string;
  onSubmit?: (item: CartItem) => void;
  onCancel?: () => void;
  money: Intl.NumberFormat;
  setActiveTab?: (tab: string) => void;
  // Props from PDV context for backward compatibility
  osItems?: CartItem[];
  setOsItems?: (items: CartItem[]) => void;
  osServices?: CartItem[];
  setOsServices?: (items: CartItem[]) => void;
  osData?: any;
  setOsData?: (data: any) => void;
  osTotal?: number;
  calculatedLabor?: number;
}

const initialOSData: OSData = {
  equipment: '',
  application: '',
  gauge: '',
  layers: '2',
  finalLength: 0,
  laborType: 'fixed',
  laborValue: 0,
};

const OSPanelRefactored: React.FC<OSPanelRefactoredProps> = ({
  customerId,
  onSubmit,
  onCancel,
  money,
  setActiveTab,
}) => {
  const [osItems, setOsItems] = useState<CartItem[]>([]);
  const [osServices, setOsServices] = useState<CartItem[]>([]);
  const [osData, setOsData] = useState<OSData>(initialOSData);
  const [paid, setPaid] = useState(0);
  const [showItemSelector, setShowItemSelector] = useState(false);

  // 🔢 gerar número simples (depois você troca por backend)
  const osNumber = useMemo(() => {
    return `OS-${Date.now().toString().slice(-6)}`;
  }, []);

  // 💰 cálculos
  const productsTotal = useMemo(
    () => osItems.reduce((acc, i) => acc + i.price * (i.quantity || 1), 0),
    [osItems]
  );

  const servicesTotal = useMemo(
    () => osServices.reduce((acc, i) => acc + i.price * (i.quantity || 1), 0),
    [osServices]
  );

  const laborTotal = useMemo(() => {
    if (osData.laborType === 'fixed') return osData.laborValue;
    if (osData.laborType === 'per_point') {
      const points = osItems.length * 2;
      return points * osData.laborValue;
    }
    return osData.laborValue;
  }, [osData, osItems]);

  const total = productsTotal + servicesTotal + laborTotal;
  const remaining = total - paid;

  // 🚀 gerar venda
  const handleGenerateSale = useCallback(() => {
    // Validar se tem itens antes de gerar
    if (osItems.length === 0 && osServices.length === 0) {
      alert('Adicione itens ou serviços antes de gerar a venda');
      return;
    }

    const osItem: CartItem = {
      id: `os-${Date.now()}`,
      name: `${osData.equipment || 'OS'} • ${osData.gauge}`,
      price: total,
      quantity: 1,
      type: 'os',
    };

    if (onSubmit) {
      onSubmit(osItem);
      // Apenas redireciona ao finalizar a venda (indo para o carrinho)
      setActiveTab?.('cart');
    } else {
      console.error('OSPanelAdapter: onSubmit callback não foi fornecido');
      alert('Erro ao gerar venda. Tente novamente.');
    }
  }, [osData, total, onSubmit, osItems.length, osServices.length, setActiveTab]);

  // Adicionar item na OS (sem redirecionar)
  const handleAddItemToOS = useCallback((item: CartItem) => {
    setOsItems([...osItems, { ...item, quantity: item.quantity || 1 }]);
    setShowItemSelector(false);
  }, [osItems]);

  // Adicionar serviço na OS (sem redirecionar)
  const handleAddServiceToOS = useCallback((service: CartItem) => {
    setOsServices([...osServices, { ...service, quantity: service.quantity || 1 }]);
    setShowItemSelector(false);
  }, [osServices]);

  return (
    <div className={styles.osLayout}>
      
      {/* 🟦 SIDEBAR */}
      <aside className={styles.sidebar}>
        
        {/* HEADER DA OS */}
        <section className={styles.cardHighlight}>
          <div className={styles.osHeader}>
            <div>
              <span className={styles.osNumber}>{osNumber}</span>
              <h3 className={styles.osTitle}>
                {osData.equipment || 'Nova Ordem de Serviço'}
              </h3>
            </div>

            <span className={styles.statusBadge}>
              Em andamento
            </span>
          </div>

          <div className={styles.metaRow}>
            <span>Itens: {osItems.length}</span>
            <span>Serviços: {osServices.length}</span>
          </div>
        </section>

        <section className={styles.card}>
          <h4>Cliente</h4>
          <p>ID: {customerId}</p>
          <button>Selecionar</button>
        </section>

        <section className={styles.card}>
          <h4>Técnico</h4>
          <button>Definir responsável</button>
        </section>

        <section className={styles.card}>
  
  <h4>Ações da OS</h4>

  <div className={styles.actions}>

    <button className={styles.button}>
      💾 Salvar rascunho
    </button>

  

    <button className={styles.button}>
      🧾 Emitir orçamento
    </button>

 
    <button className={styles.button}>
      🖨️ Imprimir OS
    </button>

    <button className={styles.secondary} onClick={onCancel}>
      ❌ Cancelar
    </button>

  </div>
</section>
      </aside>

      {/* 🟨 MAIN */}
      <main className={styles.main}>
        
        {/* ITENS */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Itens</h3>
            <button
              className={styles.primary}
              onClick={() => setShowItemSelector(true)}
              title="Adicionar item na OS"
            >
              + Adicionar
            </button>
          </div>

          {!osItems.length && (
            <div className={styles.emptyState}>
              Nenhum item adicionado
            </div>
          )}

          {osItems.map(item => (
            <div key={item.id} className={styles.listItem}>
              <div>
                <strong>{item.name}</strong>
                <small>Qtd: {item.quantity || 1}</small>
              </div>

              <span>{money.format(item.price)}</span>
            </div>
          ))}
        </section>

        {/* CONFIG */}
        <section className={styles.card}>
          <h3>Configuração</h3>

          <input
            placeholder="Equipamento"
            value={osData.equipment}
            onChange={e => setOsData({ ...osData, equipment: e.target.value })}
          />

          <input
            placeholder="Aplicação"
            value={osData.application}
            onChange={e => setOsData({ ...osData, application: e.target.value })}
          />

          <input
            placeholder="Bitola"
            value={osData.gauge}
            onChange={e => setOsData({ ...osData, gauge: e.target.value })}
          />
        </section>

        {/* MÃO DE OBRA */}
        <section className={styles.card}>
          <h3>Mão de obra</h3>

          <div className={styles.flexRow}>
            <button onClick={() => setOsData({ ...osData, laborType: 'fixed' })}>
              Fixo
            </button>
            <button onClick={() => setOsData({ ...osData, laborType: 'per_point' })}>
              Por ponto
            </button>
          </div>

          <input
            type="number"
            value={osData.laborValue}
            onChange={e =>
              setOsData({ ...osData, laborValue: Number(e.target.value) })
            }
          />

          <p>Total mão de obra: {money.format(laborTotal)}</p>
        </section>
      </main>

      {/* 🟩 SUMMARY */}
      <aside className={styles.summary}>
        
        <section className={styles.cardHighlight}>
          <h3>Total</h3>

          <div className={styles.row}>
            <span>Produtos</span>
            <span>{money.format(productsTotal)}</span>
          </div>

          <div className={styles.row}>
            <span>Serviços</span>
            <span>{money.format(servicesTotal)}</span>
          </div>

          <div className={styles.row}>
            <span>Mão de obra</span>
            <span>{money.format(laborTotal)}</span>
          </div>

          <hr />

          <strong className={styles.total}>
            {money.format(total)}
          </strong>
        </section>

        <section className={styles.card}>
          <h4>Pagamento Antecipado</h4>

          <input
            type="number"
            placeholder="Valor pago"
            value={paid}
            onChange={e => setPaid(Number(e.target.value))}
          />

          <div className={styles.paymentSummary}>
            <span>Pago:</span>
            <strong>{money.format(paid)}</strong>
          </div>

          <div className={styles.paymentSummary}>
            <span>Restante:</span>
            <strong className={remaining <= 0 ? styles.paid : ''}>
              {money.format(remaining)}
            </strong>
          </div>

           <button className={styles.button}>
    💳 Registrar Pagamento
  </button>     
        </section>

        <section className={styles.actions}>
  
  <h4>Fechamento da OS</h4>

  {/* 💰 FINANCEIRO */}
  <button
    className={styles.primary}
    onClick={handleGenerateSale}
  >
    💰 Gerar Venda
  </button>

 

  <button className={styles.button}>
    💸 Aplicar Desconto
  </button>


  {/* 🧾 STATUS */}
  <button className={styles.secondary}>
    🧾 Finalizar OS
  </button>

  

  {/* 📄 DOCUMENTOS */}
  

  <button className={styles.button}>
    📄 Exportar PDF
  </button>

  <button className={styles.button}>
    📤 Enviar por WhatsApp
  </button>

</section>

      </aside>

      {/* 🟦 MODAL DE SELEÇÃO DE ITENS (Isolado dentro da OS) */}
      {showItemSelector && (
        <div 
          className={styles.modalOverlay} 
          onClick={() => setShowItemSelector(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999
          }}
        >
          <div 
            className={styles.modalContent}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px',
              borderBottom: '1px solid #eee'
            }}>
              <h3 style={{ margin: 0 }}>Adicionar Item à OS</h3>
              <button 
                onClick={() => setShowItemSelector(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '20px' }}>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                ℹ️ Digite o código do produto ou selecione da lista abaixo
              </p>
              
              <input
                type="text"
                placeholder="Buscar por SKU, EAN ou nome..."
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  marginBottom: '15px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              
              <div style={{
                minHeight: '200px',
                maxHeight: '400px',
                overflowY: 'auto',
                border: '1px solid #eee',
                borderRadius: '6px',
                padding: '10px'
              }}>
                <div style={{ color: '#999', textAlign: 'center', padding: '40px 20px' }}>
                  Integre com seletor de produtos aqui<br/>
                  <small>(Reutilize componente de seleção da aba Peças)</small>
                </div>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              padding: '20px',
              borderTop: '1px solid #eee'
            }}>
              <button
                onClick={() => setShowItemSelector(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  background: '#f5f5f5',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OSPanelRefactored;