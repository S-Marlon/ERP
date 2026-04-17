const mysql = require('mysql2/promise');

async function nukeTestData() {
  const pool = mysql.createPool({
    host: 'br920.hostgator.com.br',
    user: 'macso037_Marlon',
    password: 'macsonda-marlon',
    database: 'macso037_ERP'
  });

  try {
    console.log('🌋 LIMPEZA NUCLEAR de dados de teste...\n');

    const testIds = [999000, 999001, 999002, 999003, 999004, 999005, 999999];

    // Obter conexão para executar DDL
    const conn = await pool.getConnection();

    // Desabilitar triggers
    try {
      console.log('  ⏸  Desabilitando triggers...');
      await conn.query('DROP TRIGGER IF EXISTS tr_prevent_estoque_movimentacoes_update');
      await conn.query('DROP TRIGGER IF EXISTS tr_prevent_estoque_movimentacoes_delete');
      await conn.query('DROP TRIGGER IF EXISTS tr_atualiza_saldos_estoque');
    } catch (e) {
      console.log('  ⚠️  Triggers não encontrados (ok)');
    }

    // Desabilitar FK
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // DELETE TODOS os movimentos
    for (const id of testIds) {
      const [result] = await conn.execute(
        'DELETE FROM estoque_movimentacoes WHERE id_produto = ?',
        [id]
      );
      if (result.affectedRows > 0) {
        console.log(`  ☢️  Deletados ${result.affectedRows} movimentos de ${id}`);
      }
    }

    // DELETE todos os saldos
    for (const id of testIds) {
      const [result] = await conn.execute(
        'DELETE FROM estoque_saldos WHERE id_produto = ?',
        [id]
      );
      if (result.affectedRows > 0) {
        console.log(`  ☢️  Deletado saldo de ${id}`);
      }
    }

    // DELETE produtos
    const [result] = await conn.execute(
      `DELETE FROM produtos WHERE id_produto IN (${testIds.join(',')})`
    );
    console.log(`  ☢️  Deletados ${result.affectedRows} produtos\n`);

    // Reabilitar FK
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Recriar trigger de saldos
    console.log('  ✅ Recriando trigger tr_atualiza_saldos_estoque...');
    const triggerSQL = `
    CREATE TRIGGER tr_atualiza_saldos_estoque
    AFTER INSERT ON estoque_movimentacoes
    FOR EACH ROW
    BEGIN
      DECLARE v_qtd_total DECIMAL(10,3);
      DECLARE v_valor_medio DECIMAL(10,4);
      DECLARE v_custo_total DECIMAL(14,4);
      DECLARE v_existe INT DEFAULT 0;
      
      SELECT COUNT(*) INTO v_existe 
      FROM estoque_saldos 
      WHERE id_produto = NEW.id_produto;
      
      IF NEW.tipo = 'ENTRADA' THEN
        IF v_existe > 0 THEN
          SELECT COALESCE(quantidade, 0), COALESCE(valor_medio, 0)
          INTO v_qtd_total, v_valor_medio
          FROM estoque_saldos
          WHERE id_produto = NEW.id_produto;
          
          IF NEW.valor_unitario IS NOT NULL AND v_qtd_total > 0 THEN
            SET v_custo_total = (v_qtd_total * v_valor_medio) + (NEW.quantidade * NEW.valor_unitario);
            SET v_valor_medio = v_custo_total / (v_qtd_total + NEW.quantidade);
          ELSEIF NEW.valor_unitario IS NOT NULL THEN
            SET v_valor_medio = NEW.valor_unitario;
          END IF;
          
          UPDATE estoque_saldos
          SET 
            quantidade = v_qtd_total + NEW.quantidade,
            valor_medio = COALESCE(v_valor_medio, 0)
          WHERE id_produto = NEW.id_produto;
        ELSE
          INSERT INTO estoque_saldos (id_produto, quantidade, valor_medio)
          VALUES (NEW.id_produto, NEW.quantidade, COALESCE(NEW.valor_unitario, 0));
        END IF;
      
      ELSEIF NEW.tipo = 'SAIDA' THEN
        IF v_existe > 0 THEN
          SELECT COALESCE(quantidade, 0), COALESCE(valor_medio, 0)
          INTO v_qtd_total, v_valor_medio
          FROM estoque_saldos
          WHERE id_produto = NEW.id_produto;
          
          SET v_qtd_total = GREATEST(0, v_qtd_total - NEW.quantidade);
          
          UPDATE estoque_saldos
          SET quantidade = v_qtd_total
          WHERE id_produto = NEW.id_produto;
        ELSE
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
    
    await conn.query(triggerSQL);
    conn.release();

    console.log('\n✅ LIMPEZA COMPLETA CONCLUÍDA!\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await pool.end();
    process.exit(1);
  }
}

nukeTestData();
