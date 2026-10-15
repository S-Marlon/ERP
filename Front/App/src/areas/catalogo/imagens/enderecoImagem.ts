// Endereço para desenhar uma imagem no editor: a do próprio servidor vai direto; a de fora (ex.: site do fornecedor)
// passa pelo repasse do servidor, porque o navegador não deixa desenhar no quadro imagem de outro site.
import { API_URL } from '../../../shared/api/config';

export const enderecoParaDesenho = (url: string) => {
  if (/^(data|blob):/i.test(url)) return url;
  try {
    if (new URL(url).origin === new URL(API_URL).origin) return url;
  } catch { return url; }
  return `${API_URL}/api/catalogo/imagens/repassar?tenant_id=1&url=${encodeURIComponent(url)}`;
};
