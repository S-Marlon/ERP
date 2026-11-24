// Plano mensal › simulador › "Desconto de adesão": o serviço feito agora com desconto (ex.: R$ 6.000 cobrado R$ 2.000)
// em troca da fidelidade no plano. O desconto é um adiantamento que o lucro do plano devolve: em quantos meses se paga
// (esperado e pessimista), quanto sobra no fim da fidelidade, o preço do plano que paga o desconto no prazo e a multa
// proporcional (o desconto dos meses que faltam) para quem sai antes. Puro, com teste.

const r2 = (v: number) => Math.round(v * 100) / 100;

export interface EntradaAdesao {
  /** Valor cheio do serviço, quanto foi cobrado agora e os meses de fidelidade. */
  valorCheio: number; cobrado: number; meses: number;
  /** Custo do serviço (opcional): mostra o prejuízo de caixa quando o cobrado fica abaixo do custo. */
  custoServico?: number | null;
}
export interface PlanoParaAdesao {
  preco: number; custoMensal: number; deducoesPct: number; lucroEsperado: number; lucroPessimista: number; arredondarPara?: number;
}

export const analisarAdesao = (e: EntradaAdesao, p: PlanoParaAdesao) => {
  const desconto = r2(Math.max(0, e.valorCheio - e.cobrado));
  const meses = Math.max(1, Math.round(e.meses));
  const porMes = r2(desconto / meses);
  const payback = (lucro: number) => (desconto <= 0 ? 0 : lucro > 0 ? Math.ceil(desconto / lucro - 1e-9) : null);
  const mesesEsperado = payback(p.lucroEsperado), mesesPessimista = payback(p.lucroPessimista);
  // preço que deixa de lucro o desconto dividido pelos meses (o mínimo para o desconto voltar dentro da fidelidade)
  const passo = p.arredondarPara && p.arredondarPara > 0 ? p.arredondarPara : 0.01;
  const precoParaPagar = desconto > 0 && p.deducoesPct < 1 ? Math.ceil(((p.custoMensal + porMes) / (1 - p.deducoesPct)) / passo - 1e-9) * passo : null;
  const prejuizoCaixa = e.custoServico !== null && e.custoServico !== undefined && e.custoServico > e.cobrado ? r2(e.custoServico - e.cobrado) : 0;
  return {
    desconto, meses, porMes, mesesEsperado, mesesPessimista,
    /** O desconto volta dentro da fidelidade (no esperado e no pessimista). */
    pagaEsperado: mesesEsperado !== null && mesesEsperado <= meses,
    pagaPessimista: mesesPessimista !== null && mesesPessimista <= meses,
    /** Lucro do plano na fidelidade menos o desconto (o que sobra no fim). */
    sobraEsperada: r2(p.lucroEsperado * meses - desconto),
    sobraPessimista: r2(p.lucroPessimista * meses - desconto),
    precoParaPagar: precoParaPagar !== null ? r2(precoParaPagar) : null,
    prejuizoCaixa,
  };
};

/** Multa proporcional: quem sai no mês m devolve o desconto dos meses que faltam (desconto × (meses − m) ÷ meses). */
export const multaProporcional = (desconto: number, meses: number, mes: number) =>
  r2(Math.max(0, desconto * (Math.max(1, meses) - Math.min(Math.max(0, mes), meses)) / Math.max(1, meses)));
