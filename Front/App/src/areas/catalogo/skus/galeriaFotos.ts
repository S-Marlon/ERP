// Regras da galeria de fotos do item (sem tela): a ordem é principal -> imagem de medidas -> o resto como o operador
// arrastar (o servidor aplica a mesma regra ao salvar), mover uma foto e os avisos de cada foto.

/** Imagem de medidas gerada pelo editor ou pelo gerador do ML (`SKU-editada.jpg`, `SKU-medida.jpg`). */
export const ehImagemDeMedidas = (nomeArquivo: string | null | undefined) => /-(editada|medida)\.jpe?g$/i.test(String(nomeArquivo || '').trim());

/** Lista com o elemento de `de` levado para `para`. */
export const moverFoto = <T,>(lista: T[], de: number, para: number): T[] => {
  if (de === para || de < 0 || de >= lista.length) return lista;
  const nova = [...lista];
  const [x] = nova.splice(de, 1);
  nova.splice(Math.min(Math.max(para, 0), nova.length), 0, x);
  return nova;
};

/** A mesma regra do servidor, para a tela já mostrar a ordem final enquanto salva. */
export const comMedidasEmSegundo = <T extends { nome_arquivo: string }>(lista: T[]): T[] => {
  if (!lista.length || ehImagemDeMedidas(lista[0].nome_arquivo)) return lista;
  const i = lista.findIndex((f, k) => k > 0 && ehImagemDeMedidas(f.nome_arquivo));
  return i > 1 ? moverFoto(lista, i, 1) : lista;
};

export type AvisoFoto = 'PEQUENA' | 'PRINCIPAL_COM_MEDIDAS' | 'FORA_DO_LIMITE' | 'REPETIDA';

/** Avisos de uma foto: menor que 500 px (o ML recusa), principal com medidas, além do limite da categoria, repetida. */
export const avisosDaFoto = (
  foto: { nome_arquivo: string; url_anexo: string }, posicao: number, todas: { url_anexo: string; nome_arquivo: string }[],
  tamanho: { w: number; h: number } | undefined, limite?: number,
): AvisoFoto[] => {
  const avisos: AvisoFoto[] = [];
  if (tamanho && Math.max(tamanho.w, tamanho.h) < 500) avisos.push('PEQUENA');
  if (posicao === 0 && ehImagemDeMedidas(foto.nome_arquivo) && todas.some(f => !ehImagemDeMedidas(f.nome_arquivo))) avisos.push('PRINCIPAL_COM_MEDIDAS');
  if (limite && posicao >= limite) avisos.push('FORA_DO_LIMITE');
  const igual = (f: { url_anexo: string; nome_arquivo: string }) =>
    f.url_anexo === foto.url_anexo || (ehImagemDeMedidas(foto.nome_arquivo) && f.nome_arquivo === foto.nome_arquivo);
  if (todas.slice(0, posicao).some(igual)) avisos.push('REPETIDA');
  return avisos;
};

export interface FotoNoCanal { url: string; nome: string; daFamilia: boolean }

/**
 * Fotos de uma variação como vão ao canal (mesma regra do envio ao ML): as fotos do item na ordem dele e depois as outras
 * fotos da família. A modelo da família (a base crua do editor) só vai à variação que não tem nenhuma foto.
 */
export const fotosNoCanal = (doItem: { url: string; nome: string }[], daFamilia: { url: string; nome: string }[]): FotoNoCanal[] => {
  const lista: FotoNoCanal[] = [
    ...(doItem.length ? [] : daFamilia.slice(0, 1).map(f => ({ ...f, daFamilia: true }))),
    ...doItem.map(f => ({ ...f, daFamilia: false })),
    ...daFamilia.slice(1).map(f => ({ ...f, daFamilia: true })),
  ];
  const vistas = new Set<string>();
  return lista.filter(f => (vistas.has(f.url) ? false : (vistas.add(f.url), true)));
};
