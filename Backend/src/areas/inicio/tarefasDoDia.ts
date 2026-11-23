// Central do dia (página inicial): o que fazer hoje, calculado dos dados de cada área. Cada fonte vira tarefas com uma
// chave estável (para adiar), um nível (atrasado, hoje, esta semana, sugestão) e o atalho para a tela que resolve.
// Regras puras, sem banco, com teste. As consultas ficam em inicio.controller.ts.

export type Nivel = 'URGENTE' | 'HOJE' | 'SEMANA' | 'SUGESTAO';
export type AreaTarefa = 'COMPRAS' | 'ESTOQUE' | 'PRECOS' | 'VENDAS' | 'FINANCEIRO' | 'CAIXA' | 'MANUAL';

export interface Tarefa {
  /** Estável enquanto a pendência existir (ex.: "NF:123"), para adiar e para a tela não piscar. */
  chave: string;
  area: AreaTarefa;
  nivel: Nivel;
  titulo: string;
  detalhe: string | null;
  /** Tela que resolve (com o filtro já aplicado, quando dá). */
  rota: string;
  acao: string;
  quantidade?: number;
  valor?: number;
  /** Até 3 exemplos (itens, clientes...) para saber do que se trata sem abrir. */
  exemplos?: string[];
  /** Lembrete do operador (área MANUAL): id, data, prioridade e responsável. */
  idTarefa?: number; vencimento?: string | null; prioridade?: Prioridade; responsavel?: string | null; descricao?: string | null;
}

const ORDEM_NIVEL: Record<Nivel, number> = { URGENTE: 0, HOJE: 1, SEMANA: 2, SUGESTAO: 3 };
const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const brl = (v: number) => `R$ ${r2(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataBr = (iso: string) => iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/');

/** Dias entre duas datas ISO (AAAA-MM-DD); positivo = `ate` depois de `de`. */
export const diasEntre = (de: string, ate: string) =>
  Math.round((Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10)) - Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))) / 86400000);

const haQuanto = (desde: string, hoje: string) => {
  const d = diasEntre(desde, hoje);
  return d <= 0 ? 'de hoje' : d === 1 ? 'desde ontem' : `há ${d} dias`;
};

/** Atrasado, de hoje ou desta semana (7 dias) pela data; depois disso não entra. */
export const nivelDoPrazo = (data: string, hoje: string): Nivel | null => {
  const d = diasEntre(hoje, data);
  return d < 0 ? 'URGENTE' : d === 0 ? 'HOJE' : d <= 7 ? 'SEMANA' : null;
};

/** Mais urgente primeiro; no mesmo nível, a área na ordem do dia da loja e depois o maior valor. */
export const ordenarTarefas = (lista: Tarefa[]) => {
  const ordemArea: AreaTarefa[] = ['MANUAL', 'CAIXA', 'VENDAS', 'COMPRAS', 'ESTOQUE', 'FINANCEIRO', 'PRECOS'];
  return [...lista].sort((a, b) => ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel] || ordemArea.indexOf(a.area) - ordemArea.indexOf(b.area)
    || (b.valor || 0) - (a.valor || 0) || a.titulo.localeCompare(b.titulo));
};

// ---------------------------------------------------------------- fontes
export interface NotaEmAberto { id: number; numero: string | null; fornecedor: string | null; criadaEm: string; valor: number }
/** Entrada de NF começada e não concluída (staging em rascunho): de hoje é "hoje", mais antiga é atrasada. */
export const tarefasNotas = (notas: NotaEmAberto[], hoje: string): Tarefa[] => notas.map(n => ({
  chave: `NF:${n.id}`, area: 'COMPRAS', nivel: diasEntre(n.criadaEm, hoje) >= 1 ? 'URGENTE' : 'HOJE',
  titulo: `Terminar a entrada da NF ${n.numero || `(lote ${n.id})`}${n.fornecedor ? ` · ${n.fornecedor}` : ''}`,
  detalhe: `Começada ${haQuanto(n.criadaEm, hoje)}${n.valor ? ` · ${brl(n.valor)}` : ''}. O estoque só entra quando a nota for aprovada.`,
  rota: `/compras/entrada-nfe?lote=${n.id}`, acao: 'Continuar', valor: r2(n.valor),
}));

export interface ListaInventarioAberta { id: number; area: string | null; itens: number; criadaEm: string }
/** Listas do inventário rotativo geradas e não lançadas; e, em dia de loja aberta, gerar a de hoje se ainda não gerou. */
export const tarefasInventario = (listas: ListaInventarioAberta[], geradaHoje: boolean, diaDeLoja: boolean, hoje: string): Tarefa[] => {
  const t: Tarefa[] = listas.map(l => ({
    chave: `INVENTARIO:${l.id}`, area: 'ESTOQUE', nivel: diasEntre(l.criadaEm, hoje) >= 1 ? 'URGENTE' : 'HOJE',
    titulo: `Contar e lançar a lista ${l.id} do inventário${l.area ? ` · ${l.area}` : ''}`,
    detalhe: `${plural(l.itens, 'item', 'itens')} · gerada ${haQuanto(l.criadaEm, hoje)}. Conte, assine a folha e lance a contagem.`,
    rota: '/estoque/inventario', acao: 'Abrir', quantidade: l.itens,
  }));
  if (diaDeLoja && !geradaHoje) {
    t.push({ chave: `INVENTARIO_HOJE:${hoje}`, area: 'ESTOQUE', nivel: 'HOJE', titulo: 'Gerar a lista de inventário de hoje',
      detalhe: 'O sistema escolhe os itens do dia (curva A, problemas e os que faz tempo que ninguém conta).', rota: '/estoque/inventario', acao: 'Gerar' });
  }
  return t;
};

export interface CaixaAberto { id: number; operador: string | null; abertoEm: string }
export const tarefasCaixa = (caixas: CaixaAberto[], hoje: string): Tarefa[] => caixas
  .filter(c => diasEntre(c.abertoEm, hoje) >= 1)
  .map(c => ({
    chave: `CAIXA:${c.id}`, area: 'CAIXA', nivel: 'URGENTE', titulo: `Fechar o caixa aberto em ${dataBr(c.abertoEm)}${c.operador ? ` (${c.operador})` : ''}`,
    detalhe: 'Caixa de outro dia ainda aberto: confira o dinheiro e feche antes de abrir o de hoje.', rota: '/vendas/caixas', acao: 'Fechar',
  }));

export interface Titulos { quantidade: number; valor: number; exemplos: string[] }
/** Contas a pagar: vencidas (atrasado), de hoje e dos próximos 7 dias. */
export const tarefasPagar = (vencidas: Titulos, deHoje: Titulos, semana: Titulos): Tarefa[] => {
  const t: Tarefa[] = [];
  const add = (q: Titulos, nivel: Nivel, chave: string, titulo: string) => {
    if (q.quantidade > 0) t.push({ chave, area: 'FINANCEIRO', nivel, titulo, detalhe: brl(q.valor), rota: '/financeiro/pagar', acao: 'Pagar', quantidade: q.quantidade, valor: r2(q.valor), exemplos: q.exemplos.slice(0, 3) });
  };
  add(vencidas, 'URGENTE', 'PAGAR_VENCIDAS', `Pagar ${plural(vencidas.quantidade, 'conta vencida', 'contas vencidas')}`);
  add(deHoje, 'HOJE', 'PAGAR_HOJE', `Pagar ${plural(deHoje.quantidade, 'conta que vence hoje', 'contas que vencem hoje')}`);
  add(semana, 'SEMANA', 'PAGAR_SEMANA', `${plural(semana.quantidade, 'conta vence', 'contas vencem')} nos próximos 7 dias`);
  return t;
};

/** Contas a receber vencidas: cobrar. */
export const tarefasReceber = (vencidas: Titulos): Tarefa[] => (vencidas.quantidade > 0 ? [{
  chave: 'RECEBER_VENCIDAS', area: 'FINANCEIRO', nivel: 'HOJE', titulo: `Cobrar ${plural(vencidas.quantidade, 'parcela vencida', 'parcelas vencidas')}`,
  detalhe: `${brl(vencidas.valor)} a receber em atraso.`, rota: '/financeiro', acao: 'Cobrar', quantidade: vencidas.quantidade, valor: r2(vencidas.valor),
  exemplos: vencidas.exemplos.slice(0, 3),
}] : []);

export interface PedidoAEntregar { id: number; cliente: string; previsao: string | null; boletosFaltando: number; total: number }
/** Pedidos faturados: entrega atrasada ou de hoje; boleto que falta colar na parcela. */
export const tarefasPedidos = (pedidos: PedidoAEntregar[], hoje: string): Tarefa[] => {
  const t: Tarefa[] = [];
  for (const p of pedidos) {
    const nivel = p.previsao ? nivelDoPrazo(p.previsao, hoje) : null;
    if (nivel === 'URGENTE' || nivel === 'HOJE') {
      t.push({ chave: `PEDIDO_ENTREGA:${p.id}`, area: 'VENDAS', nivel, titulo: `Entregar o pedido ${p.id} · ${p.cliente}`,
        detalhe: nivel === 'URGENTE' ? `Atrasado: a previsão era ${dataBr(p.previsao!)}. Imprima o romaneio e combine a entrega.` : 'Entrega prevista para hoje: imprima o romaneio.',
        rota: `/vendas/pedidos-faturados?id=${p.id}`, acao: 'Abrir', valor: r2(p.total) });
    }
    if (p.boletosFaltando > 0) {
      t.push({ chave: `PEDIDO_BOLETO:${p.id}`, area: 'VENDAS', nivel: 'HOJE', titulo: `Colar ${plural(p.boletosFaltando, 'boleto', 'boletos')} do pedido ${p.id} · ${p.cliente}`,
        detalhe: 'Gere o boleto no banco e cole a linha digitável na parcela (o cliente recebe junto com a nota).', rota: `/vendas/pedidos-faturados?id=${p.id}`, acao: 'Abrir' });
    }
  }
  return t;
};

export interface Orcamento { id: number; cliente: string; validade: string | null; total: number; status: 'ORCAMENTO' | 'SUSPENSA'; criadoEm: string }
/** Orçamento que vence em até 2 dias (retornar ao cliente) e venda suspensa de outro dia (finalizar ou cancelar). */
export const tarefasOrcamentos = (lista: Orcamento[], hoje: string): Tarefa[] => {
  const t: Tarefa[] = [];
  for (const o of lista) {
    if (o.status === 'ORCAMENTO' && o.validade) {
      const d = diasEntre(hoje, o.validade);
      if (d >= 0 && d <= 2) {
        t.push({ chave: `ORCAMENTO:${o.id}`, area: 'VENDAS', nivel: d === 0 ? 'HOJE' : 'SEMANA', titulo: `Retornar ao cliente: orçamento ${o.id} · ${o.cliente}`,
          detalhe: `${brl(o.total)} · vence ${d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${dataBr(o.validade)}`}. Ligue para fechar ou renove a validade.`,
          rota: '/vendas/orcamentos', acao: 'Abrir', valor: r2(o.total) });
      }
    }
    if (o.status === 'SUSPENSA' && diasEntre(o.criadoEm, hoje) >= 1) {
      t.push({ chave: `SUSPENSA:${o.id}`, area: 'VENDAS', nivel: 'HOJE', titulo: `Venda suspensa ${haQuanto(o.criadoEm, hoje)} · ${o.cliente}`,
        detalhe: `${brl(o.total)} parado no PDV: retome e finalize, ou cancele.`, rota: '/vendas/pdv', acao: 'Retomar', valor: r2(o.total) });
    }
  }
  return t;
};

export interface PedidoCompraRascunho { id: number; fornecedor: string; criadoEm: string; total: number }
export const tarefasPedidosCompra = (lista: PedidoCompraRascunho[], hoje: string): Tarefa[] => lista
  .filter(p => diasEntre(p.criadoEm, hoje) >= 1)
  .map(p => ({ chave: `COMPRA:${p.id}`, area: 'COMPRAS', nivel: 'HOJE', titulo: `Enviar o pedido de compra ${p.id} · ${p.fornecedor}`,
    detalhe: `Montado ${haQuanto(p.criadoEm, hoje)} e ainda não enviado${p.total ? ` · ${brl(p.total)}` : ''}.`, rota: '/compras/inteligente', acao: 'Abrir', valor: r2(p.total) }));

export interface ResumoPrecos { SEM_PRECO?: number; MARGEM_NEGATIVA?: number; CUSTO_DEFASADO?: number; MARGEM_BAIXA?: number }
export const tarefasPrecos = (r: ResumoPrecos): Tarefa[] => {
  const t: Tarefa[] = [];
  const add = (n: number | undefined, nivel: Nivel, chave: string, titulo: string, detalhe: string) => {
    if (n && n > 0) t.push({ chave, area: 'PRECOS', nivel, titulo, detalhe, rota: '/catalogo/preco', acao: 'Ajustar', quantidade: n });
  };
  add(r.MARGEM_NEGATIVA, 'URGENTE', 'PRECO_PREJUIZO', `${plural(r.MARGEM_NEGATIVA || 0, 'item vendendo', 'itens vendendo')} com prejuízo`, 'O preço está abaixo do custo: corrija antes da próxima venda.');
  add(r.SEM_PRECO, 'HOJE', 'PRECO_SEM', `Pôr preço em ${plural(r.SEM_PRECO || 0, 'item', 'itens')}`, 'Item de venda sem preço não aparece direito no PDV.');
  add(r.CUSTO_DEFASADO, 'SEMANA', 'PRECO_CUSTO', `Revisar o preço de ${plural(r.CUSTO_DEFASADO || 0, 'item', 'itens')} com custo novo`, 'O custo de entrada mudou desde a última precificação.');
  add(r.MARGEM_BAIXA, 'SEMANA', 'PRECO_MARGEM', `${plural(r.MARGEM_BAIXA || 0, 'item', 'itens')} com margem baixa`, 'Abaixo da margem mínima: veja se dá para subir o preço.');
  return t;
};

export interface ItemDaCurva {
  nome: string; venda: string | null; situacao: string; estoque: number; valorEstoque: number; lucro: number; margem: number | null;
  lucroClasse: string | null; decisaoCompra: string | null;
}
/**
 * Da curva ABC: curva A zerada (repor já), vende muito e lucra pouco (revisar preço) e, como sugestão para girar o
 * estoque, promoção dos parados com mais dinheiro empatado e escoar o que foi marcado para não recomprar.
 */
export const tarefasCurva = (itens: ItemDaCurva[], quantosNaPromocao = 10): Tarefa[] => {
  const t: Tarefa[] = [];
  const zerados = itens.filter(i => i.situacao === 'NORMAL' && i.venda === 'A' && i.estoque <= 0);
  if (zerados.length) t.push({ chave: 'CURVA_A_ZERADA', area: 'COMPRAS', nivel: 'URGENTE', titulo: `Repor ${plural(zerados.length, 'item', 'itens')} da curva A sem estoque`,
    detalhe: 'Os que mais vendem estão zerados: cada dia sem eles é venda perdida.', rota: '/compras/inteligente', acao: 'Comprar', quantidade: zerados.length,
    exemplos: zerados.slice(0, 3).map(i => i.nome) });
  const lucraPouco = itens.filter(i => i.situacao === 'NORMAL' && i.venda === 'A' && (i.lucroClasse === 'C' || (i.margem !== null && i.margem < 0.15)));
  if (lucraPouco.length) t.push({ chave: 'CURVA_LUCRA_POUCO', area: 'PRECOS', nivel: 'SEMANA', titulo: `Revisar o preço de ${plural(lucraPouco.length, 'item', 'itens')} que vende muito e lucra pouco`,
    detalhe: 'Curva A de venda com margem baixa: um ajuste pequeno no preço pesa muito no lucro do mês.', rota: '/estoque/curva-abc', acao: 'Ver', quantidade: lucraPouco.length,
    exemplos: lucraPouco.slice(0, 3).map(i => i.nome) });
  const parados = itens.filter(i => i.situacao === 'PARADO' && i.valorEstoque > 0).sort((a, b) => b.valorEstoque - a.valorEstoque).slice(0, quantosNaPromocao);
  if (parados.length) {
    const valor = parados.reduce((s, i) => s + i.valorEstoque, 0);
    t.push({ chave: 'CURVA_PROMOCAO', area: 'ESTOQUE', nivel: 'SUGESTAO', titulo: `Promoção para girar: ${plural(parados.length, 'item parado', 'itens parados')} com mais dinheiro empatado`,
      detalhe: `${brl(valor)} em estoque sem venda no período. Monte uma oferta (WhatsApp, balcão) ou um kit com itens que vendem.`,
      rota: '/estoque/onde-focar', acao: 'Montar promoção', quantidade: parados.length, valor: r2(valor), exemplos: parados.slice(0, 3).map(i => i.nome) });
  }
  const escoar = itens.filter(i => i.decisaoCompra === 'NAO_RECOMPRAR' && i.estoque > 0);
  if (escoar.length) t.push({ chave: 'CURVA_ESCOAR', area: 'ESTOQUE', nivel: 'SUGESTAO', titulo: `Escoar ${plural(escoar.length, 'item marcado', 'itens marcados')} para não recomprar`,
    detalhe: 'Ainda têm estoque: ofereça no balcão (o PDV já sugere como equivalente) ou faça um preço para sair.', rota: '/estoque/equivalentes', acao: 'Ver',
    quantidade: escoar.length, valor: r2(escoar.reduce((s, i) => s + i.valorEstoque, 0)), exemplos: escoar.slice(0, 3).map(i => i.nome) });
  return t;
};

export const tarefasEstoqueNegativo = (quantidade: number): Tarefa[] => (quantidade > 0 ? [{
  chave: 'ESTOQUE_NEGATIVO', area: 'ESTOQUE', nivel: 'URGENTE', titulo: `Acertar ${plural(quantidade, 'item', 'itens')} com estoque negativo`,
  detalhe: 'Venda sem saldo ou entrada que faltou: confira e acerte (nota pendente, contagem).', rota: '/estoque/consulta', acao: 'Ver', quantidade,
}] : []);

/** Tira as adiadas até depois de hoje; devolve as visíveis e quantas ficaram escondidas. */
export const semAdiadas = (lista: Tarefa[], adiadas: Map<string, string>, hoje: string) => {
  const visiveis = lista.filter(t => { const ate = adiadas.get(t.chave); return !ate || ate <= hoje; });
  return { visiveis, adiadas: lista.length - visiveis.length };
};

// ---------------------------------------------------------------- lembretes do operador e adiar
export type Prioridade = 'ALTA' | 'NORMAL' | 'BAIXA';
export class ErroTarefa extends Error { constructor(message: string, public status = 400) { super(message); } }

const dataValida = (v: unknown) => {
  const t = String(v ?? '').trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(`${t}T12:00:00Z`))) throw new ErroTarefa('Data inválida.');
  return t;
};

/** Lembrete digitado: título obrigatório; data, prioridade e responsável opcionais (tamanhos das colunas). */
export const validarLembrete = (b: any) => {
  const titulo = String(b?.titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, 150);
  if (titulo.length < 3) throw new ErroTarefa('Escreva o que precisa ser feito (ao menos 3 letras).');
  const prioridade = String(b?.prioridade || 'NORMAL').toUpperCase() as Prioridade;
  if (!['ALTA', 'NORMAL', 'BAIXA'].includes(prioridade)) throw new ErroTarefa('Prioridade inválida.');
  return {
    titulo, prioridade, vencimento: dataValida(b?.vencimento),
    descricao: String(b?.descricao ?? '').trim().slice(0, 500) || null,
    responsavel: String(b?.responsavel ?? '').trim().slice(0, 60) || null,
  };
};

/**
 * Nível do lembrete: vencido = atrasado; de hoje (ou alta sem data) = hoje; até 7 dias ou sem data = esta semana;
 * mais longe fica agendado (fora da lista até chegar perto).
 */
export const nivelDoLembrete = (vencimento: string | null, prioridade: Prioridade, hoje: string): Nivel | null => {
  if (!vencimento) return prioridade === 'ALTA' ? 'HOJE' : 'SEMANA';
  return nivelDoPrazo(vencimento, hoje);
};

export interface Lembrete { id: number; titulo: string; descricao: string | null; vencimento: string | null; prioridade: Prioridade; responsavel: string | null }
export const tarefasLembretes = (lista: Lembrete[], hoje: string) => {
  const visiveis: Tarefa[] = [];
  const agendados: Lembrete[] = [];
  for (const l of lista) {
    const nivel = nivelDoLembrete(l.vencimento, l.prioridade, hoje);
    if (!nivel) { agendados.push(l); continue; }
    visiveis.push({
      chave: `LEMBRETE:${l.id}`, area: 'MANUAL', nivel, titulo: l.titulo,
      detalhe: [l.descricao, l.vencimento ? (l.vencimento < hoje ? `Venceu em ${dataBr(l.vencimento)}` : l.vencimento === hoje ? 'Para hoje' : `Até ${dataBr(l.vencimento)}`) : null]
        .filter(Boolean).join(' · ') || null,
      rota: '', acao: 'Feito', idTarefa: l.id, vencimento: l.vencimento, prioridade: l.prioridade, responsavel: l.responsavel, descricao: l.descricao,
    });
  }
  // Alta primeiro dentro do mesmo nível (a ordem geral põe MANUAL antes das outras áreas)
  visiveis.sort((a, b) => ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel] || (a.prioridade === 'ALTA' ? 0 : 1) - (b.prioridade === 'ALTA' ? 0 : 1));
  return { visiveis, agendados };
};

/** Adiar: amanhã, daqui a 7 dias (próxima semana) ou uma data escolhida (depois de hoje). */
export const dataDoAdiamento = (opcao: unknown, hoje: string) => {
  const mais = (dias: number) => new Date(Date.parse(`${hoje}T12:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);
  if (opcao === 'AMANHA') return mais(1);
  if (opcao === 'SEMANA') return mais(7);
  const d = dataValida(opcao);
  if (!d || d <= hoje) throw new ErroTarefa('Escolha uma data depois de hoje.');
  return d;
};
