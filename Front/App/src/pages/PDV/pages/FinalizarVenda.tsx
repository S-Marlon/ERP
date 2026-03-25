import React, { useState } from 'react';
import './FinalizarVenda.css';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Fieldset from '../../../components/ui/Fieldset/Fieldset';
import {imprimirExtratoElgin} from '../../../utils/printService';
import { salesService, SalePayload } from '../services/salesService';
import Swal from 'sweetalert2';
// import {ItemVenda} from '../../../utils/printService'




export interface ItemVenda {
    id: string | number;
    name: string;
    quantity: number;
    salePrice: number;
    costPrice?: number;
    price: number;     // ADICIONE ESTA LINHA para satisfazer o erro
}

export type PaymentMethodType = 
  | 'money' 
  | 'credit_card' 
  | 'debit_card' 
  | 'pix' 
  | 'bank_transfer' 
  | 'store_credit'; // O seu 'Crediário'

  export const PAYMENT_METHOD_DETAILS: Record<PaymentMethodType, { label: string; icon: string }> = {
    money: { 
        label: 'Dinheiro', 
        icon: '💵' 
    },
    pix: { 
        label: 'PIX', 
        icon: '💠' 
    },
    credit_card: { 
        label: 'Cartão Crédito', 
        icon: '💳' 
    },
    debit_card: { 
        label: 'Cartão Débito', 
        icon: '🏦' 
    },
    store_credit: { 
        label: 'Crediário', 
        icon: '🎫' 
    },
    bank_transfer: { 
        label: 'Transferência', 
        icon: '🏛️' 
    }
};

// 1. Defina o tipo técnico (Seguro e sem acentos)
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';

// 2. Crie um mapeamento de tradução (Dicionário)
export const STATUS_LABELS: Record<PaymentStatus, string> = {
    pending: 'Pendente',
    processing: 'Processando',
    paid: 'Pago',
    failed: 'Falha',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado'
};

export interface Pagamento {
    id: string;               // UUID para controle de lista (key no React)
    metodo: PaymentMethodType; // Tipagem estrita em vez de string genérica
    valor: number;            // Valor bruto
    valorLiquido?: number;    // Valor descontando taxas (útil para o financeiro)
    taxaAplicada?: number;    // % ou valor fixo da taxa da maquininha
    parcelas: number;         // Padrão 1
    status: PaymentStatus;
    
    // Metadados para Cartão/PIX
    detalhes?: {
        bandeira?: string;    // Visa, Master, etc.
        authCode?: string;    // Código de autorização da maquininha/TEF
        nsu?: string;         // Número sequencial único
        chavePix?: string;    // ID da transação PIX
    };

    createdAt: Date;          // Timestamp do recebimento
    updatedAt?: Date;         // Para quando um status muda (ex: de pendente para pago)
}



interface FinalizarVendaProps {
    onBack: () => void;
    total: number;
    cliente: string;
itens: ItemVenda[]; // <-- Adicione esta linha
}

export const FinalizarVenda: React.FC<FinalizarVendaProps> = ({ onBack, total, cliente, itens }) => {

    const [isEnviando, setIsEnviando] = useState(false);
    const [descontoValor, setDescontoValor] = useState(0); // O valor digitado no input
    const [tipoDesconto, setTipoDesconto] = useState<'real' | 'porcent'>('real');
    const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
    const [statusPagamento, setStatusPagamento] = useState<PaymentStatus>('Pendente');
const [metodoSelecionado, setMetodoSelecionado] = useState<PaymentMethodType | null>(null);
    const [valorInput, setValorInput] = useState(0);
    const [parcelasInput, setParcelasInput] = useState(1);



    // Mapeamento de Cores para o Badge de Status
const STATUS_COLORS: Record<PaymentStatus, "warning" | "info" | "success" | "error" | "secondary"> = {
    pending: 'warning',
    processing: 'info',
    paid: 'success',
    failed: 'error',
    cancelled: 'secondary',
    refunded: 'error'
};

// Mapeamento para o Select (Exibição Amigável)
const STATUS_OPTIONS = [
    { value: 'pending', label: '⏳ Pendente' },
    { value: 'processing', label: '🔄 Processando' },
    { value: 'paid', label: '✅ Pago' },
    { value: 'failed', label: '❌ Falha' },
    { value: 'cancelled', label: '🚫 Cancelado' },
];

    // cliente e total já vêm do pai via props (comentário duplicado eliminado)

    // Cálculos de Totais
 const totalPago = pagamentos
    .filter(p => p.status === 'paid' || p.status === 'processing')
    .reduce((acc, p) => acc + p.valor, 0);



    const [showChangeDetails, setShowChangeDetails] = useState(false);

    // Cálculo do desconto real aplicado ao total
    const descontoCalculado = tipoDesconto === 'porcent'
        ? (total * descontoValor) / 100
        : descontoValor;

    const totalLiquido = total - descontoCalculado;
    const saldoRestante = Math.max(0, Number((totalLiquido - totalPago).toFixed(2)));
    const troco = totalPago > totalLiquido ? totalPago - totalLiquido : 0;

    const [showDiscount, setShowDiscount] = useState(false);
    // Estados para a Trava
    const [autorizado, setAutorizado] = useState(false);
    const [pedindoSenha, setPedindoSenha] = useState(false);
    const [senhaGerente, setSenhaGerente] = useState("");


    const alterarStatusPagamento = (index: number, novoStatus: PaymentStatus) => {
        const novosPagamentos = [...pagamentos];
        novosPagamentos[index].status = novoStatus;
        setPagamentos(novosPagamentos);
    };

    const LIMITE_VENDEDOR_PORCENT = 4; // 10% de autonomia



    // Regra: se o desconto for > limite e não estiver autorizado, bloqueia
    // utiliza o total informado pelo pai (já líquido de imposto, se houver)
    const descontoExcedido = (descontoCalculado / total) * 100 > LIMITE_VENDEDOR_PORCENT;
    const precisaBloquear = descontoExcedido && !autorizado;

    const validarGerente = () => {
        if (senhaGerente === "1234") { // Simulação de senha
            setAutorizado(true);
            setPedindoSenha(false);
        } else {
            alert("Senha Inválida!");
        }
    };



const handleFinalizarVenda = async () => {
    if (isEnviando) return;
    setIsEnviando(true);

    // 1. Cálculos de métricas (Snapshots)
    const totalCusto = itens.reduce((acc, item) => acc + ((item.costPrice || 0) * item.quantity), 0);
    const lucroNominal = totalLiquido - totalCusto;
    const percentualLucro = totalLiquido > 0 ? (lucroNominal / totalLiquido) * 100 : 0;

    console.log("📊 Métricas da Venda:", { totalCusto, lucroNominal, percentualLucro });

    // 2. Montagem do Payload completo para o BI (Business Intelligence)
    const vendaCompleta: SalePayload = {
        data: new Date().toISOString(),
        clienteNome: cliente || "CONSUMIDOR",
        totalBruto: total,
        totalDesconto: descontoCalculado,
        totalLiquido: totalLiquido,
        totalCusto: totalCusto,
        lucroNominal: lucroNominal,
        percentualLucro: Number(percentualLucro.toFixed(2)),
        itens: itens.map(item => ({
            productId: item.id,
            nome: item.name,
            quantidade: item.quantity,
            precoVenda: item.salePrice,
            precoCusto: item.costPrice || 0, // GARANTE O CUSTO ATUAL
            subtotal: item.quantity * item.salePrice,
            lucroUnitario: item.salePrice - (item.costPrice || 0)
        })),
        pagamentos: pagamentos
            .filter(p => p.status === 'Pago' || p.status === 'Processando')
            .map(p => ({
                metodo: p.metodo,
                valor: p.valor,
                parcelas: p.parcelas || 1
            }))
    };


    console.log("🚀 Payload Final da Venda:", vendaCompleta);
    console.table(vendaCompleta.itens); // Isso mostra os itens em uma tabela linda no console!

    // // 🔥 DISPARA O LOADING DO SWAL IMEDIATAMENTE
    // Swal.fire({
    //     title: 'Processando Venda',
    //     text: 'Aguarde um momento...',
    //     allowOutsideClick: false,
    //     showConfirmButton: false,
    //     didOpen: () => {
    //         Swal.showLoading();
    //     }
    // });

     // 4. Impressão Física
        imprimirExtratoElgin({
            cliente: vendaCompleta.clienteNome,
            itens: itens,
            total: totalLiquido,
            pagamentos: vendaCompleta.pagamentos,
            troco: troco
        });

    // try {

    //     console.log("⏳ Enviando...");
    //     // 3. Persistência no Banco de Dados
    //     await salesService.saveVenda(vendaCompleta);

    //     // ✅ RESPOSTA DE SUCESSO
    // await Swal.fire({
    //     icon: 'success',
    //     title: 'Venda Finalizada!',
    //     text: `O valor de R$ ${totalLiquido.toFixed(2)} foi registrado. <br> Imprimindo Cupom Fiscal...`,
    //     confirmButtonColor: '#28a745',
    //     timer: 3000
    // });

    //     // 4. Impressão Física
    //     imprimirExtratoElgin({
    //         cliente: vendaCompleta.clienteNome,
    //         itens: itens,
    //         total: totalLiquido,
    //         pagamentos: vendaCompleta.pagamentos,
    //         troco: troco
    //     });

    //     alert("Venda finalizada com sucesso! Estoque atualizado e métricas registradas.");
    //     onBack(); 
    // } catch (error: any) {
    //     // ❌ RESPOSTA DE ERRO
    // Swal.fire({
    //     icon: 'error',
    //     title: 'Erro ao salvar',
    //     text: error.message || 'Servidor offline ou falha na rede.',
    //     confirmButtonColor: '#d33'
    // });

    // } finally {
    //     setIsEnviando(false);
    // }
};



   // --- RENDERIZAÇÃO DO PARCELAMENTO ATUALIZADA ---
  const renderParcelamento = () => {
    if (metodoSelecionado !== 'credit_card') return null;
    
    const opcoes = [];
    for (let i = 1; i <= 12; i++) {
        const valorParcela = valorInput / i;
        opcoes.push(
            <option key={i} value={i}>
                {i}x de R$ {valorParcela.toFixed(2)} {i > 4 ? '(c/ juros)' : '(s/ juros)'}
            </option>
        );
    }

    return (
        <div className="parcelas-group">
            <label>Parcelamento:</label>
            <select 
                value={parcelasInput} 
                onChange={(e) => setParcelasInput(Number(e.target.value))}
                className="select-parcelas"
            >
                {opcoes}
            </select>
        </div>
    );
};

    // --- REGRA DE NEGÓCIO: CALCULADORA DE TROCO ---
    const calcularNotasTroco = (valor: number) => {
        if (valor <= 0) return null;

        // Lista sem a moeda de 0.01
        const unidades = [
            { v: 100, t: 'nota' }, { v: 50, t: 'nota' }, { v: 20, t: 'nota' },
            { v: 10, t: 'nota' }, { v: 5, t: 'nota' }, { v: 2, t: 'nota' },
            { v: 1, t: 'moeda' }, { v: 0.5, t: 'moeda' }, { v: 0.25, t: 'moeda' },
            { v: 0.1, t: 'moeda' }, { v: 0.05, t: 'moeda' }
        ];

        // Converte para centavos
        let restoCentavos = Math.round(valor * 100);

        // REGRA DE NEGÓCIO: Se sobrar 1, 2, 3 ou 4 centavos, arredondamos para 5 centavos
        // para garantir que o troco seja fisicamente possível.
        const sobraFinal = restoCentavos % 5;
        if (sobraFinal > 0) {
            restoCentavos = restoCentavos + (5 - sobraFinal);
        }

        const resultado: string[] = [];

        unidades.forEach(unidade => {
            const valorUnidadeCentavos = Math.round(unidade.v * 100);
            const qtd = Math.floor(restoCentavos / valorUnidadeCentavos);

            if (qtd > 0) {
                if (unidade.t === 'nota') {
                    resultado.push(`${qtd}x Nota de R$ ${unidade.v}`);
                } else {
                    const label = unidade.v >= 1 ? `R$ ${unidade.v}` : `${unidade.v * 100}¢`;
                    resultado.push(`${qtd}x Moeda de ${label}`);
                }
                restoCentavos %= valorUnidadeCentavos;
            }
        });

        return resultado;
    };

    const adicionarPagamento = () => {
        if (valorInput <= 0 || !metodoSelecionado) return;

        const novoPagamento: Pagamento = {
            id: crypto.randomUUID(), // Melhor que index
            metodo: metodoSelecionado,
            valor: valorInput,
            parcelas: metodoSelecionado === 'credit_card' ? parcelasInput : 1,
            status: 'paid', // Como é PDV físico, geralmente cai como Pago direto
            createdAt: new Date(),
        };

        setPagamentos([...pagamentos, novoPagamento]);
        setValorInput(0);
        setParcelasInput(1);
        setMetodoSelecionado(null);
    };

    const removerPagamento = (index: number) => {
        setPagamentos(pagamentos.filter((_, i) => i !== index));
    };

    const etapaAtual = !metodoSelecionado ? 1 : (valorInput <= 0 ? 2 : 3);
    const [passoEmFoco, setPassoEmFoco] = useState<number | null>(null);

    return (
        // <div className="checkout-overlay">
        //     {/* MODAL DE SENHA DO GERENTE */}
        //     {pedindoSenha && (
        //         <div className="manager-lock-overlay">
        //             <div className="manager-lock-card">
        //                 <span className="icon">🛡️</span>
        //                 <h3>Autorização</h3>
        //                 <input
        //                     autoFocus
        //                     type="password"
        //                     placeholder="Senha do Gerente"
        //                     value={senhaGerente}
        //                     onChange={(e) => setSenhaGerente(e.target.value)}
        //                     onKeyDown={(e) => e.key === 'Enter' && validarGerente()}
        //                 />
        //                 <button onClick={validarGerente}>Liberar (Enter)</button>
        //                 <button className="btn-cancel" onClick={() => setPedindoSenha(false)}>Cancelar</button>
        //             </div>
        //         </div>
        //     )}

        <div className="checkout-container">

            {/* identifica o cliente em cima */}
            <div className="checkout-header">
                {/* <strong>Cliente: {cliente}</strong>


                <p>
                    VALOR TOTAL: <strong>R$ {total.toFixed(2)}</strong>
                </p>
                <p>
                    VALOR Pago: <strong>R$ {pagamentos.reduce((sum, p) => sum + p.valor, 0).toFixed(2)}</strong>
                </p> */}
       <div className="payment-steps-guide">
    <span 
        className={etapaAtual === 1 ? 'step-active' : 'step-done'}
        onMouseEnter={() => setPassoEmFoco(1)}
        onMouseLeave={() => setPassoEmFoco(null)}
    >
        {etapaAtual > 1 ? '✅' : '1.'} Escolha o método
    </span>

    <span className="step-arrow">→</span>

    <span 
        className={etapaAtual === 2 ? 'step-active' : (etapaAtual > 2 ? 'step-done' : 'step-pending')}
        onMouseEnter={() => setPassoEmFoco(2)}
        onMouseLeave={() => setPassoEmFoco(null)}
    >
        {etapaAtual > 2 ? '✅' : '2.'} Insira o valor
    </span>

    <span className="step-arrow">→</span>

    <span 
        className={etapaAtual === 3 ? 'step-active' : 'step-pending'}
        onMouseEnter={() => setPassoEmFoco(3)}
        onMouseLeave={() => setPassoEmFoco(null)}
    >
        3. Adicione o pagamento
    </span>
</div>
            </div>

            <div className="checkout-body">

                <div className="checkout-container">


                     {/* Guia de Passos */}
       

<div className={`payment-section ${metodoSelecionado ? 'method-selected' : ''}`}>

                    


                    <section className={`payment-methods ${metodoSelecionado ? 'section-locked' : ''} ${passoEmFoco === 1 ? 'step-highlight' : ''}`}>
                        <div className="payment-methods-header">
                            <h4>Métodos de Pagamento</h4>
                            {/* Botão para destravar a seleção */}

                        </div>

                        <div className="method-grid">
                            {Object.entries(PAYMENT_METHOD_DETAILS).map(([key, info]) => (
        <button
            key={key}
            // Verifica se o método selecionado é igual à chave técnica
            disabled={metodoSelecionado !== null && metodoSelecionado !== key} 
            className={metodoSelecionado === key ? 'active' : ''}
            onClick={() => setMetodoSelecionado(key as PaymentMethodType)}
        >
            {info.icon} {info.label}
        </button>
    ))}
                        </div>
                    </section>


                    <section className={`payment-details ${!metodoSelecionado ? 'section-locked' : ''} ${passoEmFoco === 2 ? 'step-highlight' : ''}`}>

                        <h4>
    {metodoSelecionado 
        ? `Pagamento: ${PAYMENT_METHOD_DETAILS[metodoSelecionado].label}` 
        : '(Selecione um método)'}
</h4>


                        {metodoSelecionado && (
                            <button
                                className="btn-change-method"
                                onClick={() => {
                                    setMetodoSelecionado(null); // Destrava a seção de métodos
                                    setValorInput(0);           // Zera o valor (O "IF" que você queria)
                                }}
                            >
                                🔄 Trocar Método
                            </button>
                        )}


                        <div className="add-payment">



                            <div className="input-group"> {/* Adicionei uma classe aqui */}

                                <button className='btn-add-saldo' onClick={() => setValorInput(saldoRestante)} disabled={!metodoSelecionado}>Saldo Restante Total →</button>

                                <input
                                    type="number"
                                    value={valorInput || ''}
                                    onChange={(e) => setValorInput(Number(e.target.value))}
                                    disabled={!metodoSelecionado}

                                    placeholder={`Valor à Pagar`}
                                />
                            </div>

                            {renderParcelamento()}
                        </div>
                    </section>
                </div>

                {/* Direita: PAGAMENTOS */}

                <Button onClick={adicionarPagamento} color='primary' className={`btn-add-payment ${valorInput ? '' : 'btn-disabled'} ${passoEmFoco === 3 ? 'step-highlight-btn' : ''}`}>Adicionar ↓ (Enter)</Button>


                {
                    pagamentos.length > 0 && (
                        
                      
<Fieldset variant='card'>
    {pagamentos.length > 0 && (
        <div className="payment-summary">
            <span>
                {`Pagamento${pagamentos.length > 1 ? 's' : ''} ${pagamentos.length === 1 ? 'Adicionado' : 'Adicionados'} (${pagamentos.length})`}
            </span>
            <Badge color="success">
                Valor PAGO: R$ {totalPago.toFixed(2)}
            </Badge>
        </div>
    )}

    <ul className="payment-history">
        {pagamentos.map((p, i) => {
            // Busca ícone e label amigável no dicionário global
            const infoMetodo = PAYMENT_METHOD_DETAILS[p.metodo];
            const isCanceladoOuFalha = p.status === 'cancelled' || p.status === 'failed';

            return (
                <li key={p.id || i} className={isCanceladoOuFalha ? 'payment-row-disabled' : ''}>
                    <div className="payment-main-info">
                        <span>{infoMetodo?.icon} <strong>{infoMetodo?.label}</strong></span>
                        <div className="payment-info">
                            <strong>R$ {p.valor.toFixed(2)}</strong>
                            <span className="payment-subtext">
                                {p.metodo === 'credit_card' ? ` (${p.parcelas}x)` : ' (À vista)'}
                            </span>
                        </div>
                    </div>

                    <div className="status-workflow-wrapper">
                        <select
    className={`select-status-inline status-select-${p.status}`}
    value={p.status}
    onChange={(e) => alterarStatusPagamento(i, e.target.value as PaymentStatus)}
>
    <option value="pending">⏳ Pendente</option>
    <option value="processing">🔄 Processando</option>
    <option value="paid">✅ Pago</option>
    <option value="failed">❌ Falha</option>
    <option value="cancelled">🚫 Cancelado</option>
</select>

                        {/* Regra de remoção: Agora checa contra o valor técnico 'pending' */}
                        {p.status === 'pending' ? (
                            <button 
                                className="btn-remove-line" 
                                onClick={() => removerPagamento(i)}
                                title="Remover pagamento"
                            >
                                ✕
                            </button>
                        ) : (
                            <button 
                                className="btn-lock-line" 
                                disabled 
                                title="Não é possível excluir um pagamento processado ou finalizado"
                            >
                                🔒
                            </button>
                        )}
                    </div>
                </li>
            );
        })}
    </ul>
</Fieldset>
                    )
                }


            </div>
        </div>


            <div className="checkout-footer">




                <section className="totals-panel">

                    <div className="status-box">
                        <div className={`status-item ${saldoRestante > 0 ? 'pending' : 'paid'}`}>
                            <small>Faltando </small>
                            <strong>R$ {saldoRestante.toFixed(2)}</strong>
                        </div>
                        {troco > 0 && (
                            <div
                                className={`status-item change changeWrapper`}
                                onMouseEnter={() => setShowChangeDetails(true)}
                                onMouseLeave={() => setShowChangeDetails(false)}
                                onClick={() => setShowChangeDetails(!showChangeDetails)} // Suporte para touch
                            >
                                <div className='statusItem change'>
                                    <small>Troco </small>
                                    <strong>R$ {troco.toFixed(2)}</strong>
                                </div>

                                {/* O BALÃO / TOOLTIP */}
                                {showChangeDetails && (
                                    <div className="change-calculator">
                                        <div className="change-display">
                                            <div className="change-header">
                                                <span>Sugestão de Notas</span>
                                                {(Math.round(troco * 100) % 5 !== 0) && (
                                                    <span className="rounding-alert">
                                                        Arredondado p/ R$ 0,05
                                                    </span>
                                                )}
                                            </div>



                                            <div className="change-details-grid">
                                                {calcularNotasTroco(troco)?.map((item, i) => {
                                                    // Pega apenas o número (ex: 100, 50, 0.5) para a cor
                                                    const isNota = item.includes("Nota");


                                                    // Dentro do seu .map no calcularNotasTroco
                                                    const valorNumerico = item.replace(/[^0-9,.]/g, '').replace(',', '.');
                                                    // Troca o ponto por hífen para o CSS não bugar (ex: 0.5 vira 0-5)
                                                    const classeCSS = valorNumerico.replace('.', '-');
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`change-unit-item ${isNota ? 'tipo-nota' : 'tipo-moeda'} v-${classeCSS}`}
                                                        >
                                                            <span className="unit-label">{item.split(' de ')[1] || item}</span>
                                                            <span className="unit-qty">{item.split('x')[0]}x</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        {/* Setinha do balão */}
                                        <div className="tooltip-arrow"></div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>


                </section>


                <button
                    className="btn-confirm-sale"
                    disabled={totalPago < totalLiquido}
onClick={handleFinalizarVenda}                >

                    {precisaBloquear ? "AGUARDANDO GERENTE" : "CONCLUIR VENDA .(F5)"}
                </button>
            </div>


         </div>


    );
};