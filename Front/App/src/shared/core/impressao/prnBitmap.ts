// PRN da térmica (Elgin/Argox, linguagem PPLB/EPL) com a etiqueta inteira como IMAGEM (comando GW):
// o que sai é exatamente o desenho da pré-visualização, em vez das fontes internas da impressora.
// Regras puras (sem canvas): recebem os pixels RGBA e devolvem os bytes do arquivo.

/** Ajustes da impressora térmica (guardados no navegador, por modelo de etiqueta). */
export interface PerfilTermica {
  larguraMm: number;          // largura da etiqueta
  alturaMm: number;           // altura da etiqueta (sem o espaço entre elas)
  espacoMm: number;           // espaço entre uma etiqueta e outra (gap)
  larguraMaxMm: number;       // largura máxima de impressão da cabeça (L42: 104 mm)
  deslocXmm: number;          // ajuste fino: + direita / − esquerda
  deslocYmm: number;          // ajuste fino: + para baixo / − para cima
  escurecimento: number;      // D0..D15
  velocidade: number;         // S1..S6
  girar180: boolean;          // imprime de cabeça para baixo (ZB) — depende de como o rolo sai
  inverter: boolean;          // inverte preto/branco (se a etiqueta sair "negativa")
  limiar: number;             // 0..255: abaixo disso o ponto é preto (maior = traço mais grosso)
}

export const PONTOS_POR_MM = 8; // 203 dpi

export const PERFIL_PADRAO: Record<string, PerfilTermica> = {
  '105x27': { larguraMm: 105, alturaMm: 27, espacoMm: 3, larguraMaxMm: 104, deslocXmm: 0, deslocYmm: 0, escurecimento: 10, velocidade: 4, girar180: true, inverter: false, limiar: 150 },
  '60x40': { larguraMm: 60, alturaMm: 40, espacoMm: 3, larguraMaxMm: 104, deslocXmm: 0, deslocYmm: 0, escurecimento: 10, velocidade: 4, girar180: true, inverter: false, limiar: 150 },
};

const pontos = (mm: number) => Math.round(Number(mm || 0) * PONTOS_POR_MM);

/** Largura de impressão (q) em pontos: a etiqueta, limitada à cabeça da impressora, múltiplo de 8 (bytes inteiros). */
export const larguraImpressao = (p: PerfilTermica) => Math.floor(Math.min(pontos(p.larguraMm), pontos(p.larguraMaxMm)) / 8) * 8;

/**
 * Pixels RGBA → linhas de 1 bit para o GW. No PPLB/EPL o bit 0 imprime (preto) e o 1 não imprime;
 * "inverter" troca isso para impressoras que fazem ao contrário.
 */
export const bitmapParaGw = (
  rgba: Uint8ClampedArray | number[], largura: number, altura: number, opcoes: { limiar: number; inverter: boolean; larguraSaida?: number }
) => {
  const saida = opcoes.larguraSaida ?? largura;
  const bytesLinha = Math.ceil(saida / 8);
  const dados = new Uint8Array(bytesLinha * altura);
  for (let y = 0; y < altura; y++) {
    for (let bx = 0; bx < bytesLinha; bx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = bx * 8 + bit;
        let preto = false;
        if (x < largura && x < saida) {
          const i = (y * largura + x) * 4;
          const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
          const alfa = rgba[i + 3] / 255;
          preto = lum * alfa + 255 * (1 - alfa) < opcoes.limiar;
        }
        // bit 1 = não imprime (branco); bit 0 = imprime (preto)
        const branco = opcoes.inverter ? preto : !preto;
        if (branco) byte |= 0x80 >> bit;
      }
      dados[y * bytesLinha + bx] = byte;
    }
  }
  return { bytesLinha, dados };
};

const ascii = (t: string) => Uint8Array.from(Array.from(t).map(c => c.charCodeAt(0) & 0x7f));

const juntar = (partes: Uint8Array[]) => {
  const total = partes.reduce((a, p) => a + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { saida.set(p, pos); pos += p.length; }
  return saida;
};

export interface EtiquetaBitmap { rgba: Uint8ClampedArray | number[]; largura: number; altura: number; copias: number }

/** Cabeçalho da impressora: largura, altura + espaço, velocidade, escurecimento, orientação. */
export const cabecalhoPrn = (p: PerfilTermica) =>
  `\nI8,1,001\nq${larguraImpressao(p)}\nQ${pontos(p.alturaMm)},${pontos(p.espacoMm)}\nS${Math.min(6, Math.max(1, Math.round(p.velocidade)))}\n`
  + `D${Math.min(15, Math.max(0, Math.round(p.escurecimento)))}\nZ${p.girar180 ? 'B' : 'T'}\nJF\nO\n`;

/** Arquivo PRN completo: cada etiqueta vira uma imagem (GW) impressa N vezes (P). */
export const montarPrnBitmap = (etiquetas: EtiquetaBitmap[], p: PerfilTermica): Uint8Array => {
  const largura = larguraImpressao(p);
  const partes: Uint8Array[] = [ascii(cabecalhoPrn(p))];
  for (const e of etiquetas) {
    const { bytesLinha, dados } = bitmapParaGw(e.rgba, e.largura, e.altura, { limiar: p.limiar, inverter: p.inverter, larguraSaida: Math.min(largura, e.largura) });
    partes.push(ascii(`N\nGW0,0,${bytesLinha},${e.altura},`), dados, ascii(`\nP${Math.max(1, Math.floor(e.copias || 1))}\n`));
  }
  return juntar(partes);
};
