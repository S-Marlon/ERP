import { aplicarBaixa, diasDeAtraso, estornarBaixa, gerarParcelas, situacaoTitulo, validarCredito } from './receber';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};
const falha = (fn: () => unknown, msg: string, trecho?: string) => {
  try { fn(); } catch (e) { if (trecho && !String((e as Error).message).includes(trecho)) throw new Error(`${msg}: ${(e as Error).message}`); return; }
  throw new Error(msg);
};
const hoje = new Date(2026, 9, 3); // 03/10/2026

// Critério da fase 2: R$ 300 em 3x -> 3 parcelas de 100, a cada 30 dias
let p = gerarParcelas(300, 3, hoje);
assert(p.length === 3 && p.every(x => x.valor === 100), 'três parcelas de 100');
assert(p[0].vencimento === '2026-11-02' && p[1].vencimento === '2026-12-02' && p[2].vencimento === '2027-01-01', `vencimentos ${p.map(x => x.vencimento)}`);
assert(p[2].parcela === 3 && p[2].totalParcelas === 3, 'numeração');

// Centavos que sobram vão na primeira; soma confere
p = gerarParcelas(100, 3, hoje, 15, '2026-10-10');
assert(p[0].valor === 33.34 && p[1].valor === 33.33 && p[2].valor === 33.33, `centavos ${p.map(x => x.valor)}`);
assert(p[0].vencimento === '2026-10-10' && p[1].vencimento === '2026-10-25', 'primeiro vencimento e intervalo');
assert(gerarParcelas(50, 1, hoje, 30, '2026-10-03')[0].vencimento === '2026-10-03', 'vencimento hoje é aceito');
falha(() => gerarParcelas(100, 0, hoje), 'zero parcelas');
falha(() => gerarParcelas(100, 2, hoje, 30, '2026-10-02'), 'vencimento no passado', 'antes de hoje');
falha(() => gerarParcelas(100, 2, hoje, 30, '2026-02-30'), 'data inválida');
falha(() => gerarParcelas(0, 2, hoje), 'valor zero');

// Crédito
validarCredito(null, 500, 1000);
validarCredito({ limite: null, bloqueado: false }, 500, 1000);
validarCredito({ limite: 1000, bloqueado: false }, 600, 400);
falha(() => validarCredito({ limite: 1000, bloqueado: false }, 600, 400.01), 'passa do limite', 'disponível R$ 400.00');
falha(() => validarCredito({ limite: null, bloqueado: true }, 0, 1, 'João'), 'bloqueado', 'João está bloqueado');

// Baixas
let b = aplicarBaixa(100, 0, 40, 'dinheiro', 'ABERTO');
assert(b.valorPago === 40 && b.status === 'ABERTO' && b.forma === 'DINHEIRO', 'baixa parcial');
b = aplicarBaixa(100, 40, 60, 'PIX', 'ABERTO');
assert(b.valorPago === 100 && b.status === 'PAGO', 'baixa quita');
falha(() => aplicarBaixa(100, 40, 60.01, 'PIX', 'ABERTO'), 'passa do saldo', 'saldo da parcela (R$ 60.00)');
falha(() => aplicarBaixa(100, 100, 1, 'PIX', 'PAGO'), 'parcela paga');
falha(() => aplicarBaixa(100, 0, 10, 'PRAZO', 'ABERTO'), 'prazo não quita prazo');
const e = estornarBaixa(100, 100, 60);
assert(e.valorPago === 40 && e.status === 'ABERTO', 'estorno reabre');

// Situação
assert(situacaoTitulo('ABERTO', '2026-10-02', hoje) === 'VENCIDO', 'vencido');
assert(situacaoTitulo('ABERTO', '2026-10-03', hoje) === 'VENCE_HOJE', 'vence hoje');
assert(situacaoTitulo('ABERTO', '2026-10-04', hoje) === 'A_VENCER', 'a vencer');
assert(situacaoTitulo('PAGO', '2026-01-01', hoje) === 'PAGO', 'pago');
assert(diasDeAtraso('2026-09-23', hoje) === 10 && diasDeAtraso('2026-10-10', hoje) === 0, 'dias de atraso');

console.log('receber: ok');
