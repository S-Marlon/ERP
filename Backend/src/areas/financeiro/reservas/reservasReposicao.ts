// Fundos de reposição: dinheiro separado do capital de giro para recomprar itens caros (fios, bombas, irrigação,
// rolamentos, óleos...). Cada venda das categorias do fundo soma o custo vendido (× percentual); cada compra pela NF tira;
// ajustes manuais (transferência para a conta reserva, uso em outra coisa) somam ou tiram. Entradas e saídas não são
// gravadas: saem das vendas e das notas. Regras puras, sem banco, com teste.

export class ErroReserva extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type TipoMovimento = 'VENDA' | 'DEVOLUCAO' | 'COMPRA' | 'AJUSTE' | 'INICIAL';

export interface MovimentoFundo {
  data: string;            // YYYY-MM-DD
  tipo: TipoMovimento;
  descricao: string;
  valor: number;           // positivo entra no fundo, negativo sai
  referencia?: string | null;
  idAjuste?: number;
}

export interface MovimentoComSaldo extends MovimentoFundo { saldo: number; compraAcimaDoSaldo: boolean }

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export const validarFundo = (b: any) => {
  const nome = String(b?.nome || '').trim().slice(0, 80);
  if (!nome) throw new ErroReserva('Informe o nome do fundo.');
  const percentual = b?.percentualCusto === undefined || b?.percentualCusto === null || b?.percentualCusto === '' ? 1 : Number(b.percentualCusto);
  if (!(percentual > 0 && percentual <= 3)) throw new ErroReserva('Percentual do custo: de 1% a 300%.');
  const saldoInicial = Number(b?.saldoInicial || 0);
  if (!Number.isFinite(saldoInicial)) throw new ErroReserva('Saldo inicial inválido.');
  const dataInicio = String(b?.dataInicio || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || Number.isNaN(new Date(`${dataInicio}T12:00:00`).getTime())) throw new ErroReserva('Informe a data de início.');
  return { nome, percentualCusto: Math.round(percentual * 10000) / 10000, saldoInicial: r2(saldoInicial), dataInicio, ativo: b?.ativo === false ? 0 : 1 };
};

export const validarAjuste = (b: any) => {
  const valor = r2(Number(b?.valor));
  if (!Number.isFinite(valor) || valor === 0) throw new ErroReserva('Informe o valor do ajuste (positivo soma, negativo tira).');
  const motivo = String(b?.motivo || '').trim().slice(0, 150);
  if (!motivo) throw new ErroReserva('Informe o motivo do ajuste.');
  const data = String(b?.data || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroReserva('Informe a data do ajuste.');
  return { valor, motivo, data };
};

/**
 * Extrato em ordem de data (no mesmo dia: inicial, vendas, devoluções, ajustes, compras), com o saldo correndo.
 * Compra que deixa o saldo negativo foi paga (em parte) com o capital de giro: marcada para aviso.
 */
export const extratoComSaldo = (movimentos: MovimentoFundo[]): MovimentoComSaldo[] => {
  const ordem: Record<TipoMovimento, number> = { INICIAL: 0, VENDA: 1, DEVOLUCAO: 2, AJUSTE: 3, COMPRA: 4 };
  let saldo = 0;
  return [...movimentos]
    .sort((a, b) => a.data.localeCompare(b.data) || ordem[a.tipo] - ordem[b.tipo])
    .map(m => {
      saldo = r2(saldo + m.valor);
      return { ...m, valor: r2(m.valor), saldo, compraAcimaDoSaldo: m.tipo === 'COMPRA' && saldo < -0.004 };
    });
};

/** Resumo do fundo: totais, saldo, mês corrente e quanto do estoque das categorias o saldo cobre. */
export const resumoDoFundo = (extrato: MovimentoComSaldo[], estoque: number, mes: string) => {
  const soma = (f: (m: MovimentoComSaldo) => boolean) => r2(extrato.filter(f).reduce((a, m) => a + m.valor, 0));
  const saldo = extrato.length ? extrato[extrato.length - 1].saldo : 0;
  return {
    saldo,
    entradas: soma(m => m.tipo === 'VENDA' || m.tipo === 'DEVOLUCAO'),
    compras: -soma(m => m.tipo === 'COMPRA'),
    ajustes: soma(m => m.tipo === 'AJUSTE' || m.tipo === 'INICIAL'),
    entradasMes: soma(m => (m.tipo === 'VENDA' || m.tipo === 'DEVOLUCAO') && m.data.startsWith(mes)),
    comprasMes: -soma(m => m.tipo === 'COMPRA' && m.data.startsWith(mes)),
    estoque: r2(estoque),
    /** saldo ÷ estoque das categorias (1 = dá para recomprar o estoque inteiro). */
    cobertura: estoque > 0 ? Math.round((saldo / estoque) * 10000) / 10000 : null,
    comprasAcimaDoSaldo: extrato.filter(m => m.compraAcimaDoSaldo).length,
  };
};
