import pool from '../../routes/Estoque/db.config';
import { randomUUID } from 'crypto';

/**
 * Serviço Central de Movimentação de Estoque
 *
 * CORE do sistema baseado em ledger (event sourcing)
 *
 * ⚠️ SISTEMA HÍBRIDO ATUAL:
 * - estoque_movimentacoes = ledger (fonte da verdade)
 * - estoque_saldos = cache atualizado por TRIGGER (ainda ativa)
 * - Futuro: trigger será removida, replay ativado
 *
 * Regras:
 * - NÃO usar quantidade negativa
 * - tipo define comportamento (ENTRADA, SAIDA, AJUSTE)
 * - Sempre validar produto antes de inserir
 * - Preparado para idempotência futura (event_id)
 */

export const STOCK_ORIGINS = {
  RECEBIMENTO: 'RECEBIMENTO',
  VENDA: 'VENDA',
  AJUSTE_MANUAL: 'AJUSTE_MANUAL',
  REVERSAO: 'REVERSAO',
  REPROCESSAMENTO: 'REPROCESSAMENTO',
} as const;

export type StockOrigin = typeof STOCK_ORIGINS[keyof typeof STOCK_ORIGINS];

export interface StockMovementData {
  idProduto: number;
  tipo: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
  quantidade: number;
  valorUnitario?: number;
  origem: StockOrigin | string; // Permitir string para compatibilidade
  idOrigem?: number;
  idFornecedor?: number;
  referenciaAuditavel?: string;
  metadata?: Record<string, any>; // JSON para dados extras
  idRecebimento?: number; // Integração futura com recebimentos
  useManualStockUpdate?: boolean; // 🆕 Flag para testar cálculo manual
}

/**
 * Recalcula saldo de um produto baseado no ledger (estoque_movimentacoes)
 *
 * ⚠️ APENAS CÁLCULO - NÃO salva no banco
 * Usado para testar consistência antes de remover trigger
 *
 * @param productId ID do produto
 * @returns Saldo calculado do ledger
 */
export async function recalculateStockForProduct(productId: number): Promise<{
  quantidade: number;
  valorMedio: number;
  movimentosProcessados: number;
}> {
  const [rows]: any = await pool.execute(
    `SELECT tipo, quantidade, valor_unitario
     FROM estoque_movimentacoes
     WHERE id_produto = ?
     ORDER BY data_movimento ASC, id_movimento ASC`,
    [productId]
  );

  let quantidade = 0;
  let valorMedio = 0;
  let totalMovimentos = 0;

  for (const m of rows) {
    totalMovimentos++;

    const tipo = m.tipo;
    const qtd = Number(m.quantidade) || 0;
    const unit = m.valor_unitario !== null && m.valor_unitario !== undefined
      ? Number(m.valor_unitario)
      : 0;

    if (tipo === 'ENTRADA') {
      const novaQtd = quantidade + qtd;

      if (novaQtd > 0) {
        valorMedio =
          (quantidade * valorMedio + qtd * unit) / novaQtd;
      }

      quantidade = novaQtd;
    }

    if (tipo === 'SAIDA') {
      quantidade -= qtd;
    }

    if (tipo === 'AJUSTE') {
      quantidade = qtd;
      if (unit > 0) valorMedio = unit;
    }
  }

  return {
    quantidade: Number((quantidade || 0).toFixed(4)),
    valorMedio: Number((valorMedio || 0).toFixed(4)),
    movimentosProcessados: totalMovimentos
  };
}

/**
 * Função central de movimentação de estoque
 */
export async function processStockMovement(data: StockMovementData): Promise<number> {
  // 🔒 Validações básicas
  if (!data.idProduto || data.idProduto <= 0) {
    throw new Error('ID do produto inválido');
  }

  if (!['ENTRADA', 'SAIDA', 'AJUSTE'].includes(data.tipo)) {
    throw new Error('Tipo inválido (ENTRADA, SAIDA, AJUSTE)');
  }

  if (!data.quantidade || isNaN(data.quantidade) || data.quantidade <= 0) {
    throw new Error('Quantidade deve ser positiva');
  }

  if (!data.origem || data.origem.trim() === '') {
    throw new Error('Origem é obrigatória');
  }

  // 🔎 Validar produto
  const isValidProduct = await validateProductForStock(data.idProduto);
  if (!isValidProduct) {
    throw new Error('Produto inválido ou inativo');
  }

  // 🔢 SEMPRE quantidade positiva
  const quantidadeFinal = Math.abs(data.quantidade);

  // 💰 Cálculo correto
  const valorTotal = data.valorUnitario
    ? quantidadeFinal * data.valorUnitario
    : null;

  // 🧠 Validação de estoque para saída
  if (data.tipo === 'SAIDA') {
    const stock = await getCurrentStock(data.idProduto);

    if (stock.quantidade < quantidadeFinal) {
      throw new Error(
        `Estoque insuficiente. Atual: ${stock.quantidade}, solicitado: ${quantidadeFinal}`
      );
    }
  }

  // 🆔 Preparação para idempotência futura (ledger profissional)
  // ⚠️ NÃO usar event_id ainda (coluna pode não existir no banco atual)
  const eventId = randomUUID();

  // 📜 Log estruturado e auditável
  console.log('[STOCK_LEDGER]', JSON.stringify({
    eventId,
    tipo: data.tipo,
    produto: data.idProduto,
    quantidade: quantidadeFinal,
    valorUnitario: data.valorUnitario || null,
    valorTotal,
    origem: data.origem,
    idOrigem: data.idOrigem || null,
    idRecebimento: data.idRecebimento || null,
    referenciaAuditavel: data.referenciaAuditavel || null,
    metadata: data.metadata || null,
    timestamp: new Date().toISOString(),
    modo: 'HIBRIDO_TRIGGER' // Indica que trigger ainda controla saldo
  }));

  // 💾 Inserção no ledger com event_id para garantir idempotência
  const [result]: any = await pool.execute(
    `INSERT INTO estoque_movimentacoes (
      event_id,
      id_produto,
      id_fornecedor,
      tipo,
      origem,
      id_origem,
      quantidade,
      valor_unitario,
      valor_total,
      referencia_auditavel,
      data_movimento
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      eventId,
      data.idProduto,
      data.idFornecedor || null,
      data.tipo,
      data.origem,
      data.idOrigem || null,
      quantidadeFinal,
      data.valorUnitario || null,
      valorTotal,
      data.referenciaAuditavel || null,
    ]
  );

  // 🧪 Teste de cálculo manual (preparação para remoção da trigger)
  if (data.useManualStockUpdate) {
    try {
      const saldoCalculado = await recalculateStockForProduct(data.idProduto);
      const saldoAtual = await getCurrentStock(data.idProduto);

      console.log('[STOCK_TEST_MANUAL]', JSON.stringify({
        produto: data.idProduto,
        movimentoInserido: result.insertId,
        saldoLedger: saldoCalculado,
        saldoCache: saldoAtual,
        diferenca: {
          quantidade: saldoCalculado.quantidade - saldoAtual.quantidade,
          valorMedio: saldoCalculado.valorMedio - saldoAtual.valorMedio
        },
        movimentosProcessados: saldoCalculado.movimentosProcessados,
        timestamp: new Date().toISOString()
      }));

      // ⚠️ NÃO atualizar estoque_saldos ainda - apenas log
    } catch (error) {
      console.error('[STOCK_TEST_ERROR]', {
        produto: data.idProduto,
        movimento: result.insertId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return result.insertId;
}

/**
 * Valida se o produto existe e está ativo
 */
export async function validateProductForStock(productId: number): Promise<boolean> {
  const [rows]: any = await pool.execute(
    `SELECT id_produto 
     FROM produtos 
     WHERE id_produto = ? AND status = 'Ativo'`,
    [productId]
  );

  return rows.length > 0;
}

/**
 * Busca saldo atual (cache)
 * ⚠️ Futuro: substituir por leitura do ledger (replay)
 */
export async function getCurrentStock(productId: number): Promise<{
  quantidade: number;
  valorMedio: number;
}> {
  const [rows]: any = await pool.execute(
    `SELECT quantidade, valor_medio
     FROM estoque_saldos
     WHERE id_produto = ?`,
    [productId]
  );

  if (!rows.length) {
    return { quantidade: 0, valorMedio: 0 };
  }

  return {
    quantidade: Number(rows[0].quantidade),
    valorMedio: Number(rows[0].valor_medio),
  };
}

/**
 * Reverte um movimento de estoque criando movimento inverso
 *
 * ⚠️ NÃO deleta o movimento original (ledger imutável)
 * Cria novo movimento compensatório
 *
 * @param originalMovementId ID do movimento a ser revertido
 * @returns ID do novo movimento de reversão
 */
export async function revertStockMovement(originalMovementId: number): Promise<number> {
  // 🔍 Buscar movimento original
  const [rows]: any = await pool.execute(
    `SELECT id_produto, tipo, quantidade, valor_unitario, origem, id_origem, referencia_auditavel
     FROM estoque_movimentacoes
     WHERE id_movimento = ?`,
    [originalMovementId]
  );

  if (!rows.length) {
    throw new Error('Movimento original não encontrado');
  }

  const original = rows[0];

  // 🔄 Determinar tipo inverso
  let tipoInverso: 'ENTRADA' | 'SAIDA';
  if (original.tipo === 'ENTRADA') {
    tipoInverso = 'SAIDA';
  } else if (original.tipo === 'SAIDA') {
    tipoInverso = 'ENTRADA';
  } else {
    throw new Error('Não é possível reverter movimento do tipo AJUSTE');
  }

  // 📝 Criar movimento de reversão
  return await processStockMovement({
    idProduto: original.id_produto,
    tipo: tipoInverso,
    quantidade: original.quantidade, // Mesma quantidade
    valorUnitario: original.valor_unitario,
    origem: STOCK_ORIGINS.REVERSAO,
    idOrigem: originalMovementId, // Referência ao original
    referenciaAuditavel: `REVERSAO_${original.referencia_auditavel || originalMovementId}`,
    metadata: {
      tipoReversao: 'MOVIMENTO_INVERSO',
      movimentoOriginal: originalMovementId,
      origemOriginal: original.origem,
      idOrigemOriginal: original.id_origem
    }
  });
}

/**
 * Reprocessa estoque por referência (base para correção)
 *
 * ⚠️ NÃO deleta dados existentes
 * Busca movimentos por referência, cria reversões e reaplica
 *
 * @param referencia String de referência para buscar movimentos
 * @returns Array com IDs dos novos movimentos
 */
export async function reprocessStockByReference(referencia: string): Promise<number[]> {
  if (!referencia || referencia.trim() === '') {
    throw new Error('Referência é obrigatória');
  }

  // 🔍 Buscar todos os movimentos com essa referência
  const [rows]: any = await pool.execute(
    `SELECT id_movimento, id_produto, tipo, quantidade, valor_unitario, origem, id_origem
     FROM estoque_movimentacoes
     WHERE referencia_auditavel LIKE ?
     ORDER BY data_movimento ASC, id_movimento ASC`,
    [`%${referencia}%`]
  );

  if (!rows.length) {
    throw new Error('Nenhum movimento encontrado com essa referência');
  }

  const newMovementIds: number[] = [];

  // 🔄 Para cada movimento, criar reversão e reaplicar
  for (const movimento of rows) {
    // 1. Reverter o movimento original
    const revertId = await revertStockMovement(movimento.id_movimento);
    newMovementIds.push(revertId);

    // 2. Reaplicar o movimento (com mesma origem, mas origem = REPROCESSAMENTO)
    const reapplyId = await processStockMovement({
      idProduto: movimento.id_produto,
      tipo: movimento.tipo,
      quantidade: movimento.quantidade,
      valorUnitario: movimento.valor_unitario,
      origem: STOCK_ORIGINS.REPROCESSAMENTO,
      idOrigem: movimento.id_origem,
      referenciaAuditavel: `REPROCESSADO_${referencia}_${movimento.id_movimento}`,
      metadata: {
        tipoReprocessamento: 'CORRECAO_REFERENCIA',
        referenciaOriginal: referencia,
        movimentoOriginal: movimento.id_movimento,
        origemOriginal: movimento.origem
      }
    });
    newMovementIds.push(reapplyId);
  }

  return newMovementIds;
}