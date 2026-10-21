// Cascata (waterfall): cada dedução sai de onde a linha anterior parou; subtotal e resultado recomeçam do zero.
// Devolve o começo e o fim de cada barra na escala do valor, e os limites do eixo.

export type TipoCascata = 'RECEITA' | 'DEDUCAO' | 'SUBTOTAL' | 'RESULTADO';
export interface PassoCascata { tipo: TipoCascata; valor: number }

export const barrasDaCascata = (passos: PassoCascata[]) => {
  let atual = 0;
  const barras = passos.map(p => {
    if (p.tipo === 'DEDUCAO') {
      const de = atual;
      atual += p.valor;
      return { de, ate: atual };
    }
    atual = p.valor;
    return { de: 0, ate: p.valor };
  });
  const todos = barras.flatMap(b => [b.de, b.ate]);
  const min = Math.min(0, ...todos), max = Math.max(0, ...todos);
  return { barras, min, max: max === min ? min + 1 : max };
};
