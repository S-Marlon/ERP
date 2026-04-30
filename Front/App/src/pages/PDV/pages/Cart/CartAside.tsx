import React from 'react';
import styles from './CartAside.module.css';
import Swal from 'sweetalert2';

import { CartItem } from '../../types';

// interface acima substituída pelo tipo importado — garante consistência entre os componentes

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
    onFinalizar: () => void; // Callback para quando o usuário clicar em "Finalizar Venda"
    onBack: () => void; // Callback para quando o usuário clicar em "Cancelar Pagamento"
    applyIndividualDiscount: (id: string | number, newPrice: number) => void; // <-- ADICIONE ESTA LINHA
    estagio: 'SELECAO' | 'PAGAMENTO';
}

type CartAction =
  | 'print'
  | 'pdf'
  | 'export'
  | 'share'
  | 'clear';

export const CartAside: React.FC<CartAsideProps> = ({
    cart,
    cliente,
    itemsSubtotal,
    activeTab,
    total,
    money,
    updateQuantity,
    removeItem,
    onFinalizar,
    estagio,
    onBack, // Callback para quando o usuário clicar em "Cancelar Pagamento"
    applyIndividualDiscount
}) => {

    const osItems = cart.filter(i => i.type === 'os');
    const normalItems = cart.filter(i => i.type !== 'os');

    const mockOSList = [
        {
            id: 'os-001',
            number: 'OS-000123',
            equipment: 'Prensa hidráulica',
            total: 1500,
            status: 'Em andamento'
        },
        {
            id: 'os-002',
            number: 'OS-000124',
            equipment: 'Mangueira alta pressão',
            total: 890,
            status: 'Aguardando pagamento'
        }
    ];

    const handleRemove = async (item: CartItem) => {
        const result = await Swal.fire({
            title: 'Remover item?',
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

    

    const handleIndividualDiscount = async (item: CartItem) => {
        const precoOriginal = item.originalPrice || item.price;
        const temDesconto = item.price < precoOriginal;

        const result = await Swal.fire({
            title: 'Aplicar Desconto',
            html: `
            <div style="text-align: left; background: #334155; padding: 15px; border-radius: 8px; color: white; margin-bottom: 10px;">
                <p style="margin: 0"><strong>Produto:</strong> ${item.name}</p>
                <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #cbd5e0;">
                    Preço Base: ${money.format(precoOriginal)}
                </p>
            </div>
            <label style="display:block; text-align: left; margin-bottom: 5px; color: #333;">Novo Preço Unitário (R$):</label>
        `,
            input: 'number',
            inputValue: item.price,
            inputAttributes: {
                step: '0.01',
                min: '0.01'
            },
            showCancelButton: true,
            cancelButtonText: 'Cancelar',

            // BOTÃO DE RESET (Aparece apenas se já houver desconto)
            showDenyButton: temDesconto,
            denyButtonText: 'Remover Desconto',
            denyButtonColor: '#64748b',

            confirmButtonText: 'Aplicar',
            confirmButtonColor: '#10b981',

            inputValidator: (value) => {
                if (!value || Number(value) <= 0) return 'Insira um valor válido!';
                if (Number(value) > precoOriginal) return 'O preço com desconto não pode ser maior que o original!';
                return null;
            }
        });

        // 1. Lógica para REMOVER DESCONTO (Reset)
        if (result.isDenied) {
            applyIndividualDiscount(item.id, precoOriginal);
            return; // Encerra aqui
        }

        // 2. Lógica para APLICAR NOVO VALOR
        if (result.isConfirmed && result.value) {
            const novoPreco = Number(result.value);
            applyIndividualDiscount(item.id, novoPreco);
        }
    };

    const handleCartAction = async (action: CartAction) => {
  switch (action) {
    case 'print':
      handlePrint();
      break;

    case 'pdf':
      handleGeneratePDF();
      break;

    case 'export':
      handleExportJSON();
      break;

    case 'share':
      handleShare();
      break;

    case 'clear':
      await handleClearCart();
      break;
  }
};

const handlePrint = () => {
  window.print();
};

const handleGeneratePDF = () => {
  Swal.fire({
    icon: 'info',
    title: 'Em desenvolvimento',
    text: 'Geração de PDF será implementada em breve'
  });
};

const handleExportJSON = () => {
  const data = {
    cliente,
    cart,
    total,
    createdAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cart-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
};

const handleShare = async () => {
  const text = `Pedido de ${cliente}\nTotal: ${money.format(total)}`;

  if (navigator.share) {
    await navigator.share({
      title: 'Carrinho',
      text
    });
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
  <button onClick={() => handleCartAction('pdf')} title="Gerar PDF" disabled>🧾</button>
  <button onClick={() => handleCartAction('print')} title="Imprimir">🖨️</button>
  <button onClick={() => handleCartAction('export')} title="Exportar">📤</button>
  <button onClick={() => handleCartAction('share')} title="Compartilhar">📲</button>
  <button
    onClick={() => handleCartAction('clear')}
    title="Limpar carrinho"
    className={styles.danger}
  >
    🗑️
  </button>
</div>
</header>
            {/* 🔥 ORDEM DE SERVIÇO ATIVA */}
            {osItems.length > 0 && (
                <div className={styles.osHighlight}>
                    <div className={styles.osHighlightHeader}>
                        <span>🛠️ Ordem de Serviço ({osItems.length})</span>
                    </div>

                   {osItems.map(os => {
  const osDetails = os.osData || {};
  const itemsCount = osDetails.items?.length || 0;
  const servicesCount = osDetails.services?.length || 0;

  const isPaid = os.price <= 0;

  return (
    <div
      key={os.id}
      className={styles.osHighlightItem}
      title={`OS: ${osDetails.osNumber || 'N/A'}`}
    >
      <div className={styles.osItemContent}>
        <div>
          <strong>{os.name}</strong>

          <small>
            {itemsCount} itens • {servicesCount} serviços
          </small>

          <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
            {osDetails.osNumber && <>Ref: {osDetails.osNumber}</>}
          </div>

          {/* ✅ STATUS */}
          {isPaid && (
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '2px' }}>
              ✔ Quitada
            </div>
          )}
        </div>
      </div>

      <div className={styles.osItemRight}>
        <div className={styles.osBreakdown}>
          {osDetails.productsTotal !== undefined && (
            <div style={{ fontSize: '11px', color: '#999' }}>
              Produtos: {money.format(osDetails.productsTotal)}
            </div>
          )}

          {osDetails.laborTotal > 0 && (
            <div style={{ fontSize: '11px', color: '#999' }}>
              MO: {money.format(osDetails.laborTotal)}
            </div>
          )}
        </div>

        <strong style={{ fontSize: '14px', marginTop: '4px' }}>
          {money.format(os.price)}
        </strong>
      </div>

      {/* ✅ AÇÕES */}
      <div className={styles.osItemActions}>
        {/* 👁️ VISUALIZAR */}
        <button
          className={styles.osActionBtn}
          onClick={() => onViewOS?.(os)}
          title="Visualizar OS"
        >
          👁️
        </button>

        {/* ✏️ EDITAR */}
        <button
          className={styles.osActionBtn}
          onClick={() => {
            removeItem(os.id);
            onEditOS?.(os);
          }}
          title="Editar OS"
        >
          ✏️
        </button>

        {/* ❌ REMOVER */}
        <button
          className={styles.osActionBtnDanger}
          onClick={() => removeItem(os.id)}
          title="Remover OS"
        >
          ✕
        </button>
      </div>
    </div>
  );
})}
                </div>
            )}

           

            <div className={styles.cartList}>
                {cart.length === 0 ? (
                    <div className={styles.emptyCart}>
                        <p>Seu carrinho está vazio</p>
                    </div>
                ) : (
                    cart.map((item, index) => {

                        const precoOriginal = item.originalPrice || item.price;
                        const temDesconto = item.price < precoOriginal;
                        const porcentagemOff = ((1 - item.price / precoOriginal) * 100).toFixed(0);



                        // Verifica se este item específico pode ser fracionado
                        const canFractionate = FRACTIONABLE_UNITS.includes(
                            item.unitOfMeasure?.toUpperCase() || ''
                        );
                        const currentStep = canFractionate ? 0.1 : 1;

                        // facilitar a leitura e evitar avisos sobre 'stock' undefined
                        // prefer usar variável local para evitar warnings
                        const stock = item.stock ?? 0;
                        const hasStock = stock > 0;

                        return (
                            <div key={item.id} className={`${styles.cartItem} ${temDesconto ? styles.cartItemDiscounted : ''} ${item.quantity === 0 ? styles.cartItemItenzero : ''}`}>
                                {/* 1. Cabeçalho do Item: Nome e Código */}
                                <div className={styles.cartItemHeader}>

                                    <div className={styles.itemIndex}>
                                        {index + 1}
                                    </div>

                                    <div className={styles.mainInfo}>
                                        <strong className={styles.itemName}>{item.name}</strong>
                                    </div>

                                    <button
                                            className={`${styles.btnDiscount} ${temDesconto ? styles.btnDiscountActive : ''}`}
                                            // onClick={() => setSelectedPart(item)}
                                            title="Ver Detalhes"
                                        >
                                            ?
                                        </button>

                                    {item.quantity == 0 && (
                                        <button
                                            className={styles.btnRemove}
                                            onClick={() => handleRemove(item)}
                                            title="Remover item"
                                        >
                                            ✕
                                        </button>

                                    )}
                                </div>

                                {/* 2. Linha de Detalhes: Preço Unitário, Estoque e Unidade */}
                                <div className={styles.itemSecondaryDetails}>



                                    {/* exibimos sku se disponível; tipo global agora inclui campo opcional */}
                                    <span className={styles.skuText}>Cód: {item.sku ?? item.id}</span>

                                    {item.type === 'part' && (
                                        <span className={`${styles.stockInfo} ${stock < 5 ? styles.lowStock : ''}`}>
                                            Estoque: {stock}
                                        </span>
                                    )}


                                </div>

                                {/* 3. Rodapé do Item: Ações e Subtotal */}
                                <div className={styles.cartActions}>

                                    <div className={styles.priceColumn}>
                                        {temDesconto && (
                                            <span className={styles.originalPriceLabel}>{money.format(precoOriginal)} </span>

                                        )}
                                        <span className={styles.unitPrice}>
                                            {money.format(item.price)} <small>/ {item.unitOfMeasure || 'un'}</small>
                                        </span>
                                    </div>




                                    <div className={styles.controlsGroup}>


                                        <button
                                            className={`${styles.btnDiscount} ${temDesconto ? styles.btnDiscountActive : ''}`}
                                            onClick={() => handleIndividualDiscount(item)}
                                            title="Aplicar Desconto"
                                        >
                                            {temDesconto ? `${porcentagemOff}%` : '%'}
                                        </button>

                                        {activeTab === 'os' && (
                                            <button
                                                className={`${styles.btnDiscount} ${temDesconto ? styles.btnDiscountActive : ''}`}
                                                // onClick={() => setSelectedPart(item)}
                                                title="Adicionar à Ordem de Serviço"
                                            >
                                                🛠️
                                            </button>
                                        )}

                                    </div>


                                    <div className={styles.controlsGroup}>
                                        <div className={styles.quantitySelector}>
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(item.id, -currentStep)}
                                                disabled={item.quantity <= currentStep}
                                            >
                                                –
                                            </button>
                                            <input
                                                type="number"
                                                step={canFractionate ? "0.1" : "1"}
                                                className={styles.quantityInput}
                                                value={item.quantity}
                                                onChange={(e) => updateQuantity(item.id, e.target.value)}
                                                onBlur={(e) => updateQuantity(item.id, e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(item.id, currentStep)}
                                                disabled={
                                                    item.type === 'part' &&
                                                    hasStock &&
                                                    item.quantity >= stock
                                                }
                                            >
                                                +
                                            </button>
                                        </div>


                                    </div>

                                    <div className={styles.itemSubtotal}>
                                        <span className={styles.label}>Total</span>
                                        <strong>{money.format(item.price * item.quantity)}</strong>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Exibição da Mão de Obra se houver valor calculado */}
             
            </div>

            <footer className={styles.cartFooter}>
                <div className={styles.summaryBox}>

{}


                    <div className={styles.summaryRow}>
                        <span>Produtos</span>
                        <strong>0</strong>
                    </div>

                    <div className={styles.summaryRow}>
                        <span>Serviços</span>
                        <strong>0</strong>
                    </div>

                    <div className={styles.summaryRow}>
                        <span>Mão de obra</span>
                        <strong>0</strong>
                    </div>



                    <div className={styles.summaryDivider} />

                    <div className={styles.totalRow}>
                        <span>Total</span>
                        <strong>{money.format(total)}</strong>
                    </div>

                </div>


                <hr className={styles.separator} />

                {/* Bloco de Destaque: Total Geral */}
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
                        {estagio === 'PAGAMENTO'
                            ? 'CANCELAR PAGAMENTO'
                            : 'FINALIZAR VENDA (F2)'}
                    </button>




                    {/* O botão de cancelar só aparece se houver itens no carrinho ou pagamentos realizados */
                    }



                </div>
            </footer>
        </aside>
    );
};