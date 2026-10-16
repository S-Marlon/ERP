// Ordem das imagens do item (principal primeiro, depois a galeria). Regra combinada: principal -> imagem de medidas ->
// o resto na ordem que o operador quiser. A 1ª da lista é sempre a principal.

/**
 * Imagem de medidas gerada pelo editor ou pelo gerador do ML (`SKU-editada.jpg`, `SKU-medida.jpg`): fica logo depois
 * da principal e não serve de base para desenhar outra.
 */
export const ehImagemDeMedidas = (nomeArquivo: string | null | undefined) => /-(editada|medida)\.jpe?g$/i.test(String(nomeArquivo || '').trim());
/** Foto do pacote com N unidades gerada no editor ("SKU-kit10.jpg"): N, ou null se não é foto de kit. */
export const kitDaImagem = (nomeArquivo: string | null | undefined): number | null => {
  const m = String(nomeArquivo || '').trim().match(/-kit(\d+)\.(jpe?g|png|webp)$/i);
  return m ? Number(m[1]) : null;
};
/** Imagem gerada no editor (medidas ou foto de kit): não serve de foto-base do item. */
export const ehImagemGeradaNoEditor = (nomeArquivo: string | null | undefined) => ehImagemDeMedidas(nomeArquivo) || kitDaImagem(nomeArquivo) !== null;

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

/**
 * Ordem final: a pedida (ids que não são do item saem; os que faltaram vão no fim, na ordem de hoje) e a 1ª imagem de
 * medidas logo depois da principal (se ela mesma não for a principal).
 */
export const ordemFinalDasImagens = (atuais: { id: number; medidas: boolean }[], pedida?: number[]) => {
  const conhecidos = new Set(atuais.map(a => a.id));
  const inicio = [...new Set((pedida || []).filter(id => conhecidos.has(id)))];
  const ordem = [...inicio, ...atuais.map(a => a.id).filter(id => !inicio.includes(id))];
  const medidas = new Set(atuais.filter(a => a.medidas).map(a => a.id));
  const i = ordem.findIndex((id, k) => k > 0 && medidas.has(id));
  if (i > 1 && !medidas.has(ordem[0])) ordem.splice(1, 0, ...ordem.splice(i, 1));
  return ordem;
};

/** Ids válidos de uma lista vinda do front (inteiros > 0, sem repetir, até `limite`). */
export const lerIds = (v: unknown, limite = 300): number[] => {
  const lista = Array.isArray(v) ? v : String(v ?? '').split(',');
  return [...new Set(lista.map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, limite);
};
