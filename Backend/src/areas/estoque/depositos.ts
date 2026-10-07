// Estoque por depósito: VENDA (o PDV só enxerga este), ALMOXARIFADO (uso e consumo interno), PATRIMONIO (ativos).
// Lançamento único de movimento: trava o saldo do item no depósito, grava o movimento e atualiza saldo e custo médio.
import { calcularCustoMedio, calcularCustoMedioEstorno } from '../compras/staging/penteFino';

export const DEPOSITOS = ['VENDA', 'ALMOXARIFADO', 'PATRIMONIO'] as const;
export type Deposito = typeof DEPOSITOS[number];

export const ROTULO_DEPOSITO: Record<Deposito, string> = {
  VENDA: 'Venda',
  ALMOXARIFADO: 'Almoxarifado',
  PATRIMONIO: 'Patrimônio',
};

export const ehDeposito = (v: unknown): v is Deposito => DEPOSITOS.includes(String(v || '').toUpperCase() as Deposito);
export const depositoOuPadrao = (v: unknown, padrao: Deposito = 'VENDA'): Deposito =>
  (ehDeposito(v) ? String(v).toUpperCase() as Deposito : padrao);

// Destino pelo CFOP de ENTRADA (1xxx/2xxx/3xxx): revenda -> VENDA, uso e consumo -> ALMOXARIFADO, ativo -> PATRIMONIO.
// O XML do fornecedor traz o CFOP de SAÍDA dele (5xxx/6xxx), que não diz o uso na empresa: esse não sugere nada.
export const depositoPorCfop = (cfop: unknown): Deposito | null => {
  const c = String(cfop || '').replace(/\D/g, '');
  if (c.length !== 4 || !['1', '2', '3'].includes(c[0])) return null;
  const final = c.slice(1);
  if (['556', '407', '653'].includes(final)) return 'ALMOXARIFADO';
  if (['551', '406', '552'].includes(final)) return 'PATRIMONIO';
  if (['102', '403', '101', '401', '652', '910'].includes(final)) return 'VENDA';
  return null;
};

// Destino padrão pelo tipo do item quando o CFOP não diz nada
export const depositoPorTipoRecurso = (tipo: unknown): Deposito => {
  const t = String(tipo || '').toUpperCase();
  if (t === 'CONSUMO' || t === 'INSUMO') return 'ALMOXARIFADO';
  if (t === 'ATIVO') return 'PATRIMONIO';
  return 'VENDA';
};

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };
const f4 = (v: number) => Number(v || 0).toFixed(4);

export interface LancamentoEstoque {
  tenant: number;
  idItem: number;
  deposito: Deposito;
  tipo: 'ENTRADA' | 'SAIDA';
  origem: string;
  idOrigem?: number | null;
  idOrigemItem?: number | null;
  documento?: string | null;
  tipoRecurso?: string | null;
  quantidade: number;                 // na unidade base, sempre positiva
  quantidadeDocumento?: number | null;
  unidadeDocumento?: string | null;
  fatorConversao?: number;
  custoUnitario: number;              // por unidade base
  observacao?: string | null;
  // Entrada recalcula o custo médio do depósito (compra, devolução); ajuste sem custo não altera
  recalcularCustoMedio?: boolean;
  registrarUltimoCusto?: boolean;
  // Saída que desfaz uma entrada (correção de NF, unificação): tira o custo dela do custo médio
  estornoDeEntrada?: boolean;
}

export const lancarMovimentoEstoque = async (conn: Conn, l: LancamentoEstoque) => {
  const quantidade = Math.abs(Number(l.quantidade) || 0);
  const [[saldo]]: any = await conn.execute(
    `SELECT quantidade_atual, custo_medio FROM estoque_saldos_itens
     WHERE tenant_id = ? AND id_item = ? AND deposito = ? FOR UPDATE`,
    [l.tenant, l.idItem, l.deposito]
  );
  const saldoAnterior = Number(saldo?.quantidade_atual) || 0;
  const custoMedioAnterior = Number(saldo?.custo_medio) || 0;
  const saldoPosterior = l.tipo === 'ENTRADA' ? saldoAnterior + quantidade : saldoAnterior - quantidade;
  const custoMedio = l.tipo === 'ENTRADA' && l.recalcularCustoMedio !== false && l.custoUnitario > 0
    ? calcularCustoMedio(saldoAnterior, custoMedioAnterior, quantidade, l.custoUnitario)
    : l.tipo === 'SAIDA' && l.estornoDeEntrada && l.custoUnitario > 0
      ? calcularCustoMedioEstorno(saldoAnterior, custoMedioAnterior, quantidade, l.custoUnitario)
      : (custoMedioAnterior > 0 ? custoMedioAnterior : (l.tipo === 'ENTRADA' ? l.custoUnitario : 0));

  const [mov] = await conn.execute(
    `INSERT INTO estoque_movimentos
       (tenant_id, id_item, deposito, tipo_movimento, origem, id_origem, id_origem_item, documento_origem, tipo_recurso,
        quantidade, quantidade_documento, unidade_documento, fator_conversao,
        custo_unitario, custo_total, saldo_anterior, saldo_posterior, observacao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      l.tenant, l.idItem, l.deposito, l.tipo, l.origem, l.idOrigem ?? null, l.idOrigemItem ?? null, l.documento ?? null,
      l.tipoRecurso || 'PRODUTO', f4(quantidade),
      l.quantidadeDocumento !== undefined && l.quantidadeDocumento !== null ? f4(l.quantidadeDocumento) : null,
      l.unidadeDocumento ?? null, Number(l.fatorConversao || 1).toFixed(6),
      f4(l.custoUnitario), f4(l.custoUnitario * quantidade), f4(saldoAnterior), f4(saldoPosterior),
      l.observacao ? String(l.observacao).slice(0, 255) : null,
    ]
  );

  const ultimo = l.registrarUltimoCusto && l.tipo === 'ENTRADA' && l.custoUnitario > 0;
  await conn.execute(
    `INSERT INTO estoque_saldos_itens (tenant_id, id_item, deposito, quantidade_atual, custo_medio, ultimo_custo)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE quantidade_atual = VALUES(quantidade_atual), custo_medio = VALUES(custo_medio)
                             ${ultimo ? ', ultimo_custo = VALUES(ultimo_custo)' : ''}`,
    [l.tenant, l.idItem, l.deposito, f4(saldoPosterior), f4(custoMedio), ultimo ? f4(l.custoUnitario) : null]
  );

  return { idMovimento: Number(mov.insertId), saldoAnterior, saldoPosterior, custoMedio };
};
