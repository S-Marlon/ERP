// backend/src/server.ts
import express, { Request, Response, NextFunction } from 'express'; // Importado Request e Response
import cors from 'cors';
import pool from './db.config'; // Importa a conexão com o banco (deve ser um Pool do mysql2/promise)

const app = express();
const PORT = 3001; // Porta padrão para APIs, o React rodará em 3000

// =========================================================================
// INTERFACES (Tipos de Dados)
// =========================================================================

/** Tipos de dados de Contato enviados pelo front-end. */
interface ContatoPayload {
    id?: number; // Ignoramos o ID do front-end
    tipo: "Telefone" | "Email";
    valor: string;
    referencia: string; // Mapeia para nome_contato
    principal: boolean; // Mapeia para is_principal
}

/** Tipos de dados de Endereço enviados pelo front-end. */
interface EnderecoPayload {
    id?: number; // Ignoramos o ID do front-end
    cep: string;
    rua: string; // Mapeia para logradouro
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string; // CHAR(2)
    principal: boolean; // Mapeia para is_principal, usado para definir fk_endereco_principal
}

/** Payload completo do Cliente enviado pelo front-end. */
interface ClientePayload {
    nomeCompleto: string; // Mapeia para nome
    tipoPessoa: "PF" | "PJ"; // Mapeia para tipo_cliente
    documento: string; // Mapeia para cpf_cnpj
    inscricaoEstadual: string; // Não usado no DB, mas parte do payload
    dataNascimento: string; // Mapeia para data_nascimento
    contatos: ContatoPayload[];
    enderecos: EnderecoPayload[];
}

// Mapeamento de Tipo de Contato para FK_TIPO_CONTATO no DB
const CONTACT_TYPE_IDS = {
    'Email': 1,
    'Telefone': 2,
};

// Middlewares
app.use(cors()); 
app.use(express.json());

// =========================================================================
// ROTAS DE TESTE (Consulta)
// =========================================================================

// Rota de Teste Simples para verificar se a API está funcionando
app.get('/', (req, res) => {
    res.send('API de Serviços de Poços Rodando!');
});

// Rota de Teste de Conexão com o Banco de Dados
app.get('/check-db', async (req, res) => {
    try {
        // Tenta buscar o nome do banco de dados (query simples)
        // Usamos pool.execute para garantir que estamos usando o modo promises
        await pool.execute('SELECT 1'); 
        res.status(200).json({ status: 'OK', message: 'Conexão com o Banco de Dados bem-sucedida!' });
    } catch (error) {
        console.error('Erro na Conexão com o Banco:', error);
        // Ajuste a resposta de erro para capturar a mensagem corretamente
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido na conexão.';
        res.status(500).json({ status: 'Error', message: 'Falha ao conectar com o Banco de Dados.', error: errorMessage });
    }
});

// Exemplo de Rota de Consulta (Mantido, mas ajustado para usar pool.execute)
app.get('/clientes', async (req, res) => {
    const tableName = 'clientes'; 
    const query = `SELECT * FROM ${tableName} LIMIT 10`; 

    try {
        // Executa o SELECT usando execute, que é preferido em mysql2/promise
        const [rows] = await pool.execute(query);

        // Retorna os dados encontrados
        res.status(200).json({ 
            status: 'OK', 
            message: `Dados recuperados da tabela '${tableName}' com sucesso.`,
            data: rows
        });

    } catch (error) {
        console.error(`Erro ao consultar a tabela '${tableName}':`, error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        
        res.status(500).json({ 
            status: 'Error', 
            message: `Falha ao executar SELECT na tabela '${tableName}'. Verifique se o nome da tabela está correto.`, 
            error: errorMessage 
        });
    }
});

// As rotas /contratos e /pocos são semelhantes e foram omitidas por brevidade,
// mas a correção seria a mesma: trocar pool.query por pool.execute para consistência
// na biblioteca mysql2/promise.

// =========================================================================
// ROTA DE CRIAÇÃO (Transacional)
// =========================================================================

app.post('/clientes', async (req: Request<{}, {}, ClientePayload>, res: Response) => {
    const data = req.body;
    // Tipo para o resultado do execute do MySQL (mysql2/promise)
    type ResultSetHeader = { insertId: number | bigint }; 
    
    // ⚠️ ATENÇÃO: Em uma aplicação real, o ID do usuário viria de um token JWT ou sessão.
    const FK_CRIADO_POR = 1;

    // 1. Validação mínima do payload
    if (!data.nomeCompleto || !data.documento || data.enderecos.length === 0) {
        return res.status(400).json({ error: 'Dados obrigatórios (Nome, Documento e Endereço) ausentes.' });
    }

    // Identificar o endereço principal
    const enderecoPrincipalPayload = data.enderecos.find(e => e.principal);
    if (!enderecoPrincipalPayload) {
        return res.status(400).json({ error: 'Nenhum endereço principal foi marcado.' });
    }

    // ---------------------------------------------
    // INÍCIO DA TRANSAÇÃO
    // ---------------------------------------------
    let connection;
    try {
        // Obter uma conexão do pool
        connection = await pool.getConnection(); 
        // Iniciar a transação
        await connection.beginTransaction(); 

        let clienteId: number | bigint = 0; // Usando number | bigint para ser flexível
        let enderecoPrincipalId: number | bigint = 0;

        const insertedAddresses: { payload: EnderecoPayload, id: number | bigint }[] = [];

        // ---------------------------------------------
        // A. INSERIR ENDEREÇOS (COM FK_CLIENTE TEMPORÁRIO)
        // ---------------------------------------------
        for (const endereco of data.enderecos) {
            // Placeholder do MySQL é '?'
            const sqlEndereco = `
                INSERT INTO enderecos_cliente (
                    fk_cliente, tipo_endereco, cep, logradouro, numero, complemento, bairro, cidade, estado, is_principal
                ) VALUES (
                    NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?
                );
            `;
            const paramsEndereco = [
                endereco.principal ? 'Principal' : 'Secundário', // Tipo_endereco
                endereco.cep.replace(/\D/g, ''), // Limpeza do CEP
                endereco.rua, // logradouro
                endereco.numero,
                endereco.complemento || null,
                endereco.bairro,
                endereco.cidade,
                endereco.estado,
                endereco.principal
            ];

            // Usa connection.execute (retorna [ResultSetHeader, ...])
            const [result] = await connection.execute(sqlEndereco, paramsEndereco);
            // Captura o ID gerado (insertId)
            const id = (result as ResultSetHeader).insertId; 
            insertedAddresses.push({ payload: endereco, id });

            // Se for o principal, guardamos o ID gerado
            if (endereco.principal) {
                enderecoPrincipalId = id;
            }
        }

        // ---------------------------------------------
        // B. INSERIR O CLIENTE
        // ---------------------------------------------
        const sqlCliente = `
            INSERT INTO clientes (
                nome, cpf_cnpj, tipo_cliente, data_nascimento, fk_endereco_principal, fk_criado_por
            ) VALUES (
                ?, ?, ?, ?, ?, ?
            );
        `;
        
        const nomeCliente = data.nomeCompleto;
        const cpfCnpj = data.documento.replace(/\D/g, ''); // Limpeza do documento
        // Converte string vazia para NULL se for PJ
        const dataNascimento = (data.tipoPessoa === 'PF' && data.dataNascimento) ? data.dataNascimento : null;

        const paramsCliente = [
            nomeCliente,
            cpfCnpj,
            data.tipoPessoa,
            dataNascimento,
            enderecoPrincipalId, // ID do endereço principal inserido
            FK_CRIADO_POR
        ];

        const [resultCliente] = await connection.execute(sqlCliente, paramsCliente);
        clienteId = (resultCliente as ResultSetHeader).insertId;

        // ---------------------------------------------
        // C. VINCULAR O CLIENTE AOS ENDEREÇOS INSERIDOS
        // ---------------------------------------------
        // Esta é a parte mais crítica. É necessário atualizar a FK nos endereços criados.
        // Como o MySQL não suporta array de IDs diretamente no IN, faremos um WHERE IN
        // ou, para simplicidade no código, apenas um UPDATE por endereço.
        
        // **OPÇÃO MAIS SIMPLES E SEGURA (para o escopo desta correção):**
        // Iteramos sobre todos os endereços inseridos para vincular o cliente.
        for (const { id } of insertedAddresses) {
            const sqlUpdate = `UPDATE enderecos_cliente SET fk_cliente = ? WHERE id_endereco = ?;`;
            await connection.execute(sqlUpdate, [clienteId, id]);
        }


        // ---------------------------------------------
        // D. INSERIR CONTATOS
        // ---------------------------------------------
        for (const contato of data.contatos) {
            const fkTipoContato = CONTACT_TYPE_IDS[contato.tipo];

            if (!fkTipoContato) {
                console.warn(`Tipo de contato desconhecido: ${contato.tipo}. Pulando.`);
                continue; 
            }

            const sqlContato = `
    INSERT INTO contatos (
        fk_cliente, fk_tipo_contato, valor, nome_contato 
    ) VALUES (
        ?, ?, ?, ? 
    );
`;
            const paramsContato = [
                clienteId,
                fkTipoContato,
                contato.valor,
                contato.referencia || null,
                // contato.principal
            ];
            await connection.execute(sqlContato, paramsContato);
        }

        // Commit da transação se tudo correu bem
        await connection.commit(); 

        return res.status(201).json({ 
            message: 'Cliente cadastrado com sucesso!', 
            id: clienteId,
            enderecoPrincipalId: enderecoPrincipalId
        });

    } catch (error) {
        // ---------------------------------------------
        // TRATAMENTO DE ERRO
        // ---------------------------------------------
        if (connection) {
            console.error('Erro na transação. Executando ROLLBACK.');
            await connection.rollback(); // Rollback em caso de erro
        }
        console.error('Erro ao processar o cadastro do cliente:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';

        return res.status(500).json({ 
            error: 'Falha no servidor ao cadastrar cliente. A transação foi desfeita.',
            details: errorMessage
        });
    } finally {
        // ---------------------------------------------
        // LIBERAR CONEXÃO
        // ---------------------------------------------
        if (connection) {
            connection.release(); // Sempre libera a conexão para o pool
        }
    }
});

app.get('/clientes/search', async (req: Request, res: Response) => {
    // Captura os parâmetros de busca
    const { query, searchKey, typeFilter } = req.query;

    if (!query && typeFilter === 'AMBOS') {
        // Se não houver filtro, retorna a lista completa (ou com limite)
        return res.status(400).json({ status: 'Error', message: 'É necessário informar um termo de busca ou um filtro de tipo de cliente diferente de AMBOS.' });
    }

    let sqlBase = `
        SELECT 
            c.id_cliente, c.nome, c.cpf_cnpj, c.tipo_cliente, c.data_nascimento,
            c.fk_endereco_principal, ec.cep, ec.logradouro, ec.cidade, ec.estado,
            (SELECT COUNT(*) FROM contratos WHERE fk_cliente = c.id_cliente) AS num_contratos
        FROM clientes c
        LEFT JOIN enderecos_cliente ec ON c.fk_endereco_principal = ec.id_endereco
    `;
    
    let whereClauses: string[] = [];
    let params: (string | number)[] = [];

    // 1. Filtro por Tipo (PF ou PJ)
    if (typeFilter && typeFilter !== 'AMBOS') {
        whereClauses.push(`c.tipo_cliente = ?`);
        params.push(String(typeFilter));
    }

    // 2. Filtro por Termo de Busca (nome, documento, etc.)
    if (query && searchKey) {
        const term = `%${String(query).replace(/\D/g, '')}%`; // Limpa para documentos
        const likeTerm = `%${String(query)}%`;

        switch (searchKey) {
            case 'nome':
                whereClauses.push(`c.nome LIKE ?`);
                params.push(likeTerm);
                break;
            case 'documento':
                whereClauses.push(`c.cpf_cnpj LIKE ?`);
                params.push(term);
                break;
            case 'cep':
                whereClauses.push(`ec.cep LIKE ?`);
                params.push(term);
                break;
            // Para 'email' e 'telefone', precisaríamos de um JOIN com a tabela 'contatos'
            // Omitido aqui por brevidade e complexidade de JOIN.
            default:
                // Se a chave não for suportada na API, apenas ignora o filtro de query
                break;
        }
    }
    
    // Constrói a query final
    if (whereClauses.length > 0) {
        sqlBase += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    sqlBase += ' LIMIT 50;'; // Limita resultados para performance

    try {
        const [rows] = await pool.execute(sqlBase, params);

        res.status(200).json({
            status: 'OK',
            message: 'Clientes encontrados.',
            data: rows
        });

    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).json({ 
            status: 'Error', 
            message: 'Falha ao executar a busca no banco de dados.'
        });
    }
});


app.get('/contratos/search', async (req: Request, res: Response) => {
    // 🚨 Captura o typeFilter
    const { query, searchKey, typeFilter } = req.query; 

    if (!query && typeFilter === 'TODOS') {
        return res.status(400).json({ status: 'Error', message: 'É necessário informar um termo de busca ou um filtro de tipo diferente de TODOS.' });
    }

    let sqlBase = `
        SELECT 
            co.id_contrato, co.fk_cliente, co.codigo_contrato, co.data_inicio, 
            co.descricao, co.valor_total, co.data_termino,
            c.nome AS nome_cliente,
            
            -- SIMULAÇÃO DO STATUS (Mantida)
            CASE
                WHEN co.data_termino < CURDATE() THEN 'Concluido'
                WHEN co.data_inicio > CURDATE() THEN 'Pendente'
                ELSE 'Ativo'
            END AS status,
            
            -- 🚨 SIMULAÇÃO DO TIPO (NOVO CAMPO)
            -- Simula o tipo baseado no ID do contrato (Ex: ímpar=Serviço, par=Obra, múltiplo de 3=Fornecimento)
            CASE
                WHEN co.id_contrato % 3 = 0 THEN 'Serviço'
                WHEN co.id_contrato % 3 = 1 THEN 'Obra'
                ELSE 'Fornecimento'
            END AS tipo

        FROM contratos co
        JOIN clientes c ON co.fk_cliente = c.id_cliente
    `;
    
    let whereClauses: string[] = [];
    let params: (string | number)[] = [];

    // 1. 🚨 FILTRO POR TIPO DE CONTRATO
    if (typeFilter && typeFilter !== 'TODOS') {
        // Para filtrar na simulação, repetimos a lógica CASE WHEN dentro da cláusula WHERE
        const typeFilterString = String(typeFilter);
        
        // Esta abordagem é complexa. O ideal seria uma coluna 'tipo' no DB.
        // Usaremos uma cláusula WHERE que se baseia na nossa simulação:
        let typeCondition = '';
        if (typeFilterString === 'Serviço') {
            typeCondition = 'co.id_contrato % 3 = 0';
        } else if (typeFilterString === 'Obra') {
            typeCondition = 'co.id_contrato % 3 = 1';
        } else if (typeFilterString === 'Fornecimento') {
            typeCondition = 'co.id_contrato % 3 <> 0 AND co.id_contrato % 3 <> 1';
        }

        if (typeCondition) {
            whereClauses.push(typeCondition);
        }
    }


    // 2. Filtro por Termo de Busca e Chave (Mantido)
    if (query && searchKey) {
        const likeTerm = `%${String(query)}%`;
        const numericQuery = parseInt(String(query).replace(/\D/g, ''), 10);

        switch (searchKey) {
            case 'codigo_contrato':
                whereClauses.push(`co.codigo_contrato LIKE ?`);
                params.push(likeTerm);
                break;
            case 'descricao':
                whereClauses.push(`co.descricao LIKE ?`);
                params.push(likeTerm);
                break;
            case 'fk_cliente':
                if (!isNaN(numericQuery) && numericQuery > 0) {
                    whereClauses.push(`co.fk_cliente = ?`);
                    params.push(numericQuery);
                } else {
                    return res.status(400).json({ status: 'Error', message: 'ID de Cliente inválido.' });
                }
                break;
        }
    }
    
    // Constrói a query final
    if (whereClauses.length > 0) {
        sqlBase += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    sqlBase += ' LIMIT 50;'; 

    try {
        const [rows] = await pool.execute(sqlBase, params);

        res.status(200).json({
            status: 'OK',
            message: 'Contratos encontrados.',
            data: rows
        });

    } catch (error) {
        console.error('Erro ao buscar contratos:', error);
        res.status(500).json({ 
            status: 'Error', 
            message: 'Falha ao executar a busca de contratos no banco de dados.',
            details: (error instanceof Error ? error.message : 'Erro desconhecido.')
        });
    }
});

app.get('/pocos/search', async (req: Request, res: Response) => {
    const { query, searchKey, typeFilter } = req.query;

    if (!query && typeFilter === 'TODOS') {
        return res.status(400).json({ status: 'Error', message: 'É necessário informar um termo de busca ou um filtro de uso diferente de TODOS.' });
    }

    // Corrigido: Usando CONCAT() para concatenação e removendo os comentários
    let sqlBase = `
        SELECT 
            p.id_poco, p.fk_cliente, p.fk_contrato, p.profundidade_atual, 
            c.nome AS nome_cliente,
            
            -- CAMPOS SIMULADOS PARA ATENDER O FRONTEND:
            CONCAT('P-', p.id_poco) AS codigo, 
            CONCAT('Localizacao N/D (ID ', p.fk_local, ')') AS localizacao,
            15.5 AS vazao_max, -- Valor fixo temporário
            'Industrial' AS uso, -- Valor fixo temporário
            'Operacional' AS status -- Valor fixo temporário

        FROM pocos p
        JOIN clientes c ON p.fk_cliente = c.id_cliente
    `;
    
    let whereClauses: string[] = [];
    let params: (string | number)[] = [];

    const queryValue = String(query).replace(/\D/g, ''); 
    const numericQuery = parseInt(queryValue, 10);

    // ... (Filtro por Tipo de Uso — Mantido, mas inativo sem a tabela 'uso')

    // 2. Filtro por Termo de Busca e Chave
    if (query && searchKey && !isNaN(numericQuery) && numericQuery > 0) {
        switch (searchKey) {
            case 'fk_contrato':
                whereClauses.push(`p.fk_contrato = ?`);
                params.push(numericQuery);
                break;
            case 'fk_cliente':
                whereClauses.push(`p.fk_cliente = ?`);
                params.push(numericQuery);
                break;
            default:
                whereClauses.push(`p.fk_contrato = ?`);
                params.push(numericQuery);
                break;
        }
    } else if (query) {
        return res.status(400).json({ status: 'Error', message: `O filtro '${searchKey}' requer um valor numérico para busca.` });
    }
    
    // Constrói a query final
    if (whereClauses.length > 0) {
        sqlBase += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    sqlBase += ' LIMIT 50;'; 

    try {
        const [rows] = await pool.execute(sqlBase, params);

        res.status(200).json({
            status: 'OK',
            message: 'Poços encontrados.',
            data: rows
        });

    } catch (error) {
        console.error('Erro ao buscar poços:', error);
        res.status(500).json({ 
            status: 'Error', 
            message: 'Falha ao executar a busca de poços no banco de dados.',
            details: (error instanceof Error ? error.message : 'Erro desconhecido.')
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});