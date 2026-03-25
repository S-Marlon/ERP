import React from 'react';
import styles from '../../PDV.module.css';
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
}

export const CartAside: React.FC<CartAsideProps> = ({
    cart,
    cliente,
    itemsSubtotal,
    activeTab,
    calculatedLabor,
    total,
    money,
    updateQuantity,
    removeItem,
    onFinalizar,
    onBack, // Callback para quando o usuário clicar em "Cancelar Pagamento"
    applyIndividualDiscount
}) => {



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

    const FRACTIONABLE_UNITS = ['MT', 'LT', 'KG', 'M', 'L'];

    return (
        <aside className={styles.cartAside}>
            <header className={styles.cartHeader}>

                <h2>{activeTab === 'os' ? 'Resumo OS' : 'Carrinho'} ({cart.length} itens) </h2>

                {/* TOPO: IDENTIFICAÇÃO */}
                <div>

                    <h4>{cliente}</h4>

                    <span>CPF/CNPJ: 000.000.000-00</span>
                </div>

            </header>

            <div className={styles.cartList}>
                {cart.length === 0 ? (
                    <div className={styles.emptyCart}>
                        <p>Seu carrinho está vazio</p>
                    </div>
                ) : (
                    cart.map((item) => {

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
<div key={item.id} className={`${styles.cartItem} ${temDesconto ? styles.cartItemDiscounted : ''}`}>
                                    {/* 1. Cabeçalho do Item: Nome e Código */}
                                <div className={styles.cartItemHeader}>
                                    <div className={styles.mainInfo}>
                                        <strong className={styles.itemName}>{item.name}</strong>
                                    </div>
                                    <button
                                        className={styles.btnRemove}
                                        onClick={() => removeItem(item.id)}
                                        title="Remover item"
                                    >
                                        ✕
                                    </button>
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
                                {/* <span className={`${styles.unitPrice} ${temDesconto ? styles.priceGreen : ''}`}>
                                    {money.format(item.price)}
                                </span> */}
                            </div>


                                    <span className={styles.unitPrice}>
                                        {money.format(item.price)} <small>/ {item.unitOfMeasure || 'un'}</small>
                                    </span>
                                    
                                    <button 
                                className={`${styles.btnDiscount} ${temDesconto ? styles.btnDiscountActive : ''}`} 
                                onClick={() => handleIndividualDiscount(item)}
                                title="Aplicar Desconto"
                            >
                                {temDesconto ? `${porcentagemOff}%` : '%'}
                            </button>



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
                {calculatedLabor > 0 && (
                    <div className={`${styles.cartItem} ${styles.laborRow}`}>
                        <div className={styles.cartItemInfo}>
                            <strong>Mão de Obra / Taxa de Prensagem</strong>
                            <span>{money.format(calculatedLabor)}</span>
                        </div>
                    </div>
                )}
            </div>

            <footer className={styles.cartFooter}>
                <div className={styles.summaryDetails}>
                    <div className={styles.summaryColumn}>

                        <div >
                            <span>Subtotal Itens: </span>
                            <span>{money.format(itemsSubtotal)}</span>
                        </div>

                        <div >
                            <span>Mão de Obra: </span>
                            <span>{money.format(calculatedLabor)}</span>
                        </div>
                    </div>

                    <div className={styles.totalInfo}>
                        <small>Valor Total Carrinho</small>
                        <strong>R$ {total.toFixed(2)}</strong>
                    </div>
                </div>


                <hr className={styles.separator} />

                {/* Bloco de Destaque: Total Geral */}
                <div className={styles.btnFooteSection}>



                    <button
                        className={styles.btnCheckout}
                        disabled={total <= 0}
                        onClick={onFinalizar}
                    >
                        FINALIZAR VENDA (F2)
                    </button>

                    {/* O botão de cancelar só aparece se houver itens no carrinho ou pagamentos realizados */
                    }

                    {cart.length > 0 || total > 0 ? (
                        <button
                            className={styles.btnCancelSale}
                            onClick={onBack}
                        >
                            CANCELAR PAGAMENTO
                        </button>
                    ) : null}

                </div>
            </footer>
        </aside>
    );
};