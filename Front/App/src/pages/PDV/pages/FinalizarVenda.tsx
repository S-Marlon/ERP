import React, { useEffect, useRef, useState } from 'react';
import './FinalizarVenda.css';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Fieldset from '../../../components/ui/Fieldset/Fieldset';
import { imprimirExtratoElgin } from '../../../utils/printService';
import { salesService, SalePayload } from '../services/salesService';
import Swal from 'sweetalert2';
// import {ItemVenda} from '../../../utils/printService'

import Draggable from 'react-draggable';


export interface ItemVenda {
    id: string | number;
    name: string;
    quantity: number;
    salePrice: number;
    costPrice?: number;
    unidade?: string; // 👈 ADICIONE ISSO
}

export type PaymentMethodType =
    | 'money'
    | 'credit_card'
    | 'debit_card'
    | 'pix'
    | 'bank_transfer'
    | 'store_credit'; // 'Crediário'

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
    const [metodoSelecionado, setMetodoSelecionado] = useState<PaymentMethodType | null>(null);
    const [valorInput, setValorInput] = useState<string>(''); // string agora
    const [parcelasInput, setParcelasInput] = useState(1);

    const [activeModal, setActiveModal] = useState(null); // 'calc', 'obs', 'desc', etc.
    // Controle da Janela Flutuante da Calculadora
const [calcVisible, setCalcVisible] = useState(false);
// Se quiser outras janelas futuramente, pode usar o openWindows que você citou

    const FloatingCalc = ({ onClose }) => {
  return (
    <Draggable handle=".window-header">
      <div style={{
        position: 'absolute',
        width: '300px',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        zIndex: 1000
      }}>
        {/* O 'handle' é onde o usuário clica para arrastar */}
        <div className="window-header" style={{ 
          cursor: 'move', 
          background: '#2c3e50', 
          color: '#fff', 
          padding: '10px',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>🧮 Calculadora</span>
          <button onClick={onClose} style={{ background: 'red', border: 'none', color: 'white' }}>X</button>
        </div>
        
        <div className="window-body" style={{ padding: '20px' }}>
          {/* Lógica da sua calculadora aqui */}
          <input type="number" style={{ width: '100%' }} />
          <div className="grid-teclado">
            {/* ...botões numéricos... */}
          </div>
        </div>
      </div>
    </Draggable>
  );
};

const [openWindows, setOpenWindows] = useState([]);

const toggleWindow = (id) => {
  if (openWindows.includes(id)) {
    setOpenWindows(openWindows.filter(w => w !== id));
  } else {
    setOpenWindows([...openWindows, id]);
  }
};

  const closeModal = () => setActiveModal(null);


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
    const totalPago: number = pagamentos
        .filter(p => p.status === 'paid' || p.status === 'processing')
        .reduce((acc, p) => acc + (Number(p.valor) || 0), 0);



    const [showChangeDetails, setShowChangeDetails] = useState(false);

    // Cálculo do desconto real aplicado ao total
    const descontoCalculado = tipoDesconto === 'porcent'
        ? (total * descontoValor) / 100
        : descontoValor;

    const totalLiquido = total - descontoCalculado;
    const totalPagoNum = Number(totalPago) || 0;
    const totalLiquidoNum = Number(totalLiquido) || 0;

    const saldoRestante = Math.max(0, parseFloat((totalLiquidoNum - totalPagoNum).toFixed(2)));
    const troco = Number(totalPago) > totalLiquido ? Number(totalPago) - totalLiquido : 0;
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

        // 🔹 Formatar itens para impressão
const itensParaImpressao = itens.map(item => ({
    codigo: String(item.id),
    name: item.name,
    quantity: item.quantity,
    price: item.salePrice,
    desconto: 0,
    unidade: item.unidade || 'UN' // 👈 AQUI
}));

// 🔹 Formatar pagamentos para impressão
const pagamentosParaImpressao = pagamentos
    .filter(p => p.status === 'paid' || p.status === 'processing')
    .map(p => ({
        metodo: PAYMENT_METHOD_DETAILS[p.metodo].label,
        valor: p.valor,
        parcelas: p.parcelas // 👈 ESSENCIAL
    }));

// 🔹 Gerar número da venda
const numeroVenda = Date.now().toString();


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
        precoCusto: item.costPrice || 0,
        subtotal: item.quantity * item.salePrice,
        lucroUnitario: item.salePrice - (item.costPrice || 0)
    })),
    pagamentos: pagamentosParaImpressao.map(p => ({
        metodo: p.metodo,
        valor: p.valor,
        parcelas: p.parcelas || 1 // 👈 mantém parcelas reais
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
    cpf: "",
    numero: numeroVenda,
    itens: itensParaImpressao,
    total: totalLiquido,
    pagamentos: pagamentosParaImpressao,
    troco: troco
});

        try {
            console.log("⏳ Enviando...");
            // 3. Persistência no Banco de Dados
            await salesService.saveVenda(vendaCompleta);

            // ✅ RESPOSTA DE SUCESSO
            await Swal.fire({
                icon: 'success',
                title: 'Venda Finalizada!',
                text: `O valor de R$ ${totalLiquido.toFixed(2)} foi registrado com sucesso!`,
                confirmButtonColor: '#28a745',
                timer: 3000
            });

            // Limpar carrinho e voltar
            onBack(); 
        } catch (error: any) {
            // ❌ RESPOSTA DE ERRO
            Swal.fire({
                icon: 'error',
                title: 'Erro ao salvar',
                text: error.message || 'Servidor offline ou falha na rede.',
                confirmButtonColor: '#d33'
            });
        } finally {
            setIsEnviando(false);
        }
    };





    // Estado para controlar se o usuário já interagiu
const valorInputRef = useRef<HTMLInputElement>(null);

// Estado para controlar se o usuário já interagiu
const [usuarioInteragiu, setUsuarioInteragiu] = useState(false);

// Inicializa o valor do input com o saldo
useEffect(() => {
    if (metodoSelecionado && !usuarioInteragiu) {
        setValorInput(saldoRestante.toFixed(2));
    }
}, [metodoSelecionado, saldoRestante, usuarioInteragiu]);

// Foca o input quando o usuário pressiona qualquer tecla
useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
        if (valorInputRef.current && !usuarioInteragiu) {
            valorInputRef.current.focus();
        }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
        document.removeEventListener('keydown', handleKeyPress);
    };
}, [usuarioInteragiu]);

    // Função para setar valor via botão de saldo
    const inserirValorBotao = (valor: number) => {
        setValorInput(valor.toFixed(2));
        setUsuarioInteragiu(true);
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
        const valorNumerico = parseFloat(valorInput.replace(',', '.')) || 0;
        if (valorNumerico <= 0 || !metodoSelecionado) return;

        const novoPagamento: Pagamento = {
            id: crypto.randomUUID(),
            metodo: metodoSelecionado,
            valor: parseFloat(valorInput.replace(',', '.')) || 0, // <-- aqui
            parcelas: metodoSelecionado === 'credit_card' ? parcelasInput : 1,
            status: 'pending',
            createdAt: new Date(),
        };

        setPagamentos([...pagamentos, novoPagamento]);
        setValorInput(''); // string, não número
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
                    <section
                        className={`payment-methods ${metodoSelecionado ? 'section-locked' : ''} ${passoEmFoco === 1 ? 'step-highlight' : ''}`}
                    >
                        {/* <div className="payment-methods-header">
                            <h4>Métodos de Pagamento</h4>
                        </div> */}

                        <div className="method-grid">
                            {Object.entries(PAYMENT_METHOD_DETAILS).map(([key, info]) => (
                                <div
                                    key={key}
                                    className={`method-card ${metodoSelecionado === key ? 'selected' : ''} ${metodoSelecionado && metodoSelecionado !== key ? 'disabled' : ''}`}
                                    onClick={() => !metodoSelecionado || metodoSelecionado === key ? setMetodoSelecionado(key as PaymentMethodType) : null}
                                >
                                    <div className="icon">{info.icon}</div>
                                    <div className="label">{info.label}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className={`payment-section `}>






                        <section className={`payment-details ${!metodoSelecionado ? 'section-locked' : ''} ${passoEmFoco === 2 ? 'step-highlight' : ''}`}>

                            <h4>
                                {metodoSelecionado
                                    ? `Pagamento: ${PAYMENT_METHOD_DETAILS[metodoSelecionado].label}`
                                    : '(Selecione um método)'}

                                {metodoSelecionado && (
                                    <button
                                        className="btn-change-method"
                                        onClick={() => {
                                            setMetodoSelecionado(null); // Destrava a seção de métodos
                                            setValorInput('');           // Zera o valor
                                        }}
                                    >
                                        🔄 Trocar Método de Pagamento
                                    </button>
                                )}
                            </h4>

                            <div className="add-payment">

                                <div className="input-group">
                                    <div>

                                        <button
                                            className='btn-add-saldo'
                                            onClick={() => inserirValorBotao(saldoRestante)}
                                            disabled={!metodoSelecionado}
                                        >Saldo Restante Total →</button>
                                        <button
                                            className='btn-add-saldo'
                                            onClick={() => inserirValorBotao(saldoRestante / 2)}
                                            disabled={!metodoSelecionado}
                                        >50% do Saldo →</button>

                                        {renderParcelamento()}
                                    </div>

                                    <div className="input-with-keypad">

                                        <input
                                            ref={valorInputRef}
                                            type="text"
                                            value={valorInput}
                                            onFocus={() => {
                                                if (!usuarioInteragiu) {
                                                    setValorInput(''); // Limpa só no primeiro foco
                                                    setUsuarioInteragiu(true);
                                                }
                                            }}
                                            onChange={(e) => {
                                                const valor = e.target.value;
                                                if (/^[0-9]*[.,]?[0-9]*$/.test(valor)) {
                                                    setValorInput(valor.replace(',', '.'));
                                                    setUsuarioInteragiu(true);
                                                }
                                            }}
                                            disabled={!metodoSelecionado}
                                            placeholder="0.00"
                                        />

                                        <div className="keypad">
                                            {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.'].map((key) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => {
                                                        setValorInput(prev => (usuarioInteragiu ? prev : '') + key);
                                                        setUsuarioInteragiu(true);
                                                    }}
                                                    disabled={!metodoSelecionado}
                                                >
                                                    {key}
                                                </button>
                                            ))}

                                            {/* Botão Limpar */}
                                            <button
                                                type="button"
                                                onClick={() => setValorInput('')}
                                                disabled={!metodoSelecionado}
                                            >
                                                C
                                            </button>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </section>

                        <Button onClick={adicionarPagamento} color='primary' className={`btn-add-payment ${valorInput ? '' : 'btn-disabled'} ${passoEmFoco === 3 ? 'step-highlight-btn' : ''}`}>Adicionar → (Enter)</Button>


                        {
                            pagamentos.length > 0 && (


                                <Fieldset variant='card' >
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
    const infoMetodo = PAYMENT_METHOD_DETAILS[p.metodo];
    const isCanceladoOuFalha = p.status === 'cancelled' || p.status === 'failed';

    return (
      <li key={p.id || i} className={isCanceladoOuFalha ? 'payment-row-disabled' : ''}>
        {/* Número da linha à esquerda */}
        <span className="line-number">{i + 1} {infoMetodo?.icon}</span>

        <div className="payment-main-info">
           <strong>{infoMetodo?.label}</strong>
          <div className="payment-info">
            <strong>R$ {(Number(p.valor) || 0).toFixed(2)}</strong>
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

                    {/* Direita: PAGAMENTOS */}

                    {/* <Button onClick={adicionarPagamento} color='primary' className={`btn-add-payment ${valorInput ? '' : 'btn-disabled'} ${passoEmFoco === 3 ? 'step-highlight-btn' : ''}`}>Adicionar ↓ (Enter)</Button> */}





                </div>
            </div>


            <div className="checkout-footer">




                <section className="totals-panel">

                    <div className="action-buttons-grid">
                       <button 
                        className="action-card" 
                        title="Abrir calculadora" 
                        onClick={() => setCalcVisible(!calcVisible)}
                    >
                        🧮
                        <span>Calculadora</span>
                    </button>

                        <button className="action-card" title="Imprimir ou enviar comprovante por e-mail/WhatsApp" onClick={() => setActiveModal('comprovante')}>
                            📄
                            <span>Comprovante</span>
                        </button>

                         <button className="action-card" title="Aplicar cupom de desconto ou código promocional" onClick={() => setActiveModal('cupom')}>
                            🎟️
                            <span>Cupom</span>
                        </button>

                        <button className="action-card" title="Adicionar observações ao pedido, ex: sem açúcar, embalar para presente" onClick={() => setActiveModal('obs')}>
                            ✏️
                            <span>Observações</span>
                        </button>

                        {/* <button className="action-card" title="Dividir conta ou pagamento entre clientes">
                            🍽️
                            <span>Dividir Conta</span>
                        </button> */}

                        {/* <button className="action-card" title="Aplicar desconto ou acréscimo de última hora no total da venda">
                            🏷️
                            <span>Desconto/Acréscimo</span>
                        </button> */}

                        <button className="action-card" title="Consultar ou adicionar cliente para CPF na nota ou fidelidade" onClick={() => setActiveModal('cliente')}>
                            👤
                            <span>Cliente / Fidelidade</span>
                        </button>

                        <button className="action-card" title="Configurações avançadas, como ativar modo de emergência ou contato do suporte" onClick={() => setActiveModal('config')}>
                            ⚙️
                            <span>Configurações</span>
                        </button>




{/* Lógica de Renderização do Modal */}
    {/* JANELA FLUTUANTE - Renderizar aqui no final para ficar sobre tudo */}
        {calcVisible && (
            <Draggable handle=".window-header" bounds="parent">
                <div className="floating-window" style={{ 
                    position: 'absolute', 
                    top: '100px', 
                    left: '100px', 
                    zIndex: 9999,
                    width: '280px',
                    background: 'white',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    border: '1px solid #ccc'
                }}>
                    <div className="window-header" style={{
                        background: '#2c3e50',
                        color: 'white',
                        padding: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        cursor: 'move',
                        borderTopLeftRadius: '8px',
                        borderTopRightRadius: '8px'
                    }}>
                        <span>🧮 Calculadora</span>
                        <button 
                            onClick={() => setCalcVisible(false)}
                            style={{ background: '#e74c3c', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '4px', padding: '0 5px' }}
                        >
                            X
                        </button>
                    </div>
                    <div className="window-body" style={{ padding: '15px' }}>
                        {/* Aqui você pode inserir seu componente de calculadora real */}
                        <input type="text" className="calc-display" style={{ width: '100%', fontSize: '20px', textAlign: 'right', marginBottom: '10px' }} value="0" readOnly />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
                            {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+'].map(btn => (
                                <button key={btn} style={{ padding: '10px' }}>{btn}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </Draggable>
        )}

     {activeModal && (
    <div className="modal-overlay" onClick={closeModal}>
        {/* onClick no overlay fecha o modal, stopPropagation no content impede fechar ao clicar dentro */}
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            
            {/* --- TELA: COMPROVANTE --- */}
            {activeModal === 'comprovante' && (
                <div className="modal-body">
                    <h3>📄 Opções de Comprovante</h3>
                    <div className="options-vertical">
                        <button onClick={() => { /* sua função de imprimir */ }}>🖨️ Reimprimir Último</button>
                        <button>📧 Enviar por E-mail</button>
                        <button>💬 Enviar via WhatsApp</button>
                    </div>
                </div>
            )}

            {/* --- TELA: CUPOM --- */}
            {activeModal === 'cupom' && (
                <div className="modal-body">
                    <h3>🎟️ Aplicar Cupom</h3>
                    <input type="text" placeholder="Digite o código do cupom..." autoFocus />
                    <div className="modal-footer">
                        <button className="btn-confirm">Validar Cupom</button>
                    </div>
                </div>
            )}

            {/* --- TELA: OBSERVAÇÕES --- */}
            {activeModal === 'obs' && (
                <div className="modal-body">
                    <h3>✏️ Observações do Pedido</h3>
                    <textarea 
                        rows={5} 
                        placeholder="Ex: Sem cebola, embrulhar para presente..."
                        style={{ width: '100%', padding: '10px' }}
                    />
                    <div className="modal-footer">
                        <button className="btn-confirm" onClick={closeModal}>Salvar Notas</button>
                    </div>
                </div>
            )}

            {/* --- TELA: CLIENTE --- */}
            {activeModal === 'cliente' && (
                <div className="modal-body">
                    <h3>👤 Identificar Cliente</h3>
                    <div className="input-row">
                        <input type="text" placeholder="CPF ou Nome do cliente..." autoFocus />
                        <button>🔍 Buscar</button>
                    </div>
                    <div className="fidelidade-info">
                        <p>Pontos acumulados: <strong>150 pts</strong></p>
                    </div>
                </div>
            )}

            {/* --- TELA: CONFIGURAÇÕES --- */}
            {activeModal === 'config' && (
                <div className="modal-body">
                    <h3>⚙️ Configurações Rápidas</h3>
                    <div className="config-list">
                        <label><input type="checkbox" /> Impressão Automática</label>
                        <label><input type="checkbox" /> Som de confirmação</label>
                        <hr />
                        <button className="btn-danger">Suporte Técnico</button>
                    </div>
                </div>
            )}

            <button className="btn-close-modal" onClick={closeModal}>Fechar [Esc]</button>
        </div>
    </div>
)}


                    </div>

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