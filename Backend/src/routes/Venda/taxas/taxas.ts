// Taxas dos meios de pagamento (sem banco). A maquininha desconta a taxa do valor cobrado, então para
// receber L líquido com taxa t é preciso cobrar L / (1 - t) — dividir, não somar.
// O preço de tabela embute a taxa de referência (ex.: crédito 1x); outras formas permitem desconto ou exigem acréscimo:
//   valor equivalente na forma f = preço de tabela x (1 - t_ref) / (1 - t_f)

export interface TaxaPagamento {
  forma: string;
  parcelasDe: number;
  parcelasAte: number;
  percentual: number; // 4.99 = 4,99%
  fixa: number;       // R$ por transação
}

export interface ConfigTaxas {
  taxas: TaxaPagamento[];
  formaReferencia: string;
  parcelasReferencia: number;
  parcelasSemJuros: number;
  descontoFormaAutomatico: boolean;
}

const c = (v: number) => Math.round((Number(v) || 0) * 100);
const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

export class ErroTaxa extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Taxa da forma para o número de parcelas (sem cadastro = 0%). */
export const taxaPara = (taxas: TaxaPagamento[], forma: string, parcelas = 1): { percentual: number; fixa: number } => {
  const f = String(forma || '').toUpperCase();
  const n = Math.max(1, Math.floor(Number(parcelas) || 1));
  const t = taxas.find(x => x.forma === f && n >= x.parcelasDe && n <= x.parcelasAte);
  return t ? { percentual: Number(t.percentual) || 0, fixa: Number(t.fixa) || 0 } : { percentual: 0, fixa: 0 };
};

export const taxaReferencia = (cfg: ConfigTaxas) => taxaPara(cfg.taxas, cfg.formaReferencia, cfg.parcelasReferencia).percentual;

/** Fator que leva o preço líquido ao preço cobrado com a taxa (1 / (1 - t)). */
export const fatorTaxa = (percentual: number) => {
  const t = Number(percentual) / 100;
  return t > 0 && t < 1 ? 1 / (1 - t) : 1;
};

/**
 * Quanto a forma muda o preço de tabela: negativo = desconto permitido (ex.: PIX -5%),
 * positivo = acréscimo necessário (ex.: crédito 12x +4,7%). Percentual sobre o preço de tabela.
 */
export const ajusteDaForma = (cfg: ConfigTaxas, forma: string, parcelas = 1) => {
  const ref = taxaReferencia(cfg) / 100;
  const tf = taxaPara(cfg.taxas, forma, parcelas).percentual / 100;
  if (tf >= 1 || ref >= 1) return 0;
  return Number((((1 - ref) / (1 - tf) - 1) * 100).toFixed(4));
};

/** Parcelamento acima do sem juros: acréscimo (R$) para cobrar `base` nesta forma sem perder margem. */
export const acrescimoParcelamento = (cfg: ConfigTaxas, forma: string, parcelas: number, base: number) => {
  if (String(forma).toUpperCase() !== 'CREDITO' || parcelas <= cfg.parcelasSemJuros) return 0;
  const ajuste = ajusteDaForma(cfg, forma, parcelas);
  return ajuste > 0 ? r2(base * ajuste / 100) : 0;
};

export interface PagamentoComTaxa { forma: string; valor: number; parcelas: number; troco: number }

/** Taxa paga em cada pagamento (sobre o valor efetivamente recebido, sem o troco). */
export const calcularTaxas = (cfg: ConfigTaxas, pagamentos: PagamentoComTaxa[]) => {
  const linhas = pagamentos.map(p => {
    const t = taxaPara(cfg.taxas, p.forma, p.parcelas);
    const recebido = r2(Number(p.valor) - Number(p.troco || 0));
    const valor = recebido > 0 ? r2(recebido * t.percentual / 100 + t.fixa) : 0;
    return { ...p, taxaPercentual: t.percentual, taxaValor: valor, liquido: r2(recebido - valor) };
  });
  return { linhas, totalTaxas: r2(linhas.reduce((a, l) => a + l.taxaValor, 0)), totalLiquido: r2(linhas.reduce((a, l) => a + l.liquido, 0)) };
};

/**
 * Desconto efetivo da venda descontando o que a forma de pagamento permite: compara o líquido recebido
 * com o líquido que o preço de tabela daria na forma de referência. PIX a 95% da tabela com referência
 * de 5% = 0% efetivo (a margem não mudou).
 */
export const descontoEfetivoPct = (cfg: ConfigTaxas, totalTabela: number, liquidoRecebido: number) => {
  const referencia = Number(totalTabela) * (1 - taxaReferencia(cfg) / 100);
  if (c(referencia) <= 0) return 0;
  return Math.max(0, Number(((1 - Number(liquidoRecebido) / referencia) * 100).toFixed(2)));
};

/**
 * Líquido para a regra de desconto: no crédito até o limite sem juros a loja decidiu absorver a taxa,
 * então ele conta com a taxa de referência (a diferença não é desconto do operador).
 */
export const liquidoParaRegra = (cfg: ConfigTaxas, pagamentos: PagamentoComTaxa[]) => {
  const ref = taxaReferencia(cfg);
  return r2(pagamentos.reduce((a, p) => {
    const t = taxaPara(cfg.taxas, p.forma, p.parcelas);
    const absorvida = String(p.forma).toUpperCase() === 'CREDITO' && p.parcelas <= cfg.parcelasSemJuros;
    const percentual = absorvida ? ref : t.percentual;
    const recebido = Number(p.valor) - Number(p.troco || 0);
    return a + recebido * (1 - percentual / 100) - (recebido > 0 ? t.fixa : 0);
  }, 0));
};

/** Valida a tabela de taxas enviada pela tela. */
export const validarTaxas = (taxas: TaxaPagamento[]) => {
  const FORMAS = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'PRAZO', 'TRANSFERENCIA'];
  for (const t of taxas) {
    if (!FORMAS.includes(t.forma)) throw new ErroTaxa(`Forma inválida: ${t.forma}.`);
    if (!(t.parcelasDe >= 1 && t.parcelasAte >= t.parcelasDe && t.parcelasAte <= 36)) throw new ErroTaxa(`Faixa de parcelas inválida em ${t.forma} (${t.parcelasDe} a ${t.parcelasAte}).`);
    if (!(t.percentual >= 0 && t.percentual < 50)) throw new ErroTaxa(`Taxa inválida em ${t.forma}: use de 0 a 50%.`);
    if (!(t.fixa >= 0)) throw new ErroTaxa(`Taxa fixa inválida em ${t.forma}.`);
  }
  // Faixas da mesma forma não podem se sobrepor
  for (const a of taxas) {
    for (const b of taxas) {
      if (a !== b && a.forma === b.forma && a.parcelasDe <= b.parcelasAte && b.parcelasDe <= a.parcelasAte) {
        throw new ErroTaxa(`Faixas de parcelas sobrepostas em ${a.forma} (${a.parcelasDe}-${a.parcelasAte} e ${b.parcelasDe}-${b.parcelasAte}).`);
      }
    }
  }
};
