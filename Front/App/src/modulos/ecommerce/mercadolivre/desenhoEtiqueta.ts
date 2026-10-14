// Desenha a foto do produto num quadro de 1200×1200 (fundo branco, o tamanho que o ML recomenda) com a medida escrita:
// faixa embaixo, cota com seta (como em desenho técnico) ou selo no canto. Roda no navegador (canvas).
import { API_URL } from '../../../shared/api/config';

export type EstiloEtiqueta = 'FAIXA' | 'COTA' | 'SELO';
export interface OpcoesEtiqueta { texto: string; subtexto?: string; estilo: EstiloEtiqueta; cor: string; lado?: number }

const LADO = 1200;
const cacheImagens = new Map<string, Promise<HTMLImageElement>>();

/** Foto de fora do ERP passa pelo servidor (sem isso o navegador não deixa salvar o desenho). */
const enderecoParaDesenho = (url: string) => {
  if (/^(data|blob):/i.test(url)) return url;
  try {
    if (new URL(url).origin === new URL(API_URL).origin) return url;
  } catch { return url; }
  return `${API_URL}/api/modulos/ecommerce/mercadolivre/fotos-ml/imagem?tenant_id=1&url=${encodeURIComponent(url)}`;
};

export const carregarImagem = (url: string) => {
  const chave = enderecoParaDesenho(url);
  if (!cacheImagens.has(chave)) {
    const p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível abrir a foto.'));
      img.src = chave;
    });
    p.catch(() => cacheImagens.delete(chave));
    cacheImagens.set(chave, p);
  }
  return cacheImagens.get(chave)!;
};

/** Maior fonte (negrito) que cabe na largura. */
const ajustarFonte = (ctx: CanvasRenderingContext2D, texto: string, maxLargura: number, maxTamanho: number) => {
  let t = maxTamanho;
  for (; t > 24; t -= 4) {
    ctx.font = `800 ${t}px Arial, Helvetica, sans-serif`;
    if (ctx.measureText(texto).width <= maxLargura) break;
  }
  return t;
};

const retanguloArredondado = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const seta = (ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, tam: number) => {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dir * tam, y - tam * 0.55);
  ctx.lineTo(x + dir * tam, y + tam * 0.55);
  ctx.closePath();
  ctx.fill();
};

/** A foto com a etiqueta, num canvas quadrado. */
export const desenharEtiqueta = (img: HTMLImageElement, op: OpcoesEtiqueta): HTMLCanvasElement => {
  const lado = op.lado || LADO;
  const k = lado / LADO;
  const cv = document.createElement('canvas');
  cv.width = lado;
  cv.height = lado;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lado, lado);

  const temTexto = !!op.texto.trim();
  // área da foto: a faixa e a cota reservam o pé do quadro; o selo fica por cima
  const reserva = !temTexto || op.estilo === 'SELO' ? 0 : (op.estilo === 'FAIXA' ? (op.subtexto ? 250 : 200) : (op.subtexto ? 270 : 220)) * k;
  const margem = 60 * k;
  const areaL = lado - 2 * margem;
  const areaA = lado - 2 * margem - reserva;
  const escala = Math.min(areaL / img.naturalWidth, areaA / img.naturalHeight);
  const w = img.naturalWidth * escala;
  const h = img.naturalHeight * escala;
  const x = (lado - w) / 2;
  const y = margem + (areaA - h) / 2;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x, y, w, h);
  if (!temTexto) return cv;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (op.estilo === 'FAIXA') {
    const topo = lado - reserva;
    ctx.fillStyle = op.cor;
    ctx.fillRect(0, topo, lado, reserva);
    ctx.fillStyle = '#ffffff';
    const tam = ajustarFonte(ctx, op.texto, lado - 120 * k, 150 * k);
    ctx.fillText(op.texto, lado / 2, topo + (op.subtexto ? reserva * 0.4 : reserva / 2));
    if (op.subtexto) {
      ajustarFonte(ctx, op.subtexto, lado - 160 * k, Math.min(64 * k, tam * 0.5));
      ctx.globalAlpha = 0.9;
      ctx.fillText(op.subtexto, lado / 2, topo + reserva * 0.78);
      ctx.globalAlpha = 1;
    }
  } else if (op.estilo === 'COTA') {
    // linha de cota com setas na largura da foto e o valor em cima, como em desenho técnico
    const yLinha = lado - reserva + 70 * k;
    const x1 = Math.max(margem, x);
    const x2 = Math.min(lado - margem, x + w);
    ctx.strokeStyle = op.cor;
    ctx.fillStyle = op.cor;
    ctx.lineWidth = 8 * k;
    ctx.beginPath();
    ctx.moveTo(x1, yLinha - 45 * k); ctx.lineTo(x1, yLinha + 45 * k);
    ctx.moveTo(x2, yLinha - 45 * k); ctx.lineTo(x2, yLinha + 45 * k);
    ctx.moveTo(x1 + 30 * k, yLinha); ctx.lineTo(x2 - 30 * k, yLinha);
    ctx.stroke();
    seta(ctx, x1 + 4 * k, yLinha, 1, 40 * k);
    seta(ctx, x2 - 4 * k, yLinha, -1, 40 * k);
    const tam = ajustarFonte(ctx, op.texto, lado - 120 * k, 130 * k);
    const larguraTexto = ctx.measureText(op.texto).width + 60 * k;
    const yTexto = yLinha + 30 * k + tam * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(lado / 2 - larguraTexto / 2, yTexto - tam * 0.6, larguraTexto, tam * 1.2);
    ctx.fillStyle = op.cor;
    ctx.fillText(op.texto, lado / 2, yTexto);
    if (op.subtexto) {
      ajustarFonte(ctx, op.subtexto, lado - 160 * k, Math.min(56 * k, tam * 0.45));
      ctx.fillStyle = '#444444';
      ctx.fillText(op.subtexto, lado / 2, yTexto + tam * 0.6 + 40 * k);
    }
  } else {
    // selo no canto de cima, à direita
    const tam = ajustarFonte(ctx, op.texto, lado * 0.55, 110 * k);
    const lt = ctx.measureText(op.texto).width;
    const pad = 36 * k;
    const sub = op.subtexto ? Math.min(48 * k, tam * 0.45) : 0;
    const selW = lt + pad * 2;
    const selH = tam * 1.25 + (sub ? sub * 1.4 : 0) + pad * 0.6;
    const sx = lado - margem / 2 - selW;
    const sy = margem / 2;
    ctx.fillStyle = op.cor;
    retanguloArredondado(ctx, sx, sy, selW, selH, 28 * k);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${tam}px Arial, Helvetica, sans-serif`;
    ctx.fillText(op.texto, sx + selW / 2, sy + pad * 0.3 + tam * 0.65);
    if (sub && op.subtexto) {
      ajustarFonte(ctx, op.subtexto, selW - pad, sub);
      ctx.fillText(op.subtexto, sx + selW / 2, sy + pad * 0.3 + tam * 1.25 + sub * 0.6);
    }
  }
  return cv;
};

/** Canvas -> arquivo JPEG pronto para enviar ao cadastro. */
export const canvasParaArquivo = (cv: HTMLCanvasElement, nome: string) => new Promise<File>((resolve, reject) => {
  cv.toBlob(b => (b ? resolve(new File([b], nome, { type: 'image/jpeg' })) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/jpeg', 0.92);
});
