// Oportunidades: itens do catálogo que ainda não estão no ML, do mais promissor para o menos, com o que falta para
// anunciar. "Pronto" = dá para criar o anúncio e publicar sem mexer no cadastro; "quase" = publica, mas falta algo que
// muda a conta ou a venda (peso, estoque, cadastro); "falta" = o ML recusa (sem foto ou sem preço).

export type SituacaoOportunidade = 'PRONTO' | 'QUASE' | 'FALTA';

export interface Candidato {
  preco: number;
  estoque: number;
  fotos: number;
  fotoFamilia: boolean;          // a família tem foto (vale para o item sem foto própria)
  pesoKg: number | null;
  medidas: boolean;
  gtin: boolean;
  motivosCadastro: string[];     // o que falta no cadastro interno (PIM)
  vendidos90: number;            // unidades vendidas no balcão nos últimos 90 dias
}

/** erro = o ML recusa; aviso = publica, mas muda a conta ou a venda; info = só lembrete. */
export interface Falta { texto: string; nivel: 'erro' | 'aviso' | 'info' }

export const faltasDoCandidato = (c: Candidato): Falta[] => {
  const f: Falta[] = [];
  if (c.fotos === 0) f.push(c.fotoFamilia ? { texto: 'sem foto própria (vai a da família)', nivel: 'info' } : { texto: 'sem foto', nivel: 'erro' });
  if (!(c.preco > 0)) f.push({ texto: 'sem preço de venda', nivel: 'erro' });
  if (!c.pesoKg || !c.medidas) f.push({ texto: 'sem peso ou medidas (o frete não entra na conta)', nivel: 'aviso' });
  if (!(c.estoque > 0)) f.push({ texto: 'sem estoque', nivel: 'aviso' });
  for (const m of c.motivosCadastro) f.push({ texto: m, nivel: 'aviso' });
  if (!c.gtin) f.push({ texto: 'sem código de barras (vai como "produto sem código")', nivel: 'info' });
  return f;
};

export const situacaoDoCandidato = (faltas: Falta[]): SituacaoOportunidade =>
  faltas.some(f => f.nivel === 'erro') ? 'FALTA' : faltas.some(f => f.nivel === 'aviso') ? 'QUASE' : 'PRONTO';

const ORDEM: Record<SituacaoOportunidade, number> = { PRONTO: 0, QUASE: 1, FALTA: 2 };

/**
 * Com estoque antes; depois o que mais vende no balcão (a procura já existe); depois pronto, quase e falta; depois o
 * maior valor em estoque.
 */
export const compararCandidatos = (
  a: Candidato & { situacao: SituacaoOportunidade }, b: Candidato & { situacao: SituacaoOportunidade }
) =>
  Number(b.estoque > 0) - Number(a.estoque > 0)
  || b.vendidos90 - a.vendidos90
  || ORDEM[a.situacao] - ORDEM[b.situacao]
  || b.estoque * b.preco - a.estoque * a.preco;
