import { depositoOuPadrao, depositoPorCfop, depositoPorTipoRecurso, ehDeposito } from './depositos';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runDepositosTests = (): void => {
  assert(depositoPorCfop('1102') === 'VENDA' && depositoPorCfop('2.102') === 'VENDA', 'Compra para revenda vai para VENDA.');
  assert(depositoPorCfop('1556') === 'ALMOXARIFADO' && depositoPorCfop('2556') === 'ALMOXARIFADO', 'Uso e consumo vai para ALMOXARIFADO.');
  assert(depositoPorCfop('1551') === 'PATRIMONIO' && depositoPorCfop('2551') === 'PATRIMONIO', 'Ativo imobilizado vai para PATRIMONIO.');
  assert(depositoPorCfop('1403') === 'VENDA' && depositoPorCfop('1407') === 'ALMOXARIFADO', 'Com substituição tributária também.');
  assert(depositoPorCfop('') === null && depositoPorCfop('1949') === null, 'CFOP desconhecido não sugere.');
  // O XML do fornecedor traz o CFOP de saída dele (5102/6102): não indica o uso na empresa
  assert(depositoPorCfop('5102') === null && depositoPorCfop('6102') === null, 'CFOP de saída do fornecedor não sugere destino.');

  assert(depositoPorTipoRecurso('CONSUMO') === 'ALMOXARIFADO' && depositoPorTipoRecurso('ATIVO') === 'PATRIMONIO', 'Tipo do item define o padrão.');
  assert(depositoPorTipoRecurso('PRODUTO') === 'VENDA' && depositoPorTipoRecurso(undefined) === 'VENDA', 'Produto vai para venda.');

  assert(ehDeposito('almoxarifado') && !ehDeposito('USO_INTERNO'), 'Depósitos válidos.');
  assert(depositoOuPadrao('xpto') === 'VENDA' && depositoOuPadrao('patrimonio') === 'PATRIMONIO', 'Padrão VENDA.');
};
