// Desenho da etiqueta num canvas, com as mesmas medidas do modelo HTML (CSS_ETIQUETAS em etiquetas.ts):
// é o que vai para a térmica como imagem, então sai igual à pré-visualização.
// k = pontos por mm (térmica: 8). Na térmica o código de barras usa módulos de pontos inteiros (leitura nítida).
import { escolherCodigo, CodigoBarras } from './codigoBarras';
import { EtiquetaDados, linhaAtacado, linhaInfo, ModeloEtiquetaId, partesPreco } from './etiquetas';

const FONTE = 'Arial, Helvetica, sans-serif';
const ENTRELINHA = 1.15; // line-height "normal" da Arial
const ESPACO_RS = 1.5; // mm entre o "R$" e o valor

type Ctx = CanvasRenderingContext2D;

const comEspacamento = (ctx: Ctx, px: number) => {
  // letterSpacing existe no Chrome/Edge atuais; sem ele, segue sem espaçamento
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
};

/** Quebra o texto em linhas que cabem na largura (palavra longa demais é cortada). */
const quebrarLinhas = (ctx: Ctx, texto: string, largura: number, maxLinhas: number) => {
  const palavras = String(texto || '').split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(tentativa).width <= largura) { atual = tentativa; continue; }
    if (atual) linhas.push(atual);
    atual = p;
    while (ctx.measureText(atual).width > largura && atual.length > 1) {
      let corte = atual.length - 1;
      while (corte > 1 && ctx.measureText(atual.slice(0, corte)).width > largura) corte--;
      linhas.push(atual.slice(0, corte));
      atual = atual.slice(corte);
    }
    if (linhas.length >= maxLinhas) break;
  }
  if (atual && linhas.length < maxLinhas) linhas.push(atual);
  return linhas.slice(0, maxLinhas);
};

/** Corta com reticências para caber numa linha. */
const caber = (ctx: Ctx, texto: string, largura: number) => {
  if (ctx.measureText(texto).width <= largura) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > largura) t = t.slice(0, -1);
  return `${t}…`;
};

/**
 * Barras do código: zona de silêncio de 10 módulos de cada lado. Em pontos inteiros (térmica) o módulo tem pelo menos
 * 2 pontos quando couber em larguraMax, para o leitor ler com folga. Devolve a largura usada.
 */
const larguraBarras = (codigo: CodigoBarras, larguraBox: number, larguraMax: number, inteiro: boolean) => {
  const total = codigo.modulos.length + 20;
  if (!inteiro) return { modulo: larguraBox / total, largura: larguraBox };
  let modulo = Math.max(1, Math.floor(larguraBox / total));
  if (modulo < 2 && total * 2 <= larguraMax) modulo = 2;
  return { modulo, largura: total * modulo };
};

const desenharBarras = (ctx: Ctx, codigo: CodigoBarras, x: number, y: number, modulo: number, altura: number) => {
  let pos = x + 10 * modulo;
  let i = 0;
  while (i < codigo.modulos.length) {
    if (codigo.modulos[i] === '1') {
      let w = 0;
      while (codigo.modulos[i + w] === '1') w++;
      ctx.fillRect(Math.round(pos), Math.round(y), Math.round(w * modulo), Math.round(altura));
      pos += w * modulo; i += w;
    } else { pos += modulo; i++; }
  }
};

/** Tamanho real da etiqueta (o mesmo do .etq no CSS). */
export const DIMENSOES_ETIQUETA: Record<ModeloEtiquetaId, { larguraMm: number; alturaMm: number }> = {
  '105x27': { larguraMm: 105, alturaMm: 27 },
  '60x40': { larguraMm: 60, alturaMm: 40 },
};

export const desenharEtiqueta = (ctx: Ctx, e: EtiquetaDados, modelo: ModeloEtiquetaId, k: number, inteiro: boolean) => {
  const { larguraMm: W, alturaMm: H } = DIMENSOES_ETIQUETA[modelo];
  const s = (mm: number) => mm * k;
  const fonte = (mm: number, peso = '700') => `${peso} ${s(mm)}px ${FONTE}`;
  const meiaEntrelinha = (mm: number) => s(mm) * (ENTRELINHA - 1) / 2;
  const horizontal = modelo === '105x27';
  const padX = 2;
  const padY = 1.2;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, s(W), s(H));
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  comEspacamento(ctx, 0);

  // OFERTA: tarja preta no canto
  if (e.promo) {
    ctx.font = fonte(2.4);
    const largura = ctx.measureText('OFERTA').width + s(2.4);
    const altura = s(2.4 * ENTRELINHA + 0.6);
    const x = s(W - 1.5) - largura;
    ctx.fillRect(x, s(1), largura, altura);
    ctx.fillStyle = '#fff';
    ctx.fillText('OFERTA', x + s(1.2), s(1) + s(0.3) + meiaEntrelinha(2.4));
    ctx.fillStyle = '#000';
  }

  // Nome: negrito 3,1 mm, até 2 linhas, sem invadir o canto da oferta
  ctx.font = fonte(3.1);
  const linhasNome = quebrarLinhas(ctx, e.nome, s(W - 2 * padX - 12), 2);
  linhasNome.forEach((l, i) => ctx.fillText(l, s(padX), s(padY) + i * s(3.1 * ENTRELINHA) + meiaEntrelinha(3.1)));
  const topoCorpo = s(padY) + linhasNome.length * s(3.1 * ENTRELINHA);

  // Rodapé (de baixo para cima): lote/validade/localização (só se houver) e atacado
  const info = [linhaInfo(e), e.localizacao ? `LOC: ${e.localizacao}` : ''].filter(Boolean).join(' | ');
  let baseCorpo = s(H - padY);
  if (info) {
    baseCorpo -= s(2.2 * ENTRELINHA);
    ctx.font = fonte(2.2, '400');
    ctx.fillText(caber(ctx, info, s(W - 2 * padX)), s(padX), baseCorpo + meiaEntrelinha(2.2));
  }
  const atacado = linhaAtacado(e);
  if (atacado) {
    baseCorpo -= s(2.4 * ENTRELINHA);
    ctx.font = fonte(2.4);
    ctx.fillText(caber(ctx, atacado, s(W - 2 * padX)), s(padX), baseCorpo + meiaEntrelinha(2.4));
  }

  // Preço: o maior que couber (para ler de longe); R$ e centavos alinhados pelo topo do número
  const { inteiro: parteInteira, centavos } = partesPreco(e.preco);
  const medirPreco = (tam: number) => {
    ctx.font = fonte(tam * 0.32); const wRs = ctx.measureText('R$').width;
    ctx.font = fonte(tam, '800'); comEspacamento(ctx, -s(tam * 0.033)); const wInt = ctx.measureText(`${parteInteira},`).width; comEspacamento(ctx, 0);
    ctx.font = fonte(tam * 0.5, '800'); const wCent = ctx.measureText(centavos).width;
    return { wRs, wInt, total: wRs + s(ESPACO_RS) + wInt + wCent };
  };
  const desenharPreco = (x: number, y: number, tam: number) => {
    const m = medirPreco(tam);
    ctx.font = fonte(tam * 0.32); ctx.fillText('R$', x, y);
    ctx.font = fonte(tam, '800'); comEspacamento(ctx, -s(tam * 0.033)); ctx.fillText(`${parteInteira},`, x + m.wRs + s(ESPACO_RS), y); comEspacamento(ctx, 0);
    ctx.font = fonte(tam * 0.5, '800'); ctx.fillText(centavos, x + m.wRs + s(ESPACO_RS) + m.wInt, y);
  };
  /** Maior tamanho (mm) entre 8 e 14 que cabe na altura e na largura dadas. */
  const tamanhoPreco = (alturaMm: number, larguraPx: number) => {
    let tam = Math.max(8, Math.min(14, alturaMm));
    while (tam > 8 && medirPreco(tam).total > larguraPx) tam -= 0.25;
    return tam;
  };

  // Código de barras com a unidade (UOM) em cima e o código embaixo
  const codigo = escolherCodigo(e.gtin, e.sku);
  const altUom = e.unidade ? s(2.6 * ENTRELINHA) : 0;
  // Na 105x27 cheia (nome em 2 linhas, atacado e lote) as barras encolhem para o bloco caber na altura
  const alturaBarras = horizontal
    ? Math.max(4, Math.min(7, (baseCorpo - topoCorpo - altUom) / k - 2.2 * ENTRELINHA))
    : 8;
  const alturaBlocoBarras = codigo ? altUom + s(alturaBarras) + s(2.2 * ENTRELINHA) : altUom;
  const desenharBloco = (x: number, y: number, larg: number, modulo: number) => {
    if (e.unidade) {
      ctx.font = fonte(2.6);
      const w = ctx.measureText(e.unidade).width;
      ctx.fillText(e.unidade, x + (larg - w) / 2, y + meiaEntrelinha(2.6));
    }
    if (!codigo) return;
    const yBarras = y + altUom;
    desenharBarras(ctx, codigo, x, yBarras, modulo, s(alturaBarras));
    ctx.font = fonte(2.2, '400');
    comEspacamento(ctx, s(0.4));
    const w = ctx.measureText(codigo.valor).width;
    ctx.fillText(codigo.valor, x + (larg - w) / 2, yBarras + s(alturaBarras) + meiaEntrelinha(2.2));
    comEspacamento(ctx, 0);
  };

  const altCorpo = baseCorpo - topoCorpo;
  if (horizontal) {
    const barras = codigo ? larguraBarras(codigo, s(38), s(W - 2 * padX - 34), inteiro) : { modulo: 0, largura: e.unidade ? s(10) : 0 };
    const tam = tamanhoPreco(altCorpo / k * 0.95, s(W - 2 * padX) - barras.largura - s(2));
    desenharPreco(s(padX), topoCorpo + (altCorpo - s(tam)) / 2, tam);
    if (alturaBlocoBarras > 0) desenharBloco(s(W - padX) - barras.largura, topoCorpo + (altCorpo - alturaBlocoBarras) / 2, barras.largura, barras.modulo);
  } else {
    const barras = codigo ? larguraBarras(codigo, s(50), s(W - 2 * padX), inteiro) : { modulo: 0, largura: s(W - 2 * padX) };
    const folga = alturaBlocoBarras > 0 ? s(0.8) + alturaBlocoBarras : 0;
    const tam = tamanhoPreco((altCorpo - folga) / k * 0.95, s(W - 2 * padX));
    const y0 = topoCorpo + (altCorpo - s(tam) - folga) / 2;
    desenharPreco((s(W) - medirPreco(tam).total) / 2, y0, tam);
    if (alturaBlocoBarras > 0) desenharBloco((s(W) - barras.largura) / 2, y0 + s(tam) + s(0.8), barras.largura, barras.modulo);
  }
};

/** Canvas com a etiqueta. Na térmica (inteiro) os pontos ficam alinhados à grade da impressora. */
export const renderizarEtiqueta = (e: EtiquetaDados, modelo: ModeloEtiquetaId, k: number, inteiro: boolean, deslocMm = { x: 0, y: 0 }) => {
  const { larguraMm, alturaMm } = DIMENSOES_ETIQUETA[modelo];
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(larguraMm * k);
  canvas.height = Math.round(alturaMm * k);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(Math.round(deslocMm.x * k), Math.round(deslocMm.y * k));
  desenharEtiqueta(ctx, e, modelo, k, inteiro);
  ctx.restore();
  return canvas;
};

/** Etiqueta de teste: moldura na borda, cruz no centro e as medidas, para acertar posição e tamanho. */
export const renderizarTeste = (modelo: ModeloEtiquetaId, k: number, deslocMm = { x: 0, y: 0 }) => {
  const { larguraMm: W, alturaMm: H } = DIMENSOES_ETIQUETA[modelo];
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * k);
  canvas.height = Math.round(H * k);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(Math.round(deslocMm.x * k), Math.round(deslocMm.y * k));
  ctx.fillStyle = '#000';
  const t = Math.max(2, Math.round(0.3 * k));
  // Moldura a 1 mm da borda: se ela sair inteira e centrada, posição e tamanho estão certos
  ctx.fillRect(k, k, W * k - 2 * k, t);
  ctx.fillRect(k, H * k - k - t, W * k - 2 * k, t);
  ctx.fillRect(k, k, t, H * k - 2 * k);
  ctx.fillRect(W * k - k - t, k, t, H * k - 2 * k);
  ctx.fillRect(W * k / 2 - t / 2, H * k / 2 - 3 * k, t, 6 * k);
  ctx.fillRect(W * k / 2 - 3 * k, H * k / 2 - t / 2, 6 * k, t);
  ctx.font = `700 ${3 * k}px ${FONTE}`;
  ctx.textBaseline = 'top';
  ctx.fillText(`TESTE ${W} x ${H} mm`, 3 * k, 2.5 * k);
  ctx.font = `400 ${2.2 * k}px ${FONTE}`;
  ctx.fillText('Moldura a 1 mm da borda · cruz no centro', 3 * k, H * k - 5.5 * k);
  return canvas;
};

/** Pré-visualização da térmica: a imagem já em preto e branco puro (como a impressora vai imprimir). */
export const previaTermica = (canvas: HTMLCanvasElement, limiar: number) => {
  const ctx = canvas.getContext('2d')!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const lum = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
    const v = lum < limiar ? 0 : 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
};
