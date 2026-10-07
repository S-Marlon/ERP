import { applyConfirmation, applyItemEdit } from './conferencia';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

type TestItem = { tempId: string; mappedId?: string | number | null; isConfirmed?: boolean; tipoRecurso?: string };

export const runConferenciaTests = (): void => {
  const items: TestItem[] = [
    { tempId: 'item-1', mappedId: 'SKU-1', isConfirmed: false },
    { tempId: 'item-2', mappedId: null, isConfirmed: false },
  ];

  const conf = applyConfirmation(items, ['item-1', 'item-2'], true);
  assert(conf.items[0].isConfirmed === true, 'Item com código interno deveria ser conferido.');
  assert(conf.items[1].isConfirmed === false && conf.blocked === 1, 'Item sem código interno não deveria ser conferido.');

  const desfeito = applyConfirmation(conf.items, ['item-1'], false);
  assert(desfeito.items[0].isConfirmed === false, 'Desfazer deveria voltar o item para pendente.');

  const editado = applyItemEdit(conf.items, ['item-1'], () => ({ tipoRecurso: 'ATIVO' }));
  assert(
    editado.items[0].isConfirmed === false && editado.reopened === 1,
    'Alterar o item deveria desfazer a conferência.'
  );

  const semMudanca = applyItemEdit(conf.items, ['item-1'], () => null);
  assert(
    semMudanca.items[0].isConfirmed === true && semMudanca.changed.length === 0,
    'Sem alteração real, a conferência deveria ser mantida.'
  );
};
