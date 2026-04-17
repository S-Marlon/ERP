/**
 * Script para criar a trigger tr_atualiza_saldos_estoque
 * Executa o SQL de criação da trigger no banco de dados
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function createTrigger() {
  const pool = mysql.createPool({
    host: 'br920.hostgator.com.br',
    user: 'macso037_Marlon',
    password: 'macsonda-marlon',
    database: 'macso037_ERP',
    multipleStatements: true
  });

  try {
    console.log('🔧 Criando TRIGGER tr_atualiza_saldos_estoque...\n');

    // SQL da trigger (extraído do arquivo)
    const triggerSQL = `
    DROP TRIGGER IF EXISTS tr_atualiza_saldos_estoque;

    CREATE TRIGGER tr_atualiza_saldos_estoque
    AFTER INSERT ON estoque_movimentacoes
    FOR EACH ROW
    BEGIN
      DECLARE v_qtd_total DECIMAL(10,3);
      DECLARE v_valor_medio DECIMAL(10,4);
      DECLARE v_custo_total DECIMAL(14,4);
      DECLARE v_existe INT DEFAULT 0;
      
      -- Verificar se produto já existe em saldos
      SELECT COUNT(*) INTO v_existe 
      FROM estoque_saldos 
      WHERE id_produto = NEW.id_produto;
      
      IF NEW.tipo = 'ENTRADA' THEN
        IF v_existe > 0 THEN
          -- Produto existe: calcular novo valor médio
          SELECT COALESCE(quantidade, 0), COALESCE(valor_medio, 0)
          INTO v_qtd_total, v_valor_medio
          FROM estoque_saldos
          WHERE id_produto = NEW.id_produto;
          
          IF NEW.valor_unitario IS NOT NULL AND v_qtd_total > 0 THEN
            -- Calcular custo total: (qtd_atual * v_medio) + (qtd_nova * v_novo)
            SET v_custo_total = (v_qtd_total * v_valor_medio) + (NEW.quantidade * NEW.valor_unitario);
            SET v_valor_medio = v_custo_total / (v_qtd_total + NEW.quantidade);
          ELSEIF NEW.valor_unitario IS NOT NULL THEN
            -- Primeira entrada com custo
            SET v_valor_medio = NEW.valor_unitario;
          END IF;
          
          -- Atualizar saldo
          UPDATE estoque_saldos
          SET 
            quantidade = v_qtd_total + NEW.quantidade,
            valor_medio = COALESCE(v_valor_medio, 0)
          WHERE id_produto = NEW.id_produto;
        ELSE
          -- Novo produto
          INSERT INTO estoque_saldos (id_produto, quantidade, valor_medio)
          VALUES (NEW.id_produto, NEW.quantidade, COALESCE(NEW.valor_unitario, 0));
        END IF;
      
      ELSEIF NEW.tipo = 'SAIDA' THEN
        IF v_existe > 0 THEN
          SELECT COALESCE(quantidade, 0), COALESCE(valor_medio, 0)
          INTO v_qtd_total, v_valor_medio
          FROM estoque_saldos
          WHERE id_produto = NEW.id_produto;
          
          -- Subtrair quantidade (nunca ir abaixo de 0)
          SET v_qtd_total = GREATEST(0, v_qtd_total - NEW.quantidade);
          
          UPDATE estoque_saldos
          SET quantidade = v_qtd_total
          WHERE id_produto = NEW.id_produto;
        ELSE
          -- Saída em produto que não existe: criar com quantidade 0
          INSERT INTO estoque_saldos (id_produto, quantidade, valor_medio)
          VALUES (NEW.id_produto, 0, 0);
        END IF;
      
      ELSEIF NEW.tipo = 'AJUSTE' THEN
        IF v_existe > 0 THEN
          UPDATE estoque_saldos
          SET 
            quantidade = NEW.quantidade,
            valor_medio = COALESCE(NEW.valor_unitario, 0)
          WHERE id_produto = NEW.id_produto;
        ELSE
          INSERT INTO estoque_saldos (id_produto, quantidade, valor_medio)
          VALUES (NEW.id_produto, NEW.quantidade, COALESCE(NEW.valor_unitario, 0));
        END IF;
      END IF;
    END;
    `;

    // Executar trigger
    const connection = await pool.getConnection();
    await connection.query(triggerSQL);
    connection.release();

    console.log('✅ TRIGGER criada com sucesso!');
    
    // Verificar se foi criada
    const [triggers] = await pool.execute(
      'SELECT TRIGGER_NAME FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME = ?',
      ['macso037_ERP', 'tr_atualiza_saldos_estoque']
    );

    if (triggers.length > 0) {
      console.log('✅ Verificação: Trigger foi criada no banco');
      console.log('\n📊 Próximos passos:');
      console.log('1. Deletar registros de teste: npm run clean-test-data');
      console.log('2. Reexecutar testes: npm run test-stock-edge-cases');
      console.log('3. Validar auditoria: npm run audit-stock');
    } else {
      console.log('❌ Erro: Trigger não encontrada após criação');
    }

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro ao criar trigger:', error.message);
    await pool.end();
    process.exit(1);
  }
}

createTrigger();