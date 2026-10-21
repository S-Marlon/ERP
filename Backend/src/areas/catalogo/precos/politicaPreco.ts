// Política de preço em lote: varejo (manter, markup fixo ou markup por faixa de custo) e até dois atacados, cada um com
// quantidade mínima e markup próprio (ex.: rolamento pequeno a 4,5x no varejo e 2x a partir da embalagem de 10). Regras
// puras: o preço é custo × markup × taxa embutida, como no resto do sistema. Só a unidade base do item.
import { calcularPrecoUnidade } from './precificacao';

export type RegraVarejo =
  | { modo: 'MANTER' }
  | { modo: 'MARKUP'; markup: number }
  /** Faixas em ordem de custo: a primeira cujo `ateCusto` alcança o custo (null = acima de todas). */
  | { modo: 'POR_CUSTO'; faixas: { ateCusto: number | null; markup: number }[] };

export interface NivelAtacado { quantidade: number; markup: number }

export interface Politica {
  varejo: RegraVarejo;
  /** MANTER = não mexe no atacado; DEFINIR = troca pelos níveis abaixo (sem níveis = tira o atacado). */
  atacado: { modo: 'MANTER' } | { modo: 'DEFINIR'; nivel1: NivelAtacado | null; nivel2: NivelAtacado | null; pularQuemTem: boolean };
}

export interface ItemPolitica {
  custo: number | null;
  varejoAtual: { markup: number; preco: number } | null;
  atacadoAtual: { quantidade: number; markup: number; preco: number }[];
}

export interface FaixaPlanejada { tipo: 'VAREJO' | 'ATACADO'; ordem: number; quantidadeMinima: number; quantidadeMaxima: number | null; markup: number; preco: number }

export interface PlanoPolitica {
  situacao: 'ALTERA' | 'IGUAL' | 'ERRO';
  erro: string | null;
  avisos: string[];
  /** As faixas da unidade base depois de aplicar (varejo + atacados), com o lucro de cada uma. */
  faixas: (FaixaPlanejada & { lucroPct: number; margemPct: number })[];
  mexeNoAtacado: boolean;
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const r2 = (v: number) => Math.round(v * 100) / 100;

export class ErroPolitica extends Error {}

/** Confere a política antes de olhar os itens (o que vale para todos). */
export const validarPolitica = (p: Politica) => {
  if (p.varejo.modo === 'MARKUP' && !(p.varejo.markup > 0)) throw new ErroPolitica('Informe o markup do varejo.');
  if (p.varejo.modo === 'POR_CUSTO') {
    if (!p.varejo.faixas.length) throw new ErroPolitica('Informe ao menos uma faixa de custo.');
    if (p.varejo.faixas.some(f => !(f.markup > 0))) throw new ErroPolitica('Todas as faixas de custo precisam de markup.');
    const limites = p.varejo.faixas.map(f => f.ateCusto).filter((x): x is number => x !== null);
    if (limites.some((v, i) => i > 0 && v <= limites[i - 1])) throw new ErroPolitica('As faixas de custo precisam estar em ordem crescente.');
  }
  if (p.atacado.modo === 'DEFINIR') {
    const { nivel1: a1, nivel2: a2 } = p.atacado;
    for (const [n, a] of [[1, a1], [2, a2]] as const) {
      if (a && (!(a.quantidade >= 2) || !(a.markup > 0))) throw new ErroPolitica(`Atacado ${n}: quantidade a partir de 2 e markup maior que zero.`);
    }
    if (a2 && !a1) throw new ErroPolitica('Preencha o atacado 1 antes do atacado 2.');
    if (a1 && a2 && !(a2.quantidade > a1.quantidade)) throw new ErroPolitica('O atacado 2 precisa de quantidade maior que o atacado 1.');
    if (a1 && a2 && !(a2.markup < a1.markup)) throw new ErroPolitica('O atacado 2 precisa de markup menor que o atacado 1 (é o preço de quem leva mais).');
  }
};

/** Markup do varejo para o custo: o atual, o fixo ou o da faixa de custo. */
export const markupDoVarejo = (regra: RegraVarejo, custo: number, atual: number | null) => {
  if (regra.modo === 'MANTER') return atual;
  if (regra.modo === 'MARKUP') return regra.markup;
  return (regra.faixas.find(f => f.ateCusto === null || custo <= f.ateCusto) ?? regra.faixas[regra.faixas.length - 1]).markup;
};

/**
 * O que a política faz no item: as faixas novas da unidade base, ou o motivo de não aplicar. `taxaPct` é a taxa
 * embutida no preço (cartão) e `alvoPct` o lucro mínimo sobre o custo (avisa abaixo dele).
 */
export const planejarPolitica = (item: ItemPolitica, p: Politica, op: { fatorTaxa: number; taxaPct: number; alvoPct: number }): PlanoPolitica => {
  const erro = (texto: string): PlanoPolitica => ({ situacao: 'ERRO', erro: texto, avisos: [], faixas: [], mexeNoAtacado: false });
  const custo = Number(item.custo) || 0;
  if (!(custo > 0)) return erro('Sem custo: lance o custo para calcular o preço.');
  const mVarejo = markupDoVarejo(p.varejo, custo, item.varejoAtual?.markup ?? null);
  if (!mVarejo) return erro('Sem preço de varejo: escolha um markup para o varejo.');

  const pular = p.atacado.modo === 'DEFINIR' && p.atacado.pularQuemTem && item.atacadoAtual.length > 0;
  const mexeNoAtacado = p.atacado.modo === 'DEFINIR' && !pular;
  const niveis: NivelAtacado[] = mexeNoAtacado && p.atacado.modo === 'DEFINIR'
    ? [p.atacado.nivel1, p.atacado.nivel2].filter((n): n is NivelAtacado => !!n)
    : item.atacadoAtual.map(a => ({ quantidade: a.quantidade, markup: a.markup }));
  if (mexeNoAtacado && niveis.some(n => n.markup >= mVarejo)) {
    return erro(`O atacado (${niveis.map(n => `${n.markup}x`).join(' e ')}) não fica mais barato que o varejo (${mVarejo}x).`);
  }

  const preco = (m: number) => calcularPrecoUnidade(custo, 1, m, op.fatorTaxa);
  // varejo mantido conserva o preço gravado (pode ter sido digitado à mão)
  const precoVarejo = p.varejo.modo === 'MANTER' && item.varejoAtual ? item.varejoAtual.preco : preco(mVarejo);
  const faixas: FaixaPlanejada[] = [
    { tipo: 'VAREJO', ordem: 1, quantidadeMinima: 0, quantidadeMaxima: niveis.length ? niveis[0].quantidade - 1 : null, markup: r4(mVarejo), preco: precoVarejo },
    ...niveis.map((n, k) => ({
      tipo: 'ATACADO' as const, ordem: k + 2, quantidadeMinima: n.quantidade,
      quantidadeMaxima: niveis[k + 1] ? niveis[k + 1].quantidade - 1 : null, markup: r4(n.markup),
      preco: !mexeNoAtacado && item.atacadoAtual[k] ? item.atacadoAtual[k].preco : preco(n.markup),
    })),
  ];
  const comLucro = faixas.map(f => {
    const liquido = f.preco * (1 - op.taxaPct / 100);
    return { ...f, lucroPct: r2(((liquido - custo) / custo) * 100), margemPct: f.preco > 0 ? r2(((liquido - custo) / f.preco) * 100) : 0 };
  });

  const nome = (f: FaixaPlanejada) => (f.tipo === 'VAREJO' ? 'Varejo' : `Atacado ${f.ordem - 1} (${f.quantidadeMinima}+)`);
  const prejuizo = comLucro.find(f => f.lucroPct < 0);
  if (prejuizo) return erro(`${nome(prejuizo)} dá prejuízo: ${prejuizo.lucroPct}% sobre o custo.`);
  const avisos = comLucro.filter(f => f.lucroPct < op.alvoPct).map(f => `${nome(f)}: lucro de ${f.lucroPct}% sobre o custo (alvo ${op.alvoPct}%).`);
  if (pular) avisos.push('Já tem atacado próprio: o atacado fica como está.');

  const igual = (!item.varejoAtual || Math.abs(item.varejoAtual.preco - precoVarejo) < 0.005)
    && !!item.varejoAtual
    && (!mexeNoAtacado || (item.atacadoAtual.length === niveis.length
      && niveis.every((n, k) => item.atacadoAtual[k].quantidade === n.quantidade && Math.abs(item.atacadoAtual[k].preco - preco(n.markup)) < 0.005)));
  return { situacao: igual ? 'IGUAL' : 'ALTERA', erro: null, avisos, faixas: comLucro, mexeNoAtacado };
};
