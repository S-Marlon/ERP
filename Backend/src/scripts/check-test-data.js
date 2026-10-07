const mysql = require('mysql2/promise');

async function checkTestData() {
  const pool = mysql.createPool({
    host: 'br920.hostgator.com.br',
    user: 'macso037_Marlon',
    password: 'macsonda-marlon',
    database: 'macso037_ERP'
  });

  try {
    const testIds = [999000, 999001, 999002, 999003, 999004, 999005, 999999];

    console.log('🔍 Verificando dados de teste...\n');

    for (const id of testIds) {
      const [[movCount]] = await pool.execute(
        'SELECT COUNT(*) as cnt FROM estoque_movimentacoes WHERE id_produto = ?',
        [id]
      );
      
      const [[saldoCount]] = await pool.execute(
        'SELECT COUNT(*) as cnt FROM estoque_saldos WHERE id_produto = ?',
        [id]
      );
      
      const [[prodCount]] = await pool.execute(
        'SELECT COUNT(*) as cnt FROM produtos WHERE id_produto = ?',
        [id]
      );

      const hasData = movCount.cnt > 0 || saldoCount.cnt > 0 || prodCount.cnt > 0;
      if (hasData) {
        console.log(`⚠️  Produto ${id}:`);
        if (movCount.cnt > 0) console.log(`   - ${movCount.cnt} movimentações`);
        if (saldoCount.cnt > 0) console.log(`   - ${saldoCount.cnt} saldos`);
        if (prodCount.cnt > 0) console.log(`   - ${prodCount.cnt} produtos`);
      }
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkTestData();
