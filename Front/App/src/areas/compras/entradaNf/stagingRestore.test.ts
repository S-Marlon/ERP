import { restaurarItensDoStaging, lerFreteAdicionalSalvo } from './stagingRestore';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runStagingRestoreTests = (): void => {
  const itensXml = [
    { nItem: '1', quantidade: 10 },
    { nItem: '2', quantidade: 5 },
    { nItem: '3', quantidade: 1 },
  ];

  const linhas = [
    {
      item_nfe_seq: '1', quantidade_recebida: 8, is_confirmed: 1, produto_id_sistema: 7, sku_sistema: 'ROL-6201',
      mapeamento_json: JSON.stringify({ mode: 'EXISTING_DIRECT', existingProductId: 7, tipo_recurso: 'PRODUTO', gtin_manual: '789' }),
    },
    {
      item_nfe_seq: '2', quantidade_recebida: 5, is_confirmed: 1, produto_id_sistema: null, sku_sugerido: null,
      mapeamento_json: JSON.stringify({ tipo_recurso: 'CONSUMO' }),
    },
    { item_nfe_seq: '', quantidade_recebida: 0, is_confirmed: 0 }, // linha antiga sem sequência: ignorada
  ];

  const r = restaurarItensDoStaging(itensXml, linhas);
  const [i1, i2, i3] = r.items as any[];

  assert(r.restaurados === 2 && r.mapeados === 1 && r.conferidos === 1, 'Contadores da restauração incorretos.');
  assert(i1.mappedId === 'ROL-6201' && i1.receivedQuantity === 8 && i1.difference === -2, 'Item vinculado deveria voltar com SKU, quantidade e divergência.');
  assert(i1.isConfirmed === true && i1.customGtin === '789' && i1.mapeamento?.mode === 'EXISTING_DIRECT', 'Conferência, GTIN e mapeamento deveriam ser restaurados.');
  assert(i1.mapeamento.tipo_recurso === undefined, 'tipo_recurso não deveria ficar dentro do payload do modal.');
  assert(i2.tipoRecurso === 'CONSUMO' && i2.isConfirmed === false, 'Item sem código interno não pode voltar conferido.');
  assert(i3.receivedQuantity === undefined, 'Item sem linha na staging deveria ficar como veio do XML.');

  const aprovado = restaurarItensDoStaging([{ nItem: '1', quantidade: 4 }], [
    { item_nfe_seq: '1', quantidade_recebida: 4, is_confirmed: 1, produto_id_sistema: 45, sku_sistema: null, sku_sugerido: '000000114694B' },
  ]);
  assert((aprovado.items[0] as any).mappedId === '000000114694B', 'Item novo já aprovado deveria exibir o SKU criado, não o id.');

  const frete = lerFreteAdicionalSalvo('{"valor":"12.5","metodo":"PAC","observacao":"","modo_rateio":"equal"}');
  assert(frete?.valor === 12.5 && frete.modo_rateio === 'equal', 'Frete adicional salvo deveria ser lido com o modo de rateio.');
  assert(lerFreteAdicionalSalvo(null) === null, 'Sem frete salvo deveria retornar null.');
};
