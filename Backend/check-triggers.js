const mysql = require('mysql2/promise');

async function checkTriggers() {
  const pool = mysql.createPool({
    host: 'br920.hostgator.com.br',
    user: 'macso037_Marlon',
    password: 'macsonda-marlon',
    database: 'macso037_ERP'
  });
  
  console.log('🔍 Verificando TRIGGERS...\n');
  
  const [triggers] = await pool.execute(
    'SELECT TRIGGER_SCHEMA, TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_STATEMENT FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA = ?',
    ['macso037_ERP']
  );
  
  if (triggers.length === 0) {
    console.log('❌ Nenhuma trigger encontrada no banco!');
  } else {
    console.log('✅ Triggers encontradas:');
    triggers.forEach((t, idx) => {
      console.log(`\n${idx+1}. ${t.TRIGGER_NAME}`);
      console.log(`   Tabela: ${t.EVENT_OBJECT_TABLE}`);
      console.log(`   Evento: ${t.EVENT_MANIPULATION}`);
      console.log(`   SQL: ${t.ACTION_STATEMENT.substring(0, 150)}...`);
    });
  }
  
  // Verificar se há dados em estoque_saldos
  const [saldos] = await pool.execute('SELECT COUNT(*) as total FROM estoque_saldos');
  console.log(`\n📊 Registros em estoque_saldos: ${saldos[0].total}`);
  
  // Verificar dados de teste
  const [dados] = await pool.execute('SELECT * FROM estoque_saldos WHERE id_produto >= 999 LIMIT 5');
  console.log(`\n📋 Dados de teste (id_produto >= 999):`);
  if (dados.length === 0) {
    console.log('   Nenhum encontrado');
  } else {
    dados.forEach(d => {
      console.log(`   Produto ${d.id_produto}: QTD=${d.quantidade}, VM=${d.valor_medio}`);
    });
  }
  
  await pool.end();
}

checkTriggers().catch(err => console.error('Erro:', err));