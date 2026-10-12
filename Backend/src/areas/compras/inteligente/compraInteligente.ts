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
