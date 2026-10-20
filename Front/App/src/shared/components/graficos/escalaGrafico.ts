// Escala do gráfico de barras: as séries positivas empilham para cima, as negativas (saídas) para baixo, e a linha
// (ex.: saldo acumulado) também precisa caber. O zero fica onde a proporção mandar.

export interface SerieGrafico { chave: string; nome: string; cor: string; negativa?: boolean }
export interface PontoGrafico { chave: string; rotulo: string; valores: Record<string, number>; linha?: number }

export const limitesDoGrafico = (pontos: PontoGrafico[], series: SerieGrafico[]) => {
  let max = 0, min = 0;
  for (const p of pontos) {
    const cima = series.filter(s => !s.negativa).reduce((a, s) => a + Math.max(0, p.valores[s.chave] || 0), 0);
    const baixo = series.filter(s => s.negativa).reduce((a, s) => a + Math.max(0, p.valores[s.chave] || 0), 0);
    max = Math.max(max, cima, p.linha ?? 0);
    min = Math.min(min, baixo ? -baixo : 0, p.linha ?? 0);
  }
  if (max === 0 && min === 0) max = 1;   // tudo zerado: um eixo qualquer
  return { max, min };
};

/** De quantos em quantos pontos escrever o rótulo do eixo (no máximo ~12 rótulos). */
export const passoDosRotulos = (n: number, maximo = 12) => (n <= maximo ? 1 : Math.ceil(n / maximo));
