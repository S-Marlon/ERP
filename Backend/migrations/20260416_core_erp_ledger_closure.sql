-- Migration: 20260416_core_erp_ledger_closure.sql
-- Descrição: Fecha o core de estoque como um ledger de eventos imutável,
-- remove lógica de negócio de trigger e implementa replay determinístico de estoque_saldos.
-- Regras principais:
--  1) estoque_movimentacoes é o ÚNICO ledger válido.
--  2) triggers não podem conter regra de negócio de estoque.
--  3) ledger é imutável: updates/deletes diretos são proibidos.
--  4) replay de estoque_saldos é oficial, determinístico e idempotente.

START TRANSACTION;

-- 1. Tornar o ledger explicitamente auditável e idempotente
ALTER TABLE estoque_movimentacoes
  ADD COLUMN event_id CHAR(36) NULL AFTER id_movimento,
  ADD COLUMN valor_total_custo DECIMAL(14,4) NULL AFTER valor_total;

UPDATE estoque_movimentacoes
SET event_id = UUID(),
    valor_total_custo = COALESCE(valor_total, quantidade * valor_unitario)
WHERE event_id IS NULL;

ALTER TABLE estoque_movimentacoes
  MODIFY COLUMN event_id CHAR(36) NOT NULL,
  ADD UNIQUE KEY idx_estoque_movimentacoes_event_id (event_id),
  ADD KEY idx_estoque_movimentacoes_produto_ordem (id_produto, data_movimento, id_movimento);

-- 2. Remover trigger de materialização de estoque e garantir que o ledger não aplique lógica de negócio
DROP TRIGGER IF EXISTS tr_atualiza_estoque_saldo;

DROP TRIGGER IF EXISTS tr_prevent_estoque_movimentacoes_update;
DROP TRIGGER IF EXISTS tr_prevent_estoque_movimentacoes_delete;

DELIMITER $$
CREATE TRIGGER tr_prevent_estoque_movimentacoes_update
BEFORE UPDATE ON estoque_movimentacoes FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Atualização direta de estoque_movimentacoes é proibida. O ledger é imutável.';
END$$

CREATE TRIGGER tr_prevent_estoque_movimentacoes_delete
BEFORE DELETE ON estoque_movimentacoes FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Remoção direta de estoque_movimentacoes é proibida. O ledger é imutável.';
END$$
DELIMITER ;

-- 3. Procedimento de replay oficial para reconstruir estoque_saldos a partir do ledger
DROP PROCEDURE IF EXISTS rebuild_estoque_saldos;
DELIMITER $$
CREATE PROCEDURE rebuild_estoque_saldos()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE current_produto INT;
  DECLARE current_qty DECIMAL(14,4);
  DECLARE current_valor DECIMAL(14,4);
  DECLARE ev_tipo ENUM('ENTRADA','SAIDA','AJUSTE');
  DECLARE ev_qtd DECIMAL(14,4);
  DECLARE ev_unit DECIMAL(14,4);

  DECLARE prod_cursor CURSOR FOR
    SELECT DISTINCT id_produto
    FROM estoque_movimentacoes
    ORDER BY id_produto;

  DECLARE event_cursor CURSOR FOR
    SELECT tipo, quantidade, valor_unitario
    FROM estoque_movimentacoes
    WHERE id_produto = current_produto
    ORDER BY data_movimento ASC, id_movimento ASC;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  TRUNCATE TABLE estoque_saldos;

  OPEN prod_cursor;
  prod_loop: LOOP
    SET done = 0;
    FETCH prod_cursor INTO current_produto;
    IF done THEN
      LEAVE prod_loop;
    END IF;

    SET current_qty = 0.0000;
    SET current_valor = 0.0000;

    OPEN event_cursor;
    SET done = 0;
    event_loop: LOOP
      FETCH event_cursor INTO ev_tipo, ev_qtd, ev_unit;
      IF done THEN
        LEAVE event_loop;
      END IF;

      IF ev_tipo = 'ENTRADA' THEN
        SET current_valor = ((current_qty * current_valor) + (ev_qtd * COALESCE(ev_unit, 0))) / NULLIF((current_qty + ev_qtd), 0);
        SET current_qty = current_qty + ev_qtd;
      ELSEIF ev_tipo = 'SAIDA' THEN
        SET current_qty = current_qty - ev_qtd;
      ELSEIF ev_tipo = 'AJUSTE' THEN
        SET current_qty = ev_qtd;
        IF ev_unit IS NOT NULL THEN
          SET current_valor = ev_unit;
        END IF;
      END IF;
    END LOOP;
    CLOSE event_cursor;

    INSERT INTO estoque_saldos (id_produto, quantidade, valor_medio)
    VALUES (current_produto, current_qty, current_valor)
    ON DUPLICATE KEY UPDATE
      quantidade = VALUES(quantidade),
      valor_medio = VALUES(valor_medio);
  END LOOP;
  CLOSE prod_cursor;
END$$
DELIMITER ;

COMMIT;
