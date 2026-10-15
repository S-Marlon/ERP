// Formas de venda de um item no ML: unitário e conjuntos (kit c/2, c/10...). Cada forma é uma linha do anúncio
// (item + unidade); a que ainda não existe é simulada com o mesmo custo × quantidade, para comparar antes de criar.

/** Sigla da unidade de um kit com `quantidade` unidades (ex.: KIT10); cabe no varchar(10) da unidade. */
export const siglaDoKit = (quantidade: number) => `KIT${Math.round(quantidade)}`;

/** Quantidades pedidas ("1,2,10"): inteiras de 1 a 999, sem repetir, em ordem, até 8. Sem nada: 1, 2 e 10. */
export const lerQuantidades = (v: unknown): number[] => {
  const lista = String(v ?? '').split(',').map(x => Number(String(x).trim())).filter(n => Number.isInteger(n) && n >= 1 && n <= 999);
  const unicas = [...new Set(lista)].sort((a, b) => a - b).slice(0, 8);
  return unicas.length ? unicas : [1, 2, 10];
};

/** Preços informados para simular ("10:34.9,2:7"): quantidade -> preço do conjunto. */
export const lerPrecos = (v: unknown): Map<number, number> => {
  const m = new Map<number, number>();
  for (const parte of String(v ?? '').split(',')) {
    const [q, p] = parte.split(':').map(x => Number(String(x).trim()));
    if (Number.isInteger(q) && q >= 1 && p > 0) m.set(q, Math.round(p * 100) / 100);
  }
  return m;
};

/** Quantas unidades a linha vende por vez: o fator da unidade do ML, ou 1 na unidade base. */
export const quantidadeDaLinha = (l: { unidadeMl?: { fator: number } | null }) => (l.unidadeMl && l.unidadeMl.fator > 0 ? l.unidadeMl.fator : 1);

/**
 * As formas a mostrar: as pedidas e as que o item já tem no anúncio (ex.: um kit c/8 criado antes), cada uma com a
 * linha dela quando existe.
 */
export const formasDoItem = <L extends { unidadeMl?: { fator: number } | null }>(linhasDoItem: L[], pedidas: number[]) => {
  const quantidades = [...new Set([...pedidas, ...linhasDoItem.map(quantidadeDaLinha)])].sort((a, b) => a - b);
  return quantidades.map(q => ({ quantidade: q, linha: linhasDoItem.find(l => quantidadeDaLinha(l) === q) || null }));
};

/** Preço por unidade de um conjunto (para comparar formas e o mercado). */
export const precoPorUnidade = (preco: number, quantidade: number) => Math.round((preco / Math.max(1, quantidade)) * 100) / 100;
