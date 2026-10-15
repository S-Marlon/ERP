// Imagens de fora (ex.: foto do site do fornecedor): o servidor busca e repassa, porque o navegador não deixa desenhar
// no editor uma imagem de outro site. Só endereço público (nada de rede interna).

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
