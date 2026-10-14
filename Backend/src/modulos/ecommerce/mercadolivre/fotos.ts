// Regras puras das fotos do ML: entender o que o operador colou (link ou código) para buscar as fotos.

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
