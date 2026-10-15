import assert from 'assert';
import { ehImagemGerada, fotosDaVariacao, referenciaDeFoto, urlPublicaDeImagem } from './fotos';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('imagem gerada pelo editor ou gerador não serve de base', () => {
  assert.strictEqual(ehImagemGerada('ABR-3.6-100-editada.jpg'), true);
  assert.strictEqual(ehImagemGerada('6204-ZZ-medida.jpg'), true);
  assert.strictEqual(ehImagemGerada('Img_ftr_rp_300601-1160x1160.PNG'), false);
  assert.strictEqual(ehImagemGerada('editada.jpg'), false);
  assert.strictEqual(ehImagemGerada(null), false);
});

teste('fotos da variação: própria, medidas, família', () => {
  const fam = [{ url: 'f/produto.png', nome: 'produto.png', uso: 'PRINCIPAL' }, { url: 'f/aplicacao.jpg', nome: 'aplicacao.jpg', uso: 'COMUM' }, { url: 'f/gabarito.png', nome: 'gabarito.png', uso: 'EDITOR' }];
  const limpa = { idAnexo: 1, url: 'i/foto.png', nome: 'foto.png' };
  const medida = { idAnexo: 2, url: 'i/X-editada.jpg', nome: 'X-editada.jpg' };
  const chaves = (l: { chave: string }[]) => l.map(f => f.chave);
  // com foto própria: ela, a medida, depois as comuns da família (sem a principal-modelo)
  assert.deepStrictEqual(chaves(fotosDaVariacao([limpa, medida], fam)), ['1', '2', 'familia:f/aplicacao.jpg']);
  // só a medida: a principal da família (foto limpa) vem antes dela; o gabarito do editor nunca vai
  assert.deepStrictEqual(chaves(fotosDaVariacao([medida], fam)), ['familia:f/produto.png', '2', 'familia:f/aplicacao.jpg']);
  // sem foto: a família inteira
  assert.deepStrictEqual(chaves(fotosDaVariacao([], fam)), ['familia:f/produto.png', 'familia:f/aplicacao.jpg']);
  // o mesmo arquivo no item e na família vai uma vez só
  assert.deepStrictEqual(chaves(fotosDaVariacao([{ idAnexo: 3, url: 'f/aplicacao.jpg', nome: 'aplicacao.jpg' }], fam)), ['3']);
  assert.deepStrictEqual(chaves(fotosDaVariacao([limpa], [])), ['1']);
});

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
