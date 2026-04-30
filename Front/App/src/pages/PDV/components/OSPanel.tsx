/**
 * OSPanelRefactored
 * Componente refatorado com arquitetura profissional
 *
 * MUDANÇAS PRINCIPAIS:
 * - State centralizado via useOSForm hook
 * - Remoção de modal broken com SweetAlert2 + DOM manipulation
 * - Uso de ServiceSelectorModal (React Portal)
 * - Lógica separada em hooks e constantes
 * - Código limpo e testável
 * - Performance otimizada com memoização
 */

import React, { useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import styles from './OSPanelRefactored.module.css';
import { CartItem } from '../types/cart.types';
import { ItemSelectorModal } from './ItemSelectorModal';
import ServiceSelectorModal from './ServiceSelectorModal';
import { useOSForm } from '../hooks/useOSForm';

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
  // Estados dos modais
  const [showItemSelector, setShowItemSelector] = React.useState(false);
  const [showServiceSelector, setShowServiceSelector] = React.useState(false);

  // OS Number gerado na sessão
  const osNumber = useMemo(
    () => `OS-${Date.now().toString().slice(-6)}`,
    []
  );

  // Hook com toda a lógica centralizada
  // ✅ ADICIONE 'updateServiceQuantity' AQUI
  const {
    osData,
    osItems,
    osServices,
    paid,
    setOsData,
    setPaid,
    totals,
    addItem,
    removeItem,
    updateItemQuantity,
    addService,
    updateServiceQuantity, // <-- ESSA LINHA É A CHAVE
    removeService,
    buildPayload,
  } = useOSForm(customerId, osNumber);

  /**
   * Validação e geração de venda
   * Mantém a mesma lógica mas com state gerenciado pelo hook
   */
  const handleGenerateSale = useCallback(async () => {
    // 1️⃣ Validar configuração da OS
    if (!osData.equipment || !osData.gauge) {
      Swal.fire({
        icon: 'warning',
        title: 'Dados incompletos',
        text: 'Preencha ao menos "Equipamento" e "Bitola"',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // 2️⃣ Validar itens/serviços
    if (osItems.length === 0 && osServices.length === 0) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Nenhum item na OS',
        text: 'Você deseja continuar apenas com mão de obra?',
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Adicionar itens',
      });

      if (!result.isConfirmed) {
        setShowItemSelector(true);
        return;
      }
    }

    // 3️⃣ Validar mão de obra se necessário
    if (osItems.length > 0 && osData.laborValue <= 0) {
      const result = await Swal.fire({
        icon: 'info',
        title: 'Mão de obra não configurada',
        text: 'Deseja continuar sem mão de obra?',
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Configurar',
      });

      if (!result.isConfirmed) {
        return;
      }
    }

    // 4️⃣ Criar item de OS resumido
    const osItem: CartItem = {
      id: `os-${Date.now()}`,
      name: `${osData.equipment} • ${osData.gauge}`,
      category: 'OS',
      price: totals.remaining,
      quantity: 1,
      type: 'os',
      osData: {
        osNumber,
        equipment: osData.equipment,
        application: osData.application,
        gauge: osData.gauge,
        layers: osData.layers,
        finalLength: osData.finalLength,
        laborType: osData.laborType,
        laborValue: osData.laborValue,
        customerName: osData.customerName,
        technician: osData.technician,
        status: osData.status,
        title: osData.title,
        notes: osData.notes,
        items: osItems,
        services: osServices,
        productsTotal: totals.products,
        servicesTotal: totals.services,
        laborTotal: totals.labor,
        paid,
        total: totals.total,
      },
    };

    // 5️⃣ Mostrar resumo antes de confirmar
    const result = await Swal.fire({
      icon: 'question',
      title: 'Gerar Venda da OS',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p><strong>OS:</strong> ${osNumber}</p>
          <p><strong>Cliente:</strong> ${osData.customerName || 'Não informado'}</p>
          <p><strong>Técnico:</strong> ${osData.technician || 'Não informado'}</p>
          <p><strong>Equipamento:</strong> ${osData.equipment}</p>
          <p><strong>Bitola:</strong> ${osData.gauge}</p>
          <p><strong>Itens:</strong> ${osItems.length}</p>
          <p><strong>Serviços:</strong> ${osServices.length}</p>
          <hr style="margin: 10px 0;" />
          <p style="font-size: 16px;">
            <strong>Total: ${money.format(totals.total)}</strong>
          </p>
          <p style="font-size: 12px; color: #666;">
            Pago: ${money.format(paid)} | Restante: ${money.format(totals.remaining)}
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Gerar venda',
      cancelButtonText: 'Revisar',
      confirmButtonColor: '#10b981',
    });

    if (!result.isConfirmed) {
      return;
    }

    // 6️⃣ Enviar para CartAside
    try {
      if (onSubmit) {
        osItem.osData.remaining = totals.remaining;

        // ✅ ESSENCIAL
        onSubmit(osItem);

        // Feedback de sucesso
        await Swal.fire({
          icon: 'success',
          title: 'OS gerada!',
          text: 'A ordem de serviço foi adicionada ao carrinho',
          timer: 2000,
        });

        // Redirecionar para carrinho
        setActiveTab?.('cart');
      } else {
        throw new Error('Callback onSubmit não fornecido');
      }
    } catch (error) {
      console.error('Erro ao gerar venda:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro ao gerar venda',
        text: 'Tente novamente ou contacte o suporte',
        confirmButtonText: 'Entendido',
      });
    }
  }, [
    osData,
    osItems,
    osServices,
    totals,
    paid,
    money,
    onSubmit,
    setActiveTab,
    osNumber,
  ]);

  /**
   * Adicionar item à OS
   */
  const handleAddItemToOS = useCallback(
    (item: CartItem) => {
      if (!item || !item.id) {
        Swal.fire({
          icon: 'error',
          title: 'Erro',
          text: 'Item inválido',
          timer: 2000,
        });
        return;
      }

      // Validar quantidade
      if (item.quantity <= 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Quantidade inválida',
          text: 'A quantidade deve ser maior que 0',
          timer: 2000,
        });
        return;
      }

      // Validar estoque
      if (item.type === 'product' && item.stock && item.quantity > item.stock) {
        Swal.fire({
          icon: 'warning',
          title: 'Estoque insuficiente',
          text: `Apenas ${item.stock} ${item.unitOfMeasure || 'un'} disponíveis`,
          timer: 2000,
        });
        return;
      }

      addItem(item);

      // Feedback visual
      Swal.fire({
        icon: 'success',
        title: 'Adicionado!',
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
   * Adicionar serviço à OS
   */
  const handleAddServiceToOS = useCallback(
    (service: CartItem) => {
      // service já vem com a quantity correta do modal
      addService(service);

      // Feedback visual aprimorado com a quantidade
      Swal.fire({
        icon: 'success',
        title: 'Serviço adicionado!',
        text: `${service.name} (x${service.quantity})`,
        timer: 1500,
        position: 'bottom-end',
        toast: true,
        showConfirmButton: false,
      });

      setShowServiceSelector(false);
    },
    [addService]
  );

  /**
   * Registrar pagamento
   */
  const handleRegisterPayment = useCallback(async () => {
    const result = await Swal.fire({
      title: 'Registrar pagamento',
      input: 'number',
      inputLabel: 'Valor',
      inputValue: paid,
      showCancelButton: true,
      inputAttributes: {
        step: '0.01',
        min: '0',
      },
    });

    if (result.isConfirmed && result.value !== null) {
      addPayment({
        value: Number(result.value),
        method: 'cash',
        source: 'os',
      });
    }
  }, [paid, setPaid]);

  /**
   * Emitir orçamento (JSON)
   */
  const handleEmitQuote = useCallback(() => {
    const data = buildPayload();

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orcamento-${osNumber}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }, [buildPayload, osNumber]);

  /**
   * Imprimir OS
   */
  const handlePrint = useCallback(() => {
    const data = buildPayload();
    const oxbloodRed = '#731717'; // Cor Sangue de Boi

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const renderTableRows = (list: any[]) =>
      list.map(item => `
      <tr>
        <td>${item.name}</td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">${money.format(item.price)}</td>
        <td style="text-align: right;">${money.format(item.price * item.quantity)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
    <html>
      <head>
        <title>OS ${data.osNumber} - ${data.customerName}</title>
        <style>
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 40px; 
            color: #333;
            line-height: 1.6;
          }
          .header { 
            border-bottom: 3px solid ${oxbloodRed}; 
            padding-bottom: 10px; 
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .header h1 { 
            color: ${oxbloodRed}; 
            margin: 0; 
            text-transform: uppercase;
            font-size: 24px;
          }
          .info-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 10px; 
            margin-bottom: 30px;
            background: #f9f9f9;
            padding: 15px;
            border-radius: 4px;
          }
          .info-item b { color: ${oxbloodRed}; }
          
          h3 { 
            background: ${oxbloodRed}; 
            color: white; 
            padding: 8px 12px; 
            font-size: 14px;
            margin-top: 30px;
          }
          
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { 
            text-align: left; 
            border-bottom: 2px solid #eee; 
            padding: 10px; 
            font-size: 12px; 
            text-transform: uppercase; 
          }
          td { padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
          
          .totals-container { 
            margin-top: 30px; 
            display: flex; 
            justify-content: flex-end; 
          }
          .totals-table { width: 300px; }
          .totals-table td { border: none; padding: 5px 10px; }
          .row-total { 
            background: ${oxbloodRed}; 
            color: white; 
            font-weight: bold; 
          }
          .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #777; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Ordem de Serviço</h1>
            <span>Nº: <strong>${data.osNumber}</strong></span>
          </div>
          <div style="text-align: right; font-size: 12px;">
            Gerado em: ${new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>

        <div class="info-grid">
          <div class="info-item"><b>Cliente:</b> ${data.customerName}</div>
          <div class="info-item"><b>Técnico:</b> ${data.technician}</div>
          <div class="info-item"><b>Equipamento:</b> ${data.equipment}</div>
          <div class="info-item"><b>Bitola:</b> ${data.gauge}</div>
        </div>

        ${osItems.length > 0 ? `
          <h3>ITENS / PEÇAS</h3>
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th style="text-align: center;">Qtd</th>
                <th style="text-align: right;">Unitário</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${renderTableRows(osItems)}</tbody>
          </table>
        ` : ''}

        ${osServices.length > 0 ? `
          <h3>SERVIÇOS</h3>
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th style="text-align: center;">Qtd</th>
                <th style="text-align: right;">Unitário</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${renderTableRows(osServices)}</tbody>
          </table>
        ` : ''}

        <div class="totals-container">
          <table class="totals-table">
            <tr><td>Produtos:</td><td style="text-align: right;">${money.format(data.totals.products)}</td></tr>
            <tr><td>Serviços:</td><td style="text-align: right;">${money.format(data.totals.services)}</td></tr>
            <tr><td>Mão de obra:</td><td style="text-align: right;">${money.format(data.totals.labor)}</td></tr>
            <tr class="row-total">
              <td>TOTAL:</td>
              <td style="text-align: right;">${money.format(data.totals.total)}</td>
            </tr>
          </table>
        </div>

        <div class="footer">
          Documento impresso via Sistema de Gestão Interno.
        </div>

        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
    </html>
  `);

    printWindow.document.close();
  }, [buildPayload, osNumber, money, osItems, osServices]);

  /**
   * Salvar rascunho no localStorage
   */
  const handleSaveDraft = useCallback(() => {
    const data = buildPayload();

    localStorage.setItem(`os-draft-${osNumber}`, JSON.stringify(data));

    Swal.fire({
      icon: 'success',
      title: 'Rascunho salvo',
      timer: 1500,
      toast: true,
      position: 'bottom-end',
      showConfirmButton: false,
    });
  }, [buildPayload, osNumber]);

  /**
   * Status styling helper
   */
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'finished':
        return '#10b981';
      case 'in_progress':
        return '#3b82f6';
      case 'draft':
      default:
        return '#9ca3af';
    }
  };

  return (
    <div className={styles.osLayout}>
      {/* 🟦 SIDEBAR */}
      <aside className={styles.sidebar}>
        {/* HEADER DA OS */}
        <section className={styles.cardHighlight}>
          <div className={styles.osHeader}>
            <div>
              <span className={styles.osNumber}>{osNumber}</span>
              <input
                type="text"
                placeholder="Título da OS"
                value={osData.title}
                onChange={e => setOsData({ title: e.target.value })}
                className={styles.inputField}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 'inherit',
                  fontWeight: 'bold',
                  width: '100%',
                  padding: '0',
                  color: 'inherit',
                }}
              />
              {!osData.title && (
                <p style={{ margin: 0, fontSize: '0.85em', opacity: 0.7 }}>
                  {osData.equipment || 'Nova Ordem de Serviço'}
                </p>
              )}
            </div>

            <select
              value={osData.status}
              onChange={e =>
                setOsData({ status: e.target.value as any })
              }
              className={styles.selectField}
              style={{
                background: getStatusColor(osData.status),
                color: 'white',
                width: 'auto',
                minWidth: '110px',
              }}
            >
              <option value="draft">Rascunho</option>
              <option value="in_progress">Em andamento</option>
              <option value="finished">Finalizada</option>
            </select>
          </div>

          <div className={styles.metaRow}>
            <span>Itens: {osItems.length}</span>
            <span>Serviços: {osServices.length}</span>
          </div>
        </section>

        {/* CLIENTE */}
        <section className={styles.card}>
          <h4>Cliente</h4>
          <input
            type="text"
            placeholder="Nome do cliente"
            value={osData.customerName}
            onChange={e => setOsData({ customerName: e.target.value })}
            className={styles.inputField}
          />
          <small style={{ opacity: 0.7 }}>ID: {customerId}</small>
        </section>

        {/* TÉCNICO */}
        <section className={styles.card}>
          <h4>Técnico</h4>
          <input
            type="text"
            placeholder="Nome do técnico responsável"
            value={osData.technician}
            onChange={e => setOsData({ technician: e.target.value })}
            className={styles.inputField}
          />
        </section>

        {/* AÇÕES */}
        <section className={styles.card}>
          <h4>Ações da OS</h4>

          <div className={styles.actions}>
            <button className={styles.button} onClick={handleSaveDraft}>
              💾 Salvar rascunho
            </button>

            <button className={styles.button} onClick={handleEmitQuote}>
              🧾 Emitir orçamento
            </button>

            <button className={styles.button} onClick={handlePrint}>
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
            <h3>Itens ({osItems.length})</h3>
            <button
              className={styles.primary}
              onClick={() => setShowItemSelector(true)}
              title="Adicionar item na OS"
            >
              + Adicionar
            </button>
          </div>

          {osItems.length === 0 ? (
            <div className={styles.emptyState}>
              Nenhum item adicionado
            </div>
          ) : (
            osItems.map((item, index) => (
  <div key={`${item.id}-${index}`} className={styles.listItem}>
    <div className={styles.listItemContent}>
      <span className={styles.itemIndex}>{index + 1}</span>
      <div>
        <strong>{item.name}</strong>
        <small>
          SKU: {item.sku || 'N/A'} | Estoque: {item.stock || 0} {item.unitOfMeasure || 'un'}
        </small>
      </div>
    </div>

    <div className={styles.listItemActions}>
      <div className={styles.quantityControl}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            // ✅ CORRIGIDO: Usando 'item' e 'updateItemQuantity'
            updateItemQuantity(item.id, (item.quantity || 1) - 1);
          }}
          disabled={(item.quantity || 1) <= 1}
        >
          −
        </button>

        <input
          type="number"
          value={item.quantity || 1}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            updateItemQuantity(item.id, isNaN(val) ? 1 : val);
          }}
          onClick={(e) => e.stopPropagation()}
          className={styles.quantityInput}
        />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            // ✅ CORRIGIDO: Usando 'item' e 'updateItemQuantity'
            updateItemQuantity(item.id, (item.quantity || 1) + 1);
          }}
        >
          +
        </button>
      </div>
      <span className={styles.itemPrice}>
        {money.format(item.price * item.quantity)}
      </span>
      <button
        className={styles.btnRemove}
        onClick={() => removeItem(item.id)}
        title="Remover"
      >
        ✕
      </button>
    </div>
  </div>

            ))
          )}
        </section>

        {/* SERVIÇOS */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Serviços ({osServices.length})</h3>
            <button
              className={styles.primary}
              onClick={() => setShowServiceSelector(true)}
              title="Adicionar serviço na OS"
            >
              + Adicionar
            </button>
          </div>

          {osServices.length === 0 ? (
            <div className={styles.emptyState}>
              Nenhum serviço adicionado
            </div>
          ) : (
            osServices.map((service, index) => (
  <div key={`${service.id}-${index}`} className={styles.listItem}>
    <div className={styles.listItemContent}>
      <span className={styles.itemIndex}>{index + 1}</span>
      <div>
        <strong>{service.name}</strong>
        <small>{service.category || 'Serviço'}</small>
      </div>
    </div>

    <div className={styles.listItemActions}>
      <div className={styles.quantityControl}>
        <button
          type="button" // ✅ Evita submit acidental
          onClick={(e) => {
            e.stopPropagation();
            updateServiceQuantity(service.id, (service.quantity || 1) - 1);
          }}
          disabled={(service.quantity || 1) <= 1}
        >
          −
        </button>
        <input
          type="number"
          value={service.quantity || 1}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            updateServiceQuantity(service.id, isNaN(val) ? 1 : val);
          }}
          onClick={(e) => e.stopPropagation()}
          className={styles.quantityInput}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            updateServiceQuantity(service.id, (service.quantity || 1) + 1);
          }}
        >
          +
        </button>
      </div>

      <span className={styles.itemPrice}>
        {money.format(service.price * (service.quantity || 1))}
      </span>
      <button
        className={styles.btnRemove}
        onClick={() => removeService(service.id)}
        title="Remover"
      >
        ✕
      </button>
    </div>
  </div>
            ))
          )}
        </section>

        {/* CONFIGURAÇÃO */}
        <section className={styles.card}>
          <h3>Configuração</h3>

          <input
            placeholder="Equipamento"
            value={osData.equipment}
            onChange={e => setOsData({ equipment: e.target.value })}
            className={styles.inputField}
          />

          <input
            placeholder="Aplicação"
            value={osData.application}
            onChange={e => setOsData({ application: e.target.value })}
            className={styles.inputField}
          />

          <input
            placeholder="Bitola"
            value={osData.gauge}
            onChange={e => setOsData({ gauge: e.target.value })}
            className={styles.inputField}
          />
        </section>

        {/* NOTAS */}
        <section className={styles.card}>
          <h3>Observações</h3>
          <textarea
            placeholder="Notas e observações sobre a OS"
            value={osData.notes}
            onChange={e => setOsData({ notes: e.target.value })}
            className={styles.textareaField}
          />
        </section>

        {/* MÃO DE OBRA */}
        <section className={styles.card}>
          <h3>Mão de obra</h3>

          <div className={styles.flexRow}>
            <button
              className={`${styles.button} ${osData.laborType === 'fixed'
                  ? styles.buttonActive
                  : ''
                }`}
              onClick={() => setOsData({ laborType: 'fixed' })}
            >
              {osData.laborType === 'fixed' ? '✓ ' : ''}Fixo
            </button>
            <button
              className={`${styles.button} ${osData.laborType === 'per_point'
                  ? styles.buttonActive
                  : ''
                }`}
              onClick={() => setOsData({ laborType: 'per_point' })}
            >
              {osData.laborType === 'per_point' ? '✓ ' : ''}Por ponto
            </button>
          </div>

          <input
            type="number"
            value={osData.laborValue}
            onChange={e =>
              setOsData({ laborValue: Number(e.target.value) })
            }
            placeholder="Valor da mão de obra"
            className={styles.inputField}
          />

          <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
            Total mão de obra: <strong>{money.format(totals.labor)}</strong>
          </p>
        </section>
      </main>

      {/* 🟩 SUMMARY */}
      <aside className={styles.summary}>
        {/* TOTAIS */}
        <section className={styles.cardHighlight}>
          <h3>Total</h3>

          <div className={styles.row}>
            <span>Produtos</span>
            <span>{money.format(totals.products)}</span>
          </div>

          <div className={styles.row}>
            <span>Serviços</span>
            <span>{money.format(totals.services)}</span>
          </div>

          <div className={styles.row}>
            <span>Mão de obra</span>
            <span>{money.format(totals.labor)}</span>
          </div>

          <hr className={styles.divider} />

          <strong className={styles.total}>
            {money.format(totals.total)}
          </strong>
        </section>

        {/* PAGAMENTO */}
        <section className={styles.card}>
          <h4>Pagamento Antecipado</h4>

          <input
            type="number"
            placeholder="Valor pago"
            value={paid}
            onChange={e => setPaid(Number(e.target.value))}
            className={styles.inputField}
          />

          <div className={styles.paymentSummary}>
            <span>Pago:</span>
            <strong>{money.format(paid)}</strong>
          </div>

          <div className={styles.paymentSummary}>
            <span>Restante:</span>
            <strong
              className={totals.remaining <= 0 ? styles.paid : ''}
            >
              {money.format(totals.remaining)}
            </strong>
          </div>

          <button
            className={styles.button}
            onClick={handleRegisterPayment}
          >
            💳 Registrar Pagamento
          </button>
        </section>

        {/* FECHAMENTO */}
        <section className={styles.actions}>
          <h4>Fechamento da OS</h4>

          <button
            className={styles.primary}
            onClick={handleGenerateSale}
          >
            🛒 Adicionar ao carrinho
          </button>

          <button className={styles.button}>
            💸 Aplicar Desconto
          </button>



          <button className={styles.button}>
            📄 Exportar PDF
          </button>

          <button className={styles.button}>
            📤 Enviar por WhatsApp
          </button>
        </section>
      </aside>

      {/* MODAIS */}
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
