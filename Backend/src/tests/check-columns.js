const mysql = require('mysql2/promise');

async function checkSchema() {
  const pool = mysql.createPool({
    host: 'br920.hostgator.com.br',
    user: 'macso037_Marlon',
    password: 'macsonda-marlon',
    database: 'macso037_ERP'
  });

  try {
    const [columns] = await pool.execute(
      'SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
      ['macso037_ERP', 'estoque_saldos']
    );
    
    console.log('📋 Colunas da tabela estoque_saldos:');
    columns.forEach((col, idx) => {
      console.log(`  ${idx + 1}. ${col.COLUMN_NAME}: ${col.COLUMN_TYPE}`);
    });
  } finally {
    await pool.end();
  }
}

checkSchema().catch(console.error);
