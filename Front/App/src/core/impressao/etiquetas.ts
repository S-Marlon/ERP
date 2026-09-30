// Núcleo de etiquetas: o mesmo dado vira PRN (impressora térmica Elgin/PPLB) ou HTML (qualquer impressora / PDF).
import { escolherCodigo, svgCodigoBarras } from './codigoBarras';

export interface EtiquetaDados {
  nome: string;
  sku: string;
  preco: number;
  unidade?: string;
  gtin?: string;
  promo?: boolean;
  lote?: string;
  validade?: string;        // AAAA-MM-DD
  localizacao?: string;
  atacado?: { quantidadeMinima: number; preco: number } | null;
  copias: number;
}

export type ModeloEtiquetaId = '105x27' | '60x40';

export interface ModeloEtiqueta {
  id: ModeloEtiquetaId;
  nome: string;
  larguraMm: number;
  alturaMm: number;
  descricao: string;
}

export const MODELOS_ETIQUETA: Record<ModeloEtiquetaId, ModeloEtiqueta> = {
  '105x27': { id: '105x27', nome: '105 x 27 mm', larguraMm: 105, alturaMm: 27, descricao: 'Gôndola / prateleira (horizontal)' },
  '60x40': { id: '60x40', nome: '60 x 40 mm', larguraMm: 60, alturaMm: 40, descricao: 'Produto / caixa (quadrada)' },
};

// ---------------------------------------------------------------- formatação comum
export const sanitizarPrn = (texto: string): string => String(texto || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\x20-\x7E]/g, '')
  .replace(/"/g, "'")
  .toUpperCase();

const escaparHtml = (t: string) => String(t || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const partesPreco = (preco: number) => {
  const [inteiro, centavos] = Number(preco || 0).toFixed(2).split('.');
  return { inteiro: Number(inteiro).toLocaleString('pt-BR'), centavos };
};

const dataBr = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso || '');

export const linhaInfo = (e: EtiquetaDados) => [
  `COD: ${e.sku}${e.unidade ? ` (${e.unidade})` : ''}`,
  e.lote ? `L: ${e.lote}` : '',
  e.validade ? `VAL: ${dataBr(e.validade)}` : '',
].filter(Boolean).join(' | ');

export const linhaAtacado = (e: EtiquetaDados) => {
  if (!e.atacado || !(e.atacado.preco > 0)) return '';
  const p = partesPreco(e.atacado.preco);
  return `A PARTIR DE ${Number(e.atacado.quantidadeMinima).toLocaleString('pt-BR')} ${e.unidade || 'UN'}: R$ ${p.inteiro},${p.centavos}`;
};

// ---------------------------------------------------------------- PRN (Elgin L42 / PPLB)
const ALTURA_PRN: Record<ModeloEtiquetaId, string> = { '105x27': 'Q216,24', '60x40': 'Q320,24' };

// EAN-13 válido usa o tipo E30 da impressora; o resto Code 128 (tipo 1)
const comandoBarrasPrn = (x: number, y: number, altura: number, e: EtiquetaDados, largura = 2) => {
  const codigo = escolherCodigo(e.gtin, e.sku);
  if (!codigo) return '';
  const tipo = codigo.tipo === 'EAN13' ? 'E30' : '1';
  return `B${x},${y},2,${tipo},${largura},4,${altura},N,"${sanitizarPrn(codigo.valor)}"\n`;
};

const prnUma = (e: EtiquetaDados, modelo: ModeloEtiquetaId): string => {
  const { inteiro, centavos } = partesPreco(e.preco);
  let prn = 'N\n';
  if (modelo === '105x27') {
    prn += `A780,185,2,2,1,1,N,"${sanitizarPrn(e.nome).slice(0, 44)}"\n`;
    prn += `A640,132,2,3,1,1,N,"R$"\n`;
    prn += `A580,122,2,5,2,2,N,"${inteiro},"\n`;
    prn += `A400,122,2,5,1,1,N,"${centavos}"\n`;
    if (e.promo) prn += `A780,115,2,3,1,1,N,"[OFERTA]"\n`;
    const atacado = linhaAtacado(e);
    if (atacado) prn += `A780,80,2,1,1,1,N,"${sanitizarPrn(atacado)}"\n`;
    prn += `A780,45,2,1,1,1,N,"${sanitizarPrn(linhaInfo(e))}"\n`;
    prn += comandoBarrasPrn(240, 15, 32, e);
  } else {
    if (e.promo) prn += `A280,350,2,3,1,1,N,"--- OFERTA ESPECIAL ---"\n`;
    prn += `A280,310,2,3,1,1,N,"${sanitizarPrn(e.nome).slice(0, 24)}"\n`;
    prn += `A370,240,2,3,1,1,N,"R$"\n`;
    prn += `A310,230,2,5,2,2,N,"${inteiro},"\n`;
    prn += `A220,246,2,4,1,1,N,"${centavos}"\n`;
    prn += `A280,180,2,1,1,1,N,"${sanitizarPrn(linhaInfo(e))}"\n`;
    const atacado = linhaAtacado(e);
    if (atacado) prn += `A280,140,2,1,1,1,N,"${sanitizarPrn(atacado)}"\n`;
    prn += comandoBarrasPrn(280, 40, 50, e);
  }
  return prn + 'P1\n';
};

export const gerarPrn = (etiquetas: EtiquetaDados[], modelo: ModeloEtiquetaId): string => {
  let prn = `I8,1,001\nq819\nS4\nD10\nO\nJF\nWN\nZT\n${ALTURA_PRN[modelo]}\n`;
  for (const e of etiquetas) {
    for (let i = 0; i < Math.max(1, Math.floor(e.copias || 1)); i++) prn += prnUma(e, modelo);
  }
  return prn;
};

// ---------------------------------------------------------------- HTML (impressora comum / PDF)
const htmlUma = (e: EtiquetaDados, modelo: ModeloEtiqueta): string => {
  const { inteiro, centavos } = partesPreco(e.preco);
  const codigo = escolherCodigo(e.gtin, e.sku);
  const horizontal = modelo.id === '105x27';
  const barras = codigo ? svgCodigoBarras(codigo, horizontal ? 38 : 50, horizontal ? 8 : 9) : '';
  const atacado = linhaAtacado(e);
  return `
<div class="etq etq-${modelo.id}">
  ${e.promo ? '<div class="promo">OFERTA</div>' : ''}
  <div class="nome">${escaparHtml(e.nome)}</div>
  <div class="corpo">
    <div class="preco"><span class="rs">R$</span><span class="int">${inteiro},</span><span class="cent">${centavos}</span></div>
    ${codigo ? `<div class="barras">${barras}<div class="cod">${escaparHtml(codigo.valor)}</div></div>` : ''}
  </div>
  ${atacado ? `<div class="atacado">${escaparHtml(atacado)}</div>` : ''}
  <div class="info">${escaparHtml(linhaInfo(e))}${e.localizacao ? ` | LOC: ${escaparHtml(e.localizacao)}` : ''}</div>
</div>`;
};

export const CSS_ETIQUETAS = `
  .etq { box-sizing: border-box; position: relative; overflow: hidden; background: #fff; color: #000;
         font-family: Arial, Helvetica, sans-serif; padding: 1.2mm 2mm; display: flex; flex-direction: column; }
  .etq-105x27 { width: 105mm; height: 27mm; }
  .etq-60x40 { width: 60mm; height: 40mm; }
  .etq .promo { position: absolute; top: 1mm; right: 1.5mm; background: #000; color: #fff; font-size: 2.4mm; font-weight: 700; padding: 0.3mm 1.2mm; }
  .etq .nome { font-weight: 700; font-size: 3.1mm; line-height: 1.15; max-height: 7.2mm; overflow: hidden; padding-right: 12mm; }
  .etq .corpo { display: flex; align-items: center; justify-content: space-between; flex: 1; gap: 2mm; }
  .etq-60x40 .corpo { flex-direction: column; justify-content: center; gap: 0.8mm; }
  .etq .preco { white-space: nowrap; line-height: 1; }
  .etq .preco .rs { font-size: 3mm; font-weight: 700; margin-right: 0.6mm; vertical-align: top; }
  .etq .preco .int { font-size: 9mm; font-weight: 800; letter-spacing: -0.3mm; }
  .etq .preco .cent { font-size: 4.5mm; font-weight: 800; vertical-align: top; }
  .etq .barras { text-align: center; }
  .etq .barras svg { display: block; }
  .etq .barras .cod { font-size: 2.2mm; letter-spacing: 0.4mm; }
  .etq .atacado { font-size: 2.4mm; font-weight: 700; }
  .etq .info { font-size: 2.2mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

/** Etiquetas (com as cópias) em HTML, uma por página do tamanho da etiqueta. */
export const gerarHtmlEtiquetas = (etiquetas: EtiquetaDados[], modeloId: ModeloEtiquetaId): string => {
  const modelo = MODELOS_ETIQUETA[modeloId];
  const paginas = etiquetas.flatMap(e => Array.from({ length: Math.max(1, Math.floor(e.copias || 1)) }, () => htmlUma(e, modelo)));
  return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title><style>
    @page { size: ${modelo.larguraMm}mm ${modelo.alturaMm}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .pagina { page-break-after: always; break-after: page; }
    .pagina:last-child { page-break-after: auto; break-after: auto; }
    ${CSS_ETIQUETAS}
  </style></head><body>${paginas.map(p => `<div class="pagina">${p}</div>`).join('')}</body></html>`;
};

/** Só a etiqueta (sem página), para pré-visualização na tela. */
export const htmlPreviewEtiqueta = (e: EtiquetaDados, modeloId: ModeloEtiquetaId) => htmlUma(e, MODELOS_ETIQUETA[modeloId]);
