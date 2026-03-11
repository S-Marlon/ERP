// backend/src/server.ts

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import pool from './db.config'; // Assume que é um Pool do mysql2/promise
import { ResultSetHeader } from 'mysql2';
import crypto from 'crypto';

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


function gerarHashCNPJ(cnpj: string): string {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    return crypto
        .createHash('sha256')
        .update(cnpjLimpo)
        .digest('hex')
        .substring(0, 4)
        .toUpperCase(); // Garante o hash em MAIÚSCULO (ex: A1B2)
}

// --- ROTAS DE PRODUTOS E CATEGORIAS ---

/**
 * Rota 1: GET /api/products?query=<termo> (Implementa searchProducts)
 * Busca produtos internos por ID, nome ou SKU.
 */
app.get('/api/products', asyncHandler(async (req, res) => {
    const query = req.query.query as string;
    const isSearchEmpty = !query || query.trim() === '';
    const searchTerm = isSearchEmpty ? '%' : `%${query}%`;

    const [rows]: any = await pool.execute(
    `
    SELECT 
        p.id_produto AS id, 
        p.codigo_interno AS sku, 
        p.codigo_barras AS barcode,
        p.descricao AS name, 
        p.status,
        p.unidade AS unitOfMeasure,
        p.ncm,
        p.cest,
        
        -- Categorização e Marca
        c.nome_categoria AS category, 
        m.nome_marca AS brand,

        -- Precificação e Rentabilidade
        p.preco_venda AS salePrice,
        p.metodo_precificacao AS priceMethod,
        p.markup_praticado AS markup,
        COALESCE(e.valor_medio, 0) AS costPrice,
        
        -- Estoque com Alerta
        COALESCE(e.quantidade, 0) AS currentStock,
        p.estoque_minimo AS minStock,

        -- Dimensões e informações para e‑commerce
        p.peso AS weight,
        p.comprimento AS length,
        p.altura AS height,
        p.largura AS width,
        p.seo_title AS seoTitle,
        p.description_html AS descriptionHtml,
        p.sync_ecommerce AS syncEcommerce,
        p.imagem_url AS pictureUrl,

        -- Relacionamento com Fornecedores
        -- ATENÇÃO: A vírgula foi removida daqui vvv
        GROUP_CONCAT(DISTINCT f.nome_fantasia SEPARATOR ', ') AS suppliers
        
    FROM produtos AS p
    LEFT JOIN marcas m ON p.id_marca = m.id_marca
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria  
    LEFT JOIN estoque_atual e ON p.id_produto = e.id_produto
    LEFT JOIN produto_fornecedor pf ON p.id_produto = pf.id_produto
    LEFT JOIN fornecedores f ON pf.id_fornecedor = f.id_fornecedor
    WHERE 
        (? = '%' 
         OR p.codigo_interno LIKE ? 
         OR p.codigo_barras LIKE ? 
         OR p.descricao LIKE ? 
         OR pf.sku_fornecedor LIKE ?)
    GROUP BY p.id_produto
    ORDER BY p.descricao ASC
    LIMIT 100
    `,
    [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
);

    // Opcional: Tratamento de dados antes de enviar ao front
    const formattedRows = rows.map((row: any) => ({
    ...row,
    isStockLow: row.currentStock <= row.minStock,
    suppliersList: row.suppliers ? row.suppliers.split(', ') : []
}));

    return res.json(formattedRows);
}));

// Rota dedicada para o MappingModal (Entrada de NF)
// app.get('/api/products/mapping', asyncHandler(async (req, res) => {
//     const query = (req.query.query as string || '').trim();
//     const searchTerm = `%${query}%`;

//     const sql = `
//         SELECT 
//             p.id_produto AS id, 
//             p.codigo_interno AS sku, 
//             p.descricao AS name, 
//             COALESCE(c.nome_categoria, 'Sem Categoria') AS category, 
//             COALESCE(e.quantidade, 0) AS currentStock,
//             p.estoque_minimo AS minStock,
//             p.preco_venda AS salePrice,
//             p.status AS status
//         FROM produtos AS p
//         LEFT JOIN categorias c ON p.id_categoria = c.id_categoria  
//         LEFT JOIN estoque_atual e ON p.id_produto = e.id_produto
//         WHERE 
//             (? = '' OR p.codigo_interno LIKE ? OR p.descricao LIKE ? OR p.codigo_barras LIKE ?)
//         ORDER BY 
//             CASE 
//                 WHEN p.codigo_interno LIKE ? THEN 1
//                 WHEN p.descricao LIKE ? THEN 2
//                 ELSE 3
//             END,
//             p.descricao ASC
//         LIMIT 50
//     `;

//     try {
//         const [rows]: any = await pool.execute(sql, [
//             query, searchTerm, searchTerm, searchTerm, // Filtros
//             `${query}%`, `${query}%`                  // Prioridade na ordenação
//         ]);
//         return res.json(rows);
//     } catch (error) {
//         console.error('Erro na busca completa:', error);
//         return res.status(500).json({ error: 'Erro interno' });
//     }
// }));

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
 * Rota 4: POST /api/products/createNewProduct (Implementa createNewProduct)
 * Encontra um produto pelo SKU ou cria um novo se não existir.
 * Nota: Seu frontend usa isso no fluxo de criação.
 */
app.post('/api/products/createNewProduct', asyncHandler(async (req, res) => {
    const { 
        codigo_interno, 
        descricao, 
        unidade, 
        preco_venda, 
        id_categoria, 
        codigo_barras,
        // ecommerce/logistics extras
        weight,
        length,
        height,
        width,
        seoTitle,
        descriptionHtml,
        syncEcommerce,
        pictureUrl
    } = req.body;

    // 1. Validação de campos obrigatórios
    // Se o EAN for o código interno, garantimos que pelo menos um dos dois chegou
    const skuFinal = codigo_interno || codigo_barras;

    // --- NOVA VERIFICAÇÃO DE EXISTÊNCIA ---
    const [existing]: any = await pool.execute(
        `SELECT id_produto FROM produtos WHERE codigo_interno = ? OR (codigo_barras IS NOT NULL AND codigo_barras = ?)`,
        [skuFinal, codigo_barras || '---'] 
    );

    if (existing.length > 0) {
        return res.status(409).json({ 
            message: "Erro: Já existe um produto com este SKU ou Código de Barras.",
            id_conflito: existing[0].id_produto 
        });
    }
    // ---------------------------------------

    if (!skuFinal || !descricao) {
        return res.status(400).send("Identificador do produto (SKU/EAN) e Descrição são obrigatórios.");
    }

    // 2. Sanitização para o Banco de Dados
    // Se a string vier vazia do front, convertemos explicitamente para null
    // Isso evita erro de duplicidade (ER_DUP_ENTRY) em campos UNIQUE
    const barrasTratado = codigo_barras?.trim() === "" ? null : codigo_barras;
    const skuTratado = skuFinal?.trim() === "" ? null : skuFinal;
    const categoriaTratada = id_categoria || null;

    // optional ecommerce/logistics columns may exist in table
    const sql = `
        INSERT INTO produtos (
            codigo_interno, 
            codigo_barras, 
            descricao, 
            unidade, 
            preco_venda, 
            preco_venda_manual,
            metodo_precificacao,
            id_categoria, 
            status,
            peso, comprimento, altura, largura,
            seo_title, description_html, sync_ecommerce, picture_url
        ) VALUES (?, ?, ?, ?, ?, ?, 'MANUAL', ?, 'Ativo', ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        const [result]: any = await pool.execute(sql, [
            skuTratado,
            barrasTratado,
            descricao.toUpperCase(), // Padroniza descrição em maiúsculas
            unidade || 'UN',
            preco_venda || 0,
            preco_venda || 0,
            categoriaTratada,
            weight ?? null,
            length ?? null,
            height ?? null,
            width ?? null,
            seoTitle ?? null,
            descriptionHtml ?? null,
            syncEcommerce ? 1 : 0,
            pictureUrl ?? null
        ]);

        // Opcional: Se você quiser que todo produto novo já apareça na tabela de estoque atual com zero
        await pool.execute(
            `INSERT INTO estoque_atual (id_produto, quantidade, valor_medio) VALUES (?, 0, 0)`,
            [result.insertId]
        );

        // fetch and return full record to frontend for consistency
        const [newRows]: any = await pool.execute(`
          SELECT 
              p.id_produto AS id, 
              p.codigo_interno AS sku, 
              p.codigo_barras AS barcode,
              p.descricao AS name, 
              p.status,
              p.unidade AS unitOfMeasure,
              p.ncm,
              p.cest,
              p.peso AS weight,
              p.comprimento AS length,
              p.altura AS height,
              p.largura AS width,
              p.seo_title AS seoTitle,
              p.description_html AS descriptionHtml,
              p.sync_ecommerce AS syncEcommerce,
              p.imagem_url AS pictureUrl,
              c.nome_categoria AS category, 
              m.nome_marca AS brand,
              p.preco_venda AS salePrice,
              p.metodo_precificacao AS priceMethod,
              p.markup_praticado AS markup,
              COALESCE(e.valor_medio, 0) AS costPrice,
              COALESCE(e.quantidade, 0) AS currentStock,
              p.estoque_minimo AS minStock,
              GROUP_CONCAT(DISTINCT f.nome_fantasia SEPARATOR ', ') AS suppliers
          FROM produtos AS p
          LEFT JOIN marcas m ON p.id_marca = m.id_marca
          LEFT JOIN categorias c ON p.id_categoria = c.id_categoria  
          LEFT JOIN estoque_atual e ON p.id_produto = e.id_produto
          LEFT JOIN produto_fornecedor pf ON p.id_produto = pf.id_produto
          LEFT JOIN fornecedores f ON pf.id_fornecedor = f.id_fornecedor
          WHERE p.id_produto = ?
          GROUP BY p.id_produto
        `, [result.insertId]);

        res.status(201).json(newRows[0] || { 
            id: result.insertId, 
            sku: skuTratado,
            message: "Produto criado com sucesso e inicializado no estoque!" 
        });

    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).send(`Erro: O código '${skuTratado}' já está em uso por outro produto.`);
        } else {
            console.error("Erro ao inserir produto:", error);
            res.status(500).send("Erro interno ao salvar produto.");
        }
    }
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
        // console.log(categoryTree);
        res.json(categoryTree);
    } catch (error) {
        console.error('Erro ao obter árvore de categorias:', error);
        res.status(500).json({ error: 'Erro ao obter árvore de categorias.' });
    }
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});



// lembrar de : se houver mapped.CodInterno registrado no sistema, deve ser realizado um update (vinculo) ao invés de insert 
// ou seja produto já existe na tabela produtos, e será criado apenas o vínculo na tabela produto_fornecedor vinculado ao id_produto existente

app.post('/api/products/map', asyncHandler(async (req, res) => {
    console.log("Body recebido:", req.body);

    const { original, mapped, supplierCnpj } = req.body;

    if (!mapped) {
        return res.status(400).json({ error: "Propriedade 'mapped' ausente." });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Localizar o Fornecedor
        const [forns]: any = await connection.execute(
            "SELECT id_fornecedor FROM fornecedores WHERE cnpj = ? LIMIT 1",
            [supplierCnpj]
        );

        if (forns.length === 0) {
            return res.status(400).json({ error: `Fornecedor não encontrado.` });
        }
        const idFornecedor = forns[0].id_fornecedor;

        // 2. Lógica de Existência do Produto (Vínculo ou Criação)
        let idProduto: number;
        const normalizedGtin = (mapped.gtin && mapped.gtin.trim() !== "" && mapped.gtin !== "SEM GTIN") ? mapped.gtin : null;

        // Inicializamos como array vazio para o TS não reclamar no "existingProd.length"
        let existingProd: any[] = [];

        if (mapped.CodInterno) {
            // Aqui fazemos o cast para <any[]> para evitar o erro de 'QueryResult'
            const [rows] = await connection.execute<any[]>(
                "SELECT id_produto FROM produtos WHERE codigo_interno = ? LIMIT 1",
                [mapped.CodInterno]
            );
            existingProd = rows;
        }

        if (existingProd.length > 0) {
            // PRODUTO JÁ EXISTE
            idProduto = existingProd[0].id_produto;
            console.log(`Produto encontrado (ID: ${idProduto}). Realizando apenas vínculo.`);
        } else {
            // PRODUTO NÃO EXISTE: INSERT
            const [newProd] = await connection.execute<ResultSetHeader>(
                `INSERT INTO produtos 
        (codigo_interno, codigo_barras, ncm, cest, descricao, tipo_produto, unidade, estoque_minimo, preco_venda, status, id_marca, exige_gtin, id_categoria) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    mapped.CodInterno || original.sku,
                    normalizedGtin,
                    mapped.ncm || null,
                    mapped.cest || null,
                    mapped.name || null,
                    'COMERCIAL',
                    mapped.individualUnit || 'UN',
                    0,
                    mapped.Preço_Final_de_Venda || 0,
                    'Ativo',
                    null,
                    0,
                    parseInt(mapped.Categorias) || null
                ]
            );
            idProduto = newProd.insertId;
        }

        // 3. Inserir no Produto-Fornecedor (O Vínculo)
        const normalizedEan = (original.gtin && original.gtin.trim() !== "" && original.gtin !== "SEM GTIN") ? original.gtin : null;

        // DICA: Usar 'INSERT IGNORE' ou 'ON DUPLICATE KEY UPDATE' aqui evita erros se o vínculo já existir
        await connection.execute(
            `INSERT INTO produto_fornecedor 
            (id_produto, id_fornecedor, sku_fornecedor, ean_fornecedor, descricao_fornecedor, fator_conversao, ultimo_custo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE ultimo_custo = VALUES(ultimo_custo)`, // Atualiza o custo se o vínculo já existir
            [
                idProduto,
                idFornecedor,
                mapped.sku || null,
                normalizedEan,
                original.descricao || null,
                mapped.unitsPerPackage || 1.000,
                original.valorUnitario || 0.0000
            ]
        );

        await connection.commit();
        res.json({ success: true, id_produto: idProduto });

    } catch (error: any) {
        await connection.rollback();
        console.error("ERRO NO SQL:", error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
}));













app.post('/api/products/check-mappings', asyncHandler(async (req, res) => {
    const { supplierCnpj, skus } = req.body;

    console.log('\n=== CHECK MAPPINGS INICIADO ===');
    console.log('CNPJ recebido:', supplierCnpj);
    console.log('SKUs recebidos (brutos):', skus);

    if (!skus || skus.length === 0) {
        console.log('❌ SKUs vazios, retornando array vazio');
        return res.json([]);
    }

    // 1. Gera o hash único para este fornecedor
    const cnpjHash = gerarHashCNPJ(supplierCnpj);
    console.log('CNPJ Hash gerado:', cnpjHash);

    // 2. Transforma '123' ou '123/abc' em '123/hash'
    const formattedSkus = skus.map((sku: string) => {
        const prefixo = sku.split('/')[0]; // Pega só o que vem antes de qualquer barra
        const formatted = `${prefixo}/${cnpjHash}`;
        console.log(`  SKU "${sku}" -> Formatado: "${formatted}"`);
        return formatted;
    });

    const placeholders = formattedSkus.map(() => '?').join(',');
    const query = `
        SELECT pf.sku_fornecedor, p.id_produto, p.codigo_interno, p.descricao, p.unidade, c.nome_categoria
        FROM produto_fornecedor pf
        JOIN produtos p ON pf.id_produto = p.id_produto
        JOIN fornecedores f ON pf.id_fornecedor = f.id_fornecedor
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE f.cnpj = ? AND pf.sku_fornecedor IN (${placeholders})
    `;

    const [mappings]: any = await pool.execute(query, [supplierCnpj, ...formattedSkus]);



    res.json(mappings);
}));

// Endpoint: Verifica se fornecedor existe pelo CNPJ
app.post('/api/suppliers/check', asyncHandler(async (req, res) => {
    const { cnpj } = req.body;
    if (!cnpj) return res.status(400).json({ error: 'CNPJ é obrigatório' });

    const [rows]: any = await pool.execute(
        "SELECT id_fornecedor, razao_social FROM fornecedores WHERE cnpj = ? LIMIT 1",
        [cnpj]
    );

    if (rows.length === 0) return res.json({ exists: false });

    const f = rows[0];
    // Mapeia razao_social para 'name' na resposta para consistência com o frontend
    res.json({ exists: true, supplier: { id: f.id_fornecedor, name: f.razao_social } });
}));

// Endpoint: Cria um fornecedor
app.post('/api/suppliers', asyncHandler(async (req, res) => {
    const { cnpj, name, nomeFantasia, siglaGerada } = req.body;
    if (!cnpj || !name) return res.status(400).json({ error: 'CNPJ e nome são obrigatórios' });

    try {
        const [result]: any = await pool.execute(
            'INSERT INTO fornecedores (cnpj, razao_social, nome_fantasia, sigla) VALUES (?, ?, ?, ?)',
            [cnpj, name, nomeFantasia || null, siglaGerada || null]
        );
        const insertId = result.insertId;
        res.status(201).json({ id: insertId, cnpj, name });
    } catch (err: any) {
        // Duplicate / constraint handling
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Fornecedor já existe' });
        }
        throw err;
    }
}));


app.post('/api/suppliers/get-sigla', asyncHandler(async (req, res) => {
    const { cnpj } = req.body; // Vem do front como '71.636.179/0001-16'

    // Busca direta sem manipulação de string
    const [rows]: any = await pool.execute(
        'SELECT sigla FROM fornecedores WHERE cnpj = ?',
        [cnpj]
    );

    if (rows.length === 0) {
        return res.status(404).json({ sigla: "", error: "Não encontrado" });
    }

    res.json({ sigla: rows[0].sigla });
}));

/**
 * POST /api/stock-entry
 * Consolida a entrada de NF no banco de dados usando as tabelas compras_notas e compras_itens
 * Cria registros em: compras_notas, compras_itens, estoque_movimentos, e atualiza estoque_atual
 */
app.post('/api/stock-entry', asyncHandler(async (req, res) => {
    const { invoiceNumber, accessKey, entryDate, supplierCnpj, supplierName, totalFreight, totalIpi, totalOtherExpenses, totalNoteValue, items } = req.body;

    // ✨ DEBUG: Log do que chegou do frontend
    console.log('[BACKEND] POST /api/stock-entry recebido');
    console.log('[BACKEND] Total de itens:', items?.length || 0);
    console.log('[BACKEND] Itens recebidos:', JSON.stringify(items, null, 2));
    items?.forEach((item: any, idx: number) => {
        console.log(`  [Item ${idx + 1}] SKU: ${item.skuFornecedor}, ID: ${item.codigoInterno}, Qty: ${item.quantidadeRecebida}, Unit: ${item.unidade}`);
    });

    // Validações básicas
    if (!invoiceNumber || !accessKey || !supplierCnpj || !items || items.length === 0) {
        return res.status(400).json({ error: 'Dados insuficientes. Verifique invoiceNumber, accessKey, supplierCnpj e items.' });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1️⃣ Obter id_fornecedor pelo CNPJ
        const [suppliers]: any = await connection.execute(
            'SELECT id_fornecedor FROM fornecedores WHERE cnpj = ?',
            [supplierCnpj]
        );

        if (suppliers.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Fornecedor não encontrado. Verifique o CNPJ.' });
        }

        const id_fornecedor = suppliers[0].id_fornecedor;

        // 2️⃣ Inserir Nota de Compra na tabela compras_notas
        const [notaResult]: any = await connection.execute(
            `INSERT INTO compras_notas (chave_acesso, numero_nota, id_fornecedor, data_emissao, valor_total, status_nota)
             VALUES (?, ?, ?, ?, ?, 'PROCESSADA')`,
            [accessKey, invoiceNumber, id_fornecedor, entryDate || new Date(), totalNoteValue || 0]
        );

        const id_nota = notaResult.insertId;

        // 3️⃣ Processar cada item
        for (const item of items) {
            const { codigoInterno, skuFornecedor, quantidadeRecebida, unidade, custoUnitario } = item;

            // Obter id_produto pelo código interno
            const [products]: any = await connection.execute(
                'SELECT id_produto FROM produtos WHERE codigo_interno = ?',
                [codigoInterno]
            );

            if (products.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: `Produto com código interno "${codigoInterno}" não encontrado.` });
            }

            const id_produto = products[0].id_produto;
            const custoTotal = quantidadeRecebida * custoUnitario;

            // 3a. Inserir item na tabela compras_itens
            await connection.execute(
                `INSERT INTO compras_itens (id_nota, id_produto, sku_fornecedor_original, quantidade, preco_unitario_custo, valor_total_item, unidade_xml)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id_nota, id_produto, skuFornecedor || '', quantidadeRecebida, custoUnitario, custoTotal, unidade]
            );

            // 3b. Inserir movimentação em estoque_movimentos (rastreamento)
            await connection.execute(
                `INSERT INTO estoque_movimentos (id_produto, tipo, origem, id_origem, quantidade, valor_unitario, valor_total)
                 VALUES (?, 'ENTRADA', 'NFE', ?, ?, ?, ?)`,
                [id_produto, id_nota, quantidadeRecebida, custoUnitario, custoTotal]
            );

            // 3c. Atualizar estoque_atual (saldo)
            // Primeiro, verifica se já existe registro
            const [estoqueAtual]: any = await connection.execute(
                'SELECT quantidade, valor_medio FROM estoque_atual WHERE id_produto = ?',
                [id_produto]
            );

            // ✨ DEBUG: Log da atualização de estoque
            console.log(`  [ESTOQUE] SKU: ${skuFornecedor}, Produto ID: ${id_produto}, Quantidade recebida: ${quantidadeRecebida}`);

            if (estoqueAtual.length > 0) {
                // Atualiza existente
                // Converter valores retornados do banco para número (evita concatenação de string)
                const qtAnterior = parseFloat(estoqueAtual[0].quantidade) || 0;
                const custoMedioAnterior = parseFloat(estoqueAtual[0].valor_medio) || 0;

                const novaQtd = qtAnterior + Number(quantidadeRecebida);
                const novoValorMedio = novaQtd > 0 ? ((custoMedioAnterior * qtAnterior + custoTotal) / novaQtd) : custoMedioAnterior;

                console.log(`    [ESTOQUE] Anterior: ${qtAnterior}, Nova: ${novaQtd}, Adicionado: ${quantidadeRecebida}`);

                await connection.execute(
                    `UPDATE estoque_atual SET quantidade = ?, valor_medio = ? WHERE id_produto = ?`,
                    [novaQtd, novoValorMedio, id_produto]
                );
            } else {
                // Insere novo
                console.log(`    [ESTOQUE] Novo registro, quantidade: ${quantidadeRecebida}`);
                await connection.execute(
                    `INSERT INTO estoque_atual (id_produto, quantidade, valor_medio)
                     VALUES (?, ?, ?)`,
                    [id_produto, Number(quantidadeRecebida), Number(custoUnitario)]
                );
            }
        }

        // ✅ Commit de toda a transação
        await connection.commit();

        res.status(201).json({
            success: true,
            message: `Nota de Compra ${invoiceNumber} consolidada com sucesso!`,
            notaId: id_nota,
            itemsProcessed: items.length
        });

    } catch (error) {
        // ❌ Rollback em caso de erro
        await connection.rollback();
        console.error('Erro ao consolidar entrada de estoque:', error);
        throw error;
    } finally {
        connection.release();
    }
}));






app.get('/api/products/search', asyncHandler(async (req, res) => {
    const { term } = req.query;

    if (!term) return res.json([]);

    // Query ajustada para as colunas reais da sua tabela `produtos`
    // Também buscamos o nome da marca fazendo um JOIN simples se desejar, 
    // mas aqui buscaremos o id_marca direto para simplificar
    const query = `
        SELECT 
            id_produto,
            codigo_interno, 
            codigo_barras, 
            descricao, 
            unidade, 
            preco_venda, 
            id_marca, 
            id_categoria
        FROM produtos 
        WHERE codigo_interno LIKE ? 
           OR descricao LIKE ? 
           OR codigo_barras = ?
        LIMIT 10
    `;

    const searchPattern = `%${term}%`;

    const [rows]: any = await pool.execute(query, [
        searchPattern, // codigo_interno
        searchPattern, // descricao
        term           // codigo_barras (exato)
    ]);

    res.json(rows);
}));

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    // Garante que o erro sempre retorne um JSON
    res.status(500).json({ error: err.message || 'Erro interno no servidor' });
});












// Rota para buscar estatísticas do Dashboard
app.get('/api/dashboard/stats', asyncHandler(async (req, res) => {
    const [rows]: any = await pool.execute(`
        SELECT 
            -- 1. Total de Produtos
            (SELECT COUNT(*) FROM produtos WHERE status = 'Ativo') AS totalProdutos,
            
            -- 2. Valor Total do Estoque
            (SELECT SUM(quantidade * valor_medio) FROM estoque_atual) AS valorTotalEstoque,
            
            -- 3. Produtos em Alerta
            (SELECT COUNT(*) FROM produtos p JOIN estoque_atual e ON p.id_produto = e.id_produto 
             WHERE e.quantidade <= p.estoque_minimo) AS produtosEmAlerta,
            
            -- 4. Giro de Vendas (Produtos distintos vendidos nos últimos 30 dias)
            (SELECT COUNT(DISTINCT id_produto) FROM vendas_itens vi 
             JOIN vendas v ON vi.id_venda = v.id_venda 
             WHERE v.data_venda > DATE_SUB(NOW(), INTERVAL 30 DAY)) AS giroVendas,

            -- 5. Inflação Interna (Alertas de preço pendentes)
            (SELECT COUNT(*) FROM alertas_precos WHERE status = 'PENDENTE') AS variacaoCusto,

            -- 6. Curva ABC (Categorias com maior valor investido)
            (SELECT c.nome_categoria FROM categorias c
             JOIN produtos p ON c.id_categoria = p.id_categoria
             JOIN estoque_atual e ON p.id_produto = e.id_produto
             GROUP BY c.id_categoria ORDER BY SUM(e.quantidade * e.valor_medio) DESC LIMIT 1) AS categoriaTopABC,

            -- 7. Estoque Parado
            (SELECT COUNT(*) FROM estoque_atual e 
             WHERE e.quantidade > 0 AND e.id_produto NOT IN (
                 SELECT id_produto FROM estoque_movimentos 
                 WHERE tipo = 'SAIDA' AND data_movimento > DATE_SUB(NOW(), INTERVAL 60 DAY)
             )) AS estoqueParado
    `);

    const r = rows[0];
    res.json({
        totalProdutos: Number(r.totalProdutos || 0),
        valorTotalEstoque: Number(r.valorTotalEstoque || 0),
        produtosEmAlerta: Number(r.produtosEmAlerta || 0),
        giroVendas: Number(r.giroVendas || 0),
        variacaoCusto: Number(r.variacaoCusto || 0),
        categoriaTopABC: r.categoriaTopABC || 'N/A',
        estoqueParado: Number(r.estoqueParado || 0)
    });
}));

// Proximo passo é Criar o produto no banco de dados com base nos dados fornecidos pela nota FIscal.

// GET /api/produtos/:id - retorna dados completos de um produto (inclui estoque atual)
app.get('/api/produtos/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const [rows]: any = await pool.execute(`
      SELECT 
          p.id_produto AS id, 
          p.codigo_interno AS sku, 
          p.codigo_barras AS barcode,
          p.descricao AS name, 
          p.status,
          p.unidade AS unitOfMeasure,
          p.ncm,
          p.cest,
          p.peso AS weight,
          p.comprimento AS length,
          p.altura AS height,
          p.largura AS width,
          p.seo_title AS seoTitle,
          p.description_html AS descriptionHtml,
          p.sync_ecommerce AS syncEcommerce,
          p.imagem_url AS pictureUrl,
          c.nome_categoria AS category, 
          m.nome_marca AS brand,
          p.preco_venda AS salePrice,
          p.metodo_precificacao AS priceMethod,
          p.markup_praticado AS markup,
          COALESCE(e.valor_medio, 0) AS costPrice,
          COALESCE(e.quantidade, 0) AS currentStock,
          p.estoque_minimo AS minStock,
          GROUP_CONCAT(DISTINCT f.nome_fantasia SEPARATOR ', ') AS suppliers
      FROM produtos AS p
      LEFT JOIN marcas m ON p.id_marca = m.id_marca
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria  
      LEFT JOIN estoque_atual e ON p.id_produto = e.id_produto
      LEFT JOIN produto_fornecedor pf ON p.id_produto = pf.id_produto
      LEFT JOIN fornecedores f ON pf.id_fornecedor = f.id_fornecedor
      WHERE p.id_produto = ?
      GROUP BY p.id_produto
    `, [id]);

    if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    res.json(rows[0]);
}));









app.put('/api/produtos/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = { ...req.body }; // clone para podermos manipular

    // capture estoque se estiver sendo modificado
    const newStock = updates.currentStock !== undefined ? updates.currentStock : null;
    // removemos para não tentar mapear na tabela produtos
    delete updates.currentStock;

    // 1. DEFINIÇÃO DO FIELDMAP (Resolvendo o erro 2304)
    // Este objeto mapeia: 'nome_no_react': 'nome_na_tabela_mysql'
    const fieldMap: Record<string, string> = {
        name: 'descricao',
        sku: 'codigo_interno',
        barcode: 'codigo_barras',
        unitOfMeasure: 'unidade',
        salePrice: 'preco_venda',
        priceMethod: 'metodo_precificacao',
        markup: 'markup_praticado',
        status: 'status',
        minStock: 'estoque_minimo',
        ncm: 'ncm',
        cest: 'cest',
        // ecommerce/logistics fields
        weight: 'peso',
        length: 'comprimento',
        height: 'altura',
        width: 'largura',
        seoTitle: 'seo_title',
        descriptionHtml: 'description_html',
        syncEcommerce: 'sync_ecommerce',
        pictureUrl: 'imagem_url'
    };

    const columns: string[] = [];
    const values: any[] = [];

    // 2. Montagem dinâmica da query
    Object.keys(updates).forEach((key) => {
        if (fieldMap[key]) {
            columns.push(`${fieldMap[key]} = ?`);
            values.push(updates[key]);
        }
    });

    // Validação de segurança
    if (columns.length === 0 && newStock === null) {
        return res.status(400).json({ message: "Nenhum campo válido para atualizar." });
    }

    // 3. Execução no Banco de Dados
    let result: any = { affectedRows: 1 };
    if (columns.length > 0) {
        values.push(id); // O ID vai por último para o WHERE id_produto = ?
        const sql = `UPDATE produtos SET ${columns.join(', ')} WHERE id_produto = ?`;
        [result] = await pool.execute(sql, values);
    }

    if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Produto não encontrado ou nenhuma alteração feita." });
    }

    // se o front enviou novo estoque, ajusta na tabela estoque_atual
    if (newStock !== null) {
        await pool.execute(
            `INSERT INTO estoque_atual (id_produto, quantidade, valor_medio)
             VALUES (?, ?, 0)
             ON DUPLICATE KEY UPDATE quantidade = ?`,
            [id, newStock, newStock]
        );
    }

    // after update, fetch the updated record to send back
    const [updatedRows]: any = await pool.execute(`
      SELECT 
          p.id_produto AS id, 
          p.codigo_interno AS sku, 
          p.codigo_barras AS barcode,
          p.descricao AS name, 
          p.status,
          p.unidade AS unitOfMeasure,
          p.ncm,
          p.cest,
          p.peso AS weight,
          p.comprimento AS length,
          p.altura AS height,
          p.largura AS width,
          p.seo_title AS seoTitle,
          p.description_html AS descriptionHtml,
          p.sync_ecommerce AS syncEcommerce,
          p.imagem_url AS pictureUrl,
          c.nome_categoria AS category, 
          m.nome_marca AS brand,
          p.preco_venda AS salePrice,
          p.metodo_precificacao AS priceMethod,
          p.markup_praticado AS markup,
          COALESCE(e.valor_medio, 0) AS costPrice,
          COALESCE(e.quantidade, 0) AS currentStock,
          p.estoque_minimo AS minStock,
          GROUP_CONCAT(DISTINCT f.nome_fantasia SEPARATOR ', ') AS suppliers
      FROM produtos AS p
      LEFT JOIN marcas m ON p.id_marca = m.id_marca
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria  
      LEFT JOIN estoque_atual e ON p.id_produto = e.id_produto
      LEFT JOIN produto_fornecedor pf ON p.id_produto = pf.id_produto
      LEFT JOIN fornecedores f ON pf.id_fornecedor = f.id_fornecedor
      WHERE p.id_produto = ?
      GROUP BY p.id_produto
    `, [id]);

    res.json(updatedRows[0] || { success: true, message: "Produto atualizado com sucesso!" });
}));