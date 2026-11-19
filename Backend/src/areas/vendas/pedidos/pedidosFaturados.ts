// Pedido faturado (venda para empresa, entrega depois): nasce de um orçamento, reserva o material, é faturado com a NF-e
// emitida fora (o ERP guarda número e chave) e as parcelas no contas a receber (boleto gerado no banco, linha digitável
// em cada parcela), e é entregue de uma vez (baixa do estoque). Regras puras, sem banco, com teste.
import { gerarParcelas, ParcelaPlanejada } from '../../financeiro/receber/receber';

export class ErroPedido extends Error {
  constructor(message: string, public status = 400, public detalhes?: unknown) { super(message); }
}

/** Status no banco (vendas_pedidos.status) para pedido faturado. Entregue + faturado = CONCLUIDA. */
export const STATUS_ABERTOS = ['PEDIDO', 'FATURADO'] as const;

export type Etapa = 'CONFIRMADO' | 'FATURADO' | 'ENTREGUE_SEM_NOTA' | 'CONCLUIDO' | 'CANCELADO';

/** Etapa do pedido para a tela: faturar e entregar podem vir em qualquer ordem. */
export const etapaDoPedido = (status: string, entregue: boolean): Etapa => {
  if (status === 'CANCELADA') return 'CANCELADO';
  if (status === 'CONCLUIDA') return 'CONCLUIDO';
  if (status === 'FATURADO') return entregue ? 'CONCLUIDO' : 'FATURADO';
  return entregue ? 'ENTREGUE_SEM_NOTA' : 'CONFIRMADO';
};

/** Status depois de faturar/entregar: os dois feitos = CONCLUIDA (aí conta como venda no painel). */
export const statusDoPedido = (faturado: boolean, entregue: boolean) => (faturado && entregue ? 'CONCLUIDA' : faturado ? 'FATURADO' : 'PEDIDO');

const so = (s: unknown) => String(s ?? '').replace(/\D/g, '');
const dataValida = (s: unknown) => {
  const t = String(s ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const d = new Date(`${t}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
};

export interface NotaExterna { numero: number; serie: number; chave: string | null; emitidaEm: string }

/**
 * NF-e emitida fora do ERP (emissor de vocês): número obrigatório; a chave (44 dígitos) é opcional, mas se vier precisa
 * ser de NF-e (modelo 55) e bater com o número e a série.
 */
export const validarNotaExterna = (n: any, hoje: string): NotaExterna => {
  const numero = Math.floor(Number(n?.numero));
  if (!(numero > 0 && numero <= 999999999)) throw new ErroPedido('Informe o número da NF-e.');
  const serie = n?.serie === undefined || n?.serie === null || n?.serie === '' ? 1 : Math.floor(Number(n.serie));
  if (!(serie >= 0 && serie <= 999)) throw new ErroPedido('Série da NF-e inválida (0 a 999).');
  const chave = so(n?.chave) || null;
  if (chave) {
    if (chave.length !== 44) throw new ErroPedido('A chave de acesso tem 44 dígitos.');
    if (chave.slice(20, 22) !== '55') throw new ErroPedido('A chave informada não é de NF-e (modelo 55).');
    if (Number(chave.slice(22, 25)) !== serie || Number(chave.slice(25, 34)) !== numero) {
      throw new ErroPedido(`A chave é da nota ${Number(chave.slice(25, 34))} série ${Number(chave.slice(22, 25))}, não da ${numero} série ${serie}.`);
    }
  }
  const emitidaEm = n?.emitidaEm ? String(n.emitidaEm).slice(0, 10) : hoje;
  if (!dataValida(emitidaEm)) throw new ErroPedido('Data de emissão da nota inválida.');
  if (emitidaEm > hoje) throw new ErroPedido('A data de emissão da nota não pode ser no futuro.');
  return { numero, serie, chave, emitidaEm };
};

/** Linha digitável do boleto (47 dígitos; 48 nos de arrecadação/convênio). Vazio = ainda não gerado. */
export const lerLinhaDigitavel = (s: unknown): string | null => {
  const d = so(s);
  if (!d) return null;
  if (d.length !== 47 && d.length !== 48) throw new ErroPedido('A linha digitável do boleto tem 47 dígitos (48 em boletos de convênio).');
  return d;
};

export const FORMAS_PARCELA = ['BOLETO', 'PIX', 'DEPOSITO', 'DINHEIRO', 'CHEQUE'] as const;

export interface ParcelaPedido { parcela: number; totalParcelas: number; vencimento: string; valor: number; forma: string; codigoBarras: string | null }

/**
 * Parcelas sugeridas pela condição da proposta: entrada (se houver) no dia do faturamento e o resto nas parcelas
 * combinadas a partir dele. Sem condição a prazo: uma parcela em 30 dias no boleto.
 */
export const parcelasSugeridas = (
  total: number, condicao: { forma: string; parcelas: number; intervaloDias: number | null; entrada: number } | null, faturamento: string,
): ParcelaPedido[] => {
  const base = new Date(`${faturamento}T12:00:00`);
  const entrada = condicao && condicao.entrada > 0 && condicao.entrada < total ? Math.round(condicao.entrada * 100) / 100 : 0;
  const prazo = condicao?.forma === 'PRAZO';
  const resto = Math.round((total - entrada) * 100) / 100;
  const planejadas: ParcelaPlanejada[] = prazo
    ? gerarParcelas(resto, condicao!.parcelas || 1, base, condicao!.intervaloDias || 30)
    : condicao && condicao.forma !== 'CREDITO'
      ? [{ parcela: 1, totalParcelas: 1, vencimento: faturamento, valor: resto }]   // à vista: vence no faturamento
      : gerarParcelas(resto, 1, base, 30);
  const formaResto = prazo || !condicao || condicao.forma === 'CREDITO' ? 'BOLETO' : condicao.forma === 'DINHEIRO' ? 'DINHEIRO' : 'PIX';
  const lista = [
    ...(entrada > 0 ? [{ vencimento: faturamento, valor: entrada, forma: 'PIX' }] : []),
    ...planejadas.map(p => ({ vencimento: p.vencimento as string, valor: p.valor, forma: formaResto })),
  ];
  return lista.map((p, i) => ({ ...p, parcela: i + 1, totalParcelas: lista.length, codigoBarras: null }));
};

/** Confere as parcelas que o operador ajustou: datas, valores, formas, boleto; a soma tem que fechar o total. */
export const validarParcelas = (parcelas: any[], total: number): ParcelaPedido[] => {
  if (!Array.isArray(parcelas) || parcelas.length === 0) throw new ErroPedido('Informe as parcelas do pedido.');
  if (parcelas.length > 36) throw new ErroPedido('No máximo 36 parcelas.');
  const lista = parcelas.map((p, i) => {
    const valor = Math.round(Number(p?.valor) * 100) / 100;
    if (!(valor > 0)) throw new ErroPedido(`Parcela ${i + 1}: valor inválido.`);
    if (!dataValida(p?.vencimento)) throw new ErroPedido(`Parcela ${i + 1}: vencimento inválido.`);
    const forma = String(p?.forma || 'BOLETO').toUpperCase();
    if (!(FORMAS_PARCELA as readonly string[]).includes(forma)) throw new ErroPedido(`Parcela ${i + 1}: forma inválida.`);
    let codigoBarras: string | null;
    try { codigoBarras = forma === 'BOLETO' ? lerLinhaDigitavel(p?.codigoBarras) : null; } catch (e: any) { throw new ErroPedido(`Parcela ${i + 1}: ${e.message}`); }
    return { vencimento: String(p.vencimento), valor, forma, codigoBarras };
  }).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const soma = Math.round(lista.reduce((a, p) => a + p.valor, 0) * 100) / 100;
  if (Math.abs(soma - Math.round(total * 100) / 100) > 0.009) {
    throw new ErroPedido(`As parcelas somam R$ ${soma.toFixed(2).replace('.', ',')} e o pedido é R$ ${total.toFixed(2).replace('.', ',')}.`);
  }
  return lista.map((p, i) => ({ ...p, parcela: i + 1, totalParcelas: lista.length }));
};

/** Saída de estoque na entrega: o item, ou cada componente do kit (quantidade por kit × kits). */
export const saidasDaEntrega = (
  linhas: Array<{ idItem: number; quantidadeBase: number; componentes: Array<{ idItem: number; quantidade: number }> }>,
) => {
  const mapa = new Map<number, number>();
  for (const l of linhas) {
    const partes = l.componentes.length ? l.componentes.map(c => ({ idItem: c.idItem, q: c.quantidade * l.quantidadeBase })) : [{ idItem: l.idItem, q: l.quantidadeBase }];
    for (const p of partes) mapa.set(p.idItem, Math.round(((mapa.get(p.idItem) || 0) + p.q) * 10000) / 10000);
  }
  return mapa;
};

/** Itens que faltam para entregar: saldo menos o reservado por outros pedidos (o próprio pedido não conta). */
export const faltasNaEntrega = (
  saidas: Map<number, number>, saldos: Map<number, number>, reservadoOutros: Map<number, number>, podeSemEstoque: Map<number, boolean>,
) => [...saidas.entries()]
  .map(([idItem, sai]) => ({ idItem, sai, disponivel: Math.round(((saldos.get(idItem) || 0) - (reservadoOutros.get(idItem) || 0)) * 10000) / 10000 }))
  .filter(f => f.sai > f.disponivel + 0.00001 && !podeSemEstoque.get(f.idItem));
