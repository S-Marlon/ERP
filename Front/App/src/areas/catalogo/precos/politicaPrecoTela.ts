// Ajudas da tela "Varejo e atacado em lote": árvore de categorias para o filtro e o resumo da prévia.
import type { ItemPrevia, OpcoesPolitica } from './politicaPrecoApi';

export interface NoArvore { value: number; title: string; children?: NoArvore[] }

/** Categorias em árvore (TreeSelect), irmãs em ordem alfabética. */
export const arvoreCategorias = (cats: OpcoesPolitica['categorias']): NoArvore[] => {
  const ids = new Set(cats.map(c => c.id));
  const filhos = (pai: number | null): NoArvore[] => cats
    .filter(c => (pai === null ? c.idPai === null || !ids.has(c.idPai) : c.idPai === pai))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map(c => {
      const sub = filhos(c.id);
      return sub.length ? { value: c.id, title: c.nome, children: sub } : { value: c.id, title: c.nome };
    });
  return filhos(null);
};

/** A categoria e todas as que estão abaixo dela. */
export const comSubcategorias = (cats: OpcoesPolitica['categorias'], id: number) => {
  const saida = new Set<number>([id]);
  const fila = [id];
  while (fila.length) {
    const atual = fila.shift()!;
    for (const c of cats) if (c.idPai === atual && !saida.has(c.id)) { saida.add(c.id); fila.push(c.id); }
  }
  return saida;
};

/** Famílias da categoria (ou das subcategorias); sem categoria, todas. */
export const familiasDaCategoria = (opcoes: OpcoesPolitica, idCategoria: number | null | undefined) => {
  if (!idCategoria) return opcoes.familias;
  const cats = comSubcategorias(opcoes.categorias, idCategoria);
  return opcoes.familias.filter(f => f.categorias.some(c => cats.has(c)));
};

/**
 * Marcas que fazem sentido no filtro: as das famílias escolhidas; sem família, as da categoria (com as subcategorias);
 * sem nada, todas.
 */
export const marcasDoFiltro = (opcoes: OpcoesPolitica, f: { idCategoria?: number | null; idsFamilias?: number[] }) => {
  const fams = new Set(f.idsFamilias || []);
  if (fams.size) return opcoes.marcas.filter(m => m.familias.some(x => fams.has(x)));
  if (!f.idCategoria) return opcoes.marcas;
  const cats = comSubcategorias(opcoes.categorias, f.idCategoria);
  return opcoes.marcas.filter(m => m.categorias.some(c => cats.has(c)));
};

/** Contagens da prévia: o que muda, o que já está igual, o que não dá para aplicar e quantos têm aviso. */
export const resumoPrevia = (itens: ItemPrevia[]) => ({
  total: itens.length,
  altera: itens.filter(i => i.plano.situacao === 'ALTERA').length,
  igual: itens.filter(i => i.plano.situacao === 'IGUAL').length,
  erro: itens.filter(i => i.plano.situacao === 'ERRO').length,
  avisos: itens.filter(i => i.plano.situacao === 'ALTERA' && i.plano.avisos.length > 0).length,
});
