import assert from 'assert';
import { juntarTags, slugTag, validarTag } from './tags';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('tags: nome normalizado não deixa repetir', () => {
  assert.strictEqual(slugTag('  Bicicleta '), 'bicicleta');
  assert.strictEqual(slugTag('Máquina  de   Lavar'), 'maquina de lavar');
  assert.strictEqual(slugTag('ROLAMENTOS'), slugTag('rolamentos'));
});

teste('tags: validação', () => {
  assert.deepStrictEqual(validarTag({ nome: ' Graxa  azul ', grupo: ' Lubrificação ', cor: 'blue' }), { nome: 'Graxa azul', slug: 'graxa azul', grupo: 'Lubrificação', cor: 'blue' });
  assert.strictEqual(validarTag({ nome: 'Moto', cor: 'rosa-choque' }).cor, 'default');
  assert.strictEqual(validarTag({ nome: 'Moto', grupo: '  ' }).grupo, null);
  assert.throws(() => validarTag({ nome: 'x' }), /nome da tag/);
});

teste('tags: as da família e as do item, sem repetir', () => {
  const t = juntarTags(
    [{ idTag: 1, nome: 'rolamentos', cor: 'blue' }, { idTag: 2, nome: 'bicicleta', cor: 'green' }],
    [{ idTag: 2, nome: 'bicicleta', cor: 'green' }, { idTag: 3, nome: 'moto', cor: 'red' }],
  );
  assert.deepStrictEqual(t.map(x => [x.nome, x.herdada]), [['bicicleta', true], ['moto', false], ['rolamentos', true]]);
});
