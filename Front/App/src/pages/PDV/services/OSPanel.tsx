import React from 'react';
import styles from './OSPanel.module.css';
import { CartItem, MoneyFormatter } from '../types';

interface OSPanelProps {
  osItems: CartItem[];
  setOsItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  osServices: CartItem[];
  setOsServices: React.Dispatch<React.SetStateAction<CartItem[]>>;
  osData: any;
  setOsData: React.Dispatch<React.SetStateAction<any>>;
  osTotal: number;
  calculatedLabor: number;
  money: MoneyFormatter;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  setActiveTab: (tab: string) => void;
}

const OSPanel: React.FC<OSPanelProps> = ({
  osItems,
  setOsItems,
  osServices,
  setOsServices,
  osData,
  setOsData,
  osTotal,
  calculatedLabor,
  money,
  setCart,
  setActiveTab
}) => {

  const updateCartItem = (
    idOrIndex: string | number,
    type: 'items' | 'services',
    action: 'increment' | 'decrement' | 'remove',
  ) => {
    const setter = type === 'items' ? setOsItems : setOsServices;
    setter(prev => prev.map((i: CartItem, idx) => {
      const match = type === 'items' ? i.id === idOrIndex : idx === idOrIndex;
      if (!match) return i;
      if (action === 'increment') return { ...i, quantity: (i.quantity || 1) + 1 };
      if (action === 'decrement') return { ...i, quantity: Math.max(1, (i.quantity || 1) - 1) };
      return i;
    }).filter((_, idx) => !(action === 'remove' && (type === 'items' ? prev[idx].id === idOrIndex : idx === idOrIndex))));
  };

  const handleSendOS = () => {
    if (!osItems.length && !osServices.length) {
      alert('Adicione pelo menos um item ou serviço na OS');
      return;
    }
    const osItem: CartItem = {
      id: `os-${Date.now()}`,
      name: `${osData.equipment || 'OS'} • ${osData.gauge || ''}" ${osData.layers || ''}T`,
      price: osTotal,
      quantity: 1,
      type: 'os',
      osData: { items: osItems, services: osServices, config: osData },
    };
    setCart(prev => [...prev, osItem]);
    setOsItems([]);
    setOsServices([]);
    setActiveTab('parts');
  };

  const renderList = (list: CartItem[], type: 'items' | 'services') => {
    if (!list.length) return <p>{type === 'items' ? 'Nenhum produto adicionado' : 'Nenhum serviço adicionado'}</p>;
    return list.map((item, idx) => (
      <div key={type === 'items' ? item.id : idx} className={styles.osItemRow}>
        <span>{item.name}</span>

        {type === 'items' && (
          <div className={styles.qtyControl}>
            <button onClick={() => updateCartItem(item.id, 'items', 'decrement')}>-</button>
            <input
              type="number"
              value={item.quantity || 1}
              onChange={e => {
                const val = parseFloat(e.target.value) || 1;
                setOsItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: val } : i));
              }}
            />
            <button onClick={() => updateCartItem(item.id, 'items', 'increment')}>+</button>
          </div>
        )}

        <span>{money.format(item.price * (item.quantity || 1))}</span>
        <button onClick={() => updateCartItem(type === 'items' ? item.id : idx, type, 'remove')}>✕</button>
      </div>
    ));
  };

  // Configuração dinâmica do formulário
  const formFields = [
    { label: 'Equipamento / Frota', key: 'equipment', type: 'text', placeholder: 'Ex: Escavadeira PC200 / Lote 04' },
    { label: 'Local de Aplicação', key: 'application', type: 'text', placeholder: 'Ex: Comando Central / Lança' },
    { label: 'Bitola (Pol/Dash)', key: 'gauge', type: 'select', options: [
      { value: '', label: 'Selecione...' },
      { value: '1/4', label: '1/4" (-04)' },
      { value: '3/8', label: '3/8" (-06)' },
      { value: '1/2', label: '1/2" (-08)' },
      { value: '3/4', label: '3/4" (-12)' },
      { value: '1', label: '1" (-16)' },
    ]},
    { label: 'Nº de Tramas/Reforço', key: 'layers', type: 'select', options: [
      { value: '1', label: '1 Trama (R1)' },
      { value: '2', label: '2 Tramas (R2)' },
      { value: '4', label: '4 Espirais (4SH/4SP)' },
      { value: '6', label: '6 Espirais (R13/R15)' },
    ]},
    { label: 'Medida Final (mm)', key: 'finalLength', type: 'number', placeholder: 'Ex: 1250' },
  ];

  return (
    <div className={styles.osGrid}>
      {/* COLUNA ESQUERDA */}
      <div className={styles.osItemsColumn}>
        <div className={styles.osItems}>
          <h4>📦 Produtos Utilizados</h4>
          {renderList(osItems, 'items')}
        </div>

        <div className={styles.osItems}>
          <h4>🛠️ Serviços Executados</h4>
          {renderList(osServices, 'services')}
        </div>

        <div className={styles.osTotalBox}>
          <div>
            <small>Total Produtos + Serviços + Mão de obra</small>
            <strong>{money.format(osTotal)}</strong>
          </div>
        </div>

        <button className={styles.btnConfirmOS} onClick={handleSendOS}>
          💰 Gerar OS e Enviar ao Carrinho
        </button>
      </div>

      {/* COLUNA DIREITA */}
      <div className={styles.osFormColumn}>
        <section className={styles.osSection}>
          <div className={styles.osForm}>
            <h2>Configuração da Montagem Hidráulica</h2>

            <div className={styles.inputGroupRow}>
              {formFields.map(field => (
                <div className={styles.inputField} key={field.key}>
                  <label>{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      value={osData[field.key] || ''}
                      onChange={e => setOsData({ ...osData, [field.key]: e.target.value })}
                    >
                      {field.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      placeholder={field.placeholder || ''}
                      value={osData[field.key] || ''}
                      onChange={e => setOsData({ ...osData, [field.key]: field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Mão de Obra */}
            <div className={styles.laborContainer}>
              <label>Serviço de Prensagem</label>
              <div className={styles.laborTypeSelector}>
                {['per_point', 'fixed', 'table'].map(type => (
                  <button
                    key={type}
                    className={osData.laborType === type ? styles.activeType : ''}
                    onClick={() => setOsData({ ...osData, laborType: type })}
                  >
                    {type === 'per_point' ? 'R$ Por Terminal' : type === 'fixed' ? 'Valor Fixo Montagem' : '📋 Tabela por Bitola'}
                  </button>
                ))}
              </div>

              <div className={styles.laborInputWrapper}>
                <div className={styles.inputWithIcon}>
                  <span className={styles.currencyBadge}>R$</span>
                  <input
                    type="number"
                    placeholder="Custo da prensagem"
                    value={osData.laborValue || 0}
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
      </div>
    </div>
  );
};

export default OSPanel;