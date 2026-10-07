// Contas a receber (sem banco): parcelas da venda a prazo, crédito do cliente e baixas.

const c = (v: number) => Math.round((Number(v) || 0) * 100);
const r = (v: number) => v / 100;

export class ErroReceber extends Error {
  constructor(message: string, public status = 400, public detalhes?: unknown) {
    super(message);
  }
}

export interface ParcelaPlanejada { parcela: number; totalParcelas: number; vencimento: string; valor: number }

const dataIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const lerData = (s: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
  const [a, m, d] = s.split('-').map(Number);
  const data = new Date(a, m - 1, d);
  return data.getFullYear() === a && data.getMonth() === m - 1 && data.getDate() === d ? data : null;
};

/**
 * Parcelas iguais (os centavos que sobram vão para a primeira). Vencimentos a cada `intervaloDias`
 * a partir de `primeiroVencimento` (padrão: hoje + intervalo).
 */
export const gerarParcelas = (
  total: number,
  quantidade: number,
  hoje: Date,
  intervaloDias = 30,
  primeiroVencimento?: string | null
): ParcelaPlanejada[] => {
  const n = quantidade === undefined || quantidade === null ? 1 : Math.floor(Number(quantidade));
  if (!Number.isFinite(n)) throw new ErroReceber('Número de parcelas inválido (1 a 36).');
  if (n < 1 || n > 36) throw new ErroReceber('Número de parcelas inválido (1 a 36).');
  const intervalo = Math.floor(Number(intervaloDias) || 30);
  if (intervalo < 1 || intervalo > 365) throw new ErroReceber('Intervalo entre parcelas inválido (1 a 365 dias).');
  const totalC = c(total);
  if (totalC <= 0) throw new ErroReceber('Valor a prazo inválido.');

  const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let primeiro: Date;
  if (primeiroVencimento) {
    const d = lerData(primeiroVencimento);
    if (!d) throw new ErroReceber('Data do primeiro vencimento inválida.');
    if (d < hojeSemHora) throw new ErroReceber('O primeiro vencimento não pode ser antes de hoje.');
    primeiro = d;
  } else {
    primeiro = new Date(hojeSemHora);
    primeiro.setDate(primeiro.getDate() + intervalo);
  }

  const base = Math.floor(totalC / n);
  const sobra = totalC - base * n;
  return Array.from({ length: n }, (_, i) => {
    const venc = new Date(primeiro);
    venc.setDate(venc.getDate() + intervalo * i);
    return { parcela: i + 1, totalParcelas: n, vencimento: dataIso(venc), valor: r(base + (i === 0 ? sobra : 0)) };
  });
};

export interface CreditoCliente { limite: number | null; bloqueado: boolean }

/** Venda a prazo: cliente não bloqueado e dívida aberta + nova compra dentro do limite (sem limite = livre). */
export const validarCredito = (credito: CreditoCliente | null, saldoDevedor: number, valorNovo: number, nomeCliente = 'O cliente') => {
  if (credito?.bloqueado) throw new ErroReceber(`${nomeCliente} está bloqueado para compras a prazo.`, 409, { codigo: 'CLIENTE_BLOQUEADO' });
  if (credito && credito.limite !== null && credito.limite !== undefined) {
    const disponivelC = c(credito.limite) - c(saldoDevedor);
    if (c(valorNovo) > disponivelC) {
      throw new ErroReceber(
        `Limite de crédito excedido: limite R$ ${Number(credito.limite).toFixed(2)}, em aberto R$ ${Number(saldoDevedor).toFixed(2)}, ` +
        `disponível R$ ${r(Math.max(0, disponivelC)).toFixed(2)}, compra a prazo R$ ${Number(valorNovo).toFixed(2)}.`,
        409,
        { codigo: 'LIMITE_EXCEDIDO', disponivel: r(Math.max(0, disponivelC)) }
      );
    }
  }
};

export const FORMAS_RECEBIMENTO = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'TRANSFERENCIA'] as const;

/** Baixa (parcial ou total): valor > 0 e até o saldo da parcela. Devolve o novo pago e o status. */
export const aplicarBaixa = (valorTitulo: number, valorPago: number, valorBaixa: number, forma: string, status: string) => {
  if (status !== 'ABERTO') throw new ErroReceber(`Parcela ${status === 'PAGO' ? 'já paga' : 'cancelada'}.`, 409);
  const f = String(forma || '').toUpperCase();
  if (!(FORMAS_RECEBIMENTO as readonly string[]).includes(f)) throw new ErroReceber(`Forma de recebimento inválida: ${forma}.`);
  const saldoC = c(valorTitulo) - c(valorPago);
  const baixaC = c(valorBaixa);
  if (!Number.isFinite(baixaC) || baixaC <= 0) throw new ErroReceber('Informe um valor maior que zero.');
  if (baixaC > saldoC) throw new ErroReceber(`O valor (R$ ${r(baixaC).toFixed(2)}) passa do saldo da parcela (R$ ${r(saldoC).toFixed(2)}).`);
  const novoPagoC = c(valorPago) + baixaC;
  return { forma: f, valor: r(baixaC), valorPago: r(novoPagoC), status: novoPagoC >= c(valorTitulo) ? 'PAGO' : 'ABERTO' };
};

/** Estorno de uma baixa: devolve o valor ao saldo e reabre a parcela. */
export const estornarBaixa = (valorTitulo: number, valorPago: number, valorBaixa: number) => {
  const novoPagoC = Math.max(0, c(valorPago) - c(valorBaixa));
  return { valorPago: r(novoPagoC), status: novoPagoC >= c(valorTitulo) ? 'PAGO' : 'ABERTO' };
};

export type SituacaoTitulo = 'VENCIDO' | 'VENCE_HOJE' | 'A_VENCER' | 'PAGO' | 'CANCELADO';

export const situacaoTitulo = (status: string, vencimento: string, hoje: Date): SituacaoTitulo => {
  if (status === 'PAGO') return 'PAGO';
  if (status === 'CANCELADO') return 'CANCELADO';
  const h = dataIso(hoje);
  const v = String(vencimento).slice(0, 10);
  return v < h ? 'VENCIDO' : v === h ? 'VENCE_HOJE' : 'A_VENCER';
};

export const diasDeAtraso = (vencimento: string, hoje: Date) => {
  const v = lerData(String(vencimento).slice(0, 10));
  if (!v) return 0;
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(0, Math.round((h.getTime() - v.getTime()) / 86400000));
};
