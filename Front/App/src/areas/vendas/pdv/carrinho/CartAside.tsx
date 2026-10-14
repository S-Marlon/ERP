// Carrinho do PDV: itens com unidade, quantidade, preço por item (desconto ou acréscimo) e faixa de atacado; rodapé com total e ações.
import React, { useState } from 'react';
import { Button, ConfigProvider, Divider, Dropdown, Empty, Flex, InputNumber, Modal, Popconfirm, Select, Tag, Tooltip, Typography, message, theme } from 'antd';
import { CopyOutlined, DeleteOutlined, ExportOutlined, MoreOutlined, PrinterOutlined, SplitCellsOutlined } from '@ant-design/icons';
import { ajusteDaLinha, ajustesDoCarrinho, precoBaseLinha } from '../utils/ajustesCarrinho';

import { CartItem } from '../types';
import { emAtacado, podeFracionar, proximaFaixa } from '../utils/precoCarrinho';
import { PrecosPorFormaPainel } from './PrecosPorFormaPainel';

interface CartAsideProps {
    cart: CartItem[];
    cliente: string;
    total: number;
    money: Intl.NumberFormat;
    updateQuantity: (id: string | number, value: number | string) => void;
    changeUnit?: (id: string | number, idUnidade: number) => void;
    removeItem: (id: string | number) => void;
    onFinalizar: () => void;
    // Guardar o carrinho sem vender: venda suspensa (retoma depois) ou orçamento (preço congelado)
    onSuspender?: () => void;
    onOrcamento?: () => void;
    salvandoPedido?: boolean;
    onBack: () => void;
    applyIndividualDiscount: (id: string | number, newPrice: number) => void;
    estagio: 'SELECAO' | 'PAGAMENTO';
    // Kit configurável: reabre a escolha das variações da linha
    onEditarKit?: (id: string | number) => void;
    style?: React.CSSProperties;
}

const escapar = (t: string) => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));

// Carrinho escuro (destaque na tela clara): tema escuro do antd só aqui dentro
const TEMA_CARRINHO = {
    algorithm: theme.darkAlgorithm,
    token: { colorBgContainer: '#1e293b', colorBgElevated: '#1e293b', colorBgLayout: '#0f172a', colorBorderSecondary: '#334155' },
};

export const CartAside: React.FC<CartAsideProps> = props => (
    <ConfigProvider theme={TEMA_CARRINHO}>
        <CarrinhoConteudo {...props} />
    </ConfigProvider>
);

const CarrinhoConteudo: React.FC<CartAsideProps> = ({
    cart, cliente, total, money, updateQuantity, changeUnit, removeItem, onFinalizar, onSuspender, onOrcamento,
    salvandoPedido, estagio, onBack, applyIndividualDiscount, onEditarKit, style,
}) => {
    const { token } = theme.useToken();
    // Fracionamento ligado à mão por item (unidades fracionáveis já vêm ligadas)
    const [fracionados, setFracionados] = useState<Record<string | number, boolean>>({});
    // Preço por item (desconto ou acréscimo): item aberto no modal e o preço digitado
    const [itemDesconto, setItemDesconto] = useState<CartItem | null>(null);
    const [novoPreco, setNovoPreco] = useState<number | null>(null);

    const precoBase = (item: CartItem) => precoBaseLinha(item);
    // desconto e acréscimo somados por linha: um não esconde o outro
    const { subtotalTabela, descontos, acrescimos } = ajustesDoCarrinho(cart);

    const abrirDesconto = (item: CartItem) => { setItemDesconto(item); setNovoPreco(item.price); };
    const aplicarDesconto = () => {
        if (!itemDesconto || !novoPreco || novoPreco <= 0) { message.warning('Informe um preço válido.'); return; }
        applyIndividualDiscount(itemDesconto.id, novoPreco);
        setItemDesconto(null);
    };

    const imprimir = () => {
        const janela = window.open('', '_blank');
        if (!janela) return;
        const linhas = cart.map(item => {
            const original = precoBase(item);
            return `<tr><td>${escapar(item.name)}${item.price < original - 0.004 ? `<div style="font-size:10px;color:#999">De: ${money.format(original)}</div>` : ''}</td>`
                + `<td style="text-align:center">${item.quantity}</td><td style="text-align:right">${money.format(item.price)}</td>`
                + `<td style="text-align:right">${money.format(item.price * item.quantity)}</td></tr>`;
        }).join('');
        janela.document.write(`<html><head><title>Venda - ${escapar(cliente)}</title><style>
            body{font-family:Arial,sans-serif;padding:30px;color:#333}
            .cab{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #731717;margin-bottom:20px;padding-bottom:10px}
            table{width:100%;border-collapse:collapse;margin-top:10px} th,td{padding:8px;border-bottom:1px solid #ddd;font-size:13px}
            .res{margin-top:25px;width:300px;margin-left:auto} .res div{display:flex;justify-content:space-between;margin-bottom:5px}
            .tot{font-size:18px;font-weight:bold;color:#731717;border-top:2px solid #731717;padding-top:5px}
          </style></head><body>
            <div class="cab"><h1>Venda</h1><div>${new Date().toLocaleDateString('pt-BR')}</div></div>
            <div><strong>Cliente:</strong> ${escapar(cliente)}</div>
            <table><thead><tr><th>Descrição</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${linhas}</tbody></table>
            <div class="res"><div><span>Subtotal:</span><span>${money.format(subtotalTabela)}</span></div>
            ${descontos > 0 ? `<div><span>Descontos:</span><span style="color:#16a34a">- ${money.format(descontos)}</span></div>` : ''}
            ${acrescimos > 0 ? `<div><span>Acréscimos:</span><span>+ ${money.format(acrescimos)}</span></div>` : ''}
            <div class="tot"><span>Total:</span><span>${money.format(total)}</span></div></div>
            <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script></body></html>`);
        janela.document.close();
    };

    const copiarResumo = async () => {
        const texto = `Pedido de ${cliente}\n${cart.map(i => `${i.quantity} x ${i.name} · ${money.format(i.price * i.quantity)}`).join('\n')}\nTotal: ${money.format(total)}`;
        try { await navigator.clipboard.writeText(texto); message.success('Resumo copiado.'); }
        catch { message.error('Não foi possível copiar.'); }
    };

    const exportar = () => {
        const blob = new Blob([JSON.stringify({ cliente, cart, total, criadoEm: new Date().toISOString() }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `carrinho-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const limpar = () => { cart.forEach(item => removeItem(item.id)); message.success('Carrinho limpo.'); };
    const emPagamento = estagio === 'PAGAMENTO';

    return (
        <Flex vertical style={{
            minWidth: 0, minHeight: 0, background: token.colorBgLayout, color: token.colorText, borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`, boxShadow: '-6px 0 20px rgba(0,0,0,0.25)', ...style,
        }}>
            <Flex align="center" justify="space-between" gap={8} style={{ padding: '8px 10px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <Typography.Text strong style={{ fontSize: 15 }}>Carrinho <Typography.Text type="secondary">({cart.length})</Typography.Text></Typography.Text>
                <Flex gap={4}>
                    <Dropdown trigger={['click']} menu={{
                        items: [
                            { key: 'imprimir', icon: <PrinterOutlined />, label: 'Imprimir', onClick: imprimir, disabled: cart.length === 0 },
                            { key: 'copiar', icon: <CopyOutlined />, label: 'Copiar resumo', onClick: copiarResumo, disabled: cart.length === 0 },
                            { key: 'exportar', icon: <ExportOutlined />, label: 'Exportar (JSON)', onClick: exportar, disabled: cart.length === 0 },
                        ],
                    }}>
                        <Button size="small" icon={<MoreOutlined />} />
                    </Dropdown>
                    <Popconfirm title="Limpar carrinho?" description="Todos os itens serão removidos." okText="Limpar" okButtonProps={{ danger: true }}
                        cancelText="Cancelar" onConfirm={limpar} disabled={cart.length === 0}>
                        <Tooltip title="Limpar carrinho"><Button size="small" danger icon={<DeleteOutlined />} disabled={cart.length === 0} /></Tooltip>
                    </Popconfirm>
                </Flex>
            </Flex>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 8 }}>
                {cart.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Carrinho vazio" style={{ marginTop: 32 }} />
                ) : (
                    <Flex vertical gap={6}>
                        {cart.map((item, index) => {
                            const original = precoBase(item);
                            const ajuste = ajusteDaLinha(item);
                            const temDesconto = ajuste.tipo === 'DESCONTO';
                            const temAcrescimo = ajuste.tipo === 'ACRESCIMO';
                            const pctOff = ajuste.pct.toFixed(0);
                            const fracionado = !!fracionados[item.id] || podeFracionar(item.unitOfMeasure);
                            const stock = item.stock ?? 0;
                            const ehProduto = item.type !== 'service' && item.type !== 'os';
                            const limitaEstoque = ehProduto && !item.podeVenderSemEstoque;
                            const unidade = item.unidades?.find(u => u.idUnidade === item.idUnidadeVenda);
                            const atacado = unidade ? emAtacado(unidade, item.quantity) : false;
                            const proxima = unidade && !item.precoManual ? proximaFaixa(unidade, item.quantity) : null;
                            const un = item.unitOfMeasure || 'un';

                            return (
                                <div key={item.id} style={{
                                    padding: 8, borderRadius: token.borderRadius, border: `1px solid ${token.colorBorderSecondary}`,
                                    borderLeft: `3px solid ${temDesconto ? token.colorSuccess : temAcrescimo ? token.colorWarning : token.colorBorderSecondary}`,
                                    background: item.quantity === 0 ? token.colorFillQuaternary : token.colorBgContainer,
                                }}>
                                    <Flex gap={6} align="flex-start">
                                        <Tag style={{ margin: 0 }}>{index + 1}</Tag>
                                        <Typography.Paragraph strong ellipsis={{ rows: 2, tooltip: item.name }} style={{ margin: 0, flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                                            {item.name}
                                        </Typography.Paragraph>
                                        <Popconfirm title="Remover item?" description={item.name} okText="Remover" okButtonProps={{ danger: true }}
                                            cancelText="Cancelar" onConfirm={() => removeItem(item.id)}>
                                            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                    </Flex>

                                    <Flex gap={6} wrap align="center" style={{ margin: '4px 0', fontSize: 12 }}>
                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Cód: {item.sku ?? item.id}</Typography.Text>
                                        {item.kitPosicoes && (
                                            <Tooltip title="Kit: clique para trocar as variações ou quantidades">
                                                <Tag color="geekblue" style={{ margin: 0, cursor: 'pointer', whiteSpace: 'normal' }} onClick={() => onEditarKit?.(item.id)}>
                                                    {item.kitResumo ? `Kit: ${item.kitResumo}` : 'Kit padrão'} · trocar
                                                </Tag>
                                            </Tooltip>
                                        )}
                                        {ehProduto && (
                                            <Typography.Text type={stock < 5 ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                                                · Estoque: {Number(stock).toLocaleString('pt-BR')} {item.unitOfMeasure || ''}
                                            </Typography.Text>
                                        )}
                                        {ehProduto && (item.unidades?.length || 0) > 1 && (
                                            <Select size="small" style={{ minWidth: 120 }} popupMatchSelectWidth={false}
                                                value={item.idUnidadeVenda ?? undefined}
                                                onChange={(v: number) => changeUnit?.(item.id, v)}
                                                options={item.unidades!.map(u => ({
                                                    value: u.idUnidade,
                                                    label: `${u.nomeExibicao && u.nomeExibicao !== u.sigla ? `${u.nomeExibicao} ` : ''}${u.sigla}${u.fator !== 1 ? ` (${u.fator})` : ''}`,
                                                }))} />
                                        )}
                                        {item.precoManual && <Tag color="orange" style={{ margin: 0 }}>Preço manual</Tag>}
                                        {atacado && <Tag color="green" style={{ margin: 0 }}>Atacado aplicado</Tag>}
                                        {proxima && (
                                            <Tooltip title={`Faltam ${Number(proxima.quantidadeMinima - item.quantity).toLocaleString('pt-BR')} ${un} para o preço de atacado. Clique para usar.`}>
                                                <Tag color="orange" style={{ margin: 0, cursor: 'pointer' }} onClick={() => updateQuantity(item.id, proxima.quantidadeMinima)}>
                                                    Atacado {Number(proxima.quantidadeMinima).toLocaleString('pt-BR')}+: {money.format(proxima.precoUnitario)}
                                                </Tag>
                                            </Tooltip>
                                        )}
                                    </Flex>

                                    <Flex gap={6} wrap align="center" justify="space-between" style={{ borderTop: `1px dashed ${token.colorBorderSecondary}`, paddingTop: 6 }}>
                                        <Flex vertical style={{ lineHeight: 1.2 }}>
                                            {temDesconto && <Typography.Text delete type="secondary" style={{ fontSize: 11 }}>{money.format(original)}</Typography.Text>}
                                            {temAcrescimo && <Typography.Text type="secondary" style={{ fontSize: 11 }}>tabela {money.format(original)}</Typography.Text>}
                                            <span style={{ whiteSpace: 'nowrap' }}>
                                                <Typography.Text strong>{money.format(item.price)}</Typography.Text>
                                                <Typography.Text type="secondary" style={{ fontSize: 11 }}> /{un}</Typography.Text>
                                            </span>
                                        </Flex>
                                        <Flex gap={4} align="center">
                                            <Tooltip title={fracionado ? 'Fracionado (decimal)' : 'Ativar fracionamento (decimal)'}>
                                                <Button size="small" type={fracionado ? 'primary' : 'default'} icon={<SplitCellsOutlined />}
                                                    onClick={() => setFracionados(prev => ({ ...prev, [item.id]: !prev[item.id] }))} />
                                            </Tooltip>
                                            <Tooltip title={temAcrescimo ? `Acréscimo de ${pctOff}% sobre a tabela` : temDesconto ? `Desconto de ${pctOff}%` : 'Mudar o preço do item (desconto ou acréscimo)'}>
                                                <Button size="small" onClick={() => abrirDesconto(item)}
                                                    style={temDesconto ? { color: token.colorSuccess, borderColor: token.colorSuccess }
                                                        : temAcrescimo ? { color: token.colorWarning, borderColor: token.colorWarning } : undefined}>
                                                    {temDesconto ? `-${pctOff}%` : temAcrescimo ? `+${pctOff}%` : '%'}
                                                </Button>
                                            </Tooltip>
                                            <InputNumber size="small" min={0} max={limitaEstoque ? stock : undefined} step={fracionado ? 0.1 : 1}
                                                value={item.quantity} onChange={val => updateQuantity(item.id, val ?? 0)} style={{ width: 80 }} />
                                        </Flex>
                                        <Typography.Text strong style={{ minWidth: 80, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {money.format(item.price * item.quantity)}
                                        </Typography.Text>
                                    </Flex>
                                </div>
                            );
                        })}
                    </Flex>
                )}
            </div>

            <div style={{ padding: 10, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                <Flex justify="space-between"><Typography.Text type="secondary">Itens</Typography.Text><span>{cart.length}</span></Flex>
                {descontos > 0 && (
                    <Flex justify="space-between">
                        <Typography.Text type="secondary">Descontos</Typography.Text>
                        <Typography.Text type="success">- {money.format(descontos)}</Typography.Text>
                    </Flex>
                )}
                {acrescimos > 0 && (
                    <Flex justify="space-between">
                        <Typography.Text type="secondary">Acréscimos</Typography.Text>
                        <Typography.Text type="warning">+ {money.format(acrescimos)}</Typography.Text>
                    </Flex>
                )}
                <Divider style={{ margin: '6px 0' }} />
                <Flex justify="space-between" align="baseline">
                    <Typography.Text strong>Total</Typography.Text>
                    <Typography.Text strong style={{ fontSize: 22 }}>{money.format(total)}</Typography.Text>
                </Flex>
                {/* À vista x parcelado: o que o cliente paga em cada forma (com as taxas) */}
                {!emPagamento && <PrecosPorFormaPainel total={total} money={money} />}

                {!emPagamento && (onSuspender || onOrcamento) && (
                    <Flex gap={6} style={{ marginTop: 8 }}>
                        {onSuspender && (
                            <Tooltip title="Guarda o carrinho e libera o PDV para o próximo cliente">
                                <Button block disabled={cart.length === 0} loading={salvandoPedido} onClick={onSuspender}>Suspender</Button>
                            </Tooltip>
                        )}
                        {onOrcamento && (
                            <Tooltip title="Salva com preços congelados e validade, para imprimir e vender depois">
                                <Button block disabled={cart.length === 0} onClick={onOrcamento}>Orçamento</Button>
                            </Tooltip>
                        )}
                    </Flex>
                )}
                <Button type="primary" danger={emPagamento} block size="large" style={{ marginTop: 8 }}
                    disabled={!emPagamento && total <= 0} onClick={emPagamento ? onBack : onFinalizar}>
                    {emPagamento ? 'Voltar ao carrinho' : 'Finalizar venda (F2)'}
                </Button>
            </div>

            <Modal open={!!itemDesconto} title="Preço do item" okText="Aplicar" cancelText="Cancelar" destroyOnHidden width={380}
                onOk={aplicarDesconto} onCancel={() => setItemDesconto(null)}
                footer={(_, { OkBtn, CancelBtn }) => (
                    <Flex justify="space-between">
                        {itemDesconto && Math.abs(itemDesconto.price - precoBase(itemDesconto)) >= 0.005
                            ? <Button onClick={() => { applyIndividualDiscount(itemDesconto.id, precoBase(itemDesconto)); setItemDesconto(null); }}>Voltar ao preço de tabela</Button>
                            : <span />}
                        <Flex gap={8}><CancelBtn /><OkBtn /></Flex>
                    </Flex>
                )}>
                {itemDesconto && (
                    <Flex vertical gap={8}>
                        <Typography.Text strong>{itemDesconto.name}</Typography.Text>
                        <Typography.Text type="secondary">Preço de tabela: {money.format(precoBase(itemDesconto))} · abaixo dá desconto, acima dá acréscimo</Typography.Text>
                        <InputNumber autoFocus prefix="R$" min={0.01} step={0.01} precision={2} decimalSeparator=","
                            value={novoPreco} onChange={v => setNovoPreco(v)} onPressEnter={aplicarDesconto} style={{ width: '100%' }} />
                        {novoPreco !== null && novoPreco > 0 && novoPreco < precoBase(itemDesconto) - 0.004 && (
                            <Typography.Text type="success">
                                Desconto de {((1 - novoPreco / precoBase(itemDesconto)) * 100).toFixed(1)}% ({money.format((precoBase(itemDesconto) - novoPreco) * itemDesconto.quantity)} no item)
                            </Typography.Text>
                        )}
                        {novoPreco !== null && novoPreco > precoBase(itemDesconto) + 0.004 && (
                            <Typography.Text type="warning">
                                Acréscimo de {((novoPreco / precoBase(itemDesconto) - 1) * 100).toFixed(1)}% (+{money.format((novoPreco - precoBase(itemDesconto)) * itemDesconto.quantity)} no item)
                            </Typography.Text>
                        )}
                    </Flex>
                )}
            </Modal>
        </Flex>
    );
};
