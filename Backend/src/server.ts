// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import pool from './db.config'; // Importa a conexão com o banco

const app = express();
const PORT = 3001; // Porta padrão para APIs, o React rodará em 3000

// Middlewares
app.use(cors()); 
app.use(express.json());

// Rota de Teste Simples para verificar se a API está funcionando
app.get('/', (req, res) => {
    res.send('API de Serviços de Poços Rodando!');
});

// Rota de Teste de Conexão com o Banco de Dados
app.get('/check-db', async (req, res) => {
    try {
        // Tenta buscar o nome do banco de dados (query simples)
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'OK', message: 'Conexão com o Banco de Dados bem-sucedida!' });
    } catch (error) {
        console.error('Erro na Conexão com o Banco:', error);
        res.status(500).json({ status: 'Error', message: 'Falha ao conectar com o Banco de Dados.', error: error });
    }
});

app.get('/clientes', async (req, res) => {
    // ⚠️ ATENÇÃO: SUBSTITUA 'servicos' pelo nome real da sua tabela, se for diferente.
    const tableName = 'clientes'; 
    const query = `SELECT * FROM ${tableName} LIMIT 10`; // Limita a 10 resultados para o teste

    try {
        // Executa o SELECT
        const [rows] = await pool.query(query);

        // Retorna os dados encontrados
        res.status(200).json({ 
            status: 'OK', 
            message: `Dados recuperados da tabela '${tableName}' com sucesso.`,
            data: rows
        });

    } catch (error) {
        console.error(`Erro ao consultar a tabela '${tableName}':`, error);
        
        // O erro mais comum aqui é se a tabela não existir (ER_NO_SUCH_TABLE)
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        
        res.status(500).json({ 
            status: 'Error', 
            message: `Falha ao executar SELECT na tabela '${tableName}'. Verifique se o nome da tabela está correto.`, 
            error: errorMessage 
        });
    }
});

app.get('/contratos', async (req, res) => {
    // ⚠️ ATENÇÃO: SUBSTITUA 'servicos' pelo nome real da sua tabela, se for diferente.
    const tableName = 'contratos'; 
    const query = `SELECT * FROM ${tableName} LIMIT 10`; // Limita a 10 resultados para o teste

    try {
        // Executa o SELECT
        const [rows] = await pool.query(query);

        // Retorna os dados encontrados
        res.status(200).json({ 
            status: 'OK', 
            message: `Dados recuperados da tabela '${tableName}' com sucesso.`,
            data: rows
        });

    } catch (error) {
        console.error(`Erro ao consultar a tabela '${tableName}':`, error);
        
        // O erro mais comum aqui é se a tabela não existir (ER_NO_SUCH_TABLE)
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        
        res.status(500).json({ 
            status: 'Error', 
            message: `Falha ao executar SELECT na tabela '${tableName}'. Verifique se o nome da tabela está correto.`, 
            error: errorMessage 
        });
    }
});

app.get('/pocos', async (req, res) => {
    // ⚠️ ATENÇÃO: SUBSTITUA 'servicos' pelo nome real da sua tabela, se for diferente.
    const tableName = 'pocos'; 
    const query = `SELECT * FROM ${tableName} LIMIT 10`; // Limita a 10 resultados para o teste

    try {
        // Executa o SELECT
        const [rows] = await pool.query(query);

        // Retorna os dados encontrados
        res.status(200).json({ 
            status: 'OK', 
            message: `Dados recuperados da tabela '${tableName}' com sucesso.`,
            data: rows
        });

    } catch (error) {
        console.error(`Erro ao consultar a tabela '${tableName}':`, error);
        
        // O erro mais comum aqui é se a tabela não existir (ER_NO_SUCH_TABLE)
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        
        res.status(500).json({ 
            status: 'Error', 
            message: `Falha ao executar SELECT na tabela '${tableName}'. Verifique se o nome da tabela está correto.`, 
            error: errorMessage 
        });
    }
});


// Rota para criar cliente
app.post('/clientes', async (req, res) => {
  const cliente = req.body;
  try {
    // ajuste os campos e a tabela conforme seu schema
    const [result] = await pool.execute(
      `INSERT INTO clientes (nomeCompleto, tipoPessoa, documento, inscricaoEstadual, dataNascimento, contatos_json, enderecos_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cliente.nomeCompleto,
        cliente.tipoPessoa,
        cliente.documento,
        cliente.inscricaoEstadual,
        cliente.dataNascimento,
        JSON.stringify(cliente.contatos || []),
        JSON.stringify(cliente.enderecos || []),
      ]
    );
    // result contém insertId em mysql
    // @ts-ignore
    const insertId = (result as any).insertId;
    res.status(201).json({ ok: true, id: insertId });
  } catch (err: any) {
    console.error('Erro ao inserir cliente:', err);
    res.status(500).json({ ok: false, error: err.message || 'Erro' });
  }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});