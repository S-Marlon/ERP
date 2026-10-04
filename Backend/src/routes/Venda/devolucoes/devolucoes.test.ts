import { abaterParcelas, calcularDevolucao } from './devolucoes';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};
const falha = (fn: () => unknown, msg: string) => { try { fn(); } catch { return; } throw new Error(msg); };

// 3 unidades pagas R$ 100 (com desconto rateado): 1 devolvida = 33,33; as outras 2 fecham em 66,67
const linha = { idVendaItem: 1, nome: 'Terminal', quantidade: 3, fator: 1, totalItem: 100, devolvidoQtd: 0, devolvidoValor: 0 };
let d = calcularDevolucao([linha], [{ idVendaItem: 1, quantidade: 1 }]);
assert(d.total === 33.33 && d.linhas[0].quantidadeBase === 1, `parcial ${JSON.stringify(d)}`);
d = calcularDevolucao([{ ...linha, devolvidoQtd: 1, devolvidoValor: 33.33 }], [{ idVendaItem: 1, quantidade: 2 }]);
assert(d.total === 66.67, `completa sem sobra ${d.total}`);
falha(() => calcularDevolucao([{ ...linha, devolvidoQtd: 2, devolvidoValor: 66.66 }], [{ idVendaItem: 1, quantidade: 2 }]), 'acima do restante');
falha(() => calcularDevolucao([linha], [{ idVendaItem: 9, quantidade: 1 }]), 'item de outra venda');
falha(() => calcularDevolucao([linha], [{ idVendaItem: 1, quantidade: 0 }]), 'nada a devolver');

// Fracionado e unidade com fator: 2,5 m de 10 m pagos R$ 80; rolo de 50 m
d = calcularDevolucao([{ idVendaItem: 2, nome: 'Mangueira', quantidade: 10, fator: 1, totalItem: 80, devolvidoQtd: 0, devolvidoValor: 0 }], [{ idVendaItem: 2, quantidade: 2.5 }]);
assert(d.total === 20, `fracionado ${d.total}`);
d = calcularDevolucao([{ idVendaItem: 3, nome: 'Rolo', quantidade: 2, fator: 50, totalItem: 900, devolvidoQtd: 0, devolvidoValor: 0 }], [{ idVendaItem: 3, quantidade: 1 }]);
assert(d.total === 450 && d.linhas[0].quantidadeBase === 50, 'fator da unidade');

// Abater parcelas: R$ 300 em 3x de 100, primeira paga; devolve 150 -> última cancelada, segunda vira 50
const titulos = [
  { idTitulo: 1, vencimento: '2026-11-01', valor: 100, valorPago: 100 },
  { idTitulo: 2, vencimento: '2026-12-01', valor: 100, valorPago: 0 },
  { idTitulo: 3, vencimento: '2027-01-01', valor: 100, valorPago: 0 },
].filter(t => t.valorPago < t.valor);
const a = abaterParcelas(titulos, 150);
assert(JSON.stringify(a) === JSON.stringify([{ idTitulo: 3, novoValor: 0, status: 'CANCELADO' }, { idTitulo: 2, novoValor: 50, status: 'ABERTO' }]), `abater ${JSON.stringify(a)}`);
// Parcela com pagamento parcial: 100 com 30 pago, abate 70 -> fica paga com 30
assert(JSON.stringify(abaterParcelas([{ idTitulo: 4, vencimento: '2026-11-01', valor: 100, valorPago: 30 }], 70)) === JSON.stringify([{ idTitulo: 4, novoValor: 30, status: 'PAGO' }]), 'parcial pago');
falha(() => abaterParcelas(titulos, 250), 'acima do saldo a prazo');

console.log('devolucoes: ok');
