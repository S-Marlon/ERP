// Cálculo do caixa (sem banco): quanto deve haver por forma de pagamento e a conferência do fechamento.
// Dinheiro esperado = troco inicial + vendas em dinheiro (líquidas do troco) + suprimentos + recebimentos
//                     - sangrias - estornos (de venda e de recebimento).
// Cartão/PIX/prazo: só o que foi vendido (conferido contra a maquininha, o extrato e os títulos).

export const TIPOS_MOVIMENTO_CAIXA = ['SUPRIMENTO', 'SANGRIA', 'ESTORNO_VENDA', 'RECEBIMENTO', 'ESTORNO_RECEBIMENTO', 'ADIANTAMENTO', 'DEVOLUCAO_SINAL'] as const;
export type TipoMovimentoCaixa = typeof TIPOS_MOVIMENTO_CAIXA[number];

// Entram (+) ou saem (-) do caixa
const SINAL: Record<TipoMovimentoCaixa, 1 | -1> = {
  SUPRIMENTO: 1, RECEBIMENTO: 1, ADIANTAMENTO: 1, SANGRIA: -1, ESTORNO_VENDA: -1, ESTORNO_RECEBIMENTO: -1, DEVOLUCAO_SINAL: -1,
};

// Formas que existem fisicamente no caixa (as demais são conferidas fora da gaveta)
export const FORMA_DINHEIRO = 'DINHEIRO';

export interface PagamentoVendaCaixa { forma: string; valor: number; troco: number }
export interface MovimentoCaixa { tipo: string; forma: string; valor: number }

export interface LinhaResumoCaixa {
  forma: string;
  abertura: number;
  vendas: number;
  suprimentos: number;
  recebimentos: number;
  sangrias: number;
  estornos: number;
  esperado: number;
}

const c = (v: number) => Math.round((Number(v) || 0) * 100);
const r = (v: number) => v / 100;

export class ErroCaixa extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const calcularResumoCaixa = (
  valorAbertura: number,
  pagamentos: PagamentoVendaCaixa[],
  movimentos: MovimentoCaixa[]
): { linhas: LinhaResumoCaixa[]; totalVendas: number; dinheiroEsperado: number } => {
  const porForma = new Map<string, { abertura: number; vendas: number; suprimentos: number; recebimentos: number; sangrias: number; estornos: number }>();
  const linha = (forma: string) => {
    const f = String(forma || '').toUpperCase();
    if (!porForma.has(f)) porForma.set(f, { abertura: 0, vendas: 0, suprimentos: 0, recebimentos: 0, sangrias: 0, estornos: 0 });
    return porForma.get(f)!;
  };

  linha(FORMA_DINHEIRO).abertura = c(valorAbertura);
  for (const p of pagamentos) linha(p.forma).vendas += c(p.valor) - c(p.troco);
  for (const m of movimentos) {
    const l = linha(m.forma);
    const v = c(m.valor);
    if (m.tipo === 'SUPRIMENTO') l.suprimentos += v;
    else if (m.tipo === 'RECEBIMENTO' || m.tipo === 'ADIANTAMENTO') l.recebimentos += v;
    else if (m.tipo === 'SANGRIA') l.sangrias += v;
    else if (m.tipo === 'ESTORNO_VENDA' || m.tipo === 'ESTORNO_RECEBIMENTO' || m.tipo === 'DEVOLUCAO_SINAL') l.estornos += v;
  }

  const linhas = [...porForma.entries()]
    .map(([forma, l]) => ({
      forma,
      abertura: r(l.abertura),
      vendas: r(l.vendas),
      suprimentos: r(l.suprimentos),
      recebimentos: r(l.recebimentos),
      sangrias: r(l.sangrias),
      estornos: r(l.estornos),
      esperado: r(l.abertura + l.vendas + l.suprimentos + l.recebimentos - l.sangrias - l.estornos),
    }))
    // Dinheiro primeiro, depois por nome
    .sort((a, b) => (a.forma === FORMA_DINHEIRO ? -1 : b.forma === FORMA_DINHEIRO ? 1 : a.forma.localeCompare(b.forma)));

  return {
    linhas,
    totalVendas: r(linhas.reduce((a, l) => a + c(l.vendas), 0)),
    dinheiroEsperado: linhas.find(l => l.forma === FORMA_DINHEIRO)?.esperado ?? 0,
  };
};

/** Valida um movimento manual (sangria/suprimento). Sangria não pode passar do dinheiro esperado na gaveta. */
export const validarMovimentoManual = (tipo: string, valor: number, dinheiroEsperado: number, motivo: string) => {
  const t = String(tipo || '').toUpperCase();
  if (t !== 'SANGRIA' && t !== 'SUPRIMENTO') throw new ErroCaixa('Tipo de movimento inválido (use SANGRIA ou SUPRIMENTO).');
  const v = c(valor);
  if (!Number.isFinite(v) || v <= 0) throw new ErroCaixa('Informe um valor maior que zero.');
  if (t === 'SANGRIA' && !String(motivo || '').trim()) throw new ErroCaixa('Informe o motivo da sangria.');
  if (t === 'SANGRIA' && v > c(dinheiroEsperado)) {
    throw new ErroCaixa(`A sangria (R$ ${r(v).toFixed(2)}) passa do dinheiro esperado na gaveta (R$ ${dinheiroEsperado.toFixed(2)}).`);
  }
  return { tipo: t as TipoMovimentoCaixa, valor: r(v) };
};

/** Conferência do fechamento: esperado x informado por forma (forma não informada conta como zero; prazo fica fora). */
// PRAZO vira contas a receber; ADIANTAMENTO já entrou no caixa quando o sinal foi recebido
export const FORMAS_SEM_CONFERENCIA = ['PRAZO', 'ADIANTAMENTO'];

export const conferirFechamento = (linhas: LinhaResumoCaixa[], informado: Record<string, number>) => {
  const formas = new Set([...linhas.map(l => l.forma), ...Object.keys(informado || {}).map(f => f.toUpperCase())]
    .filter(f => !FORMAS_SEM_CONFERENCIA.includes(f)));
  const conferencia = [...formas].map(forma => {
    const esperado = linhas.find(l => l.forma === forma)?.esperado ?? 0;
    const chave = Object.keys(informado || {}).find(k => k.toUpperCase() === forma);
    const valorInformado = chave !== undefined ? Number(informado[chave]) : 0;
    if (!Number.isFinite(valorInformado) || valorInformado < 0) throw new ErroCaixa(`Valor contado inválido em ${forma}.`);
    return { forma, esperado, informado: r(c(valorInformado)), diferenca: r(c(valorInformado) - c(esperado)) };
  });
  return {
    conferencia,
    diferencaTotal: r(conferencia.reduce((a, l) => a + c(l.diferenca), 0)),
  };
};

/**
 * Estorno de uma venda cancelada fora do caixa em que foi feita: o dinheiro que sai do caixa atual,
 * por forma (líquido do troco). Prazo não sai do caixa (é tratado nas contas a receber).
 */
export const estornoDaVenda = (pagamentos: PagamentoVendaCaixa[]) => {
  const porForma = new Map<string, number>();
  for (const p of pagamentos) {
    const forma = String(p.forma).toUpperCase();
    if (forma === 'PRAZO' || forma === 'ADIANTAMENTO') continue; // prazo: contas a receber; adiantamento: volta ao sinal
    porForma.set(forma, (porForma.get(forma) || 0) + c(p.valor) - c(p.troco));
  }
  return [...porForma.entries()].filter(([, v]) => v > 0).map(([forma, v]) => ({ forma, valor: r(v) }));
};

export const sinalMovimento = (tipo: string) => SINAL[tipo as TipoMovimentoCaixa] ?? 0;
