// Kits (itens_composicoes, tipo_relacao 'KIT'): o kit é um item de venda comum do catálogo, sem estoque próprio.
// Na venda a baixa sai dos componentes; o custo e o estoque possível do kit vêm deles.
// Regras puras (sem banco), testadas em kits.test.ts.

export const TIPO_KIT = 'KIT';

export class ErroKit extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface ComponenteKit {
  idItem: number;
  quantidade: number; // na unidade base do componente, por 1 kit
  idComposicao?: number;
  permiteTrocar?: boolean;     // na venda pode virar outra variação da mesma família
  permiteAlterarQtd?: boolean; // na venda pode mudar a quantidade (ex.: metros de fio)
}

/** Dados do componente usados nas contas (saldo e custo na unidade base). */
export interface DadosComponente {
  idItem: number;
  saldo: number;
  custo: number;
  servico?: boolean;
  podeVenderSemEstoque?: boolean;
}

const arred4 = (v: number) => Math.round((Number(v) || 0) * 10000) / 10000;
const arred2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Confere e normaliza a lista de componentes: quantidade > 0, sem o próprio kit, sem kit dentro de kit
 * e o mesmo item repetido vira uma linha só (quantidades somadas).
 */
export const normalizarComponentes = (
  entrada: Array<{ idItem: unknown; quantidade: unknown; permiteTrocar?: unknown; permiteAlterarQtd?: unknown }>,
  idKit: number | null,
  ehKit: (idItem: number) => boolean = () => false
): ComponenteKit[] => {
  if (!Array.isArray(entrada) || entrada.length === 0) throw new ErroKit('Coloque pelo menos um item no kit.');
  const porItem = new Map<number, { quantidade: number; permiteTrocar: boolean; permiteAlterarQtd: boolean }>();
  for (const c of entrada) {
    const idItem = Number(c?.idItem);
    const quantidade = Number(c?.quantidade);
    if (!Number.isInteger(idItem) || idItem <= 0) throw new ErroKit('Item inválido na composição do kit.');
    if (!Number.isFinite(quantidade) || quantidade <= 0) throw new ErroKit('A quantidade de cada item do kit precisa ser maior que zero.');
    if (idKit && idItem === idKit) throw new ErroKit('O kit não pode conter ele mesmo.');
    if (ehKit(idItem)) throw new ErroKit('Kit dentro de kit não é permitido: coloque os itens do outro kit direto.');
    const atual = porItem.get(idItem);
    porItem.set(idItem, {
      quantidade: arred4((atual?.quantidade || 0) + quantidade),
      permiteTrocar: Boolean(atual?.permiteTrocar || c?.permiteTrocar),
      permiteAlterarQtd: Boolean(atual?.permiteAlterarQtd || c?.permiteAlterarQtd),
    });
  }
  return [...porItem.entries()].map(([idItem, v]) => ({ idItem, ...v }));
};

/** Custo do kit: soma do custo de cada componente × quantidade (arredondado por linha). */
export const custoDoKit = (componentes: ComponenteKit[], dados: Map<number, DadosComponente>): number =>
  arred4(componentes.reduce((total, c) => total + arred4((dados.get(c.idItem)?.custo || 0) * c.quantidade), 0));

/**
 * Quantos kits dá para montar com o estoque atual (o componente mais escasso manda).
 * Serviço e item que pode vender sem estoque não limitam. Sem nenhum limite: null (ilimitado).
 */
export const estoqueDoKit = (componentes: ComponenteKit[], dados: Map<number, DadosComponente>): number | null => {
  let menor: number | null = null;
  for (const c of componentes) {
    const d = dados.get(c.idItem);
    if (d?.servico || d?.podeVenderSemEstoque) continue;
    const possivel = Math.max(0, Math.floor(arred4((d?.saldo || 0) / c.quantidade)));
    menor = menor === null ? possivel : Math.min(menor, possivel);
  }
  return menor;
};

/** Componente que limita a montagem (o primeiro com menos kits possíveis). */
export const componenteLimitante = (componentes: ComponenteKit[], dados: Map<number, DadosComponente>): number | null => {
  let melhor: { idItem: number; possivel: number } | null = null;
  for (const c of componentes) {
    const d = dados.get(c.idItem);
    if (d?.servico || d?.podeVenderSemEstoque) continue;
    const possivel = Math.max(0, Math.floor(arred4((d?.saldo || 0) / c.quantidade)));
    if (!melhor || possivel < melhor.possivel) melhor = { idItem: c.idItem, possivel };
  }
  return melhor?.idItem ?? null;
};

/** Saída de cada componente para uma quantidade de kits (unidade base do componente). */
export const saidaDosComponentes = (componentes: ComponenteKit[], quantidadeKits: number) =>
  componentes.map(c => ({ idItem: c.idItem, quantidade: arred4(c.quantidade * quantidadeKits) }));

/**
 * Devolução parcial de uma linha de kit: o que volta de cada componente é proporcional ao que saiu na venda.
 * movimentos = saídas dos componentes registradas na venda dessa linha.
 */
export const voltaDaDevolucao = (
  movimentos: Array<{ idItem: number; quantidade: number; custo: number }>,
  quantidadeVendida: number,
  quantidadeDevolvida: number
) => {
  if (!(quantidadeVendida > 0)) return [];
  const proporcao = Math.min(1, Math.max(0, quantidadeDevolvida / quantidadeVendida));
  return movimentos
    .map(m => ({ idItem: m.idItem, quantidade: arred4(m.quantidade * proporcao), custo: m.custo }))
    .filter(m => m.quantidade > 0);
};

/** Margem e lucro do kit pelo preço (bruto, sem taxa: a tela aplica a taxa da maquininha). */
export const margemDoKit = (preco: number, custo: number) => ({
  lucro: arred2(preco - custo),
  margemPct: preco > 0 ? arred2(((preco - custo) / preco) * 100) : 0,
});

/**
 * Cobertura do componente: em quantos dias o saldo acaba no ritmo das vendas de kits do período.
 * Sem consumo: null (não acaba).
 */
export const diasDeCobertura = (saldo: number, consumoNoPeriodo: number, diasDoPeriodo: number): number | null => {
  if (!(consumoNoPeriodo > 0) || !(diasDoPeriodo > 0)) return null;
  return Math.max(0, Math.floor(saldo / (consumoNoPeriodo / diasDoPeriodo)));
};

/** SKU sugerido para kit novo (o operador pode trocar). */
export const skuSugeridoKit = (idItem: number) => `KIT-${String(idItem).padStart(4, '0')}`;

// ---------------------------------------------------------------- kit configurável (escolhas do cliente na venda)

/** Escolha enviada pelo PDV para uma posição do kit (slot = id_composicao). */
export interface EscolhaKit {
  slot: number;
  idItem: number;
  quantidade: number;
}

/** O que a regra precisa saber de cada item (padrão e escolhido). */
export interface ItemDaEscolha {
  idItem: number;
  sku: string;
  nome: string;
  familiaId: number | null;
  ativo: boolean;
  ehKit: boolean;
  preco: number; // preço de venda por 1 unidade base (varejo)
}

export interface PosicaoResolvida {
  idComposicao: number | null;
  idItem: number;
  quantidade: number;
  idItemPadrao: number;
  quantidadePadrao: number;
  ajuste: number; // diferença de preço por 1 kit nesta posição
}

export interface KitResolvido {
  componentes: ComponenteKit[];
  posicoes: PosicaoResolvida[];
  ajuste: number;      // soma das diferenças por 1 kit
  alterado: boolean;   // alguma posição diferente do padrão
  assinatura: string;  // identifica a configuração (mesma configuração = mesma linha)
  resumo: string;      // ex.: "BOMBA-2CV; FIO-4MM x80"
}

const numeroBr = (v: number) => String(arred4(v)).replace('.', ',');

/** Assinatura da configuração (ordem fixa): a mesma no PDV, na venda e no orçamento. */
export const assinaturaKit = (posicoes: Array<{ idComposicao: number | null; idItem: number; quantidade: number }>) =>
  posicoes.map(p => `${p.idComposicao ?? 0}:${p.idItem}:${arred4(p.quantidade)}`).sort().join('|');

/**
 * Confere as escolhas do cliente contra a composição e calcula a diferença de preço.
 * Posição sem escolha fica no padrão. Trocar só para item ativo da mesma família do padrão (se a posição permitir);
 * a quantidade só muda se a posição permitir. A diferença é por 1 kit, arredondada por posição.
 */
export const resolverEscolhasKit = (
  composicao: ComponenteKit[],
  escolhas: EscolhaKit[] | undefined | null,
  itens: Map<number, ItemDaEscolha>,
  nomeKit = 'kit'
): KitResolvido => {
  const lista = Array.isArray(escolhas) ? escolhas : [];
  for (const e of lista) {
    if (!composicao.some(c => c.idComposicao === Number(e?.slot))) {
      throw new ErroKit(`O ${nomeKit} mudou: uma escolha aponta para um item que não está mais nele. Tire o kit do carrinho e coloque de novo.`, 409);
    }
  }
  const posicoes: PosicaoResolvida[] = composicao.map(c => {
    const e = lista.find(x => Number(x.slot) === c.idComposicao);
    const padrao = itens.get(c.idItem);
    const nomePadrao = padrao?.nome || `item ${c.idItem}`;
    let idItem = c.idItem;
    let quantidade = c.quantidade;
    if (e) {
      const idEscolhido = Number(e.idItem);
      if (idEscolhido !== c.idItem) {
        if (!c.permiteTrocar) throw new ErroKit(`"${nomePadrao}" é fixo no ${nomeKit}: não pode ser trocado.`);
        const escolhido = itens.get(idEscolhido);
        if (!escolhido) throw new ErroKit(`Item ${idEscolhido} não encontrado para o ${nomeKit}.`, 404);
        if (!padrao?.familiaId || escolhido.familiaId !== padrao.familiaId) throw new ErroKit(`"${escolhido.nome}" não é da mesma família de "${nomePadrao}".`);
        if (!escolhido.ativo) throw new ErroKit(`"${escolhido.nome}" está inativo.`);
        if (escolhido.ehKit) throw new ErroKit(`"${escolhido.nome}" é um kit e não pode entrar em outro kit.`);
        idItem = idEscolhido;
      }
      const q = Number(e.quantidade);
      if (Number.isFinite(q) && Math.abs(q - c.quantidade) > 1e-9) {
        if (!c.permiteAlterarQtd) throw new ErroKit(`A quantidade de "${nomePadrao}" é fixa no ${nomeKit}.`);
        if (!(q > 0)) throw new ErroKit('A quantidade de cada item do kit precisa ser maior que zero.');
        quantidade = arred4(q);
      }
    }
    const igual = idItem === c.idItem && quantidade === c.quantidade;
    const ajuste = igual ? 0 : arred2((itens.get(idItem)?.preco || 0) * quantidade - (padrao?.preco || 0) * c.quantidade);
    return { idComposicao: c.idComposicao ?? null, idItem, quantidade, idItemPadrao: c.idItem, quantidadePadrao: c.quantidade, ajuste };
  });
  const alteradas = posicoes.filter(p => p.idItem !== p.idItemPadrao || p.quantidade !== p.quantidadePadrao);
  return {
    componentes: posicoes.map(p => ({ idItem: p.idItem, quantidade: p.quantidade })),
    posicoes,
    ajuste: arred2(posicoes.reduce((a, p) => a + p.ajuste, 0)),
    alterado: alteradas.length > 0,
    assinatura: assinaturaKit(posicoes),
    resumo: alteradas.map(p => {
      const sku = itens.get(p.idItem)?.sku || String(p.idItem);
      return p.quantidade !== p.quantidadePadrao ? `${sku} x${numeroBr(p.quantidade)}` : sku;
    }).join('; '),
  };
};

/** Nome gravado na venda/nota: o do kit + as trocas (cabe em 255). */
export const nomeComTrocas = (nome: string, k: KitResolvido | null | undefined) =>
  (k?.alterado && k.resumo ? `${nome} [${k.resumo}]` : nome).slice(0, 255);
