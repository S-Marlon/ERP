// Contas sobre os pixels da foto (RGBA, sem DOM): achar o fundo a partir das bordas, deixá-lo transparente com a
// borda suave, achar a caixa do produto (para cortar as sobras) e converter um recorte da tela em frações da foto.

/** Recorte em frações da foto original (0 a 1): vale para fotos de tamanhos diferentes. */
export interface Corte { x: number; y: number; w: number; h: number }

const dif = (px: Uint8ClampedArray, i: number, r: number, g: number, b: number) =>
  Math.max(Math.abs(px[i] - r), Math.abs(px[i + 1] - g), Math.abs(px[i + 2] - b));

const mediana = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 0; };

/**
 * Fundo = pixels ligados à borda da foto com cor parecida (até `tolerancia`, 0 a 255 por canal) com a do ponto de
 * partida. Só começa pelos pontos da borda parecidos com a cor mais comum da borda, para não "entrar" no produto
 * quando ele encosta na beirada. Devolve 1 = fundo.
 */
export const mascaraDoFundo = (px: Uint8ClampedArray, w: number, h: number, tolerancia: number) => {
  const mascara = new Uint8Array(w * h);
  const ref = new Uint8Array(w * h * 3);
  const fila = new Int32Array(w * h);
  let ini = 0, fim = 0;
  const borda: number[] = [];
  for (let x = 0; x < w; x++) borda.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) borda.push(y * w, y * w + w - 1);
  const cor = (k: number) => [px[k * 4], px[k * 4 + 1], px[k * 4 + 2]];
  const [mr, mg, mb] = [0, 1, 2].map(c => mediana(borda.map(k => cor(k)[c])));
  for (const k of borda) {
    if (mascara[k]) continue;
    if (px[k * 4 + 3] >= 16 && dif(px, k * 4, mr, mg, mb) > tolerancia * 2) continue;
    mascara[k] = 1;
    ref[k * 3] = px[k * 4]; ref[k * 3 + 1] = px[k * 4 + 1]; ref[k * 3 + 2] = px[k * 4 + 2];
    fila[fim++] = k;
  }
  while (ini < fim) {
    const k = fila[ini++];
    const x = k % w;
    const r = ref[k * 3], g = ref[k * 3 + 1], b = ref[k * 3 + 2];
    const vizinhos = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w];
    for (const n of vizinhos) {
      if (n < 0 || n >= w * h || mascara[n]) continue;
      if (px[n * 4 + 3] >= 16 && dif(px, n * 4, r, g, b) > tolerancia) continue;
      mascara[n] = 1;
      ref[n * 3] = r; ref[n * 3 + 1] = g; ref[n * 3 + 2] = b;
      fila[fim++] = n;
    }
  }
  return mascara;
};

/** Deixa o fundo transparente; a borda do produto fica suave (média 3×3 da máscara). Altera `px`. */
export const tirarFundo = (px: Uint8ClampedArray, w: number, h: number, mascara: Uint8Array) => {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let soma = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          soma += mascara[yy * w + xx]; n++;
        }
      }
      const i = (y * w + x) * 4;
      px[i + 3] = Math.round(px[i + 3] * (1 - soma / n));
    }
  }
};

/** Caixa do que não é fundo (transparente ou quase branco), com folga; null se a foto for toda fundo. */
export const caixaDoProduto = (px: Uint8ClampedArray, w: number, h: number, folga = 0.02): Corte | null => {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 24 || (px[i] > 242 && px[i + 1] > 242 && px[i + 2] > 242)) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const fx = folga * w, fy = folga * h;
  const ax = Math.max(0, x0 - fx), ay = Math.max(0, y0 - fy);
  const bx = Math.min(w, x1 + 1 + fx), by = Math.min(h, y1 + 1 + fy);
  return { x: ax / w, y: ay / h, w: (bx - ax) / w, h: (by - ay) / h };
};

/**
 * Recorte novo a partir do quadro de corte, já levado para o sistema da foto (centro em 0, de -largura/2 a +largura/2,
 * nas unidades do pedaço que aparece hoje; o Fabric já desfaz giro e espelho nessa conta). `atual` é o corte de agora.
 */
export const corteDoQuadro = (
  atual: Corte, larguraVisivel: number, alturaVisivel: number, caixa: { x0: number; y0: number; x1: number; y1: number },
): Corte | null => {
  const { x0, x1, y0, y1 } = caixa;
  const lx = (v: number) => Math.min(1, Math.max(0, v / larguraVisivel + 0.5));
  const ly = (v: number) => Math.min(1, Math.max(0, v / alturaVisivel + 0.5));
  const [a, b, c, d] = [lx(x0), lx(x1), ly(y0), ly(y1)];
  if (b - a < 0.01 || d - c < 0.01) return null;
  return { x: atual.x + a * atual.w, y: atual.y + c * atual.h, w: (b - a) * atual.w, h: (d - c) * atual.h };
};

export const CORTE_INTEIRO: Corte = { x: 0, y: 0, w: 1, h: 1 };
