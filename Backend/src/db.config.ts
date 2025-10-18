// backend/src/db.config.ts
import mysql, { Pool, ConnectionOptions } from 'mysql2/promise';

// Recomenda-se usar 'dotenv' e um arquivo .env para credenciais em projetos reais
const accessConfig: ConnectionOptions = {
    host: 'br920.hostgator.com.br', // Mude para o seu host
    user: 'macso037_Marlon',      // Mude para o seu usuário
    password: 'macsonda-marlon', // << ATENÇÃO: COLOQUE SUA SENHA AQUI
    database: 'macso037_services', // Mude para o nome do seu banco
    waitForConnections: true,
    connectionLimit: 10,
};

const pool: Pool = mysql.createPool(accessConfig);


console.log(`Pool de Conexão MySQL inicializado para o banco: ${accessConfig.database}`);

export default pool;