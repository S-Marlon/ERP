// Linhas do anúncio: o mesmo item pode ser vendido em mais de uma unidade (ex.: UN e kit c/10), cada uma uma linha
// com preço, estoque e situação no ML próprios. Aqui, sem tela: em que unidades o item ainda pode entrar e o rótulo.
import type { ItemDoAnuncio } from './mercadoLivreApi';

type Linha = Pick<ItemDoAnuncio, 'idItem' | 'idLinha' | 'unidadeMl' | 'unidades' | 'siglaBase'>;

export interface OpcaoUnidade { idUnidade: number | null; rotulo: string; fator: number }

const numero = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ','));

/** Unidades em que o item da linha ainda não está neste anúncio (null = a unidade base do item). */
export const unidadesLivres = (linhas: Linha[], linha: Linha): OpcaoUnidade[] => {
  const usadas = new Set(linhas.filter(l => l.idItem === linha.idItem).map(l => l.unidadeMl?.idUnidade ?? null));
  const base = linha.siglaBase || 'unidade';
  const opcoes: OpcaoUnidade[] = [
    { idUnidade: null, rotulo: `${base} (unidade do ERP)`, fator: 1 },
    ...linha.unidades.map(u => ({ idUnidade: u.idUnidade, rotulo: `${u.nome || u.sigla} (${numero(u.fator)} ${base})`, fator: u.fator })),
  ];
  return opcoes.filter(o => !usadas.has(o.idUnidade));
};

/** Rótulo curto da unidade vendida na linha (ex.: "kit c/10"); vazio na unidade base. */
export const rotuloDaUnidade = (linha: Pick<ItemDoAnuncio, 'unidadeMl' | 'siglaBase'>) =>
  linha.unidadeMl ? `${linha.unidadeMl.sigla} · ${numero(linha.unidadeMl.fator)} ${linha.siglaBase || 'un'}` : '';

/**
 * O anúncio com uma linha por item (a da unidade base primeiro): para o que é do cadastro do item, como fotos, editor de
 * imagem e gerador de medidas, que não devem repetir o item vendido em duas unidades.
 */
export const umaLinhaPorItem = <T extends { itens: Pick<ItemDoAnuncio, 'idItem' | 'unidadeMl'>[] }>(det: T): T => {
  const porItem = new Map<number, T['itens'][number]>();
  for (const l of det.itens) if (!porItem.has(l.idItem) || (!l.unidadeMl && porItem.get(l.idItem)!.unidadeMl)) porItem.set(l.idItem, l);
  const escolhidas = new Set(porItem.values());
  return { ...det, itens: det.itens.filter(l => escolhidas.has(l)) };
};

/** Quantas linhas o item tem no anúncio (com mais de uma, a tela mostra a unidade de cada). */
export const linhasDoItem = (linhas: Pick<ItemDoAnuncio, 'idItem'>[], idItem: number) => linhas.filter(l => l.idItem === idItem).length;
