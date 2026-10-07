import { aplicarSugestoes } from './vinculoSugerido';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runVinculoSugeridoTests = (): void => {
  const itens = [
    { tempId: 'a', nItem: 1, sku: '3862', unidade: 'un', quantidade: 2, receivedQuantity: 2, descricao: 'MOTOBOMBA' },
    { tempId: 'b', nItem: 2, sku: 'GRX', unidade: 'CX', quantidade: 3, receivedQuantity: 3, descricao: 'GRAXA' },
    { tempId: 'c', nItem: 3, sku: 'X', unidade: 'UN', quantidade: 1, mappedId: 'JA-VINCULADO' },
    { tempId: 'd', nItem: 4, sku: 'Y', unidade: 'UN', quantidade: 1 },
  ];
  const base = { status: 'ATIVO', precoUltimaCompra: null, unidadeBase: 'UN' };
  const { itens: r, aplicadas } = aplicarSugestoes(itens, {
    '1': { ...base, idItem: 52, sku: '3862', nome: 'Motobomba', tipoRecurso: 'PRODUTO', origem: 'FORNECEDOR', ultimosDepositos: ['VENDA'], unidadeCompra: 'UN', fator: 1 },
    '2': { ...base, idItem: 70, sku: 'GRX-1', nome: 'Graxa', tipoRecurso: 'PRODUTO', origem: 'GTIN', ultimosDepositos: ['ALMOXARIFADO'], unidadeCompra: 'UN', fator: 12 },
    '3': { ...base, idItem: 99, sku: 'OUTRO', nome: 'Outro', tipoRecurso: 'PRODUTO', origem: 'FORNECEDOR', ultimosDepositos: [], unidadeCompra: 'UN', fator: 1 },
  });

  assert(aplicadas === 2, 'Aplica só nas linhas sem vínculo que têm sugestão.');
  assert(r[0].produtoIdSistema === 52 && r[0].vinculoSugerido === 'FORNECEDOR' && r[0].mapeamento.mode === 'EXISTING_DIRECT', 'Linha vinculada pelo código do fornecedor.');
  assert(r[0].destinos === null && r[0].mapeamento.conversaoCompra.fator === 1, 'Venda é o padrão do produto: sem divisão.');
  assert(r[1].mapeamento.conversaoCompra.fator === 1, 'Unidade da nota diferente da última compra: não reaproveita o fator.');
  assert(r[1].destinos === null, 'Destino segue o tipo do item (não repete depósito avulso da última entrada).');
  assert(r[2].mappedId === 'JA-VINCULADO' && !r[2].vinculoSugerido, 'Linha já vinculada não é alterada.');
  assert(!r[3].vinculoSugerido, 'Linha sem sugestão fica como está.');
  assert(r[0].isConfirmed === undefined, 'Sugestão não confere a linha.');
};
