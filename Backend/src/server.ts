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

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});