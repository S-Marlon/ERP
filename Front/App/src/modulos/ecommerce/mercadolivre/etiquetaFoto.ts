// Texto da etiqueta de medida das fotos: campos de cada item (o que varia no anúncio e os atributos do cadastro),
// modelo com {Campo} e conversão de unidade (200 mm -> 20 cm). Regras puras, testadas em etiquetaFoto.test.ts.
import type { AnuncioDetalhe, ItemDoAnuncio } from './mercadoLivreApi';

import type { CampoEtiqueta } from '../../../areas/catalogo/imagens/etiqueta';
export type { CampoEtiqueta } from '../../../areas/catalogo/imagens/etiqueta';
export { converterMedidas, textoDoModelo } from '../../../areas/catalogo/imagens/etiqueta';

const limpar = (s: string) => s.replace(/\s+/g, ' ').trim();
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Campos do item que podem ir na foto: o que varia no anúncio (atributos do ML) e os atributos do cadastro do ERP. */
/** Foto sobre a qual se desenha a medida: a 1ª sem medidas desenhadas (nunca uma imagem gerada antes pelo editor). */
export const fotoBaseDoItem = (item: Pick<ItemDoAnuncio, 'fotoUrl' | 'fotoBase'>) => (item.fotoBase !== undefined ? item.fotoBase : item.fotoUrl);

export const camposDoItem = (det: Pick<AnuncioDetalhe, 'eixos' | 'atributosCategoria' | 'atributosErp'>, item: Pick<ItemDoAnuncio, 'valores' | 'valoresErp'>): CampoEtiqueta[] => {
  const campos: CampoEtiqueta[] = [];
  const vistos = new Set<string>();
  for (const e of det.eixos) {
    const v = item.valores[e];
    const nome = det.atributosCategoria.find(a => a.id === e)?.nome || e;
    if (!v?.valor) continue;
    campos.push({ chave: nome, nome, valor: limpar(`${v.valor}${v.unidade && !String(v.valor).includes(v.unidade) ? ` ${v.unidade}` : ''}`) });
    vistos.add(normal(nome));
  }
  for (const a of det.atributosErp) {
    const valor = item.valoresErp?.[String(a.id)];
    if (!valor || vistos.has(normal(a.nome))) continue;
    campos.push({ chave: a.nome, nome: a.nome, valor: limpar(String(valor)) });
    vistos.add(normal(a.nome));
  }
  return campos;
};

/** Modelo padrão: os campos que variam no anúncio (ex.: "{Comprimento}"). */
export const modeloPadrao = (det: Pick<AnuncioDetalhe, 'eixos' | 'atributosCategoria'>) =>
  det.eixos.map(e => `{${det.atributosCategoria.find(a => a.id === e)?.nome || e}}`).join(' · ');
