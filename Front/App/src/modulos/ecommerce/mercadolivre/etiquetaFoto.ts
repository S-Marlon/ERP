// Texto da etiqueta de medida das fotos: campos de cada item (o que varia no anúncio e os atributos do cadastro),
// modelo com {Campo} e conversão de unidade (200 mm -> 20 cm). Regras puras, testadas em etiquetaFoto.test.ts.
import type { AnuncioDetalhe, ItemDoAnuncio } from './mercadoLivreApi';

export interface CampoEtiqueta { chave: string; nome: string; valor: string }

const limpar = (s: string) => s.replace(/\s+/g, ' ').trim();
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Campos do item que podem ir na foto: o que varia no anúncio (atributos do ML) e os atributos do cadastro do ERP. */
export const camposDoItem = (det: Pick<AnuncioDetalhe, 'eixos' | 'atributosCategoria' | 'atributosErp'>, item: Pick<ItemDoAnuncio, 'valores' | 'valoresErp'>): CampoEtiqueta[] => {
  const campos: CampoEtiqueta[] = [];
  const vistos = new Set<string>();
  for (const e of det.eixos) {
    const v = item.valores[e];
    const nome = det.atributosCategoria.find(a => a.id === e)?.nome || e;
    if (!v?.valor) continue;
    campos.push({ chave: nome, nome, valor: limpar(`${v.valor}${v.unidade && !String(v.valor).includes(v.unidade) ? ` ${v.unidade}` : ''}`) });
    vistos.add(normal(nome));
  }
  for (const a of det.atributosErp) {
    const valor = item.valoresErp?.[String(a.id)];
    if (!valor || vistos.has(normal(a.nome))) continue;
    campos.push({ chave: a.nome, nome: a.nome, valor: limpar(String(valor)) });
    vistos.add(normal(a.nome));
  }
  return campos;
};

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

/** Modelo padrão: os campos que variam no anúncio (ex.: "{Comprimento}"). */
export const modeloPadrao = (det: Pick<AnuncioDetalhe, 'eixos' | 'atributosCategoria'>) =>
  det.eixos.map(e => `{${det.atributosCategoria.find(a => a.id === e)?.nome || e}}`).join(' · ');
