// Regras puras das fotos do ML: entender o que o operador colou (link ou código) para buscar as fotos.

import { ehImagemDeMedidas } from '../../../areas/catalogo/produtos/ordemAnexos';

/** Imagem gerada pelo editor ou pelo gerador de medidas: já tem medidas desenhadas, não serve de base (regra do catálogo). */
export const ehImagemGerada = ehImagemDeMedidas;

export interface FotoDaVariacao { chave: string; url: string; nome: string }

/**
 * Fotos de uma variação no ML, na ordem combinada: as fotos do item na ordem dele (principal, medidas, outras) e depois
 * as outras fotos da família (aplicação, embalagem). A principal-modelo da família é a base crua do editor (sem as
 * medidas): não vai às variações, só à que não tem nenhuma foto (o ML não aceita anúncio sem foto). Sem repetir arquivo.
 * chave: id do anexo, ou "familia:<link>" (é como o ERP guarda o id da foto que subiu ao ML).
 */
export const fotosDaVariacao = (
  doItem: { idAnexo: number; url: string; nome: string }[], daFamilia: { url: string; nome: string }[],
): FotoDaVariacao[] => {
  const familia = daFamilia.map(f => ({ chave: `familia:${f.url}`, url: f.url, nome: f.nome }));
  const proprias = doItem.map(f => ({ chave: String(f.idAnexo), url: f.url, nome: f.nome }));
  const lista = [...(proprias.length ? [] : familia.slice(0, 1)), ...proprias, ...familia.slice(1)];
  const vistas = new Set<string>();
  return lista.filter(f => (vistas.has(f.url) ? false : (vistas.add(f.url), true)));
};

/**
 * Link ou código colado -> anúncio (MLB123…) ou produto do catálogo (link com /p/MLB…). Aceita "MLB-123", "MLB123",
 * links de produto.mercadolivre.com.br e www.mercadolivre.com.br/…/p/MLB….
 */
export const referenciaDeFoto = (texto: string): { tipo: 'ANUNCIO' | 'CATALOGO'; id: string } | null => {
  const t = String(texto || '').trim().toUpperCase();
  if (!t) return null;
  const catalogo = t.match(/\/P\/(MLB\d{5,})/);
  if (catalogo) return { tipo: 'CATALOGO', id: catalogo[1] };
  const anuncio = t.match(/MLB-?(\d{6,})/);
  if (anuncio) return { tipo: 'ANUNCIO', id: `MLB${anuncio[1]}` };
  return null;
};

export { urlPublicaDeImagem } from '../../../areas/catalogo/imagens/enderecoImagem';
