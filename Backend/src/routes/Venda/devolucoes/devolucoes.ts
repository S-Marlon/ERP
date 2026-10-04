// Devolução de venda (sem banco): valor de cada item pelo que foi efetivamente pago e abatimento nas parcelas a prazo.

const c = (v: number) => Math.round((Number(v) || 0) * 100);
const r = (v: number) => v / 100;

export class ErroDevolucao extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const REEMBOLSOS = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'CREDITO_LOJA', 'ABATER_PRAZO'] as const;
export type Reembolso = typeof REEMBOLSOS[number];
export const REEMBOLSOS_CAIXA = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'TRANSFERENCIA'];

export interface LinhaVendida {
  idVendaItem: number;
  nome: string;
  quantidade: number;       // vendida (unidade de venda)
  fator: number;            // unidade de venda -> base
  totalItem: number;        // pago na linha (com descontos/acréscimos rateados)
  devolvidoQtd: number;     // já devolvido (unidade de venda)
  devolvidoValor: number;   // já devolvido (R$)
}

export interface PedidoDevolucao { idVendaItem: number; quantidade: number }

/**
 * Valor de cada item devolvido: proporcional ao pago (total da linha / quantidade). Quando a devolução
 * completa a linha, devolve exatamente o que falta (sem sobra de centavos).
 */
export const calcularDevolucao = (vendidas: LinhaVendida[], pedidos: PedidoDevolucao[]) => {
  const linhas = pedidos.filter(p => Number(p.quantidade) > 0).map(p => {
    const v = vendidas.find(x => x.idVendaItem === Number(p.idVendaItem));
    if (!v) throw new ErroDevolucao(`Item ${p.idVendaItem} não pertence a esta venda.`);
    const restante = Number((v.quantidade - v.devolvidoQtd).toFixed(4));
    const qtd = Number(Number(p.quantidade).toFixed(4));
    if (qtd > restante + 1e-9) throw new ErroDevolucao(`"${v.nome}": só ${restante} pode(m) ser devolvido(s).`);
    const completa = Math.abs(qtd - restante) < 1e-9;
    const valorC = completa
      ? c(v.totalItem) - c(v.devolvidoValor)
      : Math.round((c(v.totalItem) * qtd) / v.quantidade);
    return { idVendaItem: v.idVendaItem, quantidade: qtd, quantidadeBase: Number((qtd * v.fator).toFixed(4)), valor: r(Math.max(0, valorC)) };
  });
  if (linhas.length === 0) throw new ErroDevolucao('Escolha ao menos um item e a quantidade a devolver.');
  return { linhas, total: r(linhas.reduce((a, l) => a + c(l.valor), 0)) };
};

export interface TituloAberto { idTitulo: number; vencimento: string; valor: number; valorPago: number }

/**
 * Abate o valor das parcelas em aberto da venda, da última para a primeira. Parcela zerada sem pagamento
 * é cancelada; com pagamento, fica paga pelo que já recebeu.
 */
export const abaterParcelas = (titulos: TituloAberto[], valor: number) => {
  const saldoC = titulos.reduce((a, t) => a + c(t.valor) - c(t.valorPago), 0);
  if (c(valor) > saldoC) throw new ErroDevolucao(`O valor (R$ ${Number(valor).toFixed(2)}) passa do saldo a prazo desta venda (R$ ${r(saldoC).toFixed(2)}).`);
  let restante = c(valor);
  const alteracoes: Array<{ idTitulo: number; novoValor: number; status: 'ABERTO' | 'PAGO' | 'CANCELADO' }> = [];
  for (const t of [...titulos].sort((a, b) => (a.vencimento < b.vencimento ? 1 : -1))) {
    if (restante <= 0) break;
    const saldo = c(t.valor) - c(t.valorPago);
    const abate = Math.min(saldo, restante);
    if (abate <= 0) continue;
    restante -= abate;
    const novoC = c(t.valor) - abate;
    alteracoes.push({
      idTitulo: t.idTitulo, novoValor: r(novoC),
      status: novoC <= c(t.valorPago) ? (c(t.valorPago) > 0 ? 'PAGO' : 'CANCELADO') : 'ABERTO',
    });
  }
  return alteracoes;
};
