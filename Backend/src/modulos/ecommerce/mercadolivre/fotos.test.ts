import assert from 'assert';
import { referenciaDeFoto, urlPublicaDeImagem } from './fotos';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('link ou código colado vira anúncio ou catálogo', () => {
  assert.deepStrictEqual(referenciaDeFoto('MLB5384283051'), { tipo: 'ANUNCIO', id: 'MLB5384283051' });
  assert.deepStrictEqual(referenciaDeFoto('https://produto.mercadolivre.com.br/MLB-5384283051-disco-de-corte-fino-_JM'), { tipo: 'ANUNCIO', id: 'MLB5384283051' });
  assert.deepStrictEqual(referenciaDeFoto('https://www.mercadolivre.com.br/disco-corte-starrett/p/MLB19876543?pdp_filters=x'), { tipo: 'CATALOGO', id: 'MLB19876543' });
  assert.deepStrictEqual(referenciaDeFoto(' mlb-7804962608 '), { tipo: 'ANUNCIO', id: 'MLB7804962608' });
  assert.strictEqual(referenciaDeFoto('abraçadeira'), null);
  assert.strictEqual(referenciaDeFoto(''), null);
});

teste('só busca imagem em endereço público', () => {
  assert.strictEqual(urlPublicaDeImagem('https://http2.mlstatic.com/D_1-O.jpg'), 'https://http2.mlstatic.com/D_1-O.jpg');
  assert.strictEqual(urlPublicaDeImagem('http://localhost:3001/uploads/a.jpg'), null);
  assert.strictEqual(urlPublicaDeImagem('http://192.168.0.10/x.png'), null);
  assert.strictEqual(urlPublicaDeImagem('http://172.20.1.1/x.png'), null);
  assert.strictEqual(urlPublicaDeImagem('file:///c:/x.png'), null);
  assert.strictEqual(urlPublicaDeImagem('nada'), null);
});
