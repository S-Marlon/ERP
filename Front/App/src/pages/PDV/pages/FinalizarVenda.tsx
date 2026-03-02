import React, { useState } from 'react';
import './FinalizarVenda.css';
import Badge from '../../../components/ui/Badge/Badge';

interface Pagamento {
    metodo: string;
    valor: number;
    parcelas?: number;
}

type PaymentStatus = 'Pendente' | 'Processando' | 'Pago' | 'Falha' | 'Cancelado' | 'Reembolsado';

interface FinalizarVendaProps {
    onBack: () => void;
    total: number;
    cliente: string;
}

export const FinalizarVenda: React.FC<FinalizarVendaProps> = ({ onBack, total, cliente }) => {
    const [descontoValor, setDescontoValor] = useState(0); // O valor digitado no input
    const [tipoDesconto, setTipoDesconto] = useState<'real' | 'porcent'>('real');
    const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
    const [statusPagamento, setStatusPagamento] = useState<PaymentStatus>('Pendente');
    const [metodoSelecionado, setMetodoSelecionado] = useState('Dinheiro');
    const [valorInput, setValorInput] = useState(0);
    const [parcelasInput, setParcelasInput] = useState(1);


    // cliente e total já vêm do pai via props (comentário duplicado eliminado)

    // Cálculos de Totais
    const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);

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

    // --- REGRA DE NEGÓCIO: PARCELAMENTO ---
    const renderParcelamento = () => {
        if (!metodoSelecionado.includes('Cartão')) return null;

        const opcoes = [];
        for (let i = 1; i <= 12; i++) {
            const valorParcela = valorInput / i;
            const juros = i > 4 ? " (c/ juros)" : " (s/ juros)";
            opcoes.push(
                <option key={i} value={i}>
                    {i}x de R$ {valorParcela.toFixed(2)} {juros}
                </option>
            );
        }
        return (
            <div className="parcelas-select">
                <label>Parcelas:</label>
                <select value={parcelasInput} onChange={(e) => setParcelasInput(Number(e.target.value))}>
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
        if (valorInput <= 0) return;
        setPagamentos([...pagamentos, {
            metodo: metodoSelecionado,
            valor: valorInput,
            parcelas: metodoSelecionado.includes('Cartão') ? parcelasInput : undefined
        }]);
        setValorInput(0);
        setParcelasInput(1);
    };

    const removerPagamento = (index: number) => {
        setPagamentos(pagamentos.filter((_, i) => i !== index));
    };

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
            <div className="checkout-header" style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                <strong>Cliente: {cliente}</strong>

                <button
                    className="btn-cancel-sale"
                    onClick={onBack}
                >
                    CANCELAR PAGAMENTO
                </button>
            </div>

            <div className="checkout-body">



                {/* ESQUERDA: PAGAMENTOS */}
                <section className="payment-methods">
                    <h4>Métodos de Pagamento</h4>
                    <div className="method-grid">
                        {['Dinheiro 💵', 'Cartão Crédito 💳', 'Cartão Débito 💳', 'PIX 💠', 'Crediário 🎫'].map(m => (
                            <button
                                key={m}
                                className={metodoSelecionado === m ? 'active' : ''}
                                onClick={() => setMetodoSelecionado(m)}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    <div className="add-payment">
                        <button onClick={() => console.log('hab')}>Saldo Restante Total</button>

                        <input
                            type="number"
                            value={valorInput || ''}
                            onChange={(e) => setValorInput(Number(e.target.value))}
                            placeholder={`Valor em ${metodoSelecionado}`}
                        />
                        <button onClick={adicionarPagamento}>Adicionar (Enter)</button>
                    </div>

                    <ul className="payment-history">
                        {pagamentos.map((p, i) => (
                            <li key={i}>
                                {p.metodo}: <strong>R$ {p.valor.toFixed(2)}</strong>
                                <Badge color="success" style={{ marginLeft: '8px' }}>
                                    {p.parcelas ? `${p.parcelas}x` : 'À vista'}
                                </Badge>

                                <Badge> Status: {statusPagamento}</Badge>
                                <button onClick={() => removerPagamento(i)}>✕</button>
                            </li>
                        ))}
                    </ul>

                    {renderParcelamento()}
                </section>


            </div>


            <div className="checkout-footer">
                <div className="accordion-section">
                    <button
                        className="accordion-trigger"
                        onClick={() => setShowDiscount(!showDiscount)}
                    >
                        <span>Aplicar Desconto</span>
                        <span style={{ marginLeft: '8px' }}>
                            <Badge color="warning">
                                aplicado: {descontoCalculado > 0 ? `R$ ${descontoCalculado.toFixed(2)}` : 'Nenhum'}
                            </Badge>
                        </span>
                        <span>{showDiscount ? '▼' : '▲'}</span>
                    </button>

                    <div className={`coupon-and-discount ${showDiscount ? 'open' : ''}`}>
                        <div className="accordion-content">




                            <div className={`total-row discount-area ${precisaBloquear ? 'locked' : ''}`}>
                                <div className="discount-label">
                                    <span>Desconto</span>

                                    {precisaBloquear && <span className="lock-badge">BLOQUEADO</span>}

                                    <div className="toggle-group">
                                        <button
                                            className={tipoDesconto === 'real' ? 'active' : ''}
                                            onClick={() => setTipoDesconto('real')}
                                        >R$</button>
                                        <button
                                            className={tipoDesconto === 'porcent' ? 'active' : ''}
                                            onClick={() => setTipoDesconto('porcent')}
                                        >%</button>
                                    </div>
                                </div>

                                <div className="discount-input-wrapper">
                                    <input
                                        type="number"
                                        value={descontoValor || ''}
                                        onChange={(e) => {
                                            setDescontoValor(Number(e.target.value));
                                            if (autorizado) setAutorizado(false); // Reset ao mudar valor
                                        }}
                                    />
                                    {precisaBloquear && (
                                        <button className="btn-request-auth" onClick={() => setPedindoSenha(true)}>
                                            Solicitar Gerente
                                        </button>
                                    )}
                                </div>

                                Desconto total {descontoCalculado.toFixed(2)}




                            </div>

<div>

                                cupons disponíveis: <br />
<div className="cupons-grid">

                        {['desconto tal: 10%', 'valor acima de tal: R$ 50'].map(m => (
                            <button
                                key={m}
                                className={metodoSelecionado === m ? 'active' : ''}
                                
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    </div>


                            

                        </div>
                    </div>
                </div>



                <section className="totals-panel">

                    <div className="status-box">
                        <div className={`status-item ${saldoRestante > 0 ? 'pending' : 'paid'}`}>
                            <small>Faltando</small>
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
                                    <br />
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
                    onClick={() => alert("Venda Finalizada com Sucesso!")}
                >
                    {precisaBloquear ? "AGUARDANDO GERENTE" : "CONCLUIR VENDA (F5)"}
                </button>
            </div>
        </div>


        // </div>


    );
};