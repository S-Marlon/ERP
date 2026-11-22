// Compra inteligente: cruza o que vendeu (giro) com o saldo e os vínculos de fornecedor para sugerir o pedido,
// completar o pedido mínimo do fornecedor e montar a lista "código do fornecedor + quantidade".
// Regras puras (sem banco), testadas em compraInteligente.test.ts.

export interface ItemDoFornecedor {
  idItem: number;
  sku: string;
  nome: string;
  unidade: string;            // unidade de estoque (base)
  saldo: number;              // na base
  minimo: number | null;
  maximo: number | null;
  vendido: number;            // na base, no período
  codigoFornecedor: string | null;
  unidadeCompra: string;      // como o fornecedor vende (ex.: CX)
  fatorCompra: number;        // 1 unidade de compra = fator unidades base
  precoCompra: number;        // por unidade de compra (última compra ou cotação)
}

export interface ParametrosCompra {
  dias: number;            // período de vendas analisado
  coberturaDias: number;   // quer estoque para quantos dias depois de receber
  prazoEntregaDias: number;
}

export interface SugestaoItem extends ItemDoFornecedor {
  consumoDia: number;
  coberturaAtual: number | null;      // dias que o saldo aguenta no ritmo atual (null = sem giro)
  necessidadeBase: number;            // quanto falta na base para a cobertura desejada
  quantidade: number;                 // em unidades de compra (embalagem inteira)
  valor: number;
  motivo: 'ABAIXO_MINIMO' | 'COBERTURA' | null;
}

const arred2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const arred4 = (v: number) => Math.round((Number(v) || 0) * 10000) / 10000;
const fatorValido = (f: number) => (Number(f) > 0 ? Number(f) : 1);

/** Embalagens inteiras de compra para cobrir uma quantidade na base. */
export const embalagens = (quantidadeBase: number, fator: number) =>
  quantidadeBase > 0 ? Math.ceil(arred4(quantidadeBase / fatorValido(fator)) - 1e-9) : 0;

export const coberturaDias = (saldo: number, consumoDia: number): number | null =>
  consumoDia > 0 ? Math.max(0, Math.floor(saldo / consumoDia)) : null;

/**
 * Sugestão do item: estoque para (cobertura + prazo de entrega) dias no ritmo de vendas;
 * abaixo do mínimo cadastrado, repõe pelo menos até o máximo (ou o mínimo).
 */
export const sugerirItem = (item: ItemDoFornecedor, p: ParametrosCompra): SugestaoItem => {
  const consumoDia = p.dias > 0 ? item.vendido / p.dias : 0;
  const alvoGiro = consumoDia * (p.coberturaDias + p.prazoEntregaDias);
  const abaixoMinimo = item.minimo !== null && item.saldo < item.minimo;
  const alvo = abaixoMinimo ? Math.max(alvoGiro, item.maximo ?? item.minimo ?? 0) : alvoGiro;
  const necessidadeBase = arred4(Math.max(0, alvo - item.saldo));
  const quantidade = embalagens(necessidadeBase, item.fatorCompra);
  return {
    ...item,
    consumoDia: arred4(consumoDia),
    coberturaAtual: coberturaDias(item.saldo, consumoDia),
    necessidadeBase,
    quantidade,
    valor: arred2(quantidade * item.precoCompra),
    motivo: quantidade > 0 ? (abaixoMinimo ? 'ABAIXO_MINIMO' : 'COBERTURA') : null,
  };
};

export const totalDoPedido = (linhas: Array<{ quantidade: number; precoCompra: number }>) =>
  arred2(linhas.reduce((a, l) => a + arred2(l.quantidade * l.precoCompra), 0));

/**
 * Completa o pedido mínimo: acrescenta uma embalagem por vez no item que fica com MENOS dias de estoque
 * (o que vai acabar primeiro), só itens com giro e preço, sem passar do limite de cobertura (não compra parado).
 * Devolve as quantidades novas (idItem -> quantidade em unidades de compra) e quanto ainda falta, se faltar.
 */
export const completarPedidoMinimo = (
  itens: SugestaoItem[],
  quantidades: Map<number, number>,
  pedidoMinimo: number,
  limiteCoberturaDias = 120
) => {
  const qtd = new Map(quantidades);
  const total = () => totalDoPedido(itens.map(i => ({ quantidade: qtd.get(i.idItem) || 0, precoCompra: i.precoCompra })));
  const coberturaCom = (i: SugestaoItem, pacotes: number) => (i.saldo + pacotes * fatorValido(i.fatorCompra)) / i.consumoDia;
  const acrescentados = new Map<number, number>();
  for (let volta = 0; volta < 5000 && total() < pedidoMinimo - 0.004; volta++) {
    let melhor: SugestaoItem | null = null;
    let menorCobertura = Infinity;
    for (const i of itens) {
      if (!(i.consumoDia > 0) || !(i.precoCompra > 0)) continue;
      const atual = qtd.get(i.idItem) || 0;
      if (coberturaCom(i, atual + 1) > limiteCoberturaDias) continue;
      const c = coberturaCom(i, atual);
      if (c < menorCobertura) { menorCobertura = c; melhor = i; }
    }
    if (!melhor) break;
    qtd.set(melhor.idItem, (qtd.get(melhor.idItem) || 0) + 1);
    acrescentados.set(melhor.idItem, (acrescentados.get(melhor.idItem) || 0) + 1);
  }
  const final = total();
  return { quantidades: qtd, acrescentados, total: final, falta: arred2(Math.max(0, pedidoMinimo - final)) };
};

const qtdTexto = (v: number) => String(arred4(v)).replace('.', ',');

/** Texto do pedido para mandar ao fornecedor (WhatsApp/e-mail): só código e quantidade. */
export const textoDoPedido = (
  fornecedor: string,
  linhas: Array<{ codigoFornecedor: string | null; nome: string; quantidade: number; unidadeCompra: string }>,
  observacao = ''
) => {
  const itens = linhas.filter(l => l.quantidade > 0);
  const corpo = itens.map(l => (l.codigoFornecedor
    ? `${l.codigoFornecedor} - ${qtdTexto(l.quantidade)} ${l.unidadeCompra}`.trim()
    : `(sem código) ${l.nome} - ${qtdTexto(l.quantidade)} ${l.unidadeCompra}`.trim()));
  return [
    `Olá, ${fornecedor}! Por favor, orçamento dos itens abaixo:`,
    '',
    ...corpo,
    '',
    `${itens.length} item(ns).${observacao ? ` ${observacao}` : ''}`,
  ].join('\n');
};

// ---------------------------------------------------------------- vários fornecedores para o mesmo item

export interface VinculoFornecedor {
  idFornecedor: number;
  fornecedor: string;
  codigo: string | null;
  descricao: string | null;   // como o fornecedor escreve (última nota)
  unidadeCompra: string;
  fatorCompra: number;
  preco: number;              // por unidade de compra
  padrao: boolean;            // marcado como fornecedor padrão no cadastro
  notas: number;              // quantas vezes entrou em nota deste fornecedor
  ultimaNota: number;         // id da última nota (desempate: a mais recente)
}

/**
 * Fornecedor principal do item (o "jeito" como a loja conhece o item): o marcado como padrão;
 * sem marcação, o de quem mais comprou (mais notas), depois o da compra mais recente.
 */
export const escolherPrincipal = (vinculos: VinculoFornecedor[]): VinculoFornecedor | null => {
  if (vinculos.length === 0) return null;
  const padrao = vinculos.find(v => v.padrao);
  if (padrao) return padrao;
  return [...vinculos].sort((a, b) => b.notas - a.notas || b.ultimaNota - a.ultimaNota || a.idFornecedor - b.idFornecedor)[0];
};

/** Preço por unidade de estoque, para comparar fornecedores com embalagens diferentes. */
export const precoPorUnidadeBase = (v: { preco: number; fatorCompra: number }) =>
  Math.round((v.preco / fatorValido(v.fatorCompra)) * 10000) / 10000;

// ---------------------------------------------------------------- curva ABC, pedidos faturados, equivalentes e fundos

export type ClasseCurva = 'A' | 'B' | 'C' | 'P' | 'N' | '-';
export type UrgenciaCompra = 'FALTA_PEDIDO' | 'SEM_ESTOQUE' | 'ACABANDO' | 'REPOR';

/** Estoque de segurança (dias a mais de cobertura) pela classe de venda: o que mais vende não pode faltar. */
export const SEGURANCA_POR_CLASSE: Record<'A' | 'B' | 'C', number> = { A: 15, B: 10, C: 5 };

export interface ContextoDoItem {
  classe: ClasseCurva | null;
  /** Reservado para pedidos faturados ainda não entregues (já vendido). */
  reservado: number;
  /** Vendas de equivalentes "não recomprar" que passam para este item. */
  demandaExtra: number;
  substitui: string[];
  naoRecomprar: boolean;
}
export const CONTEXTO_VAZIO: ContextoDoItem = { classe: null, reservado: 0, demandaExtra: 0, substitui: [], naoRecomprar: false };

/**
 * Sugestão com a curva: cobertura + segurança da classe, sobre o saldo LIVRE (saldo − reservado), com as vendas dos
 * equivalentes que deixaram de ser comprados. "Não recomprar" só compra o que falta para pedido faturado (já vendido).
 */
export const sugerirComCurva = (item: ItemDoFornecedor, p: ParametrosCompra, ctx: ContextoDoItem) => {
  const seguranca = ctx.classe === 'A' || ctx.classe === 'B' || ctx.classe === 'C' ? SEGURANCA_POR_CLASSE[ctx.classe] : 0;
  const livre = arred4(item.saldo - ctx.reservado);
  const faltaPedido = ctx.reservado > item.saldo ? arred4(ctx.reservado - Math.max(0, item.saldo)) : 0;
  let s = sugerirItem({ ...item, saldo: livre, vendido: item.vendido + ctx.demandaExtra }, { ...p, coberturaDias: p.coberturaDias + seguranca });
  if (ctx.naoRecomprar) {
    const q = embalagens(faltaPedido, item.fatorCompra);
    s = { ...s, necessidadeBase: faltaPedido, quantidade: q, valor: arred2(q * item.precoCompra), motivo: q > 0 ? s.motivo || 'COBERTURA' : null };
  }
  const urgencia: UrgenciaCompra | null = s.quantidade <= 0 ? null
    : faltaPedido > 0 ? 'FALTA_PEDIDO'
      : livre <= 0 ? 'SEM_ESTOQUE'
        : s.coberturaAtual !== null && s.coberturaAtual < seguranca ? 'ACABANDO' : 'REPOR';
  return {
    ...s, saldo: item.saldo, saldoLivre: livre, reservado: ctx.reservado, faltaPedido, classe: ctx.classe, seguranca,
    urgencia, substitui: ctx.substitui, naoRecomprar: ctx.naoRecomprar, demandaExtra: ctx.demandaExtra,
  };
};

const PONTOS_URGENCIA: Record<UrgenciaCompra, number> = { FALTA_PEDIDO: 10, SEM_ESTOQUE: 6, ACABANDO: 3, REPOR: 1 };
const pesoClasse = (c: ClasseCurva | null) => (c === 'A' ? 3 : c === 'B' ? 2 : 1);

/**
 * Qual fornecedor pedir primeiro: soma de urgência (falta p/ pedido 10, sem estoque 6, acabando 3, repor 1) × peso da
 * classe (A 3, B 2, C 1) dos itens a repor, com o motivo resumido.
 */
export const prioridadeDoFornecedor = (itens: Array<{ urgencia: UrgenciaCompra | null; classe: ClasseCurva | null }>) => {
  const repor = itens.filter(i => i.urgencia) as Array<{ urgencia: UrgenciaCompra; classe: ClasseCurva | null }>;
  const conta = (u: UrgenciaCompra) => repor.filter(i => i.urgencia === u).length;
  const aUrgentes = repor.filter(i => i.classe === 'A' && i.urgencia !== 'REPOR').length;
  const motivo = [
    conta('FALTA_PEDIDO') && `${conta('FALTA_PEDIDO')} falta para pedido faturado`,
    aUrgentes && `${aUrgentes} item(ns) A sem estoque ou acabando`,
    conta('SEM_ESTOQUE') && `${conta('SEM_ESTOQUE')} sem estoque`,
    conta('ACABANDO') && `${conta('ACABANDO')} acabando`,
  ].filter(Boolean).join(' · ') || (repor.length ? 'reposição normal' : '');
  return { pontos: repor.reduce((a, i) => a + PONTOS_URGENCIA[i.urgencia] * pesoClasse(i.classe), 0), motivo, urgentes: repor.filter(i => i.urgencia !== 'REPOR').length };
};

/** Item "não recomprar" com vendas passa as vendas para o equivalente (substituto: idItem não recomprar → idItem que recebe). */
export const transferirDemanda = (
  itens: Array<{ idItem: number; sku: string; vendido: number; naoRecomprar: boolean }>, substituto: Map<number, number>,
) => {
  const extra = new Map<number, { quantidade: number; de: string[] }>();
  for (const i of itens) {
    const para = substituto.get(i.idItem);
    if (!i.naoRecomprar || !para || i.vendido <= 0) continue;
    const x = extra.get(para) || { quantidade: 0, de: [] };
    x.quantidade = arred4(x.quantidade + i.vendido); x.de.push(i.sku);
    extra.set(para, x);
  }
  return extra;
};

/** Quanto da compra cada fundo de reposição cobre (valor dos itens do fundo × saldo do fundo). */
export const coberturaDosFundos = (linhas: Array<{ fundo: { id: number; nome: string } | null; valor: number }>, saldos: Map<number, number>) => {
  const acc = new Map<number, { id: number; nome: string; valor: number }>();
  for (const l of linhas) {
    if (!l.fundo || !(l.valor > 0)) continue;
    const x = acc.get(l.fundo.id) || { id: l.fundo.id, nome: l.fundo.nome, valor: 0 };
    x.valor = arred2(x.valor + l.valor);
    acc.set(l.fundo.id, x);
  }
  return [...acc.values()].map(x => {
    const saldo = arred2(Math.max(0, saldos.get(x.id) || 0));
    return { ...x, saldo, cobre: arred2(Math.min(saldo, x.valor)), falta: arred2(Math.max(0, x.valor - saldo)) };
  });
};
