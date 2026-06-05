import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2/promise'; // 🟢 Importante para tipar o retorno do banco
import pool from '../../Estoque/db.config';
import { ResultSetHeader } from 'mysql2/promise'; // Importação necessária para capturar o insertId

// 1. Criamos uma interface que estende o RowDataPacket com as colunas que o banco vai devolver
interface FornecedorRow extends RowDataPacket {
    id_pessoa: number;
    razao_social: string;
    nome_fantasia: string | null;
}

export async function verificarFornecedor(req: Request, res: Response): Promise<Response> {
    // 2. Tipamos o recebimento da Query String para o TS saber que são strings
    const tenant_id = req.query.tenant_id as string | undefined;
    const cnpj = req.query.cnpj as string | undefined;

    if (!tenant_id || !cnpj) {
        return res.status(400).json({ error: "Parâmetros tenant_id e cnpj são obrigatórios." });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, '');

    try {
        // 3. Passamos a nossa interface <FornecedorRow[]> para o execute saber o que tem dentro de [rows]
        const [rows] = await pool.execute<FornecedorRow[]>(`
            SELECT 
                c.id_pessoa, 
                pj.razao_social, 
                pj.nome_fantasia 
            FROM pessoas_core c
            INNER JOIN pessoas_pj pj ON c.id_pessoa = pj.id_cliente
            WHERE c.tenant_id = ? 
              AND pj.cnpj = ? 
              AND c.deleted_at IS NULL
            LIMIT 1
        `, [Number(tenant_id), cnpjLimpo]);

        if (rows.length > 0) {
            const fornecedorEncontrado = rows[0];

            return res.status(200).json({
                exists: true,
                supplier: {
                    id: fornecedorEncontrado.id_pessoa,
                    name: fornecedorEncontrado.razao_social,       
                    fantasyName: fornecedorEncontrado.nome_fantasia || fornecedorEncontrado.razao_social
                }
            });
        }

        return res.status(200).json({ exists: false });

    } catch (error) {
        console.error("Erro ao checar fornecedor no banco de dados:", error);
        return res.status(500).json({ error: "Erro interno ao consultar fornecedor." });
    }
}


export async function criarFornecedor(req: Request, res: Response): Promise<Response> {
    const { tenant_id, cnpj, nome_razao, nome_fantasia } = req.body;

    // Validação básica
    if (!tenant_id || !cnpj || !nome_razao) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes: tenant_id, cnpj e nome_razao." });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    // Pegamos uma conexão dedicada do pool para gerenciar a transação
    const connection = await pool.getConnection();

    try {
        // Inicia a transação
        await connection.beginTransaction();

        // PASSO 1: Inserir na tabela central (pessoas_core)
        const [coreResult] = await connection.execute<ResultSetHeader>(`
            INSERT INTO pessoas_core (tenant_id, tipo_pessoa, status, created_at)
            VALUES (?, 'PJ', 'ATIVO', NOW())
        `, [Number(tenant_id)]);

        const novoIdPessoa = coreResult.insertId; // Captura o ID gerado automaticamente

        // PASSO 2: Inserir os dados fiscais/específicos na tabela filha (pessoas_pj)
        await connection.execute(`
            INSERT INTO pessoas_pj (id_cliente, razao_social, nome_fantasia, cnpj, tenant_id, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `, [novoIdPessoa, nome_razao, nome_fantasia || nome_razao, cnpjLimpo, Number(tenant_id)]);

        // PASSO 3: Atribuir o papel de FORNECEDOR (ID 2 de acordo com seu dump master)
        const ID_PAPEL_FORNECEDOR = 2;
        await connection.execute(`
            INSERT INTO pessoas_papeis_atribuido (tenant_id, id_cliente, id_cliente_papel, created_at)
            VALUES (?, ?, ?, NOW())
        `, [Number(tenant_id), novoIdPessoa, ID_PAPEL_FORNECEDOR]);

        // Se tudo deu certo até aqui, consolida as alterações no banco
        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Fornecedor cadastrado com sucesso!",
            supplier: {
                id: novoIdPessoa,
                name: nome_razao,
                fantasyName: nome_fantasia || nome_razao
            }
        });

    } catch (error) {
        // Se qualquer um dos passos falhar, desfaz tudo o que foi feito na transação
        await connection.rollback();
        console.error("Erro crítico ao cadastrar fornecedor:", error);
        return res.status(500).json({ error: "Erro interno do servidor ao salvar o fornecedor." });
    } finally {
        // Libera a conexão de volta para o pool
        connection.release();
    }
}