// Regras de precificação por unidade de venda e de defasagem do custo gerencial.
// O preço de venda é derivado do custo gerencial (comercial_produtos_dados.custo_gerencial), que só muda
// quando o gestor decide: novas NFs atualizam o custo médio/último custo e o sistema apenas sinaliza a defasagem.

export const TOLERANCIA_DEFASAGEM = 0.005; // 0,5%

const arred = (valor: number, casas: number): number => {
  const f = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * f) / f;
};

// Preço de uma unidade de venda: custo da unidade base x fator da unidade x markup x fator da taxa.
// O markup é líquido; o fator da taxa (1 / (1 - taxa de referência), Vendas › Taxas de pagamento) embute
// a taxa da maquininha para o preço render o markup depois de descontada a taxa.
export const calcularPrecoUnidade = (custoBase: number, fator: number, markup: number, fatorTaxa = 1): number =>
  arred((Number(custoBase) || 0) * (Number(fator) || 0) * (Number(markup) || 0) * (Number(fatorTaxa) || 1), 2);

export interface Defasagem {
  defasado: boolean;
  custoGerencial: number | null;
  custoMedio: number | null;
  ultimoCusto: number | null;
  variacaoUltimoPct: number | null; // último custo vs custo gerencial
  variacaoMedioPct: number | null;  // custo médio vs custo gerencial
}

const variacao = (novo: number | null, referencia: number | null): number | null => {
  if (novo === null || referencia === null || referencia <= 0) return null;
  return arred(((novo - referencia) / referencia) * 100, 2);
};

export const analisarDefasagem = (
  custoGerencial: number | null,
  custoMedio: number | null,
  ultimoCusto: number | null
): Defasagem => {
  const gerencial = custoGerencial !== null && Number(custoGerencial) > 0 ? Number(custoGerencial) : null;
  const medio = custoMedio !== null && Number(custoMedio) > 0 ? Number(custoMedio) : null;
  const ultimo = ultimoCusto !== null && Number(ultimoCusto) > 0 ? Number(ultimoCusto) : null;

  const variacaoUltimoPct = variacao(ultimo, gerencial);
  const variacaoMedioPct = variacao(medio, gerencial);
  const fora = (pct: number | null) => pct !== null && Math.abs(pct) / 100 > TOLERANCIA_DEFASAGEM;

  // Sem custo gerencial mas já com custo de entrada: precisa ser definido
  const semReferencia = gerencial === null && (medio !== null || ultimo !== null);

  return {
    defasado: semReferencia || fora(variacaoUltimoPct) || fora(variacaoMedioPct),
    custoGerencial: gerencial,
    custoMedio: medio,
    ultimoCusto: ultimo,
    variacaoUltimoPct,
    variacaoMedioPct,
  };
};

export interface FaixaPreco {
  sigla: string;
  markup: number;
  preco_unitario: number;
}

// Recalcula todas as faixas quando o custo gerencial muda (markup é mantido)
export const recalcularFaixas = <T extends FaixaPreco>(faixas: T[], custoBase: number, fatorPorSigla: Map<string, number>, fatorTaxa = 1): T[] =>
  faixas.map(f => ({
    ...f,
    preco_unitario: calcularPrecoUnidade(custoBase, fatorPorSigla.get(f.sigla) ?? 1, f.markup, fatorTaxa),
  }));

/** Margem líquida (%) do preço: o que sobra depois da taxa embutida e do custo. */
export const margemLiquida = (preco: number, custo: number, taxaPercentual = 0): number | null =>
  preco > 0 ? arred(((preco * (1 - taxaPercentual / 100) - custo) / preco) * 100, 2) : null;
