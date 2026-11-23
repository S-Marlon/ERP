import assert from 'assert';
import { formatarDinheiro, formatarNumeroBr, formatarPercentual, formatarQuantidade, lerNumeroBr } from './numeros';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('ler número digitado ou colado', () => {
  assert.strictEqual(lerNumeroBr('1,5'), '1.5');
  assert.strictEqual(lerNumeroBr('1.5'), '1.5');
  assert.strictEqual(lerNumeroBr('1.234,56'), '1234.56');
  assert.strictEqual(lerNumeroBr('R$ 1.234,56'), '1234.56');
  assert.strictEqual(lerNumeroBr('1.500'), '1500');          // milhar, como se escreve no Brasil
  assert.strictEqual(lerNumeroBr('0.500'), '0.500');         // começa com 0: decimal
  assert.strictEqual(lerNumeroBr('1.50'), '1.50');
  assert.strictEqual(lerNumeroBr('1.234.567'), '1234567');
  assert.strictEqual(lerNumeroBr('1234.567'), '1234.567');   // 4 números antes do ponto: decimal
  assert.strictEqual(lerNumeroBr('15%'), '15');
  assert.strictEqual(lerNumeroBr('-2,5'), '-2.5');
  assert.strictEqual(lerNumeroBr('-'), '-');                 // começando a digitar um negativo
  assert.strictEqual(lerNumeroBr('3,'), '3.');               // no meio da digitação
  assert.strictEqual(lerNumeroBr(''), '');
  assert.strictEqual(lerNumeroBr(12.5), '12.5');             // valor do próprio campo (número)
});

teste('mostrar', () => {
  assert.strictEqual(formatarNumeroBr(1234.5), '1.234,50');
  assert.strictEqual(formatarNumeroBr(1234.5, 2, { milhar: false }), '1234,50');
  assert.strictEqual(formatarDinheiro(1234.5), 'R$ 1.234,50');
  assert.strictEqual(formatarDinheiro(null), '');
  assert.strictEqual(formatarQuantidade(2), '2');
  assert.strictEqual(formatarQuantidade(1.5), '1,5');
  assert.strictEqual(formatarQuantidade(0.1255), '0,126');
  assert.strictEqual(formatarPercentual(12.5), '12,5%');
});
