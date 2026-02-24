import React from 'react';
import styles from '../../PDV.module.css';

// Interface para garantir que o item tenha as propriedades necessárias
interface CartItem extends any {
    id: string | number;
    name: string;
    price: number;
    quantity: number;
    unitOfMeasure?: string; // MT, LT, KG, UN, PC, etc.
    type: 'part' | 'service';
    stock?: number;
}

interface CartAsideProps {
    cart: CartItem[];
    activeTab: 'parts' | 'services' | 'os';
    calculatedLabor: number;
    total: number;
    money: Intl.NumberFormat;
    updateQuantity: (id: string | number, value: number | string) => void;
    removeItem: (id: string | number) => void;
}

export const CartAside: React.FC<CartAsideProps> = ({
    cart,
    activeTab,
    calculatedLabor,
    total,
    money,
    updateQuantity,
    removeItem,
}) => {
    // Cálculo do subtotal apenas dos itens (sem a mão de obra)
    const itemsSubtotal = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);

    // Lista de unidades que permitem venda fracionada (decimais)
    const FRACTIONABLE_UNITS = ['MT', 'LT', 'KG', 'M', 'L'];

    return (
        <aside className={styles.cartAside}>
            <header className={styles.cartHeader}>
                <div className={styles.clientInfo}>
                    <h2>Cliente:</h2>
                    <span>Cliente tals</span>
                </div>
                <div className={styles.headerTitle}>
                    <h2>{activeTab === 'os' ? 'Resumo OS' : 'Carrinho'}</h2>
                    <span className={styles.itemCount}>{cart.length} itens</span>
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


                                    <span className={styles.skuText}>Cód: {item.sku || item.id}</span>

                                    {item.type === 'part' && (
                                        <span className={`${styles.stockInfo} ${item.stock < 5 ? styles.lowStock : ''}`}>
                                            Estoque: {item.stock}
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
                                                disabled={item.type === 'part' && item.quantity >= (item.stock || 99999)}
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
                <div className={styles.summaryInfo}>
                    <div className={styles.summaryRow}>
                        <span>Subtotal Itens:</span>
                        <span> {money.format(itemsSubtotal)}</span>
                    </div>
                    {calculatedLabor > 0 && (
                        <div className={styles.summaryRow}>
                            <span>Mão de Obra:</span>
                            <span> {money.format(calculatedLabor)}</span>
                        </div>
                    )}


                      <div className={styles.totalRow}>
                    <span>TOTAL GERAL: </span>
                    <strong className={styles.totalValue}>{money.format(total)}</strong>
                </div>
                </div>

              

                <button
                    className={styles.btnCheckout}
                    disabled={cart.length === 0}
                    onClick={() => alert('Finalizado')}
                >
                    {activeTab === 'os' ? 'Gerar Orçamento' : 'Finalizar Venda'}
                </button>
            </footer>
        </aside>
    );
};