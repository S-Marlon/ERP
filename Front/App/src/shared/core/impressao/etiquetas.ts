// Núcleo de etiquetas: o mesmo dado vira HTML (qualquer impressora / PDF) ou imagem para a térmica (etiquetaCanvas.ts).
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
  '105x27': { id: '105x27', nome: '105 x 27 mm', larguraMm: 105, alturaMm: 25, descricao: 'Gôndola / prateleira (horizontal)' },
  '60x40': { id: '60x40', nome: '60 x 40 mm', larguraMm: 60, alturaMm: 40, descricao: 'Produto / caixa (quadrada)' },
};

// ---------------------------------------------------------------- formatação comum
const escaparHtml = (t: string) => String(t || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const partesPreco = (preco: number) => {
  const [inteiro, centavos] = Number(preco || 0).toFixed(2).split('.');
  return { inteiro: Number(inteiro).toLocaleString('pt-BR'), centavos };
};

const dataBr = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso || '');

// Rodapé: lote e validade (o código já sai embaixo das barras e a unidade em cima delas)
export const linhaInfo = (e: EtiquetaDados) => [
  e.lote ? `L: ${e.lote}` : '',
  e.validade ? `VAL: ${dataBr(e.validade)}` : '',
].filter(Boolean).join(' | ');

export const linhaAtacado = (e: EtiquetaDados) => {
  if (!e.atacado || !(e.atacado.preco > 0)) return '';
  const p = partesPreco(e.atacado.preco);
  return `A PARTIR DE ${Number(e.atacado.quantidadeMinima).toLocaleString('pt-BR')} ${e.unidade || 'UN'}: R$ ${p.inteiro},${p.centavos}`;
};

// PRN da térmica: a etiqueta vai como imagem (etiquetaCanvas.ts + prnBitmap.ts), igual à pré-visualização.
  
// ---------------------------------------------------------------- HTML (impressora comum / PDF)
const htmlUma = (e: EtiquetaDados, modelo: ModeloEtiqueta): string => {
  const { inteiro, centavos } = partesPreco(e.preco);
  const codigo = escolherCodigo(e.gtin, e.sku);
  const horizontal = modelo.id === '105x27';
  const barras = codigo ? svgCodigoBarras(codigo, horizontal ? 38 : 50, horizontal ? 7 : 8) : '';
  const atacado = linhaAtacado(e);
  const info = [linhaInfo(e), e.localizacao ? `LOC: ${e.localizacao}` : ''].filter(Boolean).join(' | ');
  const uom = e.unidade ? `<div class="uom">${escaparHtml(e.unidade)}</div>` : '';
  return `
<div class="etq etq-${modelo.id}">
  ${e.promo ? '<div class="promo">OFERTA</div>' : ''}
  <div class="nome">${escaparHtml(e.nome)}</div>
  <div class="corpo">
    <div class="preco"><span class="rs">R$ </span><span class="int">${inteiro},</span><span class="cent">${centavos}</span></div>
    ${codigo ? `<div class="barras">${uom}${barras}<div class="cod">${escaparHtml(codigo.valor)}</div></div>` : uom}
  </div>
  ${atacado ? `<div class="atacado">${escaparHtml(atacado)}</div>` : ''}
  ${info ? `<div class="info">${escaparHtml(info)}</div>` : ''}
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
  .etq .preco .rs { font-size: 3.8mm; font-weight: 700; margin-right: 1.5mm; vertical-align: top; }
  .etq .preco .int { font-size: 12mm; font-weight: 800; letter-spacing: -0.4mm; }
  .etq .preco .cent { font-size: 6mm; font-weight: 800; vertical-align: top; }
  .etq-60x40 .preco .rs { font-size: 3.4mm; }
  .etq-60x40 .preco .int { font-size: 10.5mm; }
  .etq-60x40 .preco .cent { font-size: 5.2mm; }
  .etq .uom { font-size: 2.6mm; font-weight: 700; line-height: 1.15; }
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
