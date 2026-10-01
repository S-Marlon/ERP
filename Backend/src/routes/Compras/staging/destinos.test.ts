import { destinoIncompativel, lerDestinos, validarDestinos, vaiParaVenda } from './destinos';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runDestinosTests = (): void => {
  // Sem divisão: depósito pelo tipo do item
  const graxa = lerDestinos(undefined, 30, 'PRODUTO');
  assert(graxa.length === 1 && graxa[0].deposito === 'VENDA' && graxa[0].quantidade === 30, 'Produto vai inteiro para VENDA.');
  assert(lerDestinos(null, 2, 'CONSUMO')[0].deposito === 'ALMOXARIFADO', 'Consumo vai para o almoxarifado.');
  assert(lerDestinos([], 1, 'ATIVO')[0].deposito === 'PATRIMONIO', 'Ativo vai para o patrimônio.');
  assert(lerDestinos(undefined, 0, 'PRODUTO').length === 0, 'Recebido zero não gera destino.');

  // Divisão: 20 venda + 10 almoxarifado
  const dividido = lerDestinos([{ deposito: 'venda', quantidade: 20 }, { deposito: 'ALMOXARIFADO', quantidade: 10 }], 30, 'PRODUTO');
  assert(dividido.length === 2 && dividido.find(d => d.deposito === 'ALMOXARIFADO')?.quantidade === 10, 'Divisão entre depósitos.');
  assert(vaiParaVenda(dividido) && !vaiParaVenda(lerDestinos(undefined, 5, 'CONSUMO')), 'Sabe se algo vai para venda.');
  const repetido = lerDestinos([{ deposito: 'VENDA', quantidade: 5 }, { deposito: 'VENDA', quantidade: 5 }], 10, 'PRODUTO');
  assert(repetido.length === 1 && repetido[0].quantidade === 10, 'Mesmo depósito repetido soma.');

  assert(validarDestinos([{ deposito: 'VENDA', quantidade: 20 }, { deposito: 'ALMOXARIFADO', quantidade: 10 }], 30) === null, 'Divisão que fecha é válida.');
  assert(validarDestinos([{ deposito: 'VENDA', quantidade: 20 }], 30)?.includes('soma 20') === true, 'Divisão que não fecha é recusada.');
  assert(validarDestinos([{ deposito: 'USO_INTERNO', quantidade: 30 }], 30)?.includes('inválido') === true, 'Depósito desconhecido é recusado.');
  assert(validarDestinos(undefined, 30) === null && validarDestinos([], 30) === null, 'Sem divisão é válido (vai pelo tipo).');

  // Destino x tipo de entrada
  assert(destinoIncompativel([{ deposito: 'VENDA', quantidade: 20 }, { deposito: 'ALMOXARIFADO', quantidade: 10 }], 30, 'PRODUTO') === null, 'Produto pode separar parte para uso interno.');
  assert(destinoIncompativel([{ deposito: 'ALMOXARIFADO', quantidade: 30 }], 30, 'PRODUTO')?.includes('Consumo') === true, 'Produto inteiro no almoxarifado é recusado.');
  assert(destinoIncompativel([{ deposito: 'PATRIMONIO', quantidade: 30 }], 30, 'PRODUTO') !== null, 'Produto não vai para patrimônio.');
  assert(destinoIncompativel([{ deposito: 'VENDA', quantidade: 2 }], 2, 'CONSUMO') !== null, 'Consumo não vai para venda.');
  assert(destinoIncompativel([{ deposito: 'ALMOXARIFADO', quantidade: 1 }, { deposito: 'PATRIMONIO', quantidade: 1 }], 2, 'ATIVO') !== null, 'Ativo só patrimônio.');
  assert(destinoIncompativel(undefined, 5, 'ATIVO') === null && destinoIncompativel(null, 5, 'CONSUMO') === null, 'Padrão do tipo sempre combina.');
};
