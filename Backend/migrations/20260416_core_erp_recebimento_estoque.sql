-- Migration: 20260416_core_erp_recebimento_estoque.sql
-- Descrição: Introduz o modelo de recebimento versionado, auditoria de recebimento e prepara o estoque como ledger de eventos.
-- Impacto: preserva as tabelas existentes (`compras`, `compras_itens`, `estoque_movimentacoes`) e adiciona novas estruturas para suportar imutabilidade, versão e rastreabilidade.

START TRANSACTION;

-- 1. Tabela de recebimentos versionados
CREATE TABLE IF NOT EXISTS recebimentos (
  id_recebimento INT(11) NOT NULL AUTO_INCREMENT,
  id_nota INT(11) NOT NULL,
  version INT(11) NOT NULL DEFAULT 1,
  status ENUM('PENDENTE','CONFERIDO','PROCESSADO') NOT NULL DEFAULT 'PENDENTE',
  criado_por VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
  observacoes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_recebimento),
  KEY idx_recebimento_nota (id_nota)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- 2. Itens de recebimento para versionamento e correlação com NF
CREATE TABLE IF NOT EXISTS recebimento_itens (
  id_item INT(11) NOT NULL AUTO_INCREMENT,
  id_recebimento INT(11) NOT NULL,
  id_produto INT(11) DEFAULT NULL,
  sku_fornecedor_original VARCHAR(50) DEFAULT NULL,
  ncm VARCHAR(20) DEFAULT NULL,
  cfop VARCHAR(10) DEFAULT NULL,
  unidade_xml VARCHAR(10) DEFAULT NULL,
  quantidade DECIMAL(12,4) DEFAULT 0,
  preco_unitario_custo DECIMAL(12,4) DEFAULT 0,
  valor_total_item DECIMAL(12,2) DEFAULT 0,
  valor_frete_item DECIMAL(12,2) DEFAULT 0,
  valor_ipi_item DECIMAL(12,2) DEFAULT 0,
  impostos_taxas DECIMAL(12,4) DEFAULT 0,
  valor_ibs DECIMAL(12,4) DEFAULT 0,
  valor_cbs DECIMAL(12,4) DEFAULT 0,
  valor_imposto_seletivo DECIMAL(12,4) DEFAULT 0,
  custo_unitario_real DECIMAL(12,4) DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_item),
  KEY idx_recebimento_item_recebimento (id_recebimento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- 3. Preparar a separação de custos na tabela de produtos
ALTER TABLE produtos
  ADD COLUMN preco_custo_contabil DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN preco_custo_precificacao DECIMAL(12,4) NOT NULL DEFAULT 0.0000;

COMMIT;
