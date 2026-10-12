import assert from 'assert';
import { chaveNomeAtributo } from './GlobalAttributeManager';

assert.strictEqual(chaveNomeAtributo('Diâmetro Interno'), chaveNomeAtributo('diametro  interno'));
assert.strictEqual(chaveNomeAtributo('Largura (mm)'), chaveNomeAtributo('Largura'));
assert.notStrictEqual(chaveNomeAtributo('Rosca ORFS'), chaveNomeAtributo('Rosca ORB'));
console.log('chave de nome do atributo (duplicados): ok');
