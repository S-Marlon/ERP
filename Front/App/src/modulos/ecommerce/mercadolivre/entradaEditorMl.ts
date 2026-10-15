// Anúncio do ML -> entrada do editor de imagem (do catálogo): uma linha por item (o item vendido em kit não repete),
// com a foto limpa e os campos do item (o que varia no anúncio e os atributos do cadastro).
import type { EntradaEditor } from '../../../areas/catalogo/imagens/editor/entradaEditor';
import type { AnuncioDetalhe } from './mercadoLivreApi';
import { camposDoItem, fotoBaseDoItem, modeloPadrao } from './etiquetaFoto';
import { umaLinhaPorItem } from './linhasAnuncio';

export const entradaDoAnuncio = (det: AnuncioDetalhe, idFotoFamiliaInicial: number | null = null): EntradaEditor => {
  const porItem = umaLinhaPorItem(det);
  return {
    chave: `ml-${det.id}`, idFamilia: det.idFamilia, familia: det.familia, modeloPadrao: modeloPadrao(det) || '',
    fotoPorItem: true, idFotoFamiliaInicial,
    itens: porItem.itens.map(i => ({
      idItem: i.idItem, sku: i.sku, nome: i.tituloMl || i.nome, foto: fotoBaseDoItem(i), campos: camposDoItem(det, i), noMl: !!i.ml.mlbId,
    })),
  };
};
