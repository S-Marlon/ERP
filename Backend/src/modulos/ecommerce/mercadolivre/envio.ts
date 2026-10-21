// Aba Envio: o pacote que está no anúncio do ML (SELLER_PACKAGE_*) comparado com o do ERP (embalagem recomendada +
// produto × quantidade) e o que falta para o envio. Regras puras.

export interface Caixa { altura: number; largura: number; comprimento: number }
export interface PacoteComparavel { pesoG: number | null; caixa: Caixa | null }

const TOLERANCIA_CM = 0.5;
const TOLERANCIA_PESO = 0.05;   // 5% (ou 5 g)

/** As medidas batem em qualquer ordem dos lados (o ML não liga para qual é a altura). */
const caixasIguais = (a: Caixa, b: Caixa) => {
  const x = [a.altura, a.largura, a.comprimento].sort((p, q) => p - q);
  const y = [b.altura, b.largura, b.comprimento].sort((p, q) => p - q);
  return x.every((v, i) => Math.abs(v - y[i]) <= TOLERANCIA_CM);
};

export type SituacaoPacote = 'IGUAL' | 'DIFERENTE' | 'FALTA_NO_ML' | 'SEM_ERP' | 'NAO_PUBLICADO';

/** O pacote do ML confere com o do ERP? SEM_ERP = o ERP não tem embalagem com peso e medidas para comparar. */
export const situacaoDoPacote = (noMl: PacoteComparavel | null, erp: PacoteComparavel | null, publicado: boolean): SituacaoPacote => {
  if (!erp?.caixa || !erp.pesoG) return 'SEM_ERP';
  if (!publicado) return 'NAO_PUBLICADO';
  if (!noMl?.caixa || !noMl.pesoG) return 'FALTA_NO_ML';
  const pesoIgual = Math.abs(noMl.pesoG - erp.pesoG) <= Math.max(5, erp.pesoG * TOLERANCIA_PESO);
  return pesoIgual && caixasIguais(noMl.caixa, erp.caixa) ? 'IGUAL' : 'DIFERENTE';
};

export type FaltaEnvio = 'PESO' | 'MEDIDAS' | 'EMBALAGEM' | 'FOTO';
export const faltasDoEnvio = (i: { pesoKg: number | null; medidas: Caixa | null; temEmbalagem: boolean; fotos: number; fotoFamilia: boolean }): FaltaEnvio[] => [
  ...(!i.pesoKg ? ['PESO' as const] : []),
  ...(!i.medidas ? ['MEDIDAS' as const] : []),
  ...(!i.temEmbalagem ? ['EMBALAGEM' as const] : []),
  ...(!(i.fotos > 0) && !i.fotoFamilia ? ['FOTO' as const] : []),
];
