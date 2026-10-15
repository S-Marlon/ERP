import assert from 'assert';
import { limparModelo } from './modeloSalvo';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const cota = (left: number, extra: Record<string, unknown> = {}) => ({
  type: 'Group', left, top: 1050, angle: 0, scaleX: 1, scaleY: 1, dadosElemento: { tipo: 'COTA', cor: '#731717', modelo: '{Comprimento}', comprimento: 800, ...extra },
});

teste('modelo salvo: tira cotas iguais empilhadas e mantém as diferentes', () => {
  const json = JSON.stringify({ version: '6.4.3', objects: [cota(600), cota(600.2), cota(600, { espessura: 12 }), cota(300)] });
  const r = limparModelo(json);
  assert.strictEqual(r.repetidos, 1);
  assert.strictEqual(JSON.parse(r.json).objects.length, 3);
});

teste('modelo salvo: foto blob: sai, foto com endereço normal fica', () => {
  const foto = (src: string) => ({ type: 'Image', src, left: 600, top: 600, dadosElemento: { tipo: 'FOTO', cor: '' } });
  const r = limparModelo(JSON.stringify({ objects: [foto('blob:http://localhost:5173/abc'), cota(600)] }));
  assert.strictEqual(r.fotoDescartada, true);
  assert.strictEqual(JSON.parse(r.json).objects.length, 1);
  const r2 = limparModelo(JSON.stringify({ objects: [foto('http://localhost:3001/foto.jpg'), foto('http://localhost:3001/foto.jpg')] }));
  assert.strictEqual(r2.fotoDescartada, false);
  assert.strictEqual(JSON.parse(r2.json).objects.length, 2);
});

teste('modelo salvo: sem nada para limpar devolve o mesmo texto', () => {
  const json = JSON.stringify({ objects: [cota(600), { type: 'Rect', left: 1 }] });
  assert.strictEqual(limparModelo(json).json, json);
});
