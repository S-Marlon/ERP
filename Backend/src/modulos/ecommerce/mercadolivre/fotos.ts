// Regras puras das fotos do ML: entender o que o operador colou (link ou código) para buscar as fotos.

import { ehImagemDeMedidas } from '../../../areas/catalogo/produtos/ordemAnexos';

/** Imagem gerada pelo editor ou pelo gerador de medidas: já tem medidas desenhadas, não serve de base (regra do catálogo). */
export const ehImagemGerada = ehImagemDeMedidas;

export interface FotoDaVariacao { chave: string; url: string; nome: string }

/**
 * Fotos de uma variação no ML, na ordem combinada: a foto limpa do item ou, se o item não tem foto ou começa por uma
 * imagem de medidas, a PRINCIPAL da família (foto limpa do produto: o ML pede a 1ª sem texto); depois as fotos do item
 * na ordem dele (medidas logo após a principal); por fim as COMUNS da família. As de uso EDITOR (gabarito do editor)
 * não vão. Sem repetir arquivo.
 * chave: id do anexo, ou "familia:<link>" (é como o ERP guarda o id da foto que subiu ao ML).
 */
export const fotosDaVariacao = (
  doItem: { idAnexo: number; url: string; nome: string }[], daFamilia: { url: string; nome: string; uso?: string }[],
): FotoDaVariacao[] => {
  const comoFoto = (f: { url: string; nome: string }) => ({ chave: `familia:${f.url}`, url: f.url, nome: f.nome });
  const principal = daFamilia.filter(f => f.uso === 'PRINCIPAL').map(comoFoto);
  const comuns = daFamilia.filter(f => (f.uso || 'COMUM') === 'COMUM').map(comoFoto);
  const proprias = doItem.map(f => ({ chave: String(f.idAnexo), url: f.url, nome: f.nome }));
  const comecaLimpa = proprias.length > 0 && !ehImagemDeMedidas(proprias[0].nome);
  const lista = [...(comecaLimpa ? [] : principal.slice(0, 1)), ...proprias, ...comuns];
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
