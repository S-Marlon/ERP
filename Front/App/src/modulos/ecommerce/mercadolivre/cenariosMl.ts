// Comparação dos cenários de venda no ML (Clássico × Premium, com e sem frete grátis) pelo volume: quanto cada cenário
// precisa vender para lucrar o mesmo que o de hoje. Regras puras, testadas em cenariosMl.test.ts.

export interface CenarioBase { tipo: string; freteGratis: boolean; atual: boolean; lucro: number }

export interface ComparacaoCenario {
  lucroMes: number;                  // lucro no mês com as vendas informadas (mesmo volume em todos)
  vendasParaEmpatar: number | null;  // vendas/mês para lucrar o mesmo que hoje (null: dá prejuízo, nunca empata)
  multiplicador: number | null;      // vendasParaEmpatar ÷ vendas de hoje
  melhorPorVenda: boolean;           // o de maior lucro por venda
}

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * Com `vendasMes` vendas por mês no cenário de hoje, quanto cada cenário precisa vender para dar o mesmo lucro no mês.
 * Ex.: hoje R$ 7,07 por venda × 10 = R$ 70,70; com frete grátis (R$ 1,12 por venda) precisa de 64 vendas (6,3×).
 */
export const compararCenarios = <T extends CenarioBase>(cenarios: T[], vendasMes: number): (T & ComparacaoCenario)[] => {
  const hoje = cenarios.find(c => c.atual) || cenarios[0];
  const vendas = Math.max(1, Math.round(vendasMes));
  const lucroHojeMes = hoje ? hoje.lucro * vendas : 0;
  const melhor = Math.max(...cenarios.map(c => c.lucro));
  return cenarios.map(c => {
    let vendasParaEmpatar: number | null = null;
    if (c === hoje) vendasParaEmpatar = vendas;
    else if (c.lucro > 0 && lucroHojeMes > 0) vendasParaEmpatar = Math.ceil(lucroHojeMes / c.lucro - 1e-9);
    else if (c.lucro > 0 && lucroHojeMes <= 0) vendasParaEmpatar = 1;   // hoje dá prejuízo: qualquer venda já ganha
    return {
      ...c,
      lucroMes: r2(c.lucro * vendas),
      vendasParaEmpatar,
      multiplicador: vendasParaEmpatar === null ? null : r2(vendasParaEmpatar / vendas),
      melhorPorVenda: c.lucro === melhor,
    };
  });
};
