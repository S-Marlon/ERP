import { converterValorAtributo } from './valoresAtributo';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const col = (tipo: string, valor: unknown, opcoes: any[] = []) => {
  const r = converterValorAtributo(tipo, valor, opcoes);
  return r.ok ? r.colunas : null;
};

export const runValoresAtributoTests = (): void => {
  assert(col('numero', '12')?.valor_numero === 12, 'Número inteiro vai para valor_numero.');
  assert(col('numero', '12,5') === null, 'Número com casas decimais não é inteiro.');
  assert(col('decimal', '1.234,5')?.valor_decimal === 1234.5, 'Decimal no formato brasileiro.');
  assert(col('decimal', '20.5')?.valor_decimal === 20.5, 'Decimal com ponto.');
  assert(col('decimal', 'abc') === null, 'Texto não é decimal.');
  assert(col('boolean', 'Sim')?.valor_boolean === 1 && col('boolean', 'não')?.valor_boolean === 0, 'Sim/não vira 1/0.');
  assert(col('data', '31/12/2026')?.valor_data === '2026-12-31 00:00:00', 'Data brasileira vira ISO.');
  const opcoes = [{ id: 7, valor: 'Aço Inox', codigo: 'INOX' }];
  assert(col('lista', 'aco inox', opcoes)?.opcao_id === 7, 'Opção casa sem acento e sem maiúscula.');
  assert(col('lista', 'inox', opcoes)?.opcao_id === 7, 'Opção casa pelo código.');
  assert(col('lista', 'Latão', opcoes) === null, 'Valor fora da lista é recusado.');
  assert(col('texto', ' NBR ')?.valor_texto === 'NBR', 'Texto é gravado sem espaços nas pontas.');
  assert(col('texto', '') === null, 'Valor vazio é recusado.');
};
