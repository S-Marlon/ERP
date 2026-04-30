import React, { useCallback, useMemo } from 'react';
import type { CartItem } from '../../types/cart.types';
import { createCartItemOS } from '../../types/cart.types';
import { useOrderService } from '../../../../hooks/useOrderService';
import { getOSSummary } from '../../../../utils/os-helpers';
import Swal from 'sweetalert2';

import OSForm from './OSForm';
import OSItemList from './OSItemList';
import OSMontagemList from './OSMontagemList';
import LaborCalculator from './LaborCalculator';
import OSSummary from './OSSummary';

import styles from '../OSPanel.module.css';

interface OSPanelRefactoredProps {
  customerId: string;
  onSubmit: (osItem: CartItem) => void;
  onCancel: () => void;
  setActiveTab?: (tab: string) => void;
  money: Intl.NumberFormat;
}

const OSPanelRefactored: React.FC<OSPanelRefactoredProps> = ({
  customerId,
  onSubmit,
  onCancel,
  setActiveTab,
  money,
}) => {
  const {
    os,
    addItem,
    removeItem,
    updateItem,
    addService,
    removeService,
    updateService,
    addMontagem,
    removeMontagem,
    setLabor,
    setConfig,
    canEdit,
  } = useOrderService(customerId);

  // 🧠 VALIDATION INTELIGENTE
  const hasMontagemContent = useMemo(() => {
    return (os.montagens || []).some(
      (m) => m.items.length > 0 || m.services.length > 0
    );
  }, [os.montagens]);

  const itemCount = useMemo(() => {
    return (
      os.items.length +
      os.services.length +
      (os.montagens?.length || 0)
    );
  }, [os]);

  const isValid = useMemo(() => {
    return (
      (itemCount > 0 || hasMontagemContent) &&
      os.config.gauge &&
      os.config.finalLength > 0
    );
  }, [itemCount, hasMontagemContent, os.config]);

  // 🚀 SUBMIT
  const handleSubmit = useCallback(() => {
    if (!isValid) {
      alert('Adicione itens/montagens e configure a OS');
      return;
    }

    // ✅ NOVO: Validar se remaining > 0
    const paid = os.totalAmount - os.totalAmount; // Assumindo que quando cria, paid = 0
    const remaining = os.totalAmount;
    
    if (remaining <= 0) {
      await Swal.fire({
    icon: 'info',
    title: 'OS já quitada',
    text: 'Esta OS já está paga e será adicionada ao carrinho apenas para registro.',
    timer: 2000,
  });
      return;
    }

    const summary = getOSSummary(os);

    // ✅ NOVO: Usar factory function createCartItemOS
    const osItem = createCartItemOS({
      osNumber: os.number,
      equipment: os.config.equipment,
      application: os.config.application || '',
      gauge: os.config.gauge,
      layers: os.config.layers || '2',
      finalLength: os.config.finalLength,
      laborType: os.labor?.type || 'fixed',
      laborValue: os.labor?.value || 0,
      customerName: '', // Pode ser buscado do contexto
      technician: '',
      status: 'draft',
      title: summary,
      notes: '',
      items: os.items,
      services: os.services,
      productsTotal: os.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      servicesTotal: os.services.reduce((sum, svc) => sum + svc.price * svc.quantity, 0),
      laborTotal: os.labor?.value || 0,
      total: os.totalAmount,
      paid: 0,
      remaining: remaining,
      payments: []
    });

    onSubmit(osItem);
  }, [isValid, os, onSubmit]);

  // ➕ NOVA MONTAGEM (simples mas funcional)
  const handleCreateMontagem = useCallback(() => {
    if (!canEdit) return;

    const name = prompt('Nome da montagem (ex: R1AT 5m JIC -06)');
    if (!name) return;

    addMontagem({
      name,
      items: [],
      services: [],
    });
  }, [canEdit, addMontagem]);

  return (
    <div className={styles.osLayout}>

        <div className={styles.cardHighlight}>
  <div className={styles.osHeader}>
    
    <div className={styles.osTitle}>
      <span className={styles.osNumber}>
        OS #{os.number || '---'}
      </span>

      <span className={styles.osName}>
        {os.config.equipment || 'Nova Ordem de Serviço'}
      </span>
    </div>

    <span className={styles.osBadge}>
      {canEdit ? 'Em edição' : 'Finalizada'}
    </span>

  </div>

  <div className={styles.status}>
    <span>Itens: {os.items.length}</span>
    <span>Montagens: {os.montagens?.length || 0}</span>
  </div>
</div>

<div className={styles.total}>
  {money.format(os.totalAmount)}
</div>

<small>Total da ordem</small>

{itemCount === 0 && (
  <div className={styles.card}>
    <small>Nenhum item ou montagem adicionada</small>
  </div>
)}
      
      {/* 🟦 SIDEBAR */}
      <aside className={styles.sidebar}>
        <OSSummary
          os={os}
          money={money}
          onConfirm={handleSubmit}
          onDiscard={onCancel}
          isLoading={false}
        />

        {canEdit && (
          <button
  onClick={handleCreateMontagem}
  className={styles.primary}
  title="Criar um novo conjunto de mangueira"
>
  ➕ Nova Montagem
</button>
        )}
      </aside>

      {/* 🟨 MAIN */}
      <main className={styles.main}>
        
        {/* 🔧 MONTAGENS */}
        <OSMontagemList
          montagens={os.montagens || []}
          onRemove={removeMontagem}
          readonly={!canEdit}
        />

        {/* 📦 ITENS SOLTOS */}
        <OSItemList
          items={os.items}
          type="items"
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onUpdateItem={updateItem}
          money={money}
          readonly={!canEdit}
        />

        {/* 🛠 SERVIÇOS */}
        <OSItemList
          items={os.services}
          type="services"
          onAddItem={addService}
          onRemoveItem={removeService}
          onUpdateItem={updateService}
          money={money}
          readonly={!canEdit}
        />
      </main>

      {/* 🟩 SUMMARY / CONFIG */}
      <aside className={styles.summary}>
        
        <OSForm
          config={os.config}
          onChange={setConfig}
          readonly={!canEdit}
        />

        <LaborCalculator
          labor={os.labor}
          terminals={os.items.length}
          onChange={setLabor}
          readonly={!canEdit}
          money={money}
        />

        {setActiveTab && (
          <button
            className={styles.secondary}
            onClick={() => setActiveTab('parts')}
          >
            ← Buscar peças no catálogo
          </button>
        )}
      </aside>
    </div>
  );
};

export default OSPanelRefactored;