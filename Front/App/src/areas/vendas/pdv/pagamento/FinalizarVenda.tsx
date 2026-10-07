// Pagamento da venda no PDV: formas (com taxas, parcelamento, a prazo e sinal), lista de pagamentos, troco e conclusão.
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Checkbox, DatePicker, Divider, Flex, Form, Input, InputNumber, List, Modal, Popover, Segmented, Select, Steps, Switch, Tag, Tooltip, Typography, message, theme } from 'antd';
import type { InputRef } from 'antd';
import {
    ArrowLeftOutlined, BankOutlined, CalculatorOutlined, CalendarOutlined, CheckOutlined, CreditCardOutlined, DeleteOutlined, DollarOutlined,
    EditOutlined, FileTextOutlined, LockOutlined, MailOutlined, PercentageOutlined, PrinterOutlined, QrcodeOutlined, SettingOutlined,
    SwapOutlined, TagOutlined, TruckOutlined, WhatsAppOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { imprimirExtratoElgin } from '../../../../shared/utils/printService';
import { salesService, VendaPdvPayload, FormaPagamentoPdv, ErroVendaPdv, AutorizacaoVenda } from '../services/salesService';
import { isCartItemOS } from '../types/cart.types';
import { caixaStore } from '../../caixa/caixaStore';
import { useSituacaoCliente } from '../../../financeiro/receber/receberApi';
import { acrescimoParcelamento, ajusteDaForma, descontoDaForma, useTaxasVenda } from '../../taxas/taxasVenda';
import { useAdiantamentosAbertos } from '../services/adiantamentosApi';
import { Calculadora, PreferenciasPdv, bipConfirmacao, guardarUltimoComprovante, lerPreferencias, salvarPreferencias, textoComprovante, ultimoComprovante } from './apoioPagamento';

export interface ItemVenda {
    id: string | number;
    name: string;
    quantity: number;
    salePrice: number;
    costPrice?: number;
    unidade?: string;
}

export type PaymentMethodType =
    | 'money'
    | 'credit_card'
    | 'debit_card'
    | 'pix'
    | 'bank_transfer'
    | 'store_credit' // 'Crediário'
    | 'advance';     // sinal/adiantamento já recebido do cliente

export const PAYMENT_METHOD_DETAILS: Record<PaymentMethodType, { label: string; icon: React.ReactNode }> = {
    money: { label: 'Dinheiro', icon: <DollarOutlined /> },
    pix: { label: 'PIX', icon: <QrcodeOutlined /> },
    credit_card: { label: 'Crédito', icon: <CreditCardOutlined /> },
    debit_card: { label: 'Débito', icon: <CreditCardOutlined /> },
    store_credit: { label: 'A prazo', icon: <CalendarOutlined /> },
    bank_transfer: { label: 'Transferência', icon: <BankOutlined /> },
    advance: { label: 'Sinal', icon: <TagOutlined /> },
};

// Forma de pagamento gravada no banco para cada método da tela
const FORMA_POR_METODO: Record<PaymentMethodType, FormaPagamentoPdv> = {
    money: 'DINHEIRO',
    pix: 'PIX',
    credit_card: 'CREDITO',
    debit_card: 'DEBITO',
    store_credit: 'PRAZO',
    bank_transfer: 'TRANSFERENCIA',
    advance: 'ADIANTAMENTO',
};

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export const STATUS_LABELS: Record<PaymentStatus, string> = {
    pending: 'Pendente',
    processing: 'Processando',
    paid: 'Pago',
    failed: 'Falha',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
};

export interface Pagamento {
    id: string;
    metodo: PaymentMethodType;
    valor: number;
    parcelas: number;
    // A prazo: intervalo entre parcelas e primeiro vencimento (vazio = hoje + intervalo)
    intervaloDias?: number;
    primeiroVencimento?: string;
    // Crédito acima do sem juros: diferença de taxa repassada ao cliente (já somada em `valor`)
    acrescimo?: number;
    // Sinal usado (forma ADIANTAMENTO)
    idAdiantamento?: number;
    status: PaymentStatus;
    createdAt: Date;
}

interface FinalizarVendaProps {
    onBack: () => void;
    // Venda gravada: o pai limpa o carrinho e volta para a seleção
    onVendaConcluida?: () => void;
    // Tela de pagamento visível (os atalhos de teclado só valem nela)
    ativo?: boolean;
    total: number;
    cliente: string;
    // Cliente do cadastro (null = consumidor final)
    clienteId?: number | null;
    // Venda nascida de um orçamento (preços congelados quando manterPrecoOrcamento)
    idOrcamento?: number | null;
    manterPrecoOrcamento?: boolean;
    // Sinais de uma origem (ex.: OS sendo entregue), além dos do cliente
    adiantamentosOrigem?: { origem: string; idOrigem: number } | null;
    itens: ItemVenda[];
}

const brl = (v: number) => `R$ ${(Number(v) || 0).toFixed(2)}`;
const dataBr = (iso: string) => iso.split('-').reverse().join('/');
const numero = (v: string) => parseFloat(String(v).replace(',', '.')) || 0;

// Troco em notas e moedas (sem a de 1 centavo: sobra de 1 a 4 centavos arredonda para 5)
const notasDoTroco = (valor: number) => {
    if (valor <= 0) return [];
    const unidades = [100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05];
    let resto = Math.round(valor * 100);
    if (resto % 5) resto += 5 - (resto % 5);
    const resultado: Array<{ valor: number; qtd: number; nota: boolean }> = [];
    for (const v of unidades) {
        const c = Math.round(v * 100);
        const qtd = Math.floor(resto / c);
        if (qtd > 0) { resultado.push({ valor: v, qtd, nota: v >= 2 }); resto %= c; }
    }
    return resultado;
};

// Pedido de autorização (senha + nome + motivo) aberto pelo servidor; resolve com os dados ou null
interface PedidoAutorizacao { motivos: string[]; senhaIncorreta?: boolean; resolver: (a: AutorizacaoVenda | null) => void }

export const FinalizarVenda: React.FC<FinalizarVendaProps> = ({
    onBack, onVendaConcluida, ativo = true, total, cliente, clienteId, itens, idOrcamento, manterPrecoOrcamento, adiantamentosOrigem,
}) => {
    const { token } = theme.useToken();
    const [isEnviando, setIsEnviando] = useState(false);
    const [descontoValor, setDescontoValor] = useState(0);
    const [tipoDesconto, setTipoDesconto] = useState<'real' | 'porcent'>('real');
    const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
    const [metodoSelecionado, setMetodoSelecionado] = useState<PaymentMethodType | null>(null);
    const [valorInput, setValorInput] = useState('');
    const [parcelasInput, setParcelasInput] = useState(1);
    // A prazo (crediário): gera parcelas em Financeiro › Contas a Receber
    const [intervaloPrazo, setIntervaloPrazo] = useState(30);
    const [primeiroVencimento, setPrimeiroVencimento] = useState('');
    const situacaoCliente = useSituacaoCliente(clienteId);
    // Taxas da maquininha: desconto que cada forma permite e acréscimo do parcelamento
    const taxasVenda = useTaxasVenda();
    // Sinais em aberto (do cliente e da origem), usados como forma de pagamento "Sinal"
    const adiantamentos = useAdiantamentosAbertos(clienteId, adiantamentosOrigem);
    const [adiantamentoEscolhido, setAdiantamentoEscolhido] = useState<number | null>(null);
    const [pedidoAutorizacao, setPedidoAutorizacao] = useState<PedidoAutorizacao | null>(null);
    const [formAutorizacao] = Form.useForm<AutorizacaoVenda>();
    // Apoio da finalização
    const [apoio, setApoio] = useState<null | 'desconto' | 'obs' | 'comprovante' | 'config' | 'frete'>(null);
    // Frete cobrado do cliente e o cálculo em edição no modal
    const [frete, setFrete] = useState(0);
    const [freteEdicao, setFreteEdicao] = useState<{ modo: 'valor' | 'km' | 'pct'; valor: number | null; km: number | null; valorKm: number | null; minimo: number | null; idaVolta: boolean; pct: number | null }>(
        { modo: 'valor', valor: null, km: null, valorKm: null, minimo: null, idaVolta: false, pct: null });
    const [calculadoraAberta, setCalculadoraAberta] = useState(false);
    const [observacao, setObservacao] = useState('');
    const [preferencias, setPreferencias] = useState<PreferenciasPdv>(lerPreferencias);
    const [descontoEdicao, setDescontoEdicao] = useState<{ tipo: 'real' | 'porcent'; valor: number | null }>({ tipo: 'real', valor: null });
    const mudarPreferencia = (p: Partial<PreferenciasPdv>) => setPreferencias(atual => { const novo = { ...atual, ...p }; salvarPreferencias(novo); return novo; });

    const saldoAdiantamento = (id: number) => {
        const a = adiantamentos.find(x => x.idAdiantamento === id);
        const usado = pagamentos.filter(p => p.idAdiantamento === id).reduce((acc, p) => acc + Number(p.valor), 0);
        return a ? Math.max(0, Math.round((a.saldo - usado) * 100) / 100) : 0;
    };

    // Totais: só pagamentos pagos/processando contam
    const pagamentosAtivos = pagamentos.filter(p => p.status === 'paid' || p.status === 'processing');
    const totalPago = pagamentosAtivos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    const acrescimoTotal = Math.round(pagamentosAtivos.reduce((acc, p) => acc + (Number(p.acrescimo) || 0), 0) * 100) / 100;
    // Parte da venda coberta pelos pagamentos (sem o acréscimo do parcelamento)
    const totalCoberto = Math.round((totalPago - acrescimoTotal) * 100) / 100;
    const descontoCalculado = tipoDesconto === 'porcent' ? (total * descontoValor) / 100 : descontoValor;
    const totalLiquido = total - descontoCalculado + frete;
    const saldoRestante = Math.max(0, parseFloat((totalLiquido - totalCoberto).toFixed(2)));
    const troco = totalCoberto > totalLiquido ? totalCoberto - totalLiquido : 0;
    const podeConcluir = totalCoberto >= totalLiquido - 0.004 && !isEnviando;

    const pedirAutorizacao = (motivos: string[], senhaIncorreta?: boolean) =>
        new Promise<AutorizacaoVenda | null>(resolver => {
            formAutorizacao.resetFields();
            setPedidoAutorizacao({ motivos, senhaIncorreta, resolver });
        });
    const fecharAutorizacao = (resultado: AutorizacaoVenda | null) => {
        pedidoAutorizacao?.resolver(resultado);
        setPedidoAutorizacao(null);
    };

    const handleFinalizarVenda = async (autorizacao?: AutorizacaoVenda) => {
        if (isEnviando) return;
        let tentarDeNovo: AutorizacaoVenda | null = null;

        // OS e serviços ainda não são gravados pelo PDV do modelo novo
        const itensCarrinho: any[] = Array.isArray(itens) ? itens : [];
        if (itensCarrinho.some(item => isCartItemOS(item) || item.type === 'service' || item.type === 'os')) {
            Modal.info({ title: 'Ainda não suportado', content: 'Ordens de serviço e serviços ainda não são gravados pelo PDV novo. Remova-os do carrinho para finalizar a venda dos produtos.' });
            return;
        }

        const payload: VendaPdvPayload = {
            clienteNome: cliente || 'CONSUMIDOR',
            idCliente: clienteId ?? null,
            ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
            ...(frete > 0 ? { frete } : {}),
            descontoGeral: Number(descontoCalculado.toFixed(2)),
            acrescimoGeral: acrescimoTotal,
            ...(idOrcamento ? { idOrcamento, manterPrecoOrcamento: Boolean(manterPrecoOrcamento) } : {}),
            itens: itensCarrinho.map(item => ({
                idItem: Number(item.id),
                quantidade: Number(item.quantity),
                idUnidade: item.idUnidadeVenda ?? null,
                // Sem desconto manual o servidor aplica a tabela (varejo/atacado) pela quantidade
                precoUnitario: item.precoManual ? Number(item.price) : undefined,
            })),
            pagamentos: pagamentosAtivos.map(p => ({
                forma: FORMA_POR_METODO[p.metodo],
                valor: Number(p.valor),
                parcelas: p.parcelas,
                ...(p.metodo === 'store_credit' ? { intervaloDias: p.intervaloDias, primeiroVencimento: p.primeiroVencimento } : {}),
                ...(p.idAdiantamento ? { idAdiantamento: p.idAdiantamento } : {}),
            })),
        };

        setIsEnviando(true);
        try {
            const resposta = await salesService.saveVenda(payload, autorizacao);
            caixaStore.recarregar();
            window.dispatchEvent(new CustomEvent('erp:venda-concluida', { detail: { idVenda: resposta.idVenda, idCliente: clienteId ?? null } }));

            // Comprovante só depois de gravada, com o número real da venda (fica guardado para reimprimir/enviar)
            const comprovante = {
                cliente: payload.clienteNome || 'CONSUMIDOR',
                cpf: '',
                numero: String(resposta.idVenda),
                itens: itensCarrinho.map(item => ({
                    codigo: String(item.sku || item.id),
                    name: item.name,
                    quantity: item.quantity,
                    price: Number(item.price ?? item.salePrice ?? 0),
                    desconto: 0,
                    unidade: item.unitOfMeasure || item.unidade || 'UN',
                })),
                total: resposta.totalLiquido,
                pagamentos: pagamentosAtivos.map(p => ({ metodo: PAYMENT_METHOD_DETAILS[p.metodo].label, valor: p.valor, parcelas: p.parcelas })),
                troco: resposta.troco,
            };
            guardarUltimoComprovante(comprovante);
            if (preferencias.impressaoAutomatica) imprimirExtratoElgin(comprovante);
            if (preferencias.somConfirmacao) bipConfirmacao();

            await new Promise<void>(fechar => Modal.success({
                title: `Venda ${resposta.idVenda} finalizada!`,
                content: (
                    <div>
                        Total: <b>{brl(resposta.totalLiquido)}</b>
                        {resposta.troco > 0 && <div>Troco: <b>{brl(resposta.troco)}</b></div>}
                        {resposta.parcelas?.length ? (
                            <div style={{ marginTop: 8 }}>
                                <b>A prazo:</b>
                                {resposta.parcelas.map(p => <div key={p.parcela}>{p.parcela}/{p.totalParcelas} · {dataBr(p.vencimento)} · {brl(p.valor)}</div>)}
                            </div>
                        ) : null}
                    </div>
                ),
                onOk: () => fechar(),
            }));

            setPagamentos([]);
            setDescontoValor(0);
            setTipoDesconto('real');
            setObservacao('');
            setFrete(0);
            setMetodoSelecionado(null);
            if (onVendaConcluida) onVendaConcluida();
            else onBack();
        } catch (error: any) {
            const detalhes = error instanceof ErroVendaPdv ? error.detalhes : undefined;
            if (detalhes?.codigo === 'AUTORIZACAO_NECESSARIA' && detalhes.temSenha) {
                tentarDeNovo = await pedirAutorizacao(detalhes.motivos || [error.message], detalhes.senhaIncorreta);
                return;
            }
            if (detalhes?.codigo === 'CAIXA_FECHADO' || /caixa/i.test(String(error?.message))) { caixaStore.recarregar(); caixaStore.mostrar('abrir'); }
            Modal.error({ title: 'Venda não registrada', content: error.message || 'Servidor offline ou falha na rede.' });
        } finally {
            setIsEnviando(false);
            // Autorizado: reenvia a mesma venda com a autorização (fora do try, já liberado o envio)
            if (tentarDeNovo) setTimeout(() => handleFinalizarVenda(tentarDeNovo!), 0);
        }
    };

    // Valor sugerido = saldo restante, até o operador mexer
    const valorRef = useRef<InputRef>(null);
    const [usuarioInteragiu, setUsuarioInteragiu] = useState(false);
    useEffect(() => {
        if (metodoSelecionado && !usuarioInteragiu) setValorInput(saldoRestante.toFixed(2));
    }, [metodoSelecionado, saldoRestante, usuarioInteragiu]);

    // Na tela de pagamento, digitar número leva ao campo de valor
    useEffect(() => {
        if (!ativo || !metodoSelecionado) return;
        const aoTeclar = (e: KeyboardEvent) => {
            const alvo = e.target as HTMLElement | null;
            if (alvo && /INPUT|TEXTAREA|SELECT/.test(alvo.tagName)) return;
            if (/^[0-9.,]$/.test(e.key)) valorRef.current?.focus();
        };
        document.addEventListener('keydown', aoTeclar);
        return () => document.removeEventListener('keydown', aoTeclar);
    }, [ativo, metodoSelecionado]);

    const escolherMetodo = (m: PaymentMethodType | null) => {
        setMetodoSelecionado(m);
        setUsuarioInteragiu(false);
        setParcelasInput(1);
        if (!m) setValorInput('');
        else setTimeout(() => valorRef.current?.focus({ cursor: 'all' }), 50);
    };

    const inserirValor = (valor: number) => { setValorInput(valor.toFixed(2)); setUsuarioInteragiu(true); };
    const teclar = (tecla: string) => {
        if (tecla === 'C') { setValorInput(''); setUsuarioInteragiu(true); return; }
        setValorInput(prev => {
            const base = usuarioInteragiu ? prev : '';
            if (tecla === '.' && base.includes('.')) return base;
            return base + tecla;
        });
        setUsuarioInteragiu(true);
    };

    const adicionarPagamento = () => {
        const valorNumerico = numero(valorInput);
        if (valorNumerico <= 0 || !metodoSelecionado) return;
        if (metodoSelecionado === 'advance') {
            if (!adiantamentoEscolhido) { message.warning('Selecione qual sinal usar.'); return; }
            const disponivel = saldoAdiantamento(adiantamentoEscolhido);
            if (valorNumerico > disponivel + 0.004) { message.warning(`Este sinal tem ${brl(disponivel)} disponível.`); return; }
        }
        if (metodoSelecionado === 'store_credit' && !clienteId) { message.warning('Para vender a prazo, identifique o cliente (F4).'); return; }

        const parcelasDoPagamento = metodoSelecionado === 'credit_card' ? parcelasInput : 1;
        const acrescimo = acrescimoParcelamento(taxasVenda, FORMA_POR_METODO[metodoSelecionado], parcelasDoPagamento, valorNumerico);
        setPagamentos(atual => [...atual, {
            id: crypto.randomUUID(),
            metodo: metodoSelecionado,
            valor: Math.round((valorNumerico + acrescimo) * 100) / 100,
            ...(acrescimo > 0 ? { acrescimo } : {}),
            ...(metodoSelecionado === 'advance' && adiantamentoEscolhido ? { idAdiantamento: adiantamentoEscolhido } : {}),
            parcelas: metodoSelecionado === 'credit_card' || metodoSelecionado === 'store_credit' ? parcelasInput : 1,
            ...(metodoSelecionado === 'store_credit' ? { intervaloDias: intervaloPrazo, primeiroVencimento: primeiroVencimento || undefined } : {}),
            status: 'pending',
            createdAt: new Date(),
        }]);
        setValorInput('');
        setPrimeiroVencimento('');
        escolherMetodo(null);
    };

    const alterarStatus = (id: string, status: PaymentStatus) =>
        setPagamentos(atual => atual.map(p => (p.id === id ? { ...p, status } : p)));
    const removerPagamento = (id: string) => setPagamentos(atual => atual.filter(p => p.id !== id));

    const valorDigitado = numero(valorInput);
    const etapaAtual = !metodoSelecionado ? 0 : valorDigitado <= 0 ? 1 : 2;
    const metodos = (Object.keys(PAYMENT_METHOD_DETAILS) as PaymentMethodType[]).filter(m => m !== 'advance' || adiantamentos.length > 0);

    // Opções que dependem da forma: parcelas do crédito, a prazo ou qual sinal
    const opcoesDaForma = () => {
        if (metodoSelecionado === 'advance') {
            return (
                <Select placeholder="Qual sinal" style={{ width: '100%' }} value={adiantamentoEscolhido ?? undefined}
                    onChange={v => setAdiantamentoEscolhido(v ?? null)}
                    options={adiantamentos.map(a => ({
                        value: a.idAdiantamento,
                        label: `Nº ${a.idAdiantamento} · ${new Date(a.criadoEm).toLocaleDateString('pt-BR')} · disponível ${brl(saldoAdiantamento(a.idAdiantamento))}`,
                    }))} />
            );
        }
        if (metodoSelecionado === 'credit_card') {
            return (
                <Select style={{ width: '100%' }} value={parcelasInput} onChange={setParcelasInput} popupMatchSelectWidth={false}
                    options={Array.from({ length: 12 }, (_, i) => i + 1).map(n => {
                        const acr = acrescimoParcelamento(taxasVenda, 'CREDITO', n, valorDigitado);
                        return { value: n, label: `${n}x de ${brl((valorDigitado + acr) / n)} ${acr > 0 ? `(+ ${brl(acr)})` : '(sem juros)'}` };
                    })} />
            );
        }
        if (metodoSelecionado === 'store_credit') {
            if (!clienteId) return <Alert type="error" showIcon title="Identifique o cliente (F4) para vender a prazo." />;
            const s = situacaoCliente;
            return (
                <Flex vertical gap={6}>
                    <Flex gap={6} wrap>
                        <Select style={{ minWidth: 130, flex: 1 }} value={parcelasInput} onChange={setParcelasInput} popupMatchSelectWidth={false}
                            options={Array.from({ length: 12 }, (_, i) => i + 1).map(n => ({ value: n, label: `${n}x de ${brl(valorDigitado / n)}` }))} />
                        <Select style={{ width: 120 }} value={intervaloPrazo} onChange={setIntervaloPrazo}
                            options={[7, 10, 14, 15, 21, 28, 30, 45, 60].map(d => ({ value: d, label: `a cada ${d} dias` }))} />
                        <DatePicker format="DD/MM/YYYY" placeholder="1º vencimento" style={{ width: 140 }}
                            value={primeiroVencimento ? dayjs(primeiroVencimento) : null}
                            disabledDate={d => d.isBefore(dayjs(), 'day')}
                            onChange={d => setPrimeiroVencimento(d ? d.format('YYYY-MM-DD') : '')} />
                    </Flex>
                    {s && (
                        <Typography.Text type={s.bloqueado || s.qtdVencidas > 0 ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                            {s.bloqueado && <b>Cliente bloqueado para compras a prazo. </b>}
                            Em aberto: <b>{brl(s.emAberto)}</b>
                            {s.qtdVencidas > 0 && <> · <b>{s.qtdVencidas} vencida(s)</b> ({brl(s.vencido)})</>}
                            {s.limite !== null && <> · Disponível: <b>{brl(s.disponivel ?? 0)}</b> de {brl(s.limite)}</>}
                        </Typography.Text>
                    )}
                </Flex>
            );
        }
        return null;
    };

    // Desconto que a forma de pagamento permite sem autorização (taxa da maquininha menor que a embutida no preço).
    // Reage ao pagamento: a forma escolhida agora ou, sem forma escolhida, a única forma já lançada.
    const ativosOuPendentes = pagamentos.filter(p => p.status !== 'cancelled' && p.status !== 'failed');
    const formaDoDesconto: PaymentMethodType | null = metodoSelecionado
        ?? (ativosOuPendentes.length > 0 && ativosOuPendentes.every(p => p.metodo === ativosOuPendentes[0].metodo) ? ativosOuPendentes[0].metodo : null);
    const pctForma = formaDoDesconto ? descontoDaForma(taxasVenda, FORMA_POR_METODO[formaDoDesconto]) : 0;
    const rotuloFormaDesconto = formaDoDesconto ? PAYMENT_METHOD_DETAILS[formaDoDesconto].label : '';
    const descontoFormaAplicado = pctForma > 0 && tipoDesconto === 'porcent' && Math.abs(descontoValor - pctForma) < 0.001;
    const aplicarDescontoForma = () => { setTipoDesconto('porcent'); setDescontoValor(pctForma); setUsuarioInteragiu(false); };
    const removerDesconto = () => { setDescontoValor(0); setTipoDesconto('real'); setUsuarioInteragiu(false); };
    const sugestaoDescontoForma = pctForma > 0 && (
        <Flex justify="space-between" align="center" gap={6} wrap
            style={{ margin: '4px 0', padding: '4px 8px', borderRadius: token.borderRadius, background: token.colorSuccessBg, border: `1px solid ${token.colorSuccessBorder}` }}>
            <Typography.Text style={{ fontSize: 12 }}>
                {descontoFormaAplicado
                    ? <>Desconto do {rotuloFormaDesconto} aplicado ({pctForma.toFixed(2)}%)</>
                    : <>{rotuloFormaDesconto} permite <b>{brl(total * pctForma / 100)}</b> de desconto ({pctForma.toFixed(2)}%)</>}
            </Typography.Text>
            {descontoFormaAplicado
                ? <Button size="small" onClick={removerDesconto}>Remover</Button>
                : <Button size="small" type="primary" onClick={aplicarDescontoForma}>Aplicar</Button>}
        </Flex>
    );

    // Frete: valor direto, por km (com mínimo e ida e volta) ou % da venda
    const calcularFrete = (f: typeof freteEdicao) => {
        if (f.modo === 'valor') return Math.max(0, Number(f.valor) || 0);
        if (f.modo === 'pct') return Math.round(total * (Number(f.pct) || 0)) / 100;
        const porKm = (Number(f.km) || 0) * (f.idaVolta ? 2 : 1) * (Number(f.valorKm) || 0);
        return porKm > 0 ? Math.round(Math.max(porKm, Number(f.minimo) || 0) * 100) / 100 : 0;
    };
    const freteCalculado = calcularFrete(freteEdicao);
    const abrirFrete = () => {
        setFreteEdicao({
            modo: 'valor', valor: frete || null, km: null, idaVolta: false, pct: null,
            valorKm: preferencias.freteValorKm || null, minimo: preferencias.freteMinimo || null,
        });
        setApoio('frete');
    };
    const aplicarFrete = () => {
        if (freteEdicao.modo === 'km') mudarPreferencia({ freteValorKm: Number(freteEdicao.valorKm) || 0, freteMinimo: Number(freteEdicao.minimo) || 0 });
        setFrete(Math.round(freteCalculado * 100) / 100);
        setUsuarioInteragiu(false);
        setApoio(null);
    };

    const notas = notasDoTroco(troco);
    const linhaTotal = (rotulo: string, valor: React.ReactNode, cor?: string) => (
        <Flex justify="space-between" align="baseline"><Typography.Text type="secondary">{rotulo}</Typography.Text><span style={{ color: cor, fontWeight: 600 }}>{valor}</span></Flex>
    );

    return (
        <Flex vertical style={{ height: '100%', minWidth: 0, background: token.colorBgContainer }}>
            <Flex align="center" gap={8} wrap style={{ padding: '8px 10px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Carrinho</Button>
                <Steps size="small" current={etapaAtual} style={{ flex: 1, minWidth: 220 }}
                    items={[{ title: 'Forma' }, { title: 'Valor' }, { title: 'Adicionar' }]} />
            </Flex>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 10 }}>
                <Flex vertical gap={10}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 6 }}>
                        {metodos.map(m => {
                            const selecionado = metodoSelecionado === m;
                            return (
                                <Button key={m} type={selecionado ? 'primary' : 'default'} disabled={!!metodoSelecionado && !selecionado}
                                    onClick={() => escolherMetodo(selecionado ? null : m)}
                                    style={{ height: 64, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: 20, lineHeight: 1 }}>{PAYMENT_METHOD_DETAILS[m].icon}</span>
                                    <span style={{ fontSize: 13 }}>{PAYMENT_METHOD_DETAILS[m].label}</span>
                                </Button>
                            );
                        })}
                    </div>

                    {metodoSelecionado && (
                        <Flex vertical gap={8} style={{ padding: 10, border: `1px solid ${token.colorPrimaryBorder}`, borderRadius: token.borderRadiusLG, background: token.colorPrimaryBg }}>
                            <Flex justify="space-between" align="center" gap={8} wrap>
                                <Typography.Text strong>{PAYMENT_METHOD_DETAILS[metodoSelecionado].icon} {PAYMENT_METHOD_DETAILS[metodoSelecionado].label}</Typography.Text>
                                <Button size="small" type="link" icon={<SwapOutlined />} onClick={() => escolherMetodo(null)}>Trocar forma</Button>
                            </Flex>
                            <Flex gap={10} wrap align="flex-start">
                                <Flex vertical gap={6} style={{ flex: '1 1 200px', minWidth: 0 }}>
                                    <Input ref={valorRef} size="large" prefix="R$" value={valorInput} placeholder="0,00" inputMode="decimal"
                                        style={{ fontSize: 22, fontWeight: 600 }}
                                        onFocus={() => { if (!usuarioInteragiu) { setValorInput(''); setUsuarioInteragiu(true); } }}
                                        onChange={e => { if (/^[0-9]*[.,]?[0-9]*$/.test(e.target.value)) { setValorInput(e.target.value.replace(',', '.')); setUsuarioInteragiu(true); } }}
                                        onPressEnter={adicionarPagamento} />
                                    <Flex gap={6}>
                                        <Button block size="small" onClick={() => inserirValor(saldoRestante)}>Saldo todo</Button>
                                        <Button block size="small" onClick={() => inserirValor(saldoRestante / 2)}>Metade</Button>
                                    </Flex>
                                    {opcoesDaForma()}
                                </Flex>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gap: 4 }}>
                                    {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', 'C'].map(t => (
                                        <Button key={t} onClick={() => teclar(t)} danger={t === 'C'} style={{ height: 36, padding: 0 }}>{t}</Button>
                                    ))}
                                </div>
                            </Flex>
                            {metodoSelecionado === 'credit_card' && taxasVenda && parcelasInput > taxasVenda.parcelasSemJuros && (
                                <Alert type="warning" showIcon
                                    title={`Acima de ${taxasVenda.parcelasSemJuros}x sem juros: acréscimo de ${ajusteDaForma(taxasVenda, 'CREDITO', parcelasInput).toFixed(2)}% (taxa da maquininha em ${parcelasInput}x).`} />
                            )}
                            <Button type="primary" size="large" block disabled={valorDigitado <= 0} onClick={adicionarPagamento}>Adicionar pagamento (Enter)</Button>
                        </Flex>
                    )}

                    {pagamentos.length > 0 && (
                        <List size="small" bordered
                            header={<Flex justify="space-between"><Typography.Text strong>Pagamentos ({pagamentos.length})</Typography.Text><Tag color="success" style={{ margin: 0 }}>Pago {brl(totalPago)}</Tag></Flex>}
                            dataSource={pagamentos}
                            renderItem={(p, i) => {
                                const inativo = p.status === 'cancelled' || p.status === 'failed';
                                return (
                                    <List.Item style={{ opacity: inativo ? 0.5 : 1, gap: 8, flexWrap: 'wrap' }}>
                                        <Flex gap={8} align="center" style={{ flex: '1 1 160px', minWidth: 0 }}>
                                            <Tag style={{ margin: 0 }}>{i + 1}</Tag>
                                            <span style={{ fontSize: 16 }}>{PAYMENT_METHOD_DETAILS[p.metodo].icon}</span>
                                            <Flex vertical style={{ minWidth: 0 }}>
                                                <Typography.Text strong>{PAYMENT_METHOD_DETAILS[p.metodo].label} · {brl(p.valor)}</Typography.Text>
                                                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                                    {p.metodo === 'credit_card' ? `${p.parcelas}x${p.acrescimo ? `, + ${brl(p.acrescimo)} de acréscimo` : ''}`
                                                        : p.metodo === 'advance' ? `Sinal Nº ${p.idAdiantamento}`
                                                            : p.metodo === 'store_credit' ? `${p.parcelas}x a cada ${p.intervaloDias || 30} dias${p.primeiroVencimento ? `, 1ª em ${dataBr(p.primeiroVencimento)}` : ''}`
                                                                : 'À vista'}
                                                </Typography.Text>
                                            </Flex>
                                        </Flex>
                                        <Flex gap={4} align="center">
                                            <Select size="small" value={p.status} onChange={v => alterarStatus(p.id, v)} style={{ width: 128 }}
                                                options={(['pending', 'processing', 'paid', 'failed', 'cancelled'] as PaymentStatus[]).map(s => ({ value: s, label: STATUS_LABELS[s] }))} />
                                            {p.status === 'pending'
                                                ? <Tooltip title="Remover pagamento"><Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removerPagamento(p.id)} /></Tooltip>
                                                : <Tooltip title="Pagamento processado ou finalizado não pode ser removido"><Button size="small" type="text" disabled icon={<LockOutlined />} /></Tooltip>}
                                        </Flex>
                                    </List.Item>
                                );
                            }} />
                    )}
                    {pagamentos.some(p => p.status === 'pending') && (
                        <Alert type="info" showIcon title='Marque o pagamento como "Pago" quando confirmar o recebimento. Só pagamentos pagos ou em processamento contam no total.' />
                    )}
                </Flex>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 6, padding: '8px 10px', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                <Popover trigger="click" open={calculadoraAberta} onOpenChange={setCalculadoraAberta} title="Calculadora"
                    content={<Calculadora onUsar={metodoSelecionado ? v => { inserirValor(v); setCalculadoraAberta(false); } : undefined} />}>
                    <Button block icon={<CalculatorOutlined />}>Calculadora</Button>
                </Popover>
                <Badge dot={descontoCalculado > 0} style={{ display: 'block' }}>
                    <Button block icon={<PercentageOutlined />}
                        onClick={() => { setDescontoEdicao({ tipo: tipoDesconto, valor: descontoValor || null }); setApoio('desconto'); }}>Desconto</Button>
                </Badge>
                <Badge dot={frete > 0} style={{ display: 'block' }}>
                    <Button block icon={<TruckOutlined />} onClick={abrirFrete}>Frete</Button>
                </Badge>
                <Badge dot={!!observacao.trim()} style={{ display: 'block' }}>
                    <Button block icon={<EditOutlined />} onClick={() => setApoio('obs')}>Observações</Button>
                </Badge>
                <Button block icon={<FileTextOutlined />} onClick={() => setApoio('comprovante')}>Comprovante</Button>
                <Button block icon={<SettingOutlined />} onClick={() => setApoio('config')}>Configurações</Button>
            </div>

            <div style={{ padding: 10, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                {linhaTotal('Total da venda', brl(total))}
                {descontoCalculado > 0 && linhaTotal(descontoFormaAplicado ? `Desconto do ${rotuloFormaDesconto}` : 'Desconto', `- ${brl(descontoCalculado)}`, token.colorSuccess)}
                {sugestaoDescontoForma}
                {frete > 0 && linhaTotal('Frete', `+ ${brl(frete)}`, token.colorInfo)}
                {acrescimoTotal > 0 && linhaTotal('Acréscimo do parcelamento', `+ ${brl(acrescimoTotal)}`, token.colorWarning)}
                {totalPago > 0 && linhaTotal('Pago', brl(totalPago))}
                <Divider style={{ margin: '6px 0' }} />
                <Flex justify="space-between" align="center" gap={8} wrap>
                    {troco > 0 ? (
                        <Popover title="Sugestão de troco" content={
                            <Flex vertical gap={4}>
                                {Math.round(troco * 100) % 5 !== 0 && <Typography.Text type="warning" style={{ fontSize: 12 }}>Arredondado para R$ 0,05</Typography.Text>}
                                <Flex gap={4} wrap style={{ maxWidth: 240 }}>
                                    {notas.map(n => <Tag key={n.valor} color={n.nota ? 'green' : 'gold'}>{n.qtd}x {n.valor >= 1 ? `R$ ${n.valor}` : `${Math.round(n.valor * 100)}¢`}</Tag>)}
                                </Flex>
                            </Flex>
                        }>
                            <Typography.Text strong style={{ fontSize: 20, color: token.colorPrimary, cursor: 'help' }}>Troco {brl(troco)}</Typography.Text>
                        </Popover>
                    ) : (
                        <Typography.Text strong style={{ fontSize: 20, color: saldoRestante > 0 ? token.colorError : token.colorSuccess }}>
                            {saldoRestante > 0 ? `Faltam ${brl(saldoRestante)}` : 'Pago'}
                        </Typography.Text>
                    )}
                    <Button type="primary" size="large" icon={<CheckOutlined />} disabled={!podeConcluir} loading={isEnviando}
                        onClick={() => handleFinalizarVenda()} style={{ minWidth: 180, background: podeConcluir ? token.colorSuccess : undefined }}>
                        Concluir venda
                    </Button>
                </Flex>
            </div>

            <Modal open={apoio === 'desconto'} title="Desconto na venda" okText="Aplicar" cancelText="Cancelar" destroyOnHidden width={400}
                onCancel={() => setApoio(null)}
                onOk={() => {
                    const v = Number(descontoEdicao.valor) || 0;
                    const emReais = descontoEdicao.tipo === 'porcent' ? total * v / 100 : v;
                    if (v < 0 || emReais >= total) { message.warning('O desconto precisa ser menor que o total da venda.'); return; }
                    setTipoDesconto(descontoEdicao.tipo); setDescontoValor(v); setUsuarioInteragiu(false); setApoio(null);
                }}
                footer={(_, { OkBtn, CancelBtn }) => (
                    <Flex justify="space-between">
                        {descontoCalculado > 0
                            ? <Button onClick={() => { setDescontoValor(0); setTipoDesconto('real'); setUsuarioInteragiu(false); setApoio(null); }}>Remover desconto</Button>
                            : <span />}
                        <Flex gap={8}><CancelBtn /><OkBtn /></Flex>
                    </Flex>
                )}>
                <Flex vertical gap={8}>
                    <Segmented block value={descontoEdicao.tipo} onChange={v => setDescontoEdicao(d => ({ ...d, tipo: v as 'real' | 'porcent' }))}
                        options={[{ value: 'real', label: 'Em reais (R$)' }, { value: 'porcent', label: 'Em porcentagem (%)' }]} />
                    <InputNumber autoFocus style={{ width: '100%' }} min={0} step={descontoEdicao.tipo === 'porcent' ? 0.5 : 1} precision={2} decimalSeparator=","
                        prefix={descontoEdicao.tipo === 'porcent' ? '%' : 'R$'} value={descontoEdicao.valor}
                        onChange={v => setDescontoEdicao(d => ({ ...d, valor: v }))} />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Total {brl(total)}{descontoEdicao.valor ? ` → ${brl(total - (descontoEdicao.tipo === 'porcent' ? total * Number(descontoEdicao.valor) / 100 : Number(descontoEdicao.valor)))}` : ''}.
                        Acima do limite da loja, a venda pede autorização com senha ao concluir.
                    </Typography.Text>
                </Flex>
            </Modal>

            <Modal open={apoio === 'frete'} title="Frete da venda" okText={freteCalculado > 0 ? `Aplicar ${brl(freteCalculado)}` : 'Aplicar'} cancelText="Cancelar"
                destroyOnHidden width={420} onCancel={() => setApoio(null)} onOk={aplicarFrete}
                footer={(_, { OkBtn, CancelBtn }) => (
                    <Flex justify="space-between">
                        {frete > 0 ? <Button onClick={() => { setFrete(0); setUsuarioInteragiu(false); setApoio(null); }}>Remover frete</Button> : <span />}
                        <Flex gap={8}><CancelBtn /><OkBtn /></Flex>
                    </Flex>
                )}>
                <Flex vertical gap={10}>
                    <Segmented block value={freteEdicao.modo} onChange={v => setFreteEdicao(f => ({ ...f, modo: v as 'valor' | 'km' | 'pct' }))}
                        options={[{ value: 'valor', label: 'Valor' }, { value: 'km', label: 'Por km' }, { value: 'pct', label: '% da venda' }]} />
                    {freteEdicao.modo === 'valor' && (
                        <InputNumber autoFocus style={{ width: '100%' }} min={0} precision={2} decimalSeparator="," prefix="R$" placeholder="Valor do frete"
                            value={freteEdicao.valor} onChange={v => setFreteEdicao(f => ({ ...f, valor: v }))} onPressEnter={aplicarFrete} />
                    )}
                    {freteEdicao.modo === 'km' && (
                        <>
                            <Flex gap={8}>
                                <InputNumber autoFocus style={{ flex: 1 }} min={0} precision={1} decimalSeparator="," suffix="km" placeholder="Distância"
                                    value={freteEdicao.km} onChange={v => setFreteEdicao(f => ({ ...f, km: v }))} />
                                <InputNumber style={{ flex: 1 }} min={0} precision={2} decimalSeparator="," prefix="R$" suffix="/km" placeholder="Valor do km"
                                    value={freteEdicao.valorKm} onChange={v => setFreteEdicao(f => ({ ...f, valorKm: v }))} />
                            </Flex>
                            <Flex gap={8} align="center" justify="space-between" wrap>
                                <Checkbox checked={freteEdicao.idaVolta} onChange={e => setFreteEdicao(f => ({ ...f, idaVolta: e.target.checked }))}>Cobrar ida e volta</Checkbox>
                                <InputNumber style={{ width: 170 }} min={0} precision={2} decimalSeparator="," prefix="Mín. R$" placeholder="Frete mínimo"
                                    value={freteEdicao.minimo} onChange={v => setFreteEdicao(f => ({ ...f, minimo: v }))} />
                            </Flex>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>O valor do km e o mínimo ficam lembrados neste computador.</Typography.Text>
                        </>
                    )}
                    {freteEdicao.modo === 'pct' && (
                        <InputNumber autoFocus style={{ width: '100%' }} min={0} max={100} precision={2} decimalSeparator="," suffix="%" placeholder="Percentual sobre os produtos"
                            value={freteEdicao.pct} onChange={v => setFreteEdicao(f => ({ ...f, pct: v }))} onPressEnter={aplicarFrete} />
                    )}
                    <Flex justify="space-between" style={{ padding: '6px 10px', borderRadius: token.borderRadius, background: token.colorFillTertiary }}>
                        <span>Frete</span><b>{brl(freteCalculado)}</b>
                    </Flex>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        O frete soma no total a pagar sem mudar o preço dos produtos. Na nota fiscal entra como outras despesas.
                    </Typography.Text>
                </Flex>
            </Modal>

            <Modal open={apoio === 'obs'} title="Observações da venda" okText="Salvar" cancelText="Cancelar" destroyOnHidden
                onCancel={() => setApoio(null)} onOk={() => setApoio(null)}>
                <Input.TextArea autoFocus rows={4} maxLength={255} showCount value={observacao} onChange={e => setObservacao(e.target.value)}
                    placeholder="Ex.: entregar na obra, retirar amanhã, embalar para presente..." />
            </Modal>

            <Modal open={apoio === 'comprovante'} title="Comprovante da última venda" footer={null} destroyOnHidden onCancel={() => setApoio(null)}>
                {(() => {
                    const ultimo = ultimoComprovante();
                    if (!ultimo) return <Typography.Text type="secondary">Nenhuma venda concluída neste computador ainda.</Typography.Text>;
                    const texto = textoComprovante(ultimo);
                    return (
                        <Flex vertical gap={8}>
                            <Typography.Paragraph style={{ whiteSpace: 'pre-line', margin: 0, padding: 8, background: token.colorFillTertiary, borderRadius: token.borderRadius, fontSize: 12 }}>
                                {texto}
                            </Typography.Paragraph>
                            <Button icon={<PrinterOutlined />} onClick={() => imprimirExtratoElgin(ultimo)}>Reimprimir</Button>
                            <Button icon={<WhatsAppOutlined />} href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank">Enviar por WhatsApp</Button>
                            <Button icon={<MailOutlined />} href={`mailto:?subject=${encodeURIComponent(`Venda Nº ${ultimo.numero}`)}&body=${encodeURIComponent(texto)}`}>Enviar por e-mail</Button>
                        </Flex>
                    );
                })()}
            </Modal>

            <Modal open={apoio === 'config'} title="Configurações do PDV" footer={null} destroyOnHidden onCancel={() => setApoio(null)}>
                <Flex vertical gap={10}>
                    <Flex justify="space-between" align="center">
                        <span>Imprimir o comprovante ao concluir</span>
                        <Switch checked={preferencias.impressaoAutomatica} onChange={v => mudarPreferencia({ impressaoAutomatica: v })} />
                    </Flex>
                    <Flex justify="space-between" align="center">
                        <span>Som de confirmação da venda</span>
                        <Switch checked={preferencias.somConfirmacao} onChange={v => mudarPreferencia({ somConfirmacao: v })} />
                    </Flex>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Vale para este computador.</Typography.Text>
                </Flex>
            </Modal>

            <Modal open={!!pedidoAutorizacao} title="Autorização necessária" okText="Autorizar e concluir" cancelText="Voltar" destroyOnHidden
                onCancel={() => fecharAutorizacao(null)}
                onOk={() => formAutorizacao.validateFields().then(v => fecharAutorizacao({ nome: v.nome.trim(), senha: v.senha, motivo: v.motivo.trim() })).catch(() => undefined)}>
                {pedidoAutorizacao?.senhaIncorreta && <Alert type="error" showIcon title="Senha incorreta." style={{ marginBottom: 8 }} />}
                <Alert type="warning" style={{ marginBottom: 12 }} title={<Flex vertical>{pedidoAutorizacao?.motivos.map((m, i) => <span key={i}>{m}</span>)}</Flex>} />
                <Form form={formAutorizacao} layout="vertical" autoComplete="off">
                    <Form.Item name="nome" label="Quem autoriza" rules={[{ required: true, whitespace: true, message: 'Informe quem autoriza.' }]}>
                        <Input autoFocus />
                    </Form.Item>
                    <Form.Item name="senha" label="Senha de autorização" rules={[{ required: true, message: 'Informe a senha.' }]}>
                        <Input.Password autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item name="motivo" label="Motivo" rules={[{ required: true, whitespace: true, message: 'Informe o motivo.' }]}>
                        <Input placeholder="Ex.: cliente antigo, queima de estoque" />
                    </Form.Item>
                </Form>
            </Modal>
        </Flex>
    );
};
