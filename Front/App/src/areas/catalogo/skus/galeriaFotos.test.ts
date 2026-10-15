import assert from 'assert';
import { avisosDaFoto, comMedidasEmSegundo, ehImagemDeMedidas, fotosNoCanal, moverFoto } from './galeriaFotos';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const f = (nome: string, url = nome) => ({ nome_arquivo: nome, url_anexo: url });

teste('galeria: imagem de medidas pelo nome', () => {
  assert.ok(ehImagemDeMedidas('6204-ZZ-medida.jpg') && ehImagemDeMedidas('ABR-3.6-100-editada.jpg'));
  assert.ok(!ehImagemDeMedidas('foto.png') && !ehImagemDeMedidas(undefined));
});

teste('galeria: mover foto', () => {
  assert.deepStrictEqual(moverFoto([1, 2, 3, 4], 3, 0), [4, 1, 2, 3]);
  assert.deepStrictEqual(moverFoto([1, 2, 3, 4], 0, 2), [2, 3, 1, 4]);
  assert.deepStrictEqual(moverFoto([1, 2, 3], 1, 9), [1, 3, 2]);
  assert.deepStrictEqual(moverFoto([1, 2, 3], 5, 0), [1, 2, 3]);
});

teste('galeria: medidas logo depois da principal', () => {
  const ordem = comMedidasEmSegundo([f('a.jpg'), f('b.jpg'), f('X-medida.jpg')]).map(x => x.nome_arquivo);
  assert.deepStrictEqual(ordem, ['a.jpg', 'X-medida.jpg', 'b.jpg']);
  const principal = comMedidasEmSegundo([f('X-medida.jpg'), f('a.jpg')]).map(x => x.nome_arquivo);
  assert.deepStrictEqual(principal, ['X-medida.jpg', 'a.jpg']);
});

teste('galeria: avisos', () => {
  const todas = [f('X-editada.jpg', 'u1'), f('a.jpg', 'u2'), f('X-editada.jpg', 'u3'), f('b.jpg', 'u2')];
  assert.deepStrictEqual(avisosDaFoto(todas[0], 0, todas, { w: 1200, h: 1200 }), ['PRINCIPAL_COM_MEDIDAS']);
  assert.deepStrictEqual(avisosDaFoto(todas[1], 1, todas, { w: 400, h: 300 }), ['PEQUENA']);
  assert.deepStrictEqual(avisosDaFoto(todas[2], 2, todas, undefined, 3), ['REPETIDA']);
  assert.deepStrictEqual(avisosDaFoto(todas[3], 3, todas, undefined, 3), ['FORA_DO_LIMITE', 'REPETIDA']);
});

teste('galeria: como a variação vai ao canal (fotos da família incluídas)', () => {
  const fam = [{ url: 'f/produto.png', nome: 'produto.png', uso: 'PRINCIPAL' }, { url: 'f/aplicacao.jpg', nome: 'aplicacao.jpg', uso: 'COMUM' }, { url: 'f/gabarito.png', nome: 'gabarito.png', uso: 'EDITOR' }];
  const limpa = { url: 'i/foto.png', nome: 'foto.png' };
  const medida = { url: 'i/X-editada.jpg', nome: 'X-editada.jpg' };
  const urls = (l: { url: string; daFamilia: boolean }[]) => l.map(f => `${f.url}${f.daFamilia ? '*' : ''}`);
  assert.deepStrictEqual(urls(fotosNoCanal([limpa, medida], fam)), ['i/foto.png', 'i/X-editada.jpg', 'f/aplicacao.jpg*']);
  assert.deepStrictEqual(urls(fotosNoCanal([medida], fam)), ['f/produto.png*', 'i/X-editada.jpg', 'f/aplicacao.jpg*']);
  assert.deepStrictEqual(urls(fotosNoCanal([], fam)), ['f/produto.png*', 'f/aplicacao.jpg*']);
  assert.deepStrictEqual(urls(fotosNoCanal([{ url: 'f/aplicacao.jpg', nome: 'aplicacao.jpg' }], fam)), ['f/aplicacao.jpg']);
});
