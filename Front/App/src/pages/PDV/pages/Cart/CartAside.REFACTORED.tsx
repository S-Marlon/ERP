/**
 * 🛒 CartAside.tsx - REFATORADO
 * 
 * Domínio: Carrinho de Vendas
 * Responsabilidades:
 * ✅ Exibir itens do carrinho
 * ✅ Permitir edição de quantidade (apenas produtos/serviços)
 * ✅ Permitir desconto manual (apenas produtos/serviços)
 * ✅ Remover itens do carrinho
 * ✅ Preparar dados para módulo de pagamento
 * 
 * ❌ NÃO faz:
 * ❌ Processamento de pagamento
 * ❌ Persistência de vendas
 * ❌ Atualização de status de OS
 * ❌ Desconto em OS (OS é imutável no carrinho)
 * ❌ Edição de quantidade de OS (OS sempre quantity = 1)
 */

import React from 'react';
import styles from './CartAside.module.css';
import Swal from 'sweetalert2';
import { CartItem, isCartItemOS } from '../../types';

interface CartAsideProps {
  cart: CartItem[];
  cliente: string;
  itemsSubtotal: number;
  activeTab: 'parts' | 'services' | 'os';
  calculatedLabor: number;
  total: number;
  money: Intl.NumberFormat;
  updateQuantity: (id: string | number, value: number | string) => void;
  removeItem: (id: string | number) => void;
  onFinalizar: () => void;
  onBack: () => void;
  applyIndividualDiscount: (id: string | number, newPrice: number) => void;
  estagio: 'SELECAO' | 'PAGAMENTO';
}

type CartAction = 'print' | 'pdf' | 'export' | 'share' | 'clear';

/**
 * 🎯 NOVO: Guard para verificar se é item editável
 * Produtos e serviços podem ser editados
 * OS não pode ser editada no carrinho
 */
const isEditableItem = (item: CartItem): boolean => {
  return !isCartItemOS(item) && item.type !== 'os';
};

export const CartAside: React.FC<CartAsideProps> = ({
  cart,
  cliente,
  itemsSubtotal,
  total,
  money,
  updateQuantity,
  removeItem,
  onFinalizar,
  estagio,
  onBack,
  applyIndividualDiscount
}) => {
  const osItems = cart.filter(i => isCartItemOS(i));
  const normalItems = cart.filter(i => !isCartItemOS(i));

  /**
   * ✅ REMOVER: Permite remover qualquer item (inclusive OS)
   * OS só entra no carrinho se remaining > 0, então pode sempre sair
   */
  const handleRemove = async (item: CartItem) => {
    const isOS = isCartItemOS(item);
    
    const result = await Swal.fire({
      title: `Remover ${isOS ? 'Ordem de Serviço' : 'item'}?`,
      html: `
        <div style="text-align:left">
          <strong>${item.name}</strong><br/>
          <small>Essa ação não pode ser desfeita</small>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remover',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
      removeItem(item.id);
    }
  };

  /**
   * ✅ DESCONTO: Só aplica a produtos/serviços
   * ❌ BLOQUEIA: Desconto em OS (OS é imutável)
   */
  const handleIndividualDiscount = async (item: CartItem) => {
    // 🔒 DOMÍNIO: OS não recebe desconto
    if (isCartItemOS(item)) {
      Swal.fire({
        icon: 'info',
        title: 'Desconto não permitido',
        text: 'Ordens de Serviço não podem receber desconto no carrinho',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // ✅ DOMÍNIO: Apenas produtos/serviços recebem desconto
    const precoOriginal = item.originalPrice || item.price;
    const temDesconto = item.price < precoOriginal;

    const result = await Swal.fire({
      title: 'Aplicar Desconto',
      html: `
        <div style="text-align: left; background: #334155; padding: 15px; border-radius: 8px; color: white; margin-bottom: 10px;">
          <p style="margin: 0"><strong>${item.category}:</strong> ${item.name}</p>
          <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #cbd5e0;">
            Preço Base: ${money.format(precoOriginal)}
          </p>
        </div>
        <label style="display:block; text-align: left; margin-bottom: 5px; color: #333;">Novo Preço Unitário (R$):</label>
      `,
      input: 'number',
      inputValue: item.price,
      inputAttributes: { step: '0.01', min: '0.01' },
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      showDenyButton: temDesconto,
      denyButtonText: 'Remover Desconto',
      denyButtonColor: '#64748b',
      confirmButtonText: 'Aplicar',
      confirmButtonColor: '#10b981',
      inputValidator: (value) => {
        if (!value || Number(value) <= 0) return 'Insira um valor válido!';
        if (Number(value) > precoOriginal) return 'Desconto não pode ser maior que o preço original!';
        return null;
      }
    });

    if (result.isDenied) {
      applyIndividualDiscount(item.id, precoOriginal);
      return;
    }

    if (result.isConfirmed && result.value) {
      applyIndividualDiscount(item.id, Number(result.value));
    }
  };

  /**
   * ✅ EDITAR QUANTIDADE: Apenas produtos/serviços
   * ❌ BLOQUEIA: Edição de quantidade de OS (sempre quantity = 1)
   */
  const handleUpdateQuantity = (item: CartItem, newValue: number | string) => {
    if (isCartItemOS(item)) {
      Swal.fire({
        icon: 'warning',
        title: 'Quantidade fixa',
        text: 'Ordens de Serviço sempre têm quantidade 1 no carrinho',
        confirmButtonText: 'Entendido',
        timer: 2000,
        timerProgressBar: true,
        position: 'bottom-end',
        toast: true
      });
      return;
    }

    updateQuantity(item.id, newValue);
  };

  const handleCartAction = async (action: CartAction) => {
    switch (action) {
      case 'print':
        handlePrint();
        break;
      case 'clear':
        await handleClearCart();
        break;
      case 'export':
        handleExportJSON();
        break;
      case 'share':
        handleShare();
        break;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const data = { cliente, cart, total, createdAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carrinho-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const text = `Pedido de ${cliente}\nTotal: ${money.format(total)}`;
    if (navigator.share) {
      await navigator.share({ title: 'Carrinho', text });
    } else {
      await navigator.clipboard.writeText(text);
      Swal.fire({
        icon: 'success',
        title: 'Copiado!',
        text: 'Resumo copiado para área de transferência',
        timer: 1500
      });
    }
  };

  const handleClearCart = async () => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Limpar carrinho?',
      text: 'Todos os itens serão removidos',
      showCancelButton: true,
      confirmButtonText: 'Limpar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
      cart.forEach(item => removeItem(item.id));
      Swal.fire({
        icon: 'success',
        title: 'Carrinho limpo',
        timer: 1200,
        showConfirmButton: false
      });
    }
  };

  const FRACTIONABLE_UNITS = ['MT', 'LT', 'KG', 'M', 'L'];

  return (
    <aside className={styles.cartAside}>
      <header className={styles.cartHeader}>
        <h2>Carrinho ({cart.length})</h2>
        <div className={styles.headerActions}>
          <button onClick={() => handleCartAction('print')} title="Imprimir">
            🖨️
          </button>
          <button onClick={() => handleCartAction('export')} title="Exportar">
            📤
          </button>
          <button onClick={() => handleCartAction('share')} title="Compartilhar">
            📲
          </button>
          <button
            onClick={() => handleCartAction('clear')}
            title="Limpar carrinho"
            className={styles.danger}
          >
            🗑️
          </button>
        </div>
      </header>

      {/* 🔒 ORDENS DE SERVIÇO - IMUTÁVEIS */}
      {osItems.length > 0 && (
        <div className={styles.osHighlight}>
          <div className={styles.osHighlightHeader}>
            <span>🛠️ Ordem(s) de Serviço ({osItems.length})</span>
          </div>

          {osItems.map(os => {
            const osDetails = os.osData || {};
            
            return (
              <div
                key={os.id}
                className={styles.osHighlightItem}
                title={`OS: ${osDetails.osNumber || 'N/A'}`}
              >
                <div className={styles.osItemContent}>
                  <div>
                    <strong>{osDetails.equipment}</strong>
                    <small>
                      Bitola: {osDetails.gauge} • Aplicação: {osDetails.application || 'N/A'}
                    </small>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                      {osDetails.items?.length || 0} itens • {osDetails.services?.length || 0} serviços
                    </div>
                  </div>
                </div>

                <div className={styles.osItemRight}>
                  <div className={styles.osBreakdown}>
                    {osDetails.productsTotal !== undefined && (
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        Produtos: {money.format(osDetails.productsTotal)}
                      </div>
                    )}
                    {osDetails.laborTotal > 0 && (
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        Mão-de-obra: {money.format(osDetails.laborTotal)}
                      </div>
                    )}
                  </div>
                  <strong style={{ fontSize: '14px', marginTop: '4px' }}>
                    {money.format(os.price)}
                  </strong>
                </div>

                {/* ✅ AÇÃO: Apenas remover OS */}
                <div className={styles.osItemActions}>
                  <button
                    className={styles.osActionBtnDanger}
                    onClick={() => handleRemove(os)}
                    title="Remover OS do carrinho"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📦 PRODUTOS E SERVIÇOS - EDITÁVEIS */}
      <div className={styles.cartList}>
        {cart.length === 0 ? (
          <div className={styles.emptyCart}>
            <p>Seu carrinho está vazio</p>
          </div>
        ) : (
          normalItems.map((item) => {
            const precoOriginal = item.originalPrice || item.price;
            const temDesconto = item.price < precoOriginal;
            const porcentagemOff = ((1 - item.price / precoOriginal) * 100).toFixed(0);
            const canFractionate = FRACTIONABLE_UNITS.includes(item.unitOfMeasure?.toUpperCase() || '');
            const currentStep = canFractionate ? 0.1 : 1;
            const stock = item.stock ?? 0;

            return (
              <div
                key={item.id}
                className={`${styles.cartItem} ${temDesconto ? styles.cartItemDiscounted : ''}`}
              >
                {/* Cabeçalho */}
                <div className={styles.cartItemHeader}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.sku || '-'}</small>
                  </div>
                  {temDesconto && (
                    <span className={styles.discountBadge}>-{porcentagemOff}%</span>
                  )}
                </div>

                {/* Detalhes */}
                <div className={styles.itemSecondaryDetails}>
                  <span>
                    {money.format(item.price)} {item.unitOfMeasure || 'un'}
                  </span>
                  {stock > 0 && (
                    <span style={{ color: '#10b981', fontSize: '11px' }}>
                      Est: {stock}
                    </span>
                  )}
                </div>

                {/* Ações */}
                <div className={styles.cartActions}>
                  {/* Quantidade */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      onClick={() => handleUpdateQuantity(item, item.quantity - currentStep)}
                      style={{ padding: '4px 6px', fontSize: '12px' }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleUpdateQuantity(item, e.target.value)}
                      step={currentStep}
                      style={{ width: '40px', textAlign: 'center', padding: '4px' }}
                    />
                    <button
                      onClick={() => handleUpdateQuantity(item, item.quantity + currentStep)}
                      style={{ padding: '4px 6px', fontSize: '12px' }}
                    >
                      +
                    </button>
                  </div>

                  {/* Subtotal */}
                  <span style={{ fontWeight: 'bold', minWidth: '80px', textAlign: 'right' }}>
                    {money.format(item.price * item.quantity)}
                  </span>

                  {/* Botões */}
                  <button
                    onClick={() => handleIndividualDiscount(item)}
                    title="Aplicar desconto"
                    style={{ padding: '4px 6px', fontSize: '12px' }}
                  >
                    💰
                  </button>
                  <button
                    onClick={() => handleRemove(item)}
                    title="Remover do carrinho"
                    style={{ padding: '4px 6px', fontSize: '12px', color: '#ef4444' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Rodapé com Total */}
      <footer className={styles.cartFooter}>
        <div className={styles.summaryBox}>
          <div className={styles.summaryRow}>
            <span>Produtos</span>
            <strong>{normalItems.length}</strong>
          </div>

          <div className={styles.summaryRow}>
            <span>Serviços</span>
            <strong>0</strong>
          </div>

          {osItems.length > 0 && (
            <div className={styles.summaryRow}>
              <span>Ordens de Serviço</span>
              <strong>{osItems.length}</strong>
            </div>
          )}

          <div className={styles.summaryDivider} />

          <div className={styles.totalRow}>
            <span>Total</span>
            <strong>{money.format(total)}</strong>
          </div>
        </div>

        <hr className={styles.separator} />

        {/* Botão de ação principal */}
        <div className={styles.btnFooteSection}>
          <button
            className={
              estagio === 'PAGAMENTO'
                ? styles.btnCancelSale
                : styles.btnCheckout
            }
            disabled={estagio !== 'PAGAMENTO' && total <= 0}
            onClick={estagio === 'PAGAMENTO' ? onBack : onFinalizar}
          >
            {estagio === 'PAGAMENTO' ? 'CANCELAR PAGAMENTO' : 'FINALIZAR VENDA (F2)'}
          </button>
        </div>
      </footer>
    </aside>
  );
};
