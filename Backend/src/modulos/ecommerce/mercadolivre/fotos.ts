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
