// Logística do item: peso e medidas do produto e a embalagem recomendada por quantidade (ex.: rolamento 6000 até 2 un.
// no envelope P, até 10 na caixa nº 1). A embalagem é um item de consumo do catálogo (custo, peso e medidas próprios).
// Regras puras: validação, qual embalagem vale para uma quantidade e o pacote do envio (para o frete e o custo).

export class ErroLogistica extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface Medidas { altura: number; largura: number; comprimento: number }
export interface RegraEmbalagem { quantidadeAte: number; idEmbalagem: number }
export interface Embalagem { idEmbalagem: number; nome: string; pesoKg: number | null; medidas: Medidas | null; custo: number }

const MAX_CM = 300;
const MAX_KG = 1000;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Número positivo dentro do limite, null quando vazio; erro quando inválido. */
const medida = (v: unknown, nome: string, max: number) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) throw new ErroLogistica(`${nome}: informe um número maior que zero.`);
  if (n > max) throw new ErroLogistica(`${nome}: no máximo ${max}.`);
  return r3(n);
};

/** Peso (kg) e medidas (cm) digitados; as três medidas vão juntas (ou nenhuma). */
export const validarLogistica = (b: any) => {
  const pesoKg = medida(b?.pesoKg, 'Peso', MAX_KG);
  const [altura, largura, comprimento] = [medida(b?.altura, 'Altura', MAX_CM), medida(b?.largura, 'Largura', MAX_CM), medida(b?.comprimento, 'Comprimento', MAX_CM)];
  const preenchidas = [altura, largura, comprimento].filter(x => x !== null).length;
  if (preenchidas > 0 && preenchidas < 3) throw new ErroLogistica('Informe as três medidas (altura, largura e comprimento) ou nenhuma.');
  return { pesoKg, medidas: preenchidas === 3 ? { altura: altura!, largura: largura!, comprimento: comprimento! } : null };
};

/** Regras de embalagem: quantidade "até" maior que zero, sem repetir, em ordem. */
export const validarRegras = (lista: unknown): RegraEmbalagem[] => {
  const regras = (Array.isArray(lista) ? lista : []).map((r: any) => ({ quantidadeAte: Number(r?.quantidadeAte), idEmbalagem: Number(r?.idEmbalagem) }));
  for (const r of regras) {
    if (!(r.quantidadeAte > 0)) throw new ErroLogistica('Quantidade "até": maior que zero.');
    if (!(r.idEmbalagem > 0)) throw new ErroLogistica('Escolha a embalagem de cada faixa.');
  }
  const qtds = regras.map(r => r.quantidadeAte);
  if (new Set(qtds).size !== qtds.length) throw new ErroLogistica('Duas faixas com a mesma quantidade.');
  return regras.sort((a, b) => a.quantidadeAte - b.quantidadeAte);
};

/** As regras que valem para o item: as dele, se tiver; senão as da família. */
export const regrasEfetivas = (doItem: RegraEmbalagem[], daFamilia: RegraEmbalagem[]) =>
  doItem.length ? { origem: 'ITEM' as const, regras: doItem } : daFamilia.length ? { origem: 'FAMILIA' as const, regras: daFamilia } : { origem: null, regras: [] };

/** A embalagem para N unidades: a menor faixa que comporta; null quando nenhuma comporta (ou não há regra). */
export const regraParaQuantidade = (regras: RegraEmbalagem[], quantidade: number) =>
  [...regras].sort((a, b) => a.quantidadeAte - b.quantidadeAte).find(r => quantidade <= r.quantidadeAte + 1e-9) || null;

/** Pacote do envio de N unidades: medidas da embalagem e peso do produto × N + o da embalagem; custo da embalagem. */
export const pacoteDoEnvio = (p: { pesoProdutoKg: number | null; quantidade: number; embalagem: Embalagem | null }) => {
  if (!p.embalagem) return null;
  const pesoProduto = p.pesoProdutoKg ? p.pesoProdutoKg * p.quantidade : null;
  return {
    medidas: p.embalagem.medidas,
    pesoKg: pesoProduto === null ? null : r3(pesoProduto + (p.embalagem.pesoKg || 0)),
    custo: Math.round(p.embalagem.custo * 100) / 100,
  };
};

export type FaltaLogistica = 'PESO' | 'MEDIDAS' | 'EMBALAGEM' | 'FOTO';
export const faltasLogistica = (i: { pesoKg: number | null; medidas: Medidas | null; temEmbalagem: boolean; fotos: number }): FaltaLogistica[] => [
  ...(!i.pesoKg ? ['PESO' as const] : []),
  ...(!i.medidas ? ['MEDIDAS' as const] : []),
  ...(!i.temEmbalagem ? ['EMBALAGEM' as const] : []),
  ...(!(i.fotos > 0) ? ['FOTO' as const] : []),
];
