import assert from 'assert';
import { referenciaDeFoto } from './fotos';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('link ou código colado vira anúncio ou catálogo', () => {
  assert.deepStrictEqual(referenciaDeFoto('MLB5384283051'), { tipo: 'ANUNCIO', id: 'MLB5384283051' });
  assert.deepStrictEqual(referenciaDeFoto('https://produto.mercadolivre.com.br/MLB-5384283051-disco-de-corte-fino-_JM'), { tipo: 'ANUNCIO', id: 'MLB5384283051' });
  assert.deepStrictEqual(referenciaDeFoto('https://www.mercadolivre.com.br/disco-corte-starrett/p/MLB19876543?pdp_filters=x'), { tipo: 'CATALOGO', id: 'MLB19876543' });
  assert.deepStrictEqual(referenciaDeFoto(' mlb-7804962608 '), { tipo: 'ANUNCIO', id: 'MLB7804962608' });
  assert.strictEqual(referenciaDeFoto('abraçadeira'), null);
  assert.strictEqual(referenciaDeFoto(''), null);
});
