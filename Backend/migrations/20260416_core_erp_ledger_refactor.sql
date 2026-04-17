-- Migration: 20260416_core_erp_ledger_refactor.sql
-- Descrição: Fortalece o modelo de estoque como ledger imutável e separa custos contábeis de precificação.
-- Impacto: adiciona metadados de evento ao ledger existente (`estoque_movimentacoes`) e um custo contábil dedicado em `produtos`.
-- Compatibilidade: não remove tabelas existentes, preserva `compras` como NF imutável e `recebimentos` como camada operacional versionada.

START TRANSACTION;

-- 1. Separação de custos
ALTER TABLE produtos
  ADD COLUMN preco_custo_contabil DECIMAL(12,4) NOT NULL DEFAULT '0.0000';

-- 2. Tornar `estoque_movimentacoes` um ledger explícito com auditabilidade e ligação ao recebimento versionado
ALTER TABLE estoque_movimentacoes
  ADD COLUMN evento_tipo ENUM(
      'RECEBIMENTO_CONFIRMADO',
      'AJUSTE_ESTOQUE',
      'REVERSAO_RECEBIMENTO',
      'REPROCESSAMENTO',
      'ENTRADA',
      'SAIDA',
      'AJUSTE'
  ) NOT NULL DEFAULT 'ENTRADA',
  ADD COLUMN id_recebimento INT(11) DEFAULT NULL,
  ADD COLUMN referencia_auditavel VARCHAR(255) DEFAULT NULL;

-- 3. Índices para consulta de replay e auditoria
ALTER TABLE estoque_movimentacoes
  ADD KEY idx_estoque_movimentacoes_recebimento (id_recebimento),
  ADD KEY idx_estoque_movimentacoes_origem (origem, id_origem),
  ADD KEY idx_estoque_movimentacoes_referencia (referencia_auditavel(100));

COMMIT;
