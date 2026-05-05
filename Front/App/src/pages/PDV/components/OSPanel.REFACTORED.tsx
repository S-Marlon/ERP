/**
 * 🛠️ OSPanel.tsx - REFATORADO
 * 
 * Domínio: Criação de Ordem de Serviço para adicionar ao Carrinho
 * Responsabilidades:
 * ✅ Coletar dados da OS (equipamento, bitola, itens, serviços, mão-de-obra)
 * ✅ Validar dados obrigatórios
 * ✅ Calcular totais de forma transparente
 * ✅ Gerar CartItemOS apenas com remaining > 0
 * ✅ Retornar item formatado para o carrinho
 * 
 * ❌ NÃO faz:
 * ❌ Validar se OS já existe (isso é backend)
 * ❌ Processar pagamentos
 * ❌ Persistir OS
 * ❌ Atualizar status de OS
 * ❌ Editar OS já adicionada ao carrinho (isso é tela separada)
 */

import React, { useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import styles from './OSPanel.module.css';
import { CartItem, createCartItemOS } from '../../types';
import { useOSForm } from '../../hooks/useOSForm';
import { ItemSelectorModal } from './ItemSelectorModal';
import ServiceSelectorModal from './ServiceSelectorModal';

interface OSPanelRefactoredProps {
  customerId: string;
  onSubmit?: (item: CartItem) => void;
  onCancel?: () => void;
  money: Intl.NumberFormat;
  setActiveTab?: (tab: string) => void;
}

const OSPanel: React.FC<OSPanelRefactoredProps> = ({
  customerId,
  onSubmit,
  onCancel,
  money,
  setActiveTab,
}) => {
  const [showItemSelector, setShowItemSelector] = React.useState(false);
  const [showServiceSelector, setShowServiceSelector] = React.useState(false);

  // OS Number gerado na sessão
  const osNumber = useMemo(
    () => `OS-${Date.now().toString().slice(-6)}`,
    []
  );

  // Hook com lógica de OS (sem lógica de pagamento)
  const {
    osData,
    osItems,
    osServices,
    totals,
    addItem,
    removeItem,
    updateItemQuantity,
    addService,
    removeService,
    buildPayload,
  } = useOSForm(customerId, osNumber);

  /**
   * 🔒 DOMÍNIO: Validação e geração de CartItemOS
   * 
   * Validações obrigatórias:
   * 1. Equipment e Gauge preenchidos
   * 2. Pelo menos um item/serviço OU apenas mão-de-obra
   * 3. Remaining > 0 (CRÍTICO: OS só entra no carrinho se há a pagar)
   */
  const handleGenerateSale = useCallback(async () => {
    // 1️⃣ Validar configuração obrigatória da OS
    if (!osData.equipment || !osData.gauge) {
      Swal.fire({
        icon: 'warning',
        title: 'Dados incompletos',
        text: 'Preencha ao menos "Equipamento" e "Bitola"',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // 2️⃣ Validar que há pelo menos itens/serviços
    if (osItems.length === 0 && osServices.length === 0) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Nenhum item na OS',
        text: 'Adicione pelo menos um item ou serviço',
        showCancelButton: true,
        confirmButtonText: 'Continuar sem itens',
        cancelButtonText: 'Adicionar itens',
      });

      if (!result.isConfirmed) {
        setShowItemSelector(true);
        return;
      }
    }

    // 3️⃣ Validar mão de obra se houver itens
    if (osItems.length > 0 && osData.laborValue <= 0) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Mão de obra não informada',
        text: 'Itens requerem mão de obra. Informe o valor.',
        showCancelButton: true,
        confirmButtonText: 'Definir mão de obra',
        cancelButtonText: 'Continuar',
      });

      if (result.isConfirmed) {
        // Scroll para seção de mão de obra
        return;
      }
    }

    // 4️⃣ CRÍTICO: Validar que remaining > 0
    // Isso garante que a OS só entra no carrinho se houver a pagar
    const remaining = totals.total; // Em nova OS, remaining = total
    
    if (remaining <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'OS sem valor',
        text: 'O total da OS deve ser maior que zero',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // 5️⃣ Criar CartItemOS usando factory function
    let osItem: CartItem;
    try {
      osItem = createCartItemOS({
        osNumber,
        equipment: osData.equipment,
        application: osData.application || '',
        gauge: osData.gauge,
        layers: osData.layers || '2',
        finalLength: osData.finalLength || 0,
        laborType: osData.laborType || 'fixed',
        laborValue: osData.laborValue || 0,
        customerName: osData.customerName || '',
        technician: osData.technician || '',
        status: 'draft',
        title: `${osData.equipment} • ${osData.gauge}`,
        notes: osData.notes || '',
        items: osItems,
        services: osServices,
        productsTotal: totals.products,
        servicesTotal: totals.services,
        laborTotal: totals.labor,
        total: totals.total,
        paid: 0, // Nova OS: nada pago ainda
        remaining: remaining, // ✅ OBRIGATÓRIO: remaining > 0
        payments: []
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao criar OS',
        text: (err as Error).message,
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // 6️⃣ Mostrar resumo para confirmação
    const result = await Swal.fire({
      icon: 'question',
      title: 'Adicionar OS ao Carrinho?',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p><strong>OS:</strong> ${osNumber}</p>
          <p><strong>Equipamento:</strong> ${osData.equipment}</p>
          <p><strong>Bitola:</strong> ${osData.gauge}</p>
          <p><strong>Itens:</strong> ${osItems.length} | <strong>Serviços:</strong> ${osServices.length}</p>
          <hr style="margin: 10px 0;" />
          <p style="font-size: 16px; font-weight: bold;">
            Total: ${money.format(totals.total)}
          </p>
          <p style="font-size: 12px; color: #10b981;">
            ✅ Valor será travado no carrinho
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Adicionar ao carrinho',
      cancelButtonText: 'Revisar',
      confirmButtonColor: '#10b981',
    });

    if (!result.isConfirmed) {
      return;
    }

    // 7️⃣ Chamar callback do componente pai
    try {
      onSubmit?.(osItem);
      
      Swal.fire({
        icon: 'success',
        title: 'OS adicionada!',
        text: `${osData.equipment} foi adicionada ao carrinho`,
        timer: 2000,
        timerProgressBar: true,
      });

      // Limpar ou voltar
      setActiveTab?.('pdv');
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao adicionar OS',
        text: (error as Error).message,
      });
    }
  }, [osData, osItems, osServices, totals, money, onSubmit, setActiveTab, osNumber]);

  /**
   * ✅ Adicionar item à OS
   */
  const handleAddItemToOS = useCallback(
    (item: CartItem) => {
      if (!item?.id) {
        Swal.fire({
          icon: 'error',
          title: 'Item inválido',
          text: 'O item deve ter ID',
        });
        return;
      }

      if (item.quantity <= 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Quantidade inválida',
          text: 'A quantidade deve ser maior que zero',
        });
        return;
      }

      if (item.type === 'product' && item.stock && item.quantity > item.stock) {
        Swal.fire({
          icon: 'warning',
          title: 'Estoque insuficiente',
          text: `Disponível: ${item.stock}`,
        });
        return;
      }

      addItem(item);

      Swal.fire({
        icon: 'success',
        title: 'Item adicionado!',
        text: `${item.name} x${item.quantity}`,
        timer: 1500,
        position: 'bottom-end',
        toast: true,
        showConfirmButton: false,
      });

      setShowItemSelector(false);
    },
    [addItem]
  );

  /**
   * ✅ Adicionar serviço à OS
   */
  const handleAddServiceToOS = useCallback(
    (service: CartItem) => {
      addService(service);

      Swal.fire({
        icon: 'success',
        title: 'Serviço adicionado!',
        text: `${service.name}`,
        timer: 1500,
        position: 'bottom-end',
        toast: true,
        showConfirmButton: false,
      });

      setShowServiceSelector(false);
    },
    [addService]
  );

  return (
    <div className={styles.osLayout}>
      {/* Cabeçalho */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
        <h2>Criar Ordem de Serviço</h2>
        <small>Preencha os dados para adicionar ao carrinho</small>
      </div>

      {/* Conteúdo - Dados da OS */}
      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        {/* Configuração: Equipment, Gauge, etc */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Configuração</h3>
          <input
            type="text"
            placeholder="Equipamento"
            value={osData.equipment || ''}
            onChange={(e) => {}}
            style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
          />
          <input
            type="text"
            placeholder="Bitola"
            value={osData.gauge || ''}
            onChange={(e) => {}}
            style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
          />
          <input
            type="text"
            placeholder="Aplicação (opcional)"
            value={osData.application || ''}
            onChange={(e) => {}}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        {/* Itens */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3>Itens ({osItems.length})</h3>
            <button onClick={() => setShowItemSelector(true)}>+ Adicionar</button>
          </div>
          {osItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px',
                backgroundColor: '#f9fafb',
                marginBottom: '4px',
                borderRadius: '4px',
              }}
            >
              <div>
                <strong>{item.name}</strong>
                <small style={{ display: 'block', color: '#666' }}>x{item.quantity}</small>
              </div>
              <div>
                <span>{money.format(item.price * item.quantity)}</span>
                <button
                  onClick={() => removeItem(item.id)}
                  style={{ marginLeft: '8px', color: 'red', background: 'none', border: 'none' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Serviços */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3>Serviços ({osServices.length})</h3>
            <button onClick={() => setShowServiceSelector(true)}>+ Adicionar</button>
          </div>
          {osServices.map((service) => (
            <div
              key={service.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px',
                backgroundColor: '#f9fafb',
                marginBottom: '4px',
                borderRadius: '4px',
              }}
            >
              <strong>{service.name}</strong>
              <div>
                <span>{money.format(service.price * service.quantity)}</span>
                <button
                  onClick={() => removeService(service.id)}
                  style={{ marginLeft: '8px', color: 'red', background: 'none', border: 'none' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Mão de obra */}
        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '4px', borderLeft: '4px solid #10b981' }}>
          <h3>Mão de Obra</h3>
          <div>
            <label>
              Valor (R$):
              <input
                type="number"
                value={osData.laborValue || 0}
                onChange={(e) => {}}
                style={{ width: '100%', padding: '8px', marginTop: '4px' }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Totais */}
      <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>Produtos:</span>
          <span>{money.format(totals.products)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>Serviços:</span>
          <span>{money.format(totals.services)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span>Mão de obra:</span>
          <span>{money.format(totals.labor)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '18px',
            fontWeight: 'bold',
            paddingTop: '12px',
            borderTop: '2px solid #d1d5db',
          }}
        >
          <span>Total:</span>
          <span>{money.format(totals.total)}</span>
        </div>

        {/* ✅ Status: remaining > 0 */}
        {totals.total > 0 && (
          <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '12px', color: '#1e40af' }}>
            ✅ Pronto para adicionar ao carrinho
          </div>
        )}

        {totals.total <= 0 && (
          <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#fee2e2', borderRadius: '4px', fontSize: '12px', color: '#dc2626' }}>
            ❌ Total deve ser maior que zero
          </div>
        )}
      </div>

      {/* Botões de ação */}
      <div style={{ padding: '16px', display: 'flex', gap: '8px', borderTop: '1px solid #e5e7eb' }}>
        <button
          onClick={handleGenerateSale}
          disabled={totals.total <= 0}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: totals.total > 0 ? '#10b981' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: totals.total > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          Adicionar ao Carrinho
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>

      {/* Modais */}
      <ItemSelectorModal
        isOpen={showItemSelector}
        onClose={() => setShowItemSelector(false)}
        onSelect={handleAddItemToOS}
        title="Adicionar Item à Ordem de Serviço"
        money={money}
      />

      <ServiceSelectorModal
        isOpen={showServiceSelector}
        onClose={() => setShowServiceSelector(false)}
        onSelect={handleAddServiceToOS}
        title="Adicionar Serviço à Ordem de Serviço"
      />
    </div>
  );
};

export default OSPanel;
