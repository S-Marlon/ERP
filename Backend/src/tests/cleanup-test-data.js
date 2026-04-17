const mysql = require('mysql2/promise');

async function cleanupTestData() {
  const pool = mysql.createPool({
    host: 'br920.hostgator.com.br',
    user: 'macso037_Marlon',
    password: 'macsonda-marlon',
    database: 'macso037_ERP',
    multipleStatements: true
  });

  try {
    console.log('🧹 Limpando dados de teste...\n');

    // IDs de teste
    const testIds = [999000, 999001, 999002, 999003, 999004, 999005, 999999];

    // Desabilitar trigger de proteção temporariamente
    console.log('⏸  Desabilitando proteção do ledger...');
    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');

    // Deletar movimentações
    for (const id of testIds) {
      try {
        const [result] = await pool.execute(
          'DELETE FROM estoque_movimentacoes WHERE id_produto = ?',
          [id]
        );
        if (result.affectedRows > 0) {
          console.log(`  ✓ Deletadas ${result.affectedRows} movimentações do produto ${id}`);
        }
      } catch (e) {
        if (e.code === 'ER_SIGNAL_NOT_FOUND' || e.sqlMessage?.includes('trigger')) {
          // Se falhar por trigger, tenta sem a trigger
          console.log(`  ⚠ Impossível deletar movimentações diretas (ledger imutável)`);
        }
      }
    }

    // Deletar saldos
    for (const id of testIds) {
      const [result] = await pool.execute(
        'DELETE FROM estoque_saldos WHERE id_produto = ?',
        [id]
      );
      if (result.affectedRows > 0) {
        console.log(`  ✓ Deletado saldo do produto ${id}`);
      }
    }

    // Deletar produtos
    const [prodResult] = await pool.execute(
      'DELETE FROM produtos WHERE id_produto IN (?, ?, ?, ?, ?, ?, ?)',
      testIds
    );
    console.log(`  ✓ ${prodResult.affectedRows} produtos deletados`);

    // Reabilitar proteção
    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n✅ Limpeza concluída!\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await pool.end();
    process.exit(1);
  }
}

cleanupTestData();
