import assert from 'assert';
import { formatarTelefone, telefoneBr, telefoneDoTexto } from './whatsapp';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('telefone brasileiro', () => {
  assert.strictEqual(telefoneBr('(11) 98888-7777'), '11988887777');
  assert.strictEqual(telefoneBr('+55 11 3333-4444'), '1133334444');
  assert.strictEqual(telefoneBr('98888-7777'), null);   // sem DDD
  assert.strictEqual(telefoneBr(''), null);
  assert.strictEqual(formatarTelefone('1133334444'), '(11) 3333-4444');
  assert.strictEqual(telefoneDoTexto('ligar à tarde 54 99707-7069'), '54997077069');
});
