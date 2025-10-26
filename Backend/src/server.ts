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


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});



// -- Variável para armazenar o ID do usuário que está fazendo a ação (Assumimos que '1' já existe)
// SET @USUARIO_CRIADOR_ID = 1; 

// -- 1. INSERIR O ENDEREÇO PRINCIPAL
// -- O SGBD gerará o ID do endereço (id_endereco).
// INSERT INTO enderecos_cliente (
//     fk_cliente, -- O valor será NULL ou um placeholder temporário se o SGBD permitir
//                 -- Visto que a coluna é NOT NULL, precisaremos de um valor temporário, 
//                 -- ou usar a abordagem 1.B (abaixo)
//     tipo_endereco,
//     cep,
//     logradouro,
//     numero,
//     complemento,
//     bairro,
//     cidade,
//     estado,
//     is_principal
// ) VALUES (
//     0, -- VALOR TEMPORÁRIO, será atualizado no passo 3
//     'Residencial',
//     '12345-000',
//     'Rua das Águas Claras',
//     '456',
//     'Apto 101',
//     'Centro',
//     'São Paulo',
//     'SP',
//     TRUE
// );

// -- Captura o ID do endereço que acabou de ser criado (depende do SGBD)
// SET @ENDERECO_PRINCIPAL_ID = LAST_INSERT_ID();


// -- 2. INSERIR O CLIENTE, REFERENCIANDO O ENDEREÇO E O USUÁRIO CRIADOR
// -- O SGBD gerará o ID do cliente (id_cliente).
// INSERT INTO clientes (
//     nome,
//     cpf_cnpj,
//     tipo_cliente,
//     data_nascimento,
//     fk_endereco_principal, -- Referencia o ID do endereço criado no passo 1
//     fk_criado_por
// ) VALUES (
//     'João da Silva e Filhos Ltda.',
//     '12.345.678/0001-90',
//     'PJ',
//     NULL, -- Pessoa Jurídica não tem data de nascimento
//     @ENDERECO_PRINCIPAL_ID,
//     @USUARIO_CRIADOR_ID
// );

// -- Captura o ID do cliente que acabou de ser criado (depende do SGBD)
// SET @CLIENTE_ID = LAST_INSERT_ID();


// -- 3. AJUSTAR A FK DO ENDEREÇO PRINCIPAL (Passo de Integridade Crítico)
// -- Atualiza a FK na tabela 'enderecos_cliente' para referenciar o ID do cliente que acabamos de criar.
// -- Isso é necessário porque `fk_cliente` em `enderecos_cliente` é NOT NULL, mas não 
// -- conhecíamos o `id_cliente` no Passo 1.
// UPDATE enderecos_cliente
// SET fk_cliente = @CLIENTE_ID
// WHERE id_endereco = @ENDERECO_PRINCIPAL_ID;


// -- 4. INSERIR UM CONTATO PRINCIPAL (Opcional, mas recomendado)
// INSERT INTO contatos (
//     fk_cliente,
//     fk_tipo_contato, -- Assumindo que '1' é o ID para 'Email' (Você deve buscar isso na look-up table)
//     valor,
//     nome_contato,
//     is_principal
// ) VALUES (
//     @CLIENTE_ID,
//     1, 
//     'contato@joaosilva.com.br',
//     'E-mail Principal',
//     TRUE
// );

// -- FIM DA TRANSAÇÃO (Idealmente, tudo isso estaria dentro de uma TRANSAÇÃO)
// COMMIT;

// SELECT 'Cliente e Endereço inseridos com sucesso!';