import React, { useState } from 'react';
import styles from './CartAside.module.css';
import Swal from 'sweetalert2';
import { Button, InputNumber, Tooltip, Modal, message } from 'antd';
import { 
  PrinterOutlined, 
  ExportOutlined, 
  ShareAltOutlined, 
  DeleteOutlined, 
  FilePdfOutlined, 
  EyeOutlined, 
  EditOutlined, 
  SplitCellsOutlined 
} from '@ant-design/icons';

import { CartItem } from '../../types';

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
    onViewOS?: (os: CartItem) => void;
    onEditOS?: (os: CartItem) => void;
}

type CartAction = 'print' | 'pdf' | 'export' | 'share' | 'clear';

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
    onBack,
    applyIndividualDiscount,
    onViewOS,
    onEditOS
}) => {
    // 🔹 Estado para controlar o fracionamento por ID do item (Ativado = true, Desativado = false)
    const [fractionatedItems, setFractionatedItems] = useState<Record<string | number, boolean>>({});

    const toggleFractionate = (id: string | number) => {
        setFractionatedItems(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const osItems = cart.filter(i => i.type === 'os');

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

        if (result.isDenied) {
            applyIndividualDiscount(item.id, precoOriginal);
            return;
        }

        if (result.isConfirmed && result.value) {
            const novoPreco = Number(result.value);
            applyIndividualDiscount(item.id, novoPreco);
        }
    };

    const handleCartAction = async (action: CartAction) => {
        switch (action) {
            case 'print': handlePrint(); break;
            case 'pdf': handleGeneratePDF(); break;
            case 'export': handleExportJSON(); break;
            case 'share': handleShare(); break;
            case 'clear': await handleClearCart(); break;
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const oxbloodRed = '#731717';
        const logoUrl = 'https://via.placeholder.com/150x60?text=LOGO';

        const renderRows = (items: CartItem[]) =>
            items.map(item => {
                const original = item.originalPrice || item.price;
                const hasDiscount = item.price < original;
                return `
                    <tr>
                      <td>
                        ${item.name}
                        ${hasDiscount ? `<div style="font-size:10px;color:#999;">De: ${money.format(original)}</div>` : ''}
                      </td>
                      <td style="text-align:center;">${item.quantity}</td>
                      <td style="text-align:right;">${money.format(item.price)}</td>
                      <td style="text-align:right;">${money.format(item.price * item.quantity)}</td>
                    </tr>
                `;
            }).join('');

        const produtos = cart.filter(i => i.type !== 'service');
        const servicos = cart.filter(i => i.type === 'service');

        const subtotal = cart.reduce((acc, item) => acc + ((item.originalPrice ?? item.price) * item.quantity), 0);
        const totalComDesconto = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const descontoTotal = subtotal - totalComDesconto;

        printWindow.document.write(`
            <html>
              <head>
                <title>Venda - ${cliente}</title>
                <style>
                  body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
                  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid ${oxbloodRed}; margin-bottom: 20px; padding-bottom: 10px; }
                  h3 { background: ${oxbloodRed}; color: #fff; padding: 6px; font-size: 14px; }
                  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                  th, td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px; }
                  .summary { margin-top: 25px; width: 300px; margin-left: auto; }
                  .summary div { display: flex; justify-content: space-between; margin-bottom: 5px; }
                  .total { font-size: 18px; font-weight: bold; color: ${oxbloodRed}; border-top: 2px solid ${oxbloodRed}; padding-top: 5px; }
                </style>
              </head>
              <body>
                <div class="header">
                  <img src="${logoUrl}" height="50"/>
                  <div><h1>Venda</h1><div>${new Date().toLocaleDateString('pt-BR')}</div></div>
                </div>
                <div><strong>Cliente:</strong> ${cliente}</div>
                ${produtos.length > 0 ? `<h3>Produtos</h3><table><thead><tr><th>Descrição</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${renderRows(produtos)}</tbody></table>` : ''}
                ${servicos.length > 0 ? `<h3>Serviços</h3><table><thead><tr><th>Descrição</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${renderRows(servicos)}</tbody></table>` : ''}
                <div class="summary">
                  <div><span>Subtotal:</span><span>${money.format(subtotal)}</span></div>
                  ${descontoTotal > 0 ? `<div><span>Descontos:</span><span style="color:#16a34a;">- ${money.format(descontoTotal)}</span></div>` : ''}
                  <div class="total"><span>Total:</span><span>${money.format(totalComDesconto)}</span></div>
                </div>
                <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };</script>
              </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleGeneratePDF = () => {
        Modal.info({ title: 'Em desenvolvimento', content: 'Geração de PDF será implementada em breve' });
    };

    const handleExportJSON = () => {
        const data = { cliente, cart, total, createdAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
            await navigator.share({ title: 'Carrinho', text });
        } else {
            await navigator.clipboard.writeText(text);
            message.success('Resumo copiado para área de transferência');
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
            message.success('Carrinho limpo');
        }
    };

    return (
        <aside className={styles.cartAside}>
            <header className={styles.cartHeader}>
                <h2>Carrinho ({cart.length})</h2>
                <div className={styles.headerActions}>
                    <Tooltip title="Gerar PDF"><Button icon={<FilePdfOutlined />} onClick={() => handleCartAction('pdf')} disabled /></Tooltip>
                    <Tooltip title="Imprimir"><Button icon={<PrinterOutlined />} onClick={() => handleCartAction('print')} /></Tooltip>
                    <Tooltip title="Exportar"><Button icon={<ExportOutlined />} onClick={() => handleCartAction('export')} /></Tooltip>
                    <Tooltip title="Compartilhar"><Button icon={<ShareAltOutlined />} onClick={() => handleCartAction('share')} /></Tooltip>
                    <Tooltip title="Limpar carrinho">
                        <Button danger icon={<DeleteOutlined />} onClick={() => handleCartAction('clear')} />
                    </Tooltip>
                </div>
            </header>

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
                            <div key={os.id} className={styles.osHighlightItem}>
                                <div className={styles.osItemContent}>
                                    <div>
                                        <strong>{os.name}</strong>
                                        <small>{itemsCount} itens • {servicesCount} serviços</small>
                                        {osDetails.osNumber && <div style={{ fontSize: '11px', color: '#999' }}>Ref: {osDetails.osNumber}</div>}
                                        {isPaid && <div style={{ fontSize: '11px', color: '#10b981' }}>✔ Quitada</div>}
                                    </div>
                                </div>
                                <div className={styles.osItemRight}>
                                    <strong>{money.format(os.price)}</strong>
                                </div>
                                <div className={styles.osItemActions}>
                                    <Tooltip title="Visualizar OS"><Button size="small" icon={<EyeOutlined />} onClick={() => onViewOS?.(os)} /></Tooltip>
                                    <Tooltip title="Editar OS"><Button size="small" icon={<EditOutlined />} onClick={() => { removeItem(os.id); onEditOS?.(os); }} /></Tooltip>
                                    <Tooltip title="Remover OS"><Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeItem(os.id)} /></Tooltip>
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

                        // 🔹 Verifica se o fracionamento está ativo para este item
                        const isFractionated = !!fractionatedItems[item.id];
                        const currentStep = isFractionated ? 0.1 : 1;

                        const stock = item.stock ?? 0;
                        const hasStock = stock > 0;

                        return (
                            <div key={item.id} className={`${styles.cartItem} ${temDesconto ? styles.cartItemDiscounted : ''}`}>
                                <div className={styles.cartItemHeader}>
                                    <div className={styles.itemIndex}>{index + 1}</div>
                                    <div className={styles.mainInfo}>
                                        <strong className={styles.itemName}>{item.name}</strong>
                                    </div>
                                    {item.quantity === 0 && (
                                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemove(item)} />
                                    )}
                                </div>

                                <div className={styles.itemSecondaryDetails}>
                                    <span className={styles.skuText}>Cód: {item.sku ?? item.id}</span>
                                    {item.type === 'part' && (
                                        <span className={`${styles.stockInfo} ${stock < 5 ? styles.lowStock : ''}`}>
                                            Estoque: {stock}
                                        </span>
                                    )}
                                </div>

                                <div className={styles.cartActions}>
                                    <div className={styles.priceColumn}>
                                        {temDesconto && <span className={styles.originalPriceLabel}>{money.format(precoOriginal)}</span>}
                                        <span className={styles.unitPrice}>
                                            {money.format(item.price)} <small>/ {item.unitOfMeasure || 'un'}</small>
                                        </span>
                                    </div>

                                    <div className={styles.controlsGroup}>
                                        {/* 🔹 Botão para Ativar/Desativar Fracionamento */}
                                        <Tooltip title={isFractionated ? "Desativar fracionamento (Inteiro)" : "Ativar fracionamento (Decimal)"}>
                                            <Button 
                                                size="small" 
                                                type={isFractionated ? "primary" : "default"}
                                                icon={<SplitCellsOutlined />} 
                                                onClick={() => toggleFractionate(item.id)}
                                            />
                                        </Tooltip>

                                        <Button 
                                            size="small" 
                                            className={temDesconto ? styles.btnDiscountActive : ''}
                                            onClick={() => handleIndividualDiscount(item)}
                                        >
                                            {temDesconto ? `${porcentagemOff}%` : '%'}
                                        </Button>
                                    </div>

                                    <div className={styles.controlsGroup}>
                                        <div className={styles.quantitySelector}>
                                            <InputNumber
                                                size="small"
                                                min={0}
                                                max={hasStock && item.type === 'part' ? stock : undefined}
                                                step={currentStep}
                                                value={item.quantity}
                                                onChange={(val) => updateQuantity(item.id, val ?? 0)}
                                                style={{ width: '90px' }}
                                            />
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
            </div>

            <footer className={styles.cartFooter}>
                <div className={styles.summaryBox}>
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

                <div className={styles.btnFooteSection}>
                    <Button 
                        type="primary" 
                        danger={estagio === 'PAGAMENTO'}
                        block
                        size="large"
                        disabled={estagio !== 'PAGAMENTO' && total <= 0}
                        onClick={estagio === 'PAGAMENTO' ? onBack : onFinalizar}
                    >
                        {estagio === 'PAGAMENTO' ? 'CANCELAR PAGAMENTO' : 'FINALIZAR VENDA (F2)'}
                    </Button>
                </div>
            </footer>
        </aside>
    );
};