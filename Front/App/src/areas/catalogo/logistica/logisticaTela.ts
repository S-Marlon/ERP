// Edição da logística em lote: o rascunho de peso e medidas por item (digitado na grade ou aplicado nos marcados) e o
// que vai para o servidor (só as linhas que mudaram).
import type { ItemLogistica } from './logisticaApi';

export interface ValoresLogistica { pesoKg: number | null; altura: number | null; largura: number | null; comprimento: number | null }
export type Rascunho = Record<number, Partial<ValoresLogistica>>;

const doItem = (i: ItemLogistica): ValoresLogistica => ({
  pesoKg: i.pesoKg, altura: i.medidas?.altura ?? null, largura: i.medidas?.largura ?? null, comprimento: i.medidas?.comprimento ?? null,
});

/** Valores na tela: o que foi digitado por cima do que está gravado. */
export const valoresDaLinha = (i: ItemLogistica, r: Rascunho): ValoresLogistica => ({ ...doItem(i), ...(r[i.idItem] || {}) });

const iguais = (a: number | null, b: number | null) => (a ?? null) === (b ?? null) || (a !== null && b !== null && Math.abs(a - b) < 1e-9);

/** Linhas que mudaram, prontas para salvar. */
export const alteracoes = (itens: ItemLogistica[], r: Rascunho) => itens
  .map(i => ({ i, v: valoresDaLinha(i, r), g: doItem(i) }))
  .filter(({ v, g }) => !iguais(v.pesoKg, g.pesoKg) || !iguais(v.altura, g.altura) || !iguais(v.largura, g.largura) || !iguais(v.comprimento, g.comprimento))
  .map(({ i, v }) => ({ idItem: i.idItem, ...v }));

/** Põe os mesmos valores nos itens marcados (só os campos preenchidos). */
export const aplicarNosMarcados = (r: Rascunho, ids: number[], valores: Partial<ValoresLogistica>): Rascunho => {
  const preenchidos = Object.fromEntries(Object.entries(valores).filter(([, v]) => v !== null && v !== undefined));
  const novo = { ...r };
  for (const id of ids) novo[id] = { ...(novo[id] || {}), ...preenchidos };
  return novo;
};
