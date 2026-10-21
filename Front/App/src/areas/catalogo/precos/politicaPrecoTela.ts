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

/** Contagens da prévia: o que muda, o que já está igual, o que não dá para aplicar e quantos têm aviso. */
export const resumoPrevia = (itens: ItemPrevia[]) => ({
  total: itens.length,
  altera: itens.filter(i => i.plano.situacao === 'ALTERA').length,
  igual: itens.filter(i => i.plano.situacao === 'IGUAL').length,
  erro: itens.filter(i => i.plano.situacao === 'ERRO').length,
  avisos: itens.filter(i => i.plano.situacao === 'ALTERA' && i.plano.avisos.length > 0).length,
});
