// Etiquetas de gôndola desatualizadas. Regras puras.
// - Categoria decide (com herança da categoria pai): SEMPRE tem etiqueta, NUNCA tem (ex.: rolamentos), ou
//   AUTOMÁTICO (padrão): só acompanha itens que já tiveram etiqueta impressa.
// - A comparação é com a última etiqueta impressa do item (estoque_etiquetas_impressas): preço ou unidade diferentes.

export type RegraEtiqueta = 'SEMPRE' | 'NUNCA' | 'AUTO';

export interface CategoriaRegra { id: number; pai: number | null; etiqueta: number | null }

/** Regra efetiva da categoria: a primeira definida subindo pela árvore; nenhuma definida = automático. */
export const regraDaCategoria = (idCategoria: number | null, mapa: Map<number, CategoriaRegra>): RegraEtiqueta => {
  let atual = idCategoria;
  const vistos = new Set<number>();
  while (atual && mapa.has(atual) && !vistos.has(atual)) {
    vistos.add(atual);
    const c = mapa.get(atual)!;
    if (c.etiqueta === 1) return 'SEMPRE';
    if (c.etiqueta === 0) return 'NUNCA';
    atual = c.pai;
  }
  return 'AUTO';
};

export interface EtiquetaImpressa { unidade: string; preco: number; impressoEm: string | null }
export type MotivoDesatualizada = 'PRECO_MUDOU' | 'UNIDADE_MUDOU' | 'SEM_ETIQUETA';

const sigla = (u: unknown) => String(u ?? '').trim().toUpperCase();

/** Por que o item precisa de etiqueta nova (null = a etiqueta da gôndola está certa ou o item não tem etiqueta). */
export const motivoDesatualizada = (
  regra: RegraEtiqueta,
  impressa: EtiquetaImpressa | null,
  atual: { preco: number; unidade: string }
): MotivoDesatualizada | null => {
  if (regra === 'NUNCA') return null;
  if (!impressa) return regra === 'SEMPRE' && atual.preco > 0 ? 'SEM_ETIQUETA' : null;
  if (sigla(impressa.unidade) !== sigla(atual.unidade)) return 'UNIDADE_MUDOU';
  if (Math.abs(Number(impressa.preco) - Number(atual.preco)) >= 0.005) return 'PRECO_MUDOU';
  return null;
};

/** Normaliza o que a tela manda ao registrar etiquetas impressas (descarta linhas inválidas). */
export const lerImpressas = (corpo: unknown): Array<{ idItem: number; unidade: string; preco: number }> => {
  const lista = Array.isArray((corpo as { itens?: unknown })?.itens) ? (corpo as { itens: unknown[] }).itens : [];
  const porItem = new Map<string, { idItem: number; unidade: string; preco: number }>();
  for (const bruto of lista) {
    const i = bruto as { idItem?: unknown; unidade?: unknown; preco?: unknown };
    const idItem = Number(i.idItem);
    const preco = Number(i.preco);
    if (!Number.isInteger(idItem) || idItem <= 0 || !Number.isFinite(preco) || preco < 0) continue;
    const unidade = sigla(i.unidade).slice(0, 10);
    porItem.set(`${idItem}|${unidade}`, { idItem, unidade, preco: Math.round(preco * 10000) / 10000 });
  }
  return [...porItem.values()];
};
