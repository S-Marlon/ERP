// Ordem das imagens do item (principal primeiro, depois a galeria): colocar uma foto nova numa posição fixa, por exemplo
// a imagem de medidas do editor sempre como 2ª foto.

/** Posição pedida no corpo (1 = primeira); null quando não veio ou não é um número inteiro maior que zero. */
export const lerPosicao = (v: unknown): number | null => {
  const n = Number(v);
  return v !== undefined && v !== null && v !== '' && Number.isInteger(n) && n > 0 ? n : null;
};

/** Ids das imagens na ordem de exibição com a nova na posição pedida (além do fim, vai para o fim). */
export const ordemComNovaNaPosicao = (idsNaOrdem: number[], idNovo: number, posicao: number) => {
  const outros = idsNaOrdem.filter(id => id !== idNovo);
  const i = Math.min(Math.max(posicao - 1, 0), outros.length);
  return [...outros.slice(0, i), idNovo, ...outros.slice(i)];
};
