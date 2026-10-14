// Preço praticado x preço de tabela no carrinho: desconto (abaixo da tabela) e acréscimo (acima), separados por linha
// para um não esconder o outro. Regras puras, testadas em ajustesCarrinho.test.ts.

export interface LinhaAjuste { price: number; quantity: number; originalPrice?: number; precoTabela?: number }

const centavos = (v: number) => Math.round(v * 100);

/** Preço de tabela da linha (sem ajuste manual, é o próprio preço). */
export const precoBaseLinha = (l: LinhaAjuste) => l.originalPrice || l.precoTabela || l.price;

/** Ajuste de uma linha em relação à tabela: tipo, percentual e valor no total da linha. */
export const ajusteDaLinha = (l: LinhaAjuste) => {
  const base = precoBaseLinha(l);
  const dif = centavos(l.price) - centavos(base);
  if (Math.abs(dif) < 1 || base <= 0) return { tipo: 'NENHUM' as const, pct: 0, valor: 0 };
  return {
    tipo: dif < 0 ? 'DESCONTO' as const : 'ACRESCIMO' as const,
    pct: Math.round((Math.abs(dif) / centavos(base)) * 1000) / 10,
    valor: Math.abs(centavos(l.price * l.quantity) - centavos(base * l.quantity)) / 100,
  };
};

/** Totais do carrinho: subtotal pela tabela, descontos e acréscimos por item (centavos certos). */
export const ajustesDoCarrinho = (linhas: LinhaAjuste[]) => {
  let tabela = 0, descontos = 0, acrescimos = 0;
  for (const l of linhas) {
    const base = centavos(precoBaseLinha(l) * l.quantity);
    const praticado = centavos(l.price * l.quantity);
    tabela += base;
    if (praticado < base) descontos += base - praticado; else acrescimos += praticado - base;
  }
  return { subtotalTabela: tabela / 100, descontos: descontos / 100, acrescimos: acrescimos / 100 };
};
