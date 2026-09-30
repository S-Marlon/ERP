import { adicionarItem, alternarTag, contagemPorTag, itensComTag, limparTag, normalizarListaSalva, removerTag } from './listaTrabalho';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runListaTrabalhoTests = (): void => {
  const t = '2026-09-30T10:00:00.000Z';
  const rolamento = { idItem: 50, sku: '17247A', nome: 'Rolamento 6005', unidade: 'PC' };
  const bomba = { idItem: 52, sku: '3862', nome: 'Motobomba 0,5HP' };

  let lista = adicionarItem([], rolamento, { tags: ['ETIQUETAR'] }, t);
  assert(lista.length === 1 && lista[0].etiqueta?.copias === 1, 'Etiquetar cria a configuração com 1 cópia.');

  lista = adicionarItem(lista, rolamento, { tags: ['COMPRAR'], quantidade: 20 }, t);
  assert(lista.length === 1 && lista[0].tags.join() === 'ETIQUETAR,COMPRAR' && lista[0].quantidade === 20, 'Mesmo item mescla as tags.');

  lista = adicionarItem(lista, rolamento, { tags: ['ETIQUETAR'], etiqueta: { copias: 5 } }, t);
  assert(lista[0].etiqueta?.copias === 5 && lista[0].tags.length === 2, 'Reincluir atualiza as cópias sem duplicar a tag.');

  lista = adicionarItem(lista, bomba, { tags: ['ETIQUETAR', 'CONFERIR'] }, t);
  assert(itensComTag(lista, 'ETIQUETAR').length === 2 && contagemPorTag(lista).CONFERIR === 1, 'Filtro e contagem por tag.');

  // Etiquetas impressas: ETIQUETAR sai de todos; a bomba continua por causa de CONFERIR
  const aposImpressao = limparTag(lista, 'ETIQUETAR');
  assert(aposImpressao.length === 2 && itensComTag(aposImpressao, 'ETIQUETAR').length === 0, 'Concluir a tarefa tira só aquela tag.');
  const soBomba = limparTag(lista, 'ETIQUETAR', [52]);
  assert(itensComTag(soBomba, 'ETIQUETAR').map(i => i.idItem).join() === '50', 'Concluir só para os itens informados.');

  const semTarefa = removerTag(removerTag(lista, 50, 'ETIQUETAR'), 50, 'COMPRAR');
  assert(!semTarefa.some(i => i.idItem === 50), 'Item sem nenhuma tarefa sai da lista.');

  const alternado = alternarTag(adicionarItem([], bomba, { tags: ['COMPRAR'] }, t), 52, 'ETIQUETAR', t);
  assert(alternado[0].tags.includes('ETIQUETAR') && alternado[0].etiqueta?.copias === 1, 'Alternar para etiquetar cria a configuração.');

  const salvo = normalizarListaSalva([
    { idItem: 50, sku: 'X', nome: 'Y', tags: ['ETIQUETAR', 'INVALIDA'], etiqueta: { copias: 0 } },
    { idItem: 'abc', tags: ['COMPRAR'] },
    { idItem: 7, tags: [] },
  ]);
  assert(salvo.length === 1 && salvo[0].tags.join() === 'ETIQUETAR' && salvo[0].etiqueta?.copias === 1, 'Leitura do armazenamento descarta lixo.');
  assert(normalizarListaSalva('corrompido').length === 0, 'Conteúdo inválido vira lista vazia.');
};
