/**
 * Script SQL para criar TRIGGER que atualiza estoque_saldos
 * 
 * Esta trigger mantém o cache estoque_saldos sincronizado com o ledger
 * estoque_movimentacoes.
 * 
 * IMPORTANTE: Executar este script diretamente no MySQL CLI
 */

-- ============================================================
-- TRIGGER: tr_atualiza_saldos_estoque
-- ============================================================
-- Dispara AFTER INSERT em estoque_movimentacoes
-- Atualiza ou insere em estoque_saldos
-- ============================================================

DELIMITER //

DROP TRIGGER IF EXISTS tr_atualiza_saldos_estoque //

CREATE TRIGGER tr_atualiza_saldos_estoque
AFTER INSERT ON estoque_movimentacoes
FOR EACH ROW
BEGIN
  DECLARE v_qtd_atual DECIMAL(10,3);
  DECLARE v_valor_medio_atual DECIMAL(12,4);
  DECLARE v_custo_total DECIMAL(14,4);
  
  -- Se for AJUSTE, atualiza diretamente ao valor informado
  IF NEW.tipo = 'AJUSTE' THEN
    UPDATE estoque_saldos
    SET 
      quantidade = NEW.quantidade,
      valor_medio = COALESCE(NEW.valor_unitario, 0),
      data_atualizacao = NOW()
    WHERE id_produto = NEW.id_produto;
    
    -- Se não atualizou, insere novo registro
    IF ROW_COUNT() = 0 THEN
      INSERT INTO estoque_saldos (
        id_produto, quantidade, valor_medio, data_atualizacao
      ) VALUES (
        NEW.id_produto, 
        NEW.quantidade, 
        COALESCE(NEW.valor_unitario, 0),
        NOW()
      );
    END IF;
  
  -- Se for ENTRADA, soma quantidade e recalcula valor médio
  ELSEIF NEW.tipo = 'ENTRADA' THEN
    SELECT 
      COALESCE(quantidade, 0),
      COALESCE(valor_medio, 0)
    INTO v_qtd_atual, v_valor_medio_atual
    FROM estoque_saldos
    WHERE id_produto = NEW.id_produto;
    
    -- Recalcular valor médio: (qtd_atual * valor_atual + nova_qtd * novo_valor) / nova_qtd_total
    IF v_qtd_atual > 0 AND NEW.valor_unitario IS NOT NULL THEN
      SET v_custo_total = (v_qtd_atual * v_valor_medio_atual) + (NEW.quantidade * NEW.valor_unitario);
      SET v_valor_medio_atual = v_custo_total / (v_qtd_atual + NEW.quantidade);
    ELSEIF NEW.valor_unitario IS NOT NULL THEN
      SET v_valor_medio_atual = NEW.valor_unitario;
    END IF;
    
    SET v_qtd_atual = v_qtd_atual + NEW.quantidade;
    
    UPDATE estoque_saldos
    SET 
      quantidade = v_qtd_atual,
      valor_medio = v_valor_medio_atual,
      data_atualizacao = NOW()
    WHERE id_produto = NEW.id_produto;
    
    -- Se não atualizou, insere novo registro
    IF ROW_COUNT() = 0 THEN
      INSERT INTO estoque_saldos (
        id_produto, quantidade, valor_medio, data_atualizacao
      ) VALUES (
        NEW.id_produto, 
        NEW.quantidade,
        COALESCE(NEW.valor_unitario, 0),
        NOW()
      );
    END IF;
  
  -- Se for SAIDA, subtrai quantidade
  ELSEIF NEW.tipo = 'SAIDA' THEN
    SELECT 
      COALESCE(quantidade, 0),
      COALESCE(valor_medio, 0)
    INTO v_qtd_atual, v_valor_medio_atual
    FROM estoque_saldos
    WHERE id_produto = NEW.id_produto;
    
    SET v_qtd_atual = GREATEST(0, v_qtd_atual - NEW.quantidade);
    
    UPDATE estoque_saldos
    SET 
      quantidade = v_qtd_atual,
      -- Valor médio não muda com saída (mantém custo histórico)
      data_atualizacao = NOW()
    WHERE id_produto = NEW.id_produto;
    
    -- Se não atualizou, insere novo registro
    IF ROW_COUNT() = 0 THEN
      INSERT INTO estoque_saldos (
        id_produto, quantidade, valor_medio, data_atualizacao
      ) VALUES (
        NEW.id_produto, 
        0,
        0,
        NOW()
      );
    END IF;
  END IF;
  
END//

DELIMITER ;

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
-- Executar este SELECT para confirmar que a trigger foi criada:
--
-- SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE
-- FROM INFORMATION_SCHEMA.TRIGGERS
-- WHERE TRIGGER_SCHEMA = 'macso037_ERP'
-- AND TRIGGER_NAME = 'tr_atualiza_saldos_estoque';
--
-- Resultado esperado: tr_atualiza_saldos_estoque | INSERT | estoque_movimentacoes
-- ============================================================