// Codificação de código de barras em módulos ("1" = barra, "0" = espaço), para desenhar em SVG.
// EAN-13 para GTIN válido; Code 128 (conjunto B) para SKU e textos.

// ---------------------------------------------------------------- EAN-13
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
// Paridade dos 6 dígitos da esquerda conforme o 1º dígito (L/G)
const EAN_PARIDADE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export const digitoVerificadorEan = (doze: string): number => {
  const soma = doze.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (soma % 10)) % 10;
};

export const eanValido = (codigo: string): boolean =>
  /^\d{13}$/.test(codigo) && digitoVerificadorEan(codigo.slice(0, 12)) === Number(codigo[12]);

export const codificarEan13 = (codigo: string): string => {
  if (!eanValido(codigo)) throw new Error(`EAN-13 inválido: ${codigo}`);
  const paridade = EAN_PARIDADE[Number(codigo[0])];
  let modulos = '101';
  for (let i = 1; i <= 6; i++) modulos += (paridade[i - 1] === 'L' ? EAN_L : EAN_G)[Number(codigo[i])];
  modulos += '01010';
  for (let i = 7; i <= 12; i++) modulos += EAN_R[Number(codigo[i])];
  return modulos + '101';
};

// ---------------------------------------------------------------- Code 128
// Larguras (barra, espaço, barra, espaço, barra, espaço) dos valores 0..105; 106 = STOP (7 elementos)
export const CODE128_PADROES = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const STOP = 106;

const larguraParaModulos = (padrao: string) =>
  padrao.split('').map((w, i) => (i % 2 === 0 ? '1' : '0').repeat(Number(w))).join('');

/** Valores Code 128-B (start, dados, checksum, stop) — exportado para teste. */
export const valoresCode128B = (texto: string): number[] => {
  const dados = texto.split('').map(ch => {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) throw new Error(`Caractere não suportado no Code 128: "${ch}"`);
    return c - 32;
  });
  const checksum = dados.reduce((acc, v, i) => acc + v * (i + 1), START_B) % 103;
  return [START_B, ...dados, checksum, STOP];
};

export const codificarCode128 = (texto: string): string =>
  valoresCode128B(texto).map(v => larguraParaModulos(CODE128_PADROES[v])).join('');

// ---------------------------------------------------------------- escolha + SVG
export interface CodigoBarras {
  tipo: 'EAN13' | 'CODE128';
  valor: string;
  modulos: string;
}

/** GTIN válido vira EAN-13; o resto vira Code 128 (sem acentos). Vazio = sem código. */
export const escolherCodigo = (gtin?: string | null, sku?: string | null): CodigoBarras | null => {
  const g = String(gtin || '').trim();
  if (eanValido(g)) return { tipo: 'EAN13', valor: g, modulos: codificarEan13(g) };
  const texto = String(gtin || sku || '').trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '');
  if (!texto) return null;
  return { tipo: 'CODE128', valor: texto, modulos: codificarCode128(texto) };
};

/** SVG com largura/altura em mm (escala pela área disponível; zona de silêncio de 10 módulos). */
export const svgCodigoBarras = (codigo: CodigoBarras, larguraMm: number, alturaMm: number): string => {
  const silencio = 10;
  const total = codigo.modulos.length + silencio * 2;
  let x = silencio;
  let barras = '';
  let i = 0;
  while (i < codigo.modulos.length) {
    if (codigo.modulos[i] === '1') {
      let w = 0;
      while (codigo.modulos[i + w] === '1') w++;
      barras += `<rect x="${x}" y="0" width="${w}" height="100"/>`;
      x += w; i += w;
    } else { x++; i++; }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} 100" preserveAspectRatio="none" width="${larguraMm}mm" height="${alturaMm}mm" shape-rendering="crispEdges"><g fill="#000">${barras}</g></svg>`;
};
