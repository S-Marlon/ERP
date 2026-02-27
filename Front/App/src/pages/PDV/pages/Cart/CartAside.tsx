import React from 'react';
import styles from '../../PDV.module.css';

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
    onFinalizar
}) => {

    // subtotal calculado no pai e recebido via props
    // const itemsSubtotal = props.itemsSubtotal; // não mais necessário

    // Lista de unidades que permitem venda fracionada (decimais)
    const FRACTIONABLE_UNITS = ['MT', 'LT', 'KG', 'M', 'L'];

    return (
        <aside className={styles.cartAside}>
            <header className={styles.cartHeader}>

                <div className={styles.headerTitle}>
                    <h2>{activeTab === 'os' ? 'Resumo OS' : 'Carrinho'}</h2>
                    <span className={styles.itemCount}> ({cart.length} itens)</span>
                </div>

                {/* TOPO: IDENTIFICAÇÃO */}
                <div style={{ display: 'flex', flexDirection: 'row' }}>
                    <div>
                        <span className="badge">VIP - 5% OFF sugerido</span>
                        <h3>{cliente}</h3>
                    </div>
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
                            <div key={item.id} className={styles.cartItem}>
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
                                    <span className={styles.unitPrice}>
                                        {money.format(item.price)} <small>/{item.unitOfMeasure || 'un'}</small>
                                    </span>


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

                                        <button className={styles.btnDiscount} title="Aplicar Desconto">
                                            %
                                        </button>
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
                {/* Bloco de Detalhamento: Informações de apoio */}
                <div className={styles.summaryDetails}>
                    <div className={styles.summaryRow}>
                                <span>Subtotal Itens:</span>
                        <span>{money.format(itemsSubtotal)}</span>
                    </div>

                    {calculatedLabor > 0 && (
                        <div className={styles.summaryRow}>
                            <span>Mão de Obra:</span>
                            <span>{money.format(calculatedLabor)}</span>
                        </div>
                    )}

                    {/* descontos e valores pagos não fazem parte do carrinho; tratados no checkout */}
                </div>

                {/* Divisor Visual Sutil */}
                <hr style={{color:'white'}} />

                {/* Bloco de Destaque: Total Geral */}
                <div className={styles.totalSection}>
                    <div className={styles.totalInfo}>
                        <span className={styles.totalLabel}>TOTAL A PAGAR</span>
                        <strong className={styles.totalAmount}>{money.format(total)}</strong>
                    </div>

                    <button
                        className={styles.btnCheckout}
                        disabled={total <= 0}
                        onClick={onFinalizar}
                    >
                        FINALIZAR VENDA (F2)
                    </button>
                </div>
            </footer>
        </aside>
    );
};