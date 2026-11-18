// backend/src/db.config.ts
import mysql, { Pool, ConnectionOptions } from 'mysql2/promise';

// Recomenda-se usar 'dotenv' e um arquivo .env para credenciais em projetos reais
const accessConfig: ConnectionOptions = {
    host: 'br920.hostgator.com.br', // Mude para o seu host
    user: 'macso037_Marlon',      // Mude para o seu usuário
    password: 'macsonda-marlon', // << ATENÇÃO: COLOQUE SUA SENHA AQUI
    database: 'macso037_ERP', // Mude para o nome do seu banco
    waitForConnections: true,
    connectionLimit: 10,
    // O banco é remoto: abrir conexão custa uma ida e volta a mais (bem mais na internet da loja). O padrão do mysql2
    // fecha a conexão parada há 1 minuto; aqui ela fica aberta por 30 min (o servidor só derruba após wait_timeout = 1 h).
    maxIdle: 10,
    idleTimeout: 30 * 60 * 1000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
};

const pool: Pool = mysql.createPool(accessConfig);


console.log(`Pool de Conexão MySQL inicializado para o banco: ${accessConfig.database}`);

export default pool;
