import assert from 'assert';
import { caixaDoProduto, corteDoQuadro, CORTE_INTEIRO, mascaraDoFundo, tirarFundo } from './fotoPixels';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

/** Foto w×h com fundo `fundo` e um retângulo `cor` de (x0,y0) a (x1,y1) inclusive. */
const foto = (w: number, h: number, fundo: number[], ret?: { x0: number; y0: number; x1: number; y1: number; cor: number[] }) => {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dentro = ret && x >= ret.x0 && x <= ret.x1 && y >= ret.y0 && y <= ret.y1;
    px.set([...(dentro ? ret!.cor : fundo), 255], (y * w + x) * 4);
  }
  return px;
};

teste('fundo: pega o que liga na borda e não o produto', () => {
  const px = foto(10, 10, [235, 235, 235], { x0: 3, y0: 3, x1: 6, y1: 6, cor: [40, 40, 200] });
  const m = mascaraDoFundo(px, 10, 10, 30);
  assert.strictEqual(m[0], 1);
  assert.strictEqual(m[5 * 10 + 5], 0);
  assert.strictEqual(m.reduce((s, v) => s + v, 0), 100 - 16);
});

teste('fundo: branco dentro do produto (sem ligação com a borda) continua', () => {
  const px = foto(10, 10, [250, 250, 250], { x0: 2, y0: 2, x1: 7, y1: 7, cor: [20, 20, 20] });
  px.set([250, 250, 250, 255], (5 * 10 + 5) * 4);   // um furo branco no meio do produto
  assert.strictEqual(mascaraDoFundo(px, 10, 10, 30)[5 * 10 + 5], 0);
});

teste('fundo: produto encostado na beirada não vira fundo', () => {
  const px = foto(10, 10, [245, 245, 245], { x0: 0, y0: 3, x1: 4, y1: 6, cor: [30, 30, 30] });
  const m = mascaraDoFundo(px, 10, 10, 30);
  assert.strictEqual(m[4 * 10 + 0], 0);
  assert.strictEqual(m[4 * 10 + 2], 0);
});

teste('tirar fundo: fundo transparente, miolo do produto opaco e borda suave', () => {
  const px = foto(10, 10, [240, 240, 240], { x0: 3, y0: 3, x1: 6, y1: 6, cor: [0, 0, 0] });
  tirarFundo(px, 10, 10, mascaraDoFundo(px, 10, 10, 30));
  assert.strictEqual(px[3], 0);
  assert.strictEqual(px[(4 * 10 + 4) * 4 + 3], 255);
  const borda = px[(3 * 10 + 3) * 4 + 3];
  assert.ok(borda > 0 && borda < 255, `borda ${borda}`);
});

teste('caixa do produto: ignora fundo branco e transparente, com folga', () => {
  const px = foto(100, 50, [255, 255, 255], { x0: 20, y0: 10, x1: 59, y1: 29, cor: [10, 10, 10] });
  assert.deepStrictEqual(caixaDoProduto(px, 100, 50, 0), { x: 0.2, y: 0.2, w: 0.4, h: 0.4 });
  const c = caixaDoProduto(px, 100, 50, 0.1)!;
  assert.deepStrictEqual([c.x, c.y].map(v => +v.toFixed(3)), [0.1, 0.1]);
  assert.strictEqual(caixaDoProduto(foto(4, 4, [255, 255, 255]), 4, 4), null);
});

teste('corte do quadro: metade da direita, sobre um corte que já existia e fora da foto', () => {
  assert.deepStrictEqual(corteDoQuadro(CORTE_INTEIRO, 200, 100, { x0: 0, y0: -50, x1: 100, y1: 50 }), { x: 0.5, y: 0, w: 0.5, h: 1 });
  // já cortado na metade da esquerda: pegar a metade de cima disso
  assert.deepStrictEqual(corteDoQuadro({ x: 0, y: 0, w: 0.5, h: 1 }, 100, 100, { x0: -50, y0: -50, x1: 50, y1: 0 }), { x: 0, y: 0, w: 0.5, h: 0.5 });
  // quadro maior que a foto fica limitado; quadro fora da foto não corta
  assert.deepStrictEqual(corteDoQuadro(CORTE_INTEIRO, 200, 100, { x0: -500, y0: -500, x1: 500, y1: 500 }), CORTE_INTEIRO);
  assert.strictEqual(corteDoQuadro(CORTE_INTEIRO, 200, 100, { x0: 300, y0: 0, x1: 400, y1: 50 }), null);
});
