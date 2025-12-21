// backend/src/server.ts

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import pool from './db.config'; // Assume que é um Pool do mysql2/promise

const app = express();
app.use(cors()); 
app.use(express.json());

const PORT = 3001; 

// --- Interfaces (para tipagem) ---
interface InternalProductData {
    id: string; // ID Padrão
    name: string;
    lastCost: number;
    category: string; // Full Name da Categoria
    unitOfMeasure: string; 
}

// --- Funções Auxiliares ---

// Middleware de Tratamento de Erros Assíncronos
// Isso evita que tenhamos que usar try/catch em todas as rotas assíncronas
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

// --- ROTAS BASE ---

app.get('/', (req, res) => {
    res.send('API de Estoque Rodando!');
});

// Rota de Teste de Conexão com o Banco de Dados (Já existente)
app.get('/check-db', asyncHandler(async (req, res) => {
    // Tenta buscar o nome do banco de dados (query simples)
    await pool.execute('SELECT 1'); 
    res.status(200).json({ status: 'OK', message: 'ssssConexão com o Banco de Dados bem-sucedida!' });
}));

// --- ROTAS DE PRODUTOS E CATEGORIAS ---

/**
 * Rota 1: GET /api/products?query=<termo> (Implementa searchProducts)
 * Busca produtos internos por ID, nome ou SKU.
 */
app.get('/api/products', asyncHandler(async (req, res) => {
    const query = req.query.query as string;

    if (!query || query.length < 2) {
        return res.json([]);
    }

    const searchTerm = `%${query}%`;
    const [rows]: any = await pool.execute(
        `
        SELECT 
            p.codigo_interno AS id, 
            p.descricao AS name, 
            c.nome_categoria AS category, 
            p.unidade AS unitOfMeasure
        FROM produtos AS p
        JOIN 
            categorias c ON p.id_categoria = c.id_categoria  
        WHERE 
            p.codigo_interno LIKE ? OR 
            p.descricao LIKE ? OR 
            p.codigo_interno LIKE ?
        ORDER BY p.descricao
        LIMIT 10
        `,
        [searchTerm, searchTerm, searchTerm]
    );
    const products: InternalProductData[] = rows;
    return res.json(products);
}));


// Rota dedicada para o MappingModal (Entrada de NF)
app.get('/api/products/mapping', asyncHandler(async (req, res) => {
    const query = (req.query.query as string || '').trim();
    const searchTerm = `%${query}%`;

    const sql = `
        SELECT 
            p.id_produto AS id, 
            p.codigo_interno AS sku, 
            p.descricao AS name, 
            COALESCE(c.nome_categoria, 'Sem Categoria') AS category, 
            COALESCE(e.quantidade, 0) AS currentStock,
            p.estoque_minimo AS minStock,
            p.preco_venda AS salePrice,
            p.status AS status
        FROM produtos AS p
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria  
        LEFT JOIN estoque_atual e ON p.id_produto = e.id_produto
        WHERE 
            (? = '' OR p.codigo_interno LIKE ? OR p.descricao LIKE ? OR p.codigo_barras LIKE ?)
        ORDER BY 
            CASE 
                WHEN p.codigo_interno LIKE ? THEN 1
                WHEN p.descricao LIKE ? THEN 2
                ELSE 3
            END,
            p.descricao ASC
        LIMIT 50
    `;

    try {
        const [rows]: any = await pool.execute(sql, [
            query, searchTerm, searchTerm, searchTerm, // Filtros
            `${query}%`, `${query}%`                  // Prioridade na ordenação
        ]);
        return res.json(rows);
    } catch (error) {
        console.error('Erro na busca completa:', error);
        return res.status(500).json({ error: 'Erro interno' });
    }
}));

/**
 * Rota 2: GET /api/products/categories (Já existente)
 * Retorna lista de fullNames de categorias.
 */
app.get('/api/products/categories', asyncHandler(async (req, res) => {
    // Assume que a tabela é 'categorias' e a coluna é 'nome_categoria' (fullName)
    const [rows]: any = await pool.execute('SELECT nome_categoria FROM categorias ORDER BY nome_categoria');
    if (!Array.isArray(rows)) return res.json([]);
    const list = rows.map((r: any) => String(r.nome_categoria ?? '').trim()).filter(Boolean);
    return res.json(list);
}));

/**
 * Rota 3: POST /api/products/categories/create (Implementa createNewCategory)
 * Cria um novo nó de categoria no banco de dados.
 */
app.post('/api/products/categories/create', asyncHandler(async (req, res) => {
    const { name, parentId } = req.body; // name é o nó, parentId é o fullName do pai

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'O nome da categoria é obrigatório.' });
    }

    // Constrói o fullName (ex: 'Pai / Filho')
    const fullName = parentId ? `${parentId.trim()} / ${name.trim()}` : name.trim();

    // Verifica se já existe
    const [existing]: any = await pool.execute('SELECT nome_categoria FROM categorias WHERE nome_categoria = ?', [fullName]);
    if (existing.length > 0) {
        return res.status(409).json({ error: `Categoria '${fullName}' já existe.` });
    }
    
    // Insere a nova categoria
    await pool.execute('INSERT INTO categorias (nome_categoria) VALUES (?)', [fullName]);

    // Retorna a nova lista de categorias (opcional, mas útil para atualizar o frontend)
    // Ou retorna apenas um status 201 (Created)
    res.status(201).json({ fullName, message: `Categoria '${fullName}' criada com sucesso.` });
}));


/**
 * Rota 4: POST /api/products/find-or-create (Implementa findOrCreateProduct)
 * Encontra um produto pelo SKU ou cria um novo se não existir.
 * Nota: Seu frontend usa isso no fluxo de criação.
 */
app.post('/api/products/find-or-create', asyncHandler(async (req, res) => {
    const { sku, name, unitCost, category } = req.body;

    if (!sku || !name || !category) {
        return res.status(400).json({ error: 'sku, name e category são campos obrigatórios para criação/busca.' });
    }

    // 1. Tenta buscar pelo SKU (ou ID, dependendo da sua regra de negócio)
    const [existing]: [any, any] = await pool.execute(
        `SELECT id_produto, nome_padrao FROM produtos_internos WHERE sku_interno = ? OR id_produto = ?`, 
        [sku, sku]
    );

    if (existing.length > 0) {
        // Produto encontrado
        return res.json({ action: 'found', id: existing[0].id_produto, name: existing[0].nome_padrao });
    }

    // 2. Produto não encontrado, cria um novo
    const newProductId = sku; // Usa o SKU como o ID Padrão, conforme o seu frontend sugere

    await pool.execute(
        `
        INSERT INTO produtos_internos 
        (id_produto, nome_padrao, sku_interno, ultimo_custo, categoria_nome, unidade_medida)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [newProductId, name, sku, unitCost || 0, category, 'UN'] // 'UN' hardcoded, ajuste conforme necessidade
    );

    res.status(201).json({ action: 'created', id: newProductId, name: name });
}));


/**
 * Rota 5: POST /api/stock/entries (Implementa createStockEntry)
 * Rota para registrar a entrada no estoque (item de NF processado).
 */
app.post('/api/stock/entries', asyncHandler(async (req, res) => {
    const { accessKey, supplier, entryDate, items } = req.body;

    if (!accessKey || !supplier || !entryDate || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Dados da entrada de estoque incompletos.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insere a Cabeçalho da Entrada
        const [entryHeaderResult]: any = await connection.execute(
            'INSERT INTO entradas_estoque (chave_acesso, fornecedor, data_entrada) VALUES (?, ?, ?)',
            [accessKey, supplier, entryDate]
        );
        const entryId = entryHeaderResult.insertId;

        // 2. Insere os Itens da Entrada e Atualiza o Custo
        for (const item of items) {
            await connection.execute(
                `
                INSERT INTO itens_entrada (id_entrada, id_produto, quantidade, custo_unitario, total)
                VALUES (?, ?, ?, ?, ?)
                `,
                [entryId, item.mappedProductId, item.quantityReceived, item.unitCost, item.total]
            );

            // Atualiza o último custo do produto padrão
            await connection.execute(
                `UPDATE produtos_internos SET ultimo_custo = ?, data_ultima_entrada = ? WHERE id_produto = ?`,
                [item.unitCost, entryDate, item.mappedProductId]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Entrada de estoque registrada com sucesso.', entryId });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao registrar entrada de estoque:', error);
        throw new Error('Falha na transação de estoque.');

    } finally {
        connection.release();
    }
}));


// --- Middleware de Tratamento de Erros (Final) ---

// Deve ser o último app.use()
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(`🚨 Erro Global: ${err.message}`, err);

    // Erro de Conexão com o DB (Pode ser capturado por outros middlewares)
    if (err.message.includes('Falha ao conectar')) {
        return res.status(503).json({ 
            error: 'Serviço Indisponível', 
            message: 'O servidor não conseguiu se conectar ao banco de dados.' 
        });
    }

    // Erros HTTP (4xx) podem ser lançados com status específico.
    // Para erros desconhecidos ou internos (transações falhas, etc.), usa 500.
    const statusCode = (res.statusCode === 200 || res.statusCode < 400) ? 500 : res.statusCode;
    res.status(statusCode).json({
        error: 'Erro Interno do Servidor',
        message: err.message,
    });
});

app.get('/api/categories/tree', async (req: Request, res: Response) => {
    // Função para transformar a lista plana em árvore
    const buildCategoryTree = (flatCategories: { id: string; nome: string; parent_id: string | null }[]) => {
        const tree: any[] = [];
        const categoryMap: Record<string, any> = {};
        // 1. Mapeia todos os nós
        flatCategories.forEach(item => {
            categoryMap[item.id] = { id: item.id, name: item.nome, children: [] };
        });
        // 2. Construi a árvore
        flatCategories.forEach(item => {
            if (item.parent_id) {
                const parent = categoryMap[item.parent_id];
                if (parent) {
                    parent.children.push(categoryMap[item.id]);
                }
            } else {
                tree.push(categoryMap[item.id]);
            }
        });
        return tree;
    };

    try {
        // Busca a lista plana do banco de dados
        const [rows]: any = await pool.execute('SELECT id_categoria AS id, nome_categoria AS nome, id_categoria_pai AS parent_id FROM categorias');
        const flatCategories = rows as { id: string; nome: string; parent_id: string | null }[];
        // Converte a lista plana em árvore
        const categoryTree = buildCategoryTree(flatCategories);
        console.log(categoryTree);
        res.json(categoryTree);
    } catch (error) {
        console.error('Erro ao obter árvore de categorias:', error);
        res.status(500).json({ error: 'Erro ao obter árvore de categorias.' });
    }
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});





// Proximo passo é Criar o produto no banco de dados com base nos dados fornecidos pela nota FIscal.