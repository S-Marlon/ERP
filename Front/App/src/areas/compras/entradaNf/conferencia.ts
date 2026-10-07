// Regras da conferência dos itens da NF-e
// - Só pode ser conferido o item com código interno vinculado (mapeamento feito).
// - Qualquer alteração no item (tipo de entrada, GTIN, quantidade recebida, mapeamento) desfaz a conferência.

export type ItemId = string | number;

export const MSG_SEM_CODIGO_INTERNO = 'Vincule o código interno (mapeamento) antes de conferir.';

export const hasCodigoInterno = (item: { mappedId?: unknown }): boolean =>
  item.mappedId !== undefined && item.mappedId !== null && String(item.mappedId).trim() !== '';

export interface ConfirmationResult<T> {
  items: T[];       // lista completa atualizada
  changed: T[];     // itens cujo status mudou
  blocked: number;  // itens que não puderam ser conferidos por falta de código interno
}

// Marca/desmarca a conferência dos ids informados respeitando a exigência de código interno
export const applyConfirmation = <T extends { tempId: ItemId; mappedId?: unknown; isConfirmed?: boolean }>(
  items: T[],
  ids: ItemId[],
  confirmed: boolean
): ConfirmationResult<T> => {
  const idSet = new Set(ids);
  const changed: T[] = [];
  let blocked = 0;

  const updated = items.map(item => {
    if (!idSet.has(item.tempId)) return item;
    if (confirmed && !hasCodigoInterno(item)) {
      blocked++;
      return item;
    }
    if (Boolean(item.isConfirmed) === confirmed) return item;
    const next = { ...item, isConfirmed: confirmed };
    changed.push(next);
    return next;
  });

  return { items: updated, changed, blocked };
};

export interface EditResult<T> {
  items: T[];
  changed: T[];
  reopened: number; // itens que estavam conferidos e voltaram para pendente
}

// Aplica uma alteração nos itens; todo item alterado volta para pendente de conferência
export const applyItemEdit = <T extends { tempId: ItemId; isConfirmed?: boolean }>(
  items: T[],
  ids: ItemId[],
  patch: (item: T) => Partial<T> | null // null = nada muda neste item
): EditResult<T> => {
  const idSet = new Set(ids);
  const changed: T[] = [];
  let reopened = 0;

  const updated = items.map(item => {
    if (!idSet.has(item.tempId)) return item;
    const diff = patch(item);
    if (!diff) return item;
    if (item.isConfirmed) reopened++;
    const next = { ...item, ...diff, isConfirmed: false };
    changed.push(next);
    return next;
  });

  return { items: updated, changed, reopened };
};
