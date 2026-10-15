// Texto escrito nas imagens das variações: modelo com {Campo} trocado pelo valor de cada item e conversão de unidade
// (200 mm -> 20 cm). Regras puras; testadas em mercadolivre/etiquetaFoto.test.ts.

export interface CampoEtiqueta { chave: string; nome: string; valor: string }

const limpar = (s: string) => s.replace(/\s+/g, ' ').trim();
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Troca {Campo} pelo valor do item (sem diferença de maiúscula/acento); campo sem valor some. */
export const textoDoModelo = (modelo: string, campos: CampoEtiqueta[]) => {
  let t = limpar(String(modelo || '').replace(/\{([^}]+)\}/g, (_, nome: string) => campos.find(c => normal(c.chave) === normal(nome))?.valor || ''));
  // separador que sobrou de campo vazio (no começo, no fim ou repetido)
  for (let k = 0; k < 3; k++) t = limpar(t.replace(/^[·|,\-–x/]\s+/i, '').replace(/\s+[·|,\-–x/]$/i, '').replace(/([·|,–])\s*[·|,–]/g, '$1'));
  return t;
};

const FATOR_MM: Record<string, number> = { mm: 1, cm: 10, m: 1000 };
const fmt = (v: number) => (Math.round(v * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** Converte as medidas do texto (mm, cm, m) para a unidade pedida: "200 mm" -> "20 cm". "original" não mexe. */
export const converterMedidas = (texto: string, para: 'original' | 'mm' | 'cm' | 'm') => {
  if (para === 'original') return texto;
  return texto.replace(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/gi, (tudo, num: string, un: string) => {
    const de = FATOR_MM[un.toLowerCase()];
    const valor = Number(num.replace(',', '.'));
    if (!de || !Number.isFinite(valor)) return tudo;
    return `${fmt((valor * de) / FATOR_MM[para])} ${para}`;
  });
};

