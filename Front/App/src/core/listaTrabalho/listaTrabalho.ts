// Lista de trabalho global (o "carrinho" da toolbar): itens do catálogo marcados com tags de tarefa
// (tirar etiqueta, comprar, conferir...). Sobrevive à troca de telas e ao recarregar a página.
// Este arquivo é só a regra (funções puras); o estado e a persistência ficam no ListaTrabalhoContext.

export type TagLista = 'ETIQUETAR' | 'COMPRAR' | 'CONFERIR' | 'REVISAR';

export const TAGS_LISTA: Record<TagLista, { label: string; color: string; descricao: string }> = {
  ETIQUETAR: { label: 'Tirar etiqueta', color: 'blue', descricao: 'Vai para a fila da Etiquetagem' },
  COMPRAR: { label: 'Comprar', color: 'orange', descricao: 'Repor / incluir no próximo pedido de compra' },
  CONFERIR: { label: 'Conferir estoque', color: 'purple', descricao: 'Contar ou verificar no inventário' },
  REVISAR: { label: 'Revisar cadastro', color: 'red', descricao: 'Corrigir dados do produto (preço, ficha, foto...)' },
};

export const ehTagLista = (t: unknown): t is TagLista => typeof t === 'string' && t in TAGS_LISTA;

// Opções da etiqueta do item (usadas pela Etiquetagem)
export interface ConfigEtiquetaItem {
  copias: number;
  promo?: boolean;
  lote?: string;
  validade?: string;
}

export interface ItemListaTrabalho {
  idItem: number;
  sku: string;
  nome: string;
  unidade?: string;
  tags: TagLista[];
  quantidade?: number;           // ex.: quanto comprar
  observacao?: string;
  etiqueta?: ConfigEtiquetaItem;
  origem?: string;               // tela que incluiu (ex.: "Consulta de Saldo")
  adicionadoEm: string;
  atualizadoEm: string;
}

export interface ItemBase {
  idItem: number;
  sku: string;
  nome: string;
  unidade?: string;
}

export interface OpcoesInclusao {
  tags: TagLista[];
  quantidade?: number;
  observacao?: string;
  etiqueta?: Partial<ConfigEtiquetaItem>;
  origem?: string;
}

const agoraIso = () => new Date().toISOString();

/** Inclui ou mescla (um item aparece uma vez só; as tags somam). */
export const adicionarItem = (lista: ItemListaTrabalho[], base: ItemBase, opcoes: OpcoesInclusao, agora = agoraIso()): ItemListaTrabalho[] => {
  const tags = opcoes.tags.filter(ehTagLista);
  const existente = lista.find(i => i.idItem === base.idItem);
  const etiqueta = opcoes.etiqueta || tags.includes('ETIQUETAR')
    ? { copias: 1, ...(existente?.etiqueta || {}), ...(opcoes.etiqueta || {}) }
    : existente?.etiqueta;

  if (existente) {
    return lista.map(i => (i.idItem !== base.idItem ? i : {
      ...i,
      sku: base.sku || i.sku,
      nome: base.nome || i.nome,
      unidade: base.unidade ?? i.unidade,
      tags: Array.from(new Set([...i.tags, ...tags])),
      quantidade: opcoes.quantidade ?? i.quantidade,
      observacao: opcoes.observacao ?? i.observacao,
      etiqueta,
      atualizadoEm: agora,
    }));
  }
  return [...lista, {
    ...base,
    tags,
    quantidade: opcoes.quantidade,
    observacao: opcoes.observacao,
    etiqueta,
    origem: opcoes.origem,
    adicionadoEm: agora,
    atualizadoEm: agora,
  }];
};

export const atualizarItem = (
  lista: ItemListaTrabalho[], idItem: number, patch: Partial<Omit<ItemListaTrabalho, 'idItem'>>, agora = agoraIso()
): ItemListaTrabalho[] =>
  lista.map(i => (i.idItem !== idItem ? i : { ...i, ...patch, idItem, atualizadoEm: agora }));

export const alternarTag = (lista: ItemListaTrabalho[], idItem: number, tag: TagLista, agora = agoraIso()) =>
  lista.map(i => {
    if (i.idItem !== idItem) return i;
    const tags = i.tags.includes(tag) ? i.tags.filter(t => t !== tag) : [...i.tags, tag];
    return { ...i, tags, etiqueta: tag === 'ETIQUETAR' && !i.etiqueta ? { copias: 1 } : i.etiqueta, atualizadoEm: agora };
  });

/** Tira a tag do item; item que fica sem nenhuma tarefa sai da lista. */
export const removerTag = (lista: ItemListaTrabalho[], idItem: number, tag: TagLista): ItemListaTrabalho[] =>
  lista
    .map(i => (i.idItem !== idItem ? i : { ...i, tags: i.tags.filter(t => t !== tag) }))
    .filter(i => i.idItem !== idItem || i.tags.length > 0);

/** Conclui uma tarefa para todos (ex.: etiquetas impressas); quem fica sem tag sai da lista. */
export const limparTag = (lista: ItemListaTrabalho[], tag: TagLista, ids?: number[]): ItemListaTrabalho[] =>
  lista
    .map(i => (ids && !ids.includes(i.idItem) ? i : { ...i, tags: i.tags.filter(t => t !== tag) }))
    .filter(i => i.tags.length > 0);

export const removerItem = (lista: ItemListaTrabalho[], idItem: number) => lista.filter(i => i.idItem !== idItem);

export const itensComTag = (lista: ItemListaTrabalho[], tag: TagLista) => lista.filter(i => i.tags.includes(tag));

export const contagemPorTag = (lista: ItemListaTrabalho[]): Record<TagLista, number> => {
  const c = { ETIQUETAR: 0, COMPRAR: 0, CONFERIR: 0, REVISAR: 0 } as Record<TagLista, number>;
  for (const i of lista) for (const t of i.tags) c[t] += 1;
  return c;
};

/** Leitura defensiva do que estava salvo (versão antiga ou corrompida vira lista vazia/limpa). */
export const normalizarListaSalva = (bruto: unknown): ItemListaTrabalho[] => {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((i: any) => i && Number.isInteger(Number(i.idItem)) && Number(i.idItem) > 0)
    .map((i: any) => ({
      idItem: Number(i.idItem),
      sku: String(i.sku || ''),
      nome: String(i.nome || ''),
      unidade: i.unidade ? String(i.unidade) : undefined,
      tags: (Array.isArray(i.tags) ? i.tags : []).filter(ehTagLista),
      quantidade: i.quantidade !== undefined && i.quantidade !== null ? Number(i.quantidade) : undefined,
      observacao: i.observacao ? String(i.observacao) : undefined,
      etiqueta: i.etiqueta ? { ...i.etiqueta, copias: Math.max(1, Number(i.etiqueta.copias) || 1) } : undefined,
      origem: i.origem ? String(i.origem) : undefined,
      adicionadoEm: String(i.adicionadoEm || agoraIso()),
      atualizadoEm: String(i.atualizadoEm || agoraIso()),
    }))
    .filter(i => i.tags.length > 0);
};
