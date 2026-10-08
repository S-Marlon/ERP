// Lista de precificação: contas da grade (regras puras). O fator da taxa vem de fora (taxa da maquininha embutida).
// preço = custo × markup × fator; markup = preço ÷ (custo × fator). Custo e markup/preço valem para o varejo da unidade base.

export interface LinhaLote {
  idItem: number;
  sku: string;
  nome: string;
  unidade: string | null;
  // Como está gravado
  custoAtual: number | null;
  ultimoCusto: number | null;
  custoMedio: number | null;
  markupAtual: number | null;
  precoAtual: number | null;
  // O que vai ser gravado
  custo: number | null;
  markup: number | null;
  preco: number | null;
  // Item antigo sem unidade base: a unidade escolhida na lista (criada junto com o preço)
  unidadeNova?: string | null;
  // Outras faixas do item (editadas no editor completo, pelo botão da linha)
  faixasAtacado?: number;
  unidadesVenda?: number;
}

export type Arredondamento = 'NENHUM' | 'CENTAVOS_90' | 'CENTAVOS_99' | 'MEIO' | 'INTEIRO';

const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

export const precoDe = (custo: number, markup: number, fator: number) => r2(custo * markup * fator);
export const markupDe = (preco: number, custo: number, fator: number) => (custo > 0 ? r4(preco / (custo * fator)) : 0);

/** Arredonda PARA CIMA no padrão de vitrine (não baixa o preço calculado). */
export const arredondar = (preco: number, modo: Arredondamento): number => {
  if (!(preco > 0) || modo === 'NENHUM') return r2(preco);
  const c = Math.round(preco * 100); // em centavos, sem erro de ponto flutuante
  const proximo = (passo: number, resto: number) => {
    // menor valor >= preço cujo resto (em centavos, no passo) é "resto"
    const base = Math.floor(c / passo) * passo + resto;
    return (base >= c ? base : base + passo) / 100;
  };
  if (modo === 'CENTAVOS_90') return proximo(100, 90);
  if (modo === 'CENTAVOS_99') return proximo(100, 99);
  if (modo === 'MEIO') return proximo(50, 0);
  return proximo(100, 0);
};

/** Linha nova a partir do painel: começa igual ao gravado (sem preço/markup: markup padrão). */
export const linhaDoPainel = (i: {
  idItem: number; sku: string; nome: string; unidadeBase: string | null; custoGerencial: number | null;
  ultimoCusto: number | null; custoMedio: number | null; markupVarejo?: number | null; precoVarejo: number | null;
  faixasAtacado?: number; unidadesVenda?: number;
}, fator: number, markupPadrao = 1.8): LinhaLote => {
  const custo = i.custoGerencial && i.custoGerencial > 0 ? i.custoGerencial : (i.ultimoCusto || i.custoMedio || null);
  const markup = i.markupVarejo && i.markupVarejo > 0 ? i.markupVarejo : (i.precoVarejo && custo ? markupDe(i.precoVarejo, custo, fator) : markupPadrao);
  return {
    idItem: i.idItem, sku: i.sku, nome: i.nome, unidade: i.unidadeBase,
    custoAtual: i.custoGerencial, ultimoCusto: i.ultimoCusto, custoMedio: i.custoMedio,
    markupAtual: i.markupVarejo ?? null, precoAtual: i.precoVarejo,
    custo, markup, preco: i.precoVarejo && i.precoVarejo > 0 ? i.precoVarejo : (custo ? precoDe(custo, markup, fator) : null),
    faixasAtacado: i.faixasAtacado ?? 0, unidadesVenda: i.unidadesVenda ?? 1,
  };
};

// ---------------------------------------------------------------- edição de uma linha (cada campo puxa os outros)
export const comCusto = (l: LinhaLote, custo: number | null, fator: number): LinhaLote =>
  ({ ...l, custo, preco: custo && l.markup ? precoDe(custo, l.markup, fator) : l.preco });
export const comMarkup = (l: LinhaLote, markup: number | null, fator: number): LinhaLote =>
  ({ ...l, markup, preco: l.custo && markup ? precoDe(l.custo, markup, fator) : l.preco });
export const comPreco = (l: LinhaLote, preco: number | null, fator: number): LinhaLote =>
  ({ ...l, preco, markup: l.custo && preco ? markupDe(preco, l.custo, fator) : l.markup });

// ---------------------------------------------------------------- ações em massa
export type AcaoLote =
  | { tipo: 'CUSTO'; origem: 'ULTIMO' | 'MEDIO' | 'ATUAL' }
  | { tipo: 'MARKUP'; valor: number }
  | { tipo: 'AJUSTE_PCT'; pct: number }
  | { tipo: 'ARREDONDAR'; modo: Arredondamento }
  | { tipo: 'DESFAZER' }
  | { tipo: 'UNIDADE'; sigla: string };

export const aplicarAcao = (linhas: LinhaLote[], acao: AcaoLote, fator: number): LinhaLote[] => linhas.map(l => {
  switch (acao.tipo) {
    case 'CUSTO': {
      const c = acao.origem === 'ULTIMO' ? l.ultimoCusto : acao.origem === 'MEDIO' ? l.custoMedio : l.custoAtual;
      return c && c > 0 ? comCusto(l, c, fator) : l;
    }
    case 'MARKUP': return acao.valor > 0 ? comMarkup(l, acao.valor, fator) : l;
    case 'AJUSTE_PCT': return l.preco ? comPreco(l, r2(l.preco * (1 + acao.pct / 100)), fator) : l;
    case 'ARREDONDAR': return l.preco ? comPreco(l, arredondar(l.preco, acao.modo), fator) : l;
    case 'DESFAZER': return {
      ...l, custo: l.custoAtual, markup: l.markupAtual,
      preco: l.precoAtual, unidadeNova: null,
    };
    // Só para quem não tem unidade base
    case 'UNIDADE': return l.unidade ? l : { ...l, unidadeNova: acao.sigla.trim().toUpperCase() || null };
    default: return l;
  }
});

const difere = (a: number | null, b: number | null, tol: number) => Math.abs((a ?? 0) - (b ?? 0)) >= tol;

/** A linha muda algo no que está gravado? */
export const linhaAlterada = (l: LinhaLote) =>
  difere(l.custo, l.custoAtual, 0.00005) || difere(l.preco, l.precoAtual, 0.005) || difere(l.markup, l.markupAtual, 0.00005)
  || (!l.unidade && !!l.unidadeNova);

/** Item sem unidade base e sem unidade escolhida: não dá para gravar o preço. */
export const faltaUnidade = (l: LinhaLote) => !l.unidade && !l.unidadeNova;

/** Pedido para o servidor: custo só se mudou; preço sempre (o servidor deriva o markup com a taxa atual). */
export const pedidoDaLinha = (l: LinhaLote) => ({
  idItem: l.idItem,
  custo: difere(l.custo, l.custoAtual, 0.00005) ? l.custo : null,
  preco: l.preco,
  unidade: l.unidade ? null : (l.unidadeNova || null),
});

/** Margem líquida (depois da taxa) sobre o preço. */
export const margemLiquida = (preco: number | null, custo: number | null, taxaPct: number) =>
  preco && preco > 0 && custo ? Math.round(((preco * (1 - taxaPct / 100) - custo) / preco) * 1000) / 10 : null;
