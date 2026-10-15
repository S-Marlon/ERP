// Regras puras das fotos do ML: entender o que o operador colou (link ou código) para buscar as fotos.

import { ehImagemDeMedidas } from '../../../areas/catalogo/produtos/ordemAnexos';

/** Imagem gerada pelo editor ou pelo gerador de medidas: já tem medidas desenhadas, não serve de base (regra do catálogo). */
export const ehImagemGerada = ehImagemDeMedidas;

export interface FotoDaVariacao { chave: string; url: string; nome: string }

/**
 * Fotos de uma variação no ML, na ordem combinada: a principal própria do item (foto limpa) ou, se o item não tem foto
 * ou começa por uma imagem de medidas, a principal-modelo da família; depois as fotos do item na ordem dele (medidas
 * logo após a principal); por fim as outras fotos da família (aplicação, embalagem). Sem repetir arquivo.
 * chave: id do anexo, ou "familia:<link>" (é como o ERP guarda o id da foto que subiu ao ML).
 */
export const fotosDaVariacao = (
  doItem: { idAnexo: number; url: string; nome: string }[], daFamilia: { url: string; nome: string }[],
): FotoDaVariacao[] => {
  const familia = daFamilia.map(f => ({ chave: `familia:${f.url}`, url: f.url, nome: f.nome }));
  const proprias = doItem.map(f => ({ chave: String(f.idAnexo), url: f.url, nome: f.nome }));
  const comecaLimpa = proprias.length > 0 && !ehImagemDeMedidas(proprias[0].nome);
  const lista = [...(comecaLimpa ? [] : familia.slice(0, 1)), ...proprias, ...familia.slice(1)];
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

/** Endereço que o servidor pode buscar para o gerador de imagens: http(s) público (nada de rede interna). */
export const urlPublicaDeImagem = (texto: string) => {
  let u: URL;
  try { u = new URL(String(texto || '').trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h === '::1' || h === '[::1]' || /^0\./.test(h) || /^127\./.test(h) || /^10\./.test(h)
    || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return null;
  return u.toString();
};
