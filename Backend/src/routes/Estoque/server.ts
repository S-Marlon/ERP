// backend/src/server.ts

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import pool from './db.config'; // Configuração do banco de dados MySQL
import { ResultSetHeader } from 'mysql2';
import crypto from 'crypto';
import { processStockMovement, STOCK_ORIGINS, recalculateStockForProduct, getCurrentStock } from '../../services/stock/stock.service';

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

// Função otimizada para buscar todos os descendentes de uma categoria
async function getAllCategoryIdsRecursive(categoryName: string, connection: any): Promise<number[]> {
    try {
        // Query otimizada: busca categoria e descendentes em DUAS camadas (suficiente para maioria)
        const [rows]: any = await connection.execute(`
            SELECT c.id_categoria FROM categorias c
            WHERE c.nome_categoria = ?
            OR c.id_categoria_pai = (
                SELECT id_categoria FROM categorias WHERE nome_categoria = ? LIMIT 1
            )
            OR c.id_categoria_pai IN (
                SELECT id_categoria FROM categorias 
                WHERE id_categoria_pai = (
                    SELECT id_categoria FROM categorias WHERE nome_categoria = ? LIMIT 1
                )
            )
        `, [categoryName, categoryName, categoryName]);
        
        return rows.length === 0 ? [] : rows.map((r: any) => r.id_categoria);
    } catch (error) {
        console.error('Erro ao buscar hierarquia de categorias:', error);
        return [];
    }
}

/**
 * Rota: GET /api/products
 * Busca otimizada com paginação e filtros avançados
 * Query params: query, category, page, limit, minPrice, maxPrice, minStock, status, brand
//  */
// app.get('/api/products', asyncHandler(async (req, res) => {
//     const query = req.query.query as string;
//     const category = req.query.category as string;
//     const page = Math.max(1, parseInt(req.query.page as string) || 1);
//     const limit = Math.min(50, parseInt(req.query.limit as string) || 20); // Max 50, default 20
//     const minPrice = parseFloat(req.query.minPrice as string) || 0;
//     const maxPrice = parseFloat(req.query.maxPrice as string) || 999999;
//     const minStock = parseInt(req.query.minStock as string) || -1;
//     const maxStock = parseInt(req.query.maxStock as string) || 999999;
//     const status = (req.query.status as string) || '';
//     const brand = (req.query.brand as string) || '';
    
//     const offset = (page - 1) * limit;
//     const isSearchEmpty = !query || query.trim() === '';
//     const searchTerm = isSearchEmpty ? '%' : `%${query}%`;

//     let params: any[] = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];
//     let categoryFilter = '';
//     let filterClauses: string[] = [];

//     // Filtro de categoria com hierarquia
//     if (category && category !== 'Todas') {
//         const categoryIds = await getAllCategoryIdsRecursive(category, pool);
//         if (categoryIds.length > 0) {
//             const placeholders = categoryIds.map(() => '?').join(',');
//             categoryFilter = ` AND c.id_categoria IN (${placeholders})`;
//             params.push(...categoryIds);
//         }
//     }

//     // Filtros avançados
//     if (minPrice > 0) {
//         filterClauses.push('p.preco_venda >= ?');
//         params.push(minPrice);
//     }
//     if (maxPrice < 999999) {
//         filterClauses.push('p.preco_venda <= ?');
//         params.push(maxPrice);
//     }
//     if (minStock >= 0) {
//         filterClauses.push('COALESCE(e.quantidade, 0) >= ?');
//         params.push(minStock);
//     }
//     if (maxStock < 999999) {
//         filterClauses.push('COALESCE(e.quantidade, 0) <= ?');
//         params.push(maxStock);
//     }
//     if (status && status !== 'Todos') {
//         filterClauses.push('p.status = ?');
//         params.push(status);
//     }
//     if (brand && brand !== 'Todos') {
//         filterClauses.push('m.nome_marca = ?');
//         params.push(brand);
//     }

//     const filterString = filterClauses.length > 0 ? ' AND ' + filterClauses.join(' AND ') : '';

//     // Query otimizada: colunas reduzidas, sem GROUP_CONCAT
//     const fullQuery = `
//         SELECT 
//             p.id_produto AS id, 
//             p.codigo_interno AS sku, 
//             p.codigo_barras AS barcode,
//             p.descricao AS name, 
//             p.status,
//             p.unidade AS unitOfMeasure,
//             c.nome_categoria AS category, 
//             m.nome_marca AS brand,
//             p.preco_venda AS salePrice,
//             p.preco_custo AS costPrice, -- Custo base vindo de produtos
//             COALESCE(es.quantidade, 0) AS currentStock, -- Tabela correta: estoque_saldos
//             p.estoque_minimo AS minStock,
//             p.imagem_url AS pictureUrl
//         FROM produtos AS p
//         LEFT JOIN marcas m ON p.id_marca = m.id_marca
//         LEFT JOIN categorias c ON p.id_categoria = c.id_categoria  
//         LEFT JOIN estoque_saldos es ON p.id_produto = es.id_produto -- Ajustado aqui
//         WHERE (? = '%' 
//              OR p.codigo_interno LIKE ? 
//              OR p.codigo_barras LIKE ? 
//              OR p.descricao LIKE ?)
//              ${categoryFilter}
//              ${filterString}
//         ORDER BY p.descricao ASC
//         LIMIT ? OFFSET ?
//     `;

//     // Contar total para paginação: usar params sem LIMIT/OFFSET para count
//     const countParams = [...params];

//    const countQuery = `
//         SELECT COUNT(p.id_produto) as total
//         FROM produtos AS p
//         LEFT JOIN estoque_saldos es ON p.id_produto = es.id_produto -- Ajustado aqui
//         WHERE (? = '%' OR p.codigo_interno LIKE ? OR p.descricao LIKE ? OR p.codigo_barras LIKE ?)
//         ${categoryFilter}
//         ${filterString}
//     `;

//     const [countRows]: any = await pool.execute(countQuery, countParams);
//     const total = countRows[0].total;
//     const totalPages = Math.ceil(total / limit);

//     // Executar query com paginação
//     params.push(limit, offset);
//     const [rows]: any = await pool.execute(fullQuery, params);

//     const formattedRows = rows.map((row: any) => ({
//         ...row,
//         isStockLow: row.currentStock <= row.minStock
//     }));

//     return res.json({
//         data: formattedRows,
//         pagination: {
//             page,
//             limit,
//             total,
//             totalPages,
//             hasNextPage: page < totalPages,
//             hasPrevPage: page > 1
//         }
//     });
// }));



app.get('/api/products', asyncHandler(async (req, res) => {
    // 1. Captura e Sanitização de Parâmetros
    const query = (req.query.query as string) || '';
    const category = (req.query.category as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(1000, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    // Filtros Avançados
    const minPrice = parseFloat(req.query.minPrice as string) || 0;
    const maxPrice = parseFloat(req.query.maxPrice as string) || 999999;
    const minStock = parseInt(req.query.minStock as string) || -1;
    const status = (req.query.status as string) || '';
    const brand = (req.query.brand as string) || '';
    const sort = (req.query.sort as string) || 'name_asc';
    const onlyInStock = req.query.onlyInStock === 'true';
    const onlyActive = req.query.onlyActive === 'true';

let orderBy = 'p.descricao ASC';

if (sort === 'price_desc') orderBy = 'p.preco_venda DESC';
if (sort === 'price_asc') orderBy = 'p.preco_venda ASC';
if (sort === 'stock_desc') orderBy = 'currentStock DESC';

    // 2. Preparação do Termo de Busca (Exatamente 4 interrogações no WHERE)
    const isSearchEmpty = query.trim() === '';
    const searchPattern = isSearchEmpty ? '%' : `%${query}%`;
    
    // IMPORTANTE: O array começa com EXATAMENTE 4 itens para o bloco WHERE inicial
    let params: any[] = [searchPattern, searchPattern, searchPattern, searchPattern];

    // 3. Construção Dinâmica de Filtros Adicionais
    let categoryFilter = '';
    let filterClauses: string[] = [];

    if (category && category !== 'Todas') {
        const categoryIds = await getAllCategoryIdsRecursive(category, pool);
        if (categoryIds.length > 0) {
            const placeholders = categoryIds.map(() => '?').join(',');
            categoryFilter = ` AND p.id_categoria IN (${placeholders})`;
            params.push(...categoryIds);
        }
    }

    if (minPrice > 0) { filterClauses.push('p.preco_venda >= ?'); params.push(minPrice); }
    if (maxPrice < 999999) { filterClauses.push('p.preco_venda <= ?'); params.push(maxPrice); }
    if (minStock >= 0) { filterClauses.push('COALESCE(es.quantidade, 0) >= ?'); params.push(minStock); }
    if (status && status !== 'Todos') { filterClauses.push('p.status = ?'); params.push(status); }
    if (brand && brand !== 'Todos') { filterClauses.push('m.nome_marca = ?'); params.push(brand); }
    if (onlyInStock) { filterClauses.push('COALESCE(es.quantidade, 0) > 0'); }
    if (onlyActive) { filterClauses.push('p.status = ?'); params.push('Ativo'); }

    const filterString = filterClauses.length > 0 ? ' AND ' + filterClauses.join(' AND ') : '';

    // 4. Execução da Query de Contagem (COUNT)
    // Note que usamos EXATAMENTE os mesmos JOINs e WHERE da busca real
    const countQuery = `
        SELECT COUNT(p.id_produto) as total
        FROM produtos AS p
        LEFT JOIN marcas m ON p.id_marca = m.id_marca
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        LEFT JOIN estoque_saldos es ON p.id_produto = es.id_produto
        WHERE (? = '%' 
            OR p.codigo_interno LIKE ? 
            OR p.codigo_barras LIKE ? 
            OR p.descricao LIKE ?)
        ${categoryFilter}
        ${filterString}
    `;

    const [countRows]: any = await pool.execute(countQuery, params);
    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limit);

    // 5. Execução da Query de Dados (SELECT)
    const fullQuery = `
        SELECT 
            p.id_produto AS id, 
            p.codigo_interno AS sku, 
            p.codigo_barras AS barcode,
            p.descricao AS name, 
            p.status,
            p.unidade AS unitOfMeasure,
            c.nome_categoria AS category, 
            m.nome_marca AS brand,
            p.preco_venda AS salePrice,
            p.preco_custo AS costPrice,
            COALESCE(es.quantidade, 0) AS currentStock,
            p.estoque_minimo AS minStock,
            p.imagem_url AS pictureUrl
        FROM produtos AS p
        LEFT JOIN marcas m ON p.id_marca = m.id_marca
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria  
        LEFT JOIN estoque_saldos es ON p.id_produto = es.id_produto
        WHERE (? = '%' 
            OR p.codigo_interno LIKE ? 
            OR p.codigo_barras LIKE ? 
            OR p.descricao LIKE ?)
        ${categoryFilter}
        ${filterString}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
    `;

    // Adicionamos os parâmetros de paginação apenas no final da execução real
    const [rows]: any = await pool.execute(fullQuery, [...params, limit, offset]);

    const formattedRows = rows.map((row: any) => ({
        ...row,
        isStockLow: row.currentStock <= row.minStock
    }));

    return res.json({
        data: formattedRows,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    });
}));

/**
 * Rota: GET /api/products/:id
 * Retorna detalhes de um produto específico por ID
 */
app.get('/api/products/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }

    const query = `
        SELECT 
            p.id_produto AS id, 
            p.codigo_interno AS sku, 
            p.codigo_barras AS barcode,
            p.descricao AS name, 
            p.status,
            p.unidade AS unitOfMeasure,
            c.nome_categoria AS category, 
            m.nome_marca AS brand,
            p.preco_venda AS salePrice,
            p.preco_custo AS costPrice,
            COALESCE(es.quantidade, 0) AS currentStock,
            p.estoque_minimo AS minStock,
            p.imagem_url AS pictureUrl
        FROM produtos AS p
        LEFT JOIN marcas m ON p.id_marca = m.id_marca
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria  
        LEFT JOIN estoque_saldos es ON p.id_produto = es.id_produto
        WHERE p.id_produto = ?
    `;

    const [rows]: any = await pool.execute(query, [id]);
    
    if (rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
    }

    const product = rows[0];
    return res.json({
        data: {
            ...product,
            isStockLow: product.currentStock <= product.minStock
        }
    });
}));

/**
 * Rota: GET /api/categories?type=parts|services
 * Retorna a lista de APENAS categorias PAI (sem subcategorias)
 */
app.get('/api/categories', asyncHandler(async (req, res) => {
    // Busca APENAS categorias pai (id_categoria_pai IS NULL ou 0)
    const query = `
        SELECT DISTINCT c.nome_categoria 
        FROM categorias c
        LEFT JOIN produtos p ON c.id_categoria = p.id_categoria
        WHERE c.id_categoria_pai IS NULL OR c.id_categoria_pai = 0
        ORDER BY c.nome_categoria ASC
    `;

    try {
        const [rows]: any = await pool.execute(query);
        const categories = rows.map((row: any) => row.nome_categoria);
        
        // Sempre adiciona "Todas" como primeira opção
        return res.json(['Todas', ...categories]);
    } catch (error) {
        console.error("Erro ao buscar categorias:", error);
        // Retorna categorias padrão para não travar o PDV caso a tabela esteja vazia
        return res.json(['Todas', 'Hidráulica', 'Pneumática']);
    }
}));

/**
 * Rota: GET /api/brands
 * Retorna a lista de marcas disponíveis para filtro
 */
app.get('/api/brands', asyncHandler(async (req, res) => {
    const query = `
        SELECT DISTINCT m.nome_marca 
        FROM marcas m
        INNER JOIN produtos p ON m.id_marca = p.id_marca
        WHERE m.nome_marca IS NOT NULL AND m.nome_marca != ''
        ORDER BY m.nome_marca ASC
    `;

    try {
        const [rows]: any = await pool.execute(query);
        const brands = rows.map((row: any) => row.nome_marca).filter((b: string) => b);
        return res.json(['Todos', ...brands]);
    } catch (error) {
        console.error("Erro ao buscar marcas:", error);
        return res.json(['Todos']);
    }
}));

/**
 * Rota: GET /api/statuses
 * Retorna os status únicos de produtos disponíveis para filtro
 */
app.get('/api/statuses', asyncHandler(async (req, res) => {
    const query = `
        SELECT DISTINCT p.status 
        FROM produtos p
        WHERE p.status IS NOT NULL AND p.status != ''
        ORDER BY p.status ASC
    `;

    try {
        const [rows]: any = await pool.execute(query);
        const statuses = rows.map((row: any) => row.status).filter((s: string) => s);
        return res.json(['Todos', ...statuses]);
    } catch (error) {
        console.error("Erro ao buscar status:", error);
        return res.json(['Todos', 'Ativo', 'Inativo']);
    }
}));

/**
 * Rota: GET /api/units
 * Retorna as unidades de medida disponíveis para filtro
 */
app.get('/api/units', asyncHandler(async (req, res) => {
    const query = `
        SELECT DISTINCT p.unidade 
        FROM produtos p
        WHERE p.unidade IS NOT NULL AND p.unidade != ''
        ORDER BY p.unidade ASC
    `;

    try {
        const [rows]: any = await pool.execute(query);
        const units = rows.map((row: any) => row.unidade).filter((u: string) => u);
        return res.json(units);
    } catch (error) {
        console.error("Erro ao buscar unidades:", error);
        return res.json(['un', 'MT', 'LT', 'KG']);
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


app.post('/api/products/createNewProduct', asyncHandler(async (req, res) => {
    const { 
        codigo_interno, 
        descricao, 
        unidade, 
        preco_venda, 
        id_categoria, 
        codigo_barras,
        ncm,
        cest,
        weight,
        length,
        height,
        width,
        pictureUrl
    } = req.body;

    // 1. Validação e Sanitização
    const skuFinal = (codigo_interno || codigo_barras)?.trim();
    if (!skuFinal || !descricao) {
        return res.status(400).send("SKU/EAN e Descrição são obrigatórios.");
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 2. Verificar se já existe (Prevenção de Duplicidade)
        const [existing]: any = await connection.execute(
            `SELECT id_produto FROM produtos WHERE codigo_interno = ? OR (codigo_barras IS NOT NULL AND codigo_barras = ?)`,
            [skuFinal, codigo_barras || '---'] 
        );

        if (existing.length > 0) {
            connection.release();
            return res.status(409).json({ 
                message: "Erro: Já existe um produto com este SKU ou Código de Barras.",
                id_conflito: existing[0].id_produto 
            });
        }

        // 3. Insert na tabela 'produtos' com as novas colunas
        const sqlInsert = `
            INSERT INTO produtos (
                codigo_interno, codigo_barras, ncm, cest, descricao, 
                unidade, preco_venda, preco_venda_manual, metodo_precificacao,
                id_categoria, status, peso, comprimento, altura, largura, imagem_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', ?, 'Ativo', ?, ?, ?, ?, ?)
        `;

        const [result]: any = await connection.execute(sqlInsert, [
            skuFinal,
            codigo_barras?.trim() || null,
            ncm || null,
            cest || null,
            descricao.toUpperCase(),
            unidade || 'UN',
            preco_venda || 0,
            preco_venda || 0,
            id_categoria || null,
            weight || null,
            length || null,
            height || null,
            width || null,
            pictureUrl || null
        ]);

        const newId = result.insertId;

        // 4. Inicializa o SALDO (Tabela: estoque_saldos)
        // Criamos o registro com zero para que o JOIN do estoque não venha vazio
        await connection.execute(
            `INSERT INTO estoque_saldos (id_produto, quantidade, valor_medio) VALUES (?, 0, 0)`,
            [newId]
        );

        await connection.commit();

        res.status(201).json({ 
            id: newId, 
            sku: skuFinal,
            message: "Produto cadastrado e inicializado no estoque com sucesso!" 
        });

    } catch (error: any) {
        await connection.rollback();
        console.error("Erro ao cadastrar produto manual:", error);
        res.status(500).send("Erro interno ao salvar produto.");
    } finally {
        connection.release();
    }
}));


/**
 * Rota: POST /api/stock/entries
 * Registra a Nota Fiscal na tabela de COMPRAS e atualiza o estoque via Trigger.
 */
app.post('/api/stock/entries', asyncHandler(async (req, res) => {
    const { accessKey, supplierCnpj, entryDate, items, totalNF } = req.body;

    if (!accessKey || !items || items.length === 0) {
        return res.status(400).json({ error: 'Dados da nota fiscal incompletos.' });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Buscar o ID do fornecedor pelo CNPJ
        const [forns]: any = await connection.execute(
            "SELECT id_fornecedor FROM fornecedores WHERE cnpj = ? LIMIT 1",
            [supplierCnpj]
        );
        const idFornecedor = forns.length > 0 ? forns[0].id_fornecedor : null;

        // 2. Inserir o Cabeçalho da Compra (Tabela: compras)
        const [compraResult]: any = await connection.execute(
            `INSERT INTO compras (chave_acesso, id_fornecedor, data_emissao, valor_total, status) 
             VALUES (?, ?, ?, ?, 'RECEBIDO')`,
            [accessKey, idFornecedor, entryDate, totalNF || 0]
        );
        const idCompra = compraResult.insertId;

        // 3. Inserir os Itens da Compra (Tabela: compras_itens)
        for (const item of items) {
            // O mappedProductId é o ID interno que vinculamos na Rota #2
            await connection.execute(
                `INSERT INTO compras_itens (id_compra, id_produto, quantidade, custo_unitario, subtotal)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    idCompra, 
                    item.mappedProductId, 
                    item.quantityReceived, 
                    item.unitCost, 
                    (item.quantityReceived * item.unitCost)
                ]
            );

            // IMPORTANTE: Não precisamos dar UPDATE no estoque aqui!
            // A trigger 'tr_entrada_compra_atualiza_estoque' (ou similar) no banco 
            // já faz o incremento do saldo e o cálculo do custo médio.
        }

        await connection.commit();
        res.status(201).json({ 
            message: 'Nota Fiscal processada com sucesso!', 
            idCompra 
        });

    } catch (error: any) {
        await connection.rollback();
        console.error('Erro ao processar entrada de NF:', error);
        res.status(500).json({ error: 'Erro ao salvar entrada de estoque.', details: error.message });
    } finally {
        connection.release();
    }
}));


/**
 * Rota: POST /api/sales
 * Registra uma nova venda com avaliação de saldo do estoque
 */
app.post('/api/sales', asyncHandler(async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        const {
            data,
            clienteNome,
            totalBruto,
            totalDesconto,
            totalLiquido,
            totalCusto,
            lucroNominal,
            percentualLucro,
            itens,
            pagamentos
        } = req.body;

        // Validações básicas
        if (!itens || itens.length === 0) {
            return res.status(400).json({ error: 'Nenhum item na venda' });
        }

        if (totalLiquido <= 0) {
            return res.status(400).json({ error: 'Valor total deve ser positivo' });
        }

        await connection.beginTransaction();

        // 1. Inserir cabeçalho da venda (vendas table)
        const [vendaResult]: any = await connection.execute(
            `INSERT INTO vendas (
                data_venda, 
                cliente_nome, 
                total_bruto, 
                total_desconto, 
                total_liquido, 
                total_custo,
                lucro_nominal,
                percentual_lucro,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Concluída')`,
            [
                new Date(data),
                clienteNome || 'CONSUMIDOR',
                totalBruto,
                totalDesconto,
                totalLiquido,
                totalCusto,
                lucroNominal,
                percentualLucro
            ]
        ) as [ResultSetHeader, any[]];

        const idVenda = vendaResult.insertId;

        // 2. Inserir itens da venda (vendas_itens table)
        for (const item of itens) {
            // Verificar se o estoque existe e reduzir
            const [estoqueRows]: any = await connection.execute(
                `SELECT quantidade FROM estoque_saldos WHERE id_produto = ?`,
                [item.productId]
            );

            if (estoqueRows.length > 0) {
                const estoqueBefore = estoqueRows[0].quantidade;
                const estoqueDepo = estoqueBefore - item.quantidade;

                if (estoqueDepo < 0) {
                    throw new Error(`Estoque insuficiente para produto ID ${item.productId}`);
                }

                // Atualizar o saldo do estoque
                await connection.execute(
                    `UPDATE estoque_saldos SET quantidade = ? WHERE id_produto = ?`,
                    [estoqueDepo, item.productId]
                );
            }

            // Inserir o item da venda
            await connection.execute(
                `INSERT INTO vendas_itens (
                    id_venda, 
                    id_produto, 
                    quantidade, 
                    preco_venda, 
                    preco_custo,
                    subtotal,
                    lucro_unitario
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    idVenda,
                    item.productId,
                    item.quantidade,
                    item.precoVenda,
                    item.precoCusto,
                    item.subtotal,
                    item.lucroUnitario
                ]
            );
        }

        // 3. Registrar pagamentos (se houver tabela de pagamentos)
        if (pagamentos && pagamentos.length > 0) {
            for (const pag of pagamentos) {
                await connection.execute(
                    `INSERT INTO pagamentos (id_venda, metodo, valor, parcelas, status)
                     VALUES (?, ?, ?, ?, 'Pago')`,
                    [idVenda, pag.metodo, pag.valor, pag.parcelas || 1]
                );
            }
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            id: idVenda,
            message: 'Venda registrada com sucesso'
        });

    } catch (error: any) {
        await connection.rollback();
        console.error('Erro ao registrar venda:', error);
        res.status(500).json({
            error: 'Erro ao registrar venda',
            details: error.message
        });
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


/**
 * GET /api/stock/recalculate/:productId
 * Endpoint de teste: compara saldo calculado do ledger vs saldo atual do cache
 */
app.get('/api/stock/recalculate/:productId', asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.productId);

    if (!productId || productId <= 0) {
        return res.status(400).json({ error: 'ID do produto inválido' });
    }

    try {
        // 🔄 Calcular saldo baseado no ledger
        const saldoLedger = await recalculateStockForProduct(productId);

        // 📊 Obter saldo atual do cache (trigger)
        const saldoCache = await getCurrentStock(productId);

        // ⚖️ Calcular diferenças
        const diferenca = {
            quantidade: saldoLedger.quantidade - saldoCache.quantidade,
            valorMedio: saldoLedger.valorMedio - saldoCache.valorMedio
        };

        // 📋 Verificar se está consistente
        const tolerancia = 0.0001; // Tolerância para arredondamento
        const consistente = Math.abs(diferenca.quantidade) < tolerancia &&
                           Math.abs(diferenca.valorMedio) < tolerancia;

        const resultado = {
            produto: productId,
            timestamp: new Date().toISOString(),
            saldoLedger, // Calculado do ledger
            saldoCache,  // Do cache (trigger)
            diferenca,
            consistente,
            movimentosProcessados: saldoLedger.movimentosProcessados,
            recomendacao: consistente
                ? '✅ Saldos consistentes - seguro remover trigger'
                : '⚠️ Saldos divergentes - investigar antes de remover trigger'
        };

        // 📜 Log detalhado
        console.log('[STOCK_RECALCULATE_TEST]', JSON.stringify(resultado));

        res.json(resultado);

    } catch (error: any) {
        console.error('[STOCK_RECALCULATE_ERROR]', {
            produto: productId,
            error: error.message
        });
        res.status(500).json({
            error: 'Erro ao recalcular estoque',
            produto: productId,
            detalhes: error.message
        });
    }
}));

/**
 * GET /api/stock/audit-all
 * Auditoria completa de estoque: compara ledger vs cache para todos os produtos
 */
app.get('/api/stock/audit-all', asyncHandler(async (req, res) => {
    try {
        // 🔍 Buscar todos os produtos ativos
        const [products]: any = await pool.execute(
            `SELECT id_produto FROM produtos WHERE status = 'Ativo' ORDER BY id_produto`
        );

        const detalhes: any[] = [];
        let totalProdutos = 0;
        let produtosOk = 0;
        let produtosErro = 0;
        let driftMax = 0;

        // 📊 Processar cada produto
        for (const product of products) {
            const productId = product.id_produto;
            totalProdutos++;

            try {
                // 🔄 Calcular saldo do ledger
                const saldoLedger = await recalculateStockForProduct(productId);

                // 📊 Obter saldo do cache
                const saldoCache = await getCurrentStock(productId);

                // ⚖️ Calcular diferenças
                const diferenca = {
                    quantidade: saldoLedger.quantidade - saldoCache.quantidade,
                    valorMedio: saldoLedger.valorMedio - saldoCache.valorMedio
                };

                // 📏 Calcular drift máximo (maior diferença absoluta)
                const driftAtual = Math.max(
                    Math.abs(diferenca.quantidade),
                    Math.abs(diferenca.valorMedio)
                );
                driftMax = Math.max(driftMax, driftAtual);

                // ✅ Verificar consistência (tolerância para arredondamento)
                const tolerancia = 0.0001;
                const consistente = Math.abs(diferenca.quantidade) < tolerancia &&
                                   Math.abs(diferenca.valorMedio) < tolerancia;

                if (consistente) {
                    produtosOk++;
                } else {
                    produtosErro++;
                }

                detalhes.push({
                    produto: productId,
                    saldoLedger: {
                        quantidade: Number(saldoLedger.quantidade.toFixed(4)),
                        valorMedio: Number(saldoLedger.valorMedio.toFixed(4))
                    },
                    saldoCache: {
                        quantidade: Number(saldoCache.quantidade.toFixed(4)),
                        valorMedio: Number(saldoCache.valorMedio.toFixed(4))
                    },
                    diferenca: {
                        quantidade: Number(diferenca.quantidade.toFixed(4)),
                        valorMedio: Number(diferenca.valorMedio.toFixed(4))
                    }
                });

            } catch (error: any) {
                console.error(`[STOCK_AUDIT_ERROR] Produto ${productId}:`, error.message);
                produtosErro++;

                // Adicionar entrada de erro nos detalhes
                detalhes.push({
                    produto: productId,
                    saldoLedger: { quantidade: 0, valorMedio: 0 },
                    saldoCache: { quantidade: 0, valorMedio: 0 },
                    diferenca: { quantidade: 0, valorMedio: 0 },
                    erro: error.message
                });
            }
        }

        // 📋 Relatório final
        const relatorio = {
            total: totalProdutos,
            ok: produtosOk,
            erro: produtosErro,
            driftMax: Number(driftMax.toFixed(4)),
            timestamp: new Date().toISOString(),
            detalhes
        };

        // 📜 Log do resumo
        console.log('[STOCK_AUDIT_ALL]', JSON.stringify({
            total: totalProdutos,
            ok: produtosOk,
            erro: produtosErro,
            driftMax: relatorio.driftMax,
            timestamp: relatorio.timestamp
        }));

        res.json(relatorio);

    } catch (error: any) {
        console.error('[STOCK_AUDIT_ALL_ERROR]', error.message);
        res.status(500).json({
            error: 'Erro na auditoria completa de estoque',
            detalhes: error.message
        });
    }
}));


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});



// lembrar de : se houver mapped.CodInterno registrado no sistema, deve ser realizado um update (vinculo) ao invés de insert 
// ou seja produto já existe na tabela produtos, e será criado apenas o vínculo na tabela produto_fornecedor vinculado ao id_produto existente
app.post('/api/products/map', asyncHandler(async (req, res) => {
    const { original, mapped, supplierCnpj } = req.body;

    if (!mapped) {
        return res.status(400).json({ error: "Dados de mapeamento ausentes." });
    }

    // ✨ ALTERAÇÃO 1: Limpar o CNPJ logo no início
    const cleanCnpj = supplierCnpj.replace(/\D/g, '');

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Localizar o Fornecedor (Tabela: fornecedores)
        const [forns]: any = await connection.execute(
            "SELECT id_fornecedor FROM fornecedores WHERE cnpj = ? LIMIT 1",
            [cleanCnpj]
        );

        if (forns.length === 0) {
            return res.status(400).json({ error: `Fornecedor com CNPJ ${cleanCnpj} não cadastrado.` });
        }
        const idFornecedor = forns[0].id_fornecedor;

        // 2. Lógica de Existência do Produto
        let idProduto: number;
        const normalizedGtin = (mapped.gtin && mapped.gtin.trim() !== "" && mapped.gtin !== "SEM GTIN") ? mapped.gtin : null;

        let existingProd: any[] = [];
        if (mapped.CodInterno) {
            const [rows] = await connection.execute<any[]>(
                "SELECT id_produto FROM produtos WHERE codigo_interno = ? LIMIT 1",
                [mapped.CodInterno]
            );
            existingProd = rows;
        }

        if (existingProd.length > 0) {
            // PRODUTO JÁ EXISTE: Apenas capturamos o ID
            idProduto = existingProd[0].id_produto;
        } else {
            // PRODUTO NÃO EXISTE: INSERT na tabela 'produtos'
            const [newProd] = await connection.execute<ResultSetHeader>(
                `INSERT INTO produtos 
                (codigo_interno, codigo_barras, ncm, cest, descricao, unidade, preco_venda, preco_custo, status, id_categoria) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Ativo', ?)`,
                [
                    mapped.CodInterno || original.sku,
                    normalizedGtin,
                    mapped.ncm || null,
                    mapped.cest || null,
                    (mapped.name || original.descricao).toUpperCase(),
                    mapped.individualUnit || 'UN',
                    mapped.Preço_Final_de_Venda || 0,
                    original.valorUnitario || 0, // Custo inicial vindo do XML
                    parseInt(mapped.Categorias) || null
                ]
            );
            idProduto = newProd.insertId;

            // Inicializa o saldo na tabela 'estoque_saldos' (Substituindo estoque_atual)
            await connection.execute(
                "INSERT INTO estoque_saldos (id_produto, quantidade, valor_medio) VALUES (?, 0, 0)",
                [idProduto]
            );
        }

        // 3. Inserir ou Atualizar o Vínculo (Tabela: produtos_fornecedores)
        const normalizedEanFornecedor = (original.gtin && original.gtin.trim() !== "" && original.gtin !== "SEM GTIN") ? original.gtin : null;

        await connection.execute(
           `INSERT INTO produtos_fornecedores 
            (id_produto, id_fornecedor, sku_fornecedor, ean_fornecedor, descricao_fornecedor, fator_conversao, ultimo_custo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                id_produto = VALUES(id_produto),
                ultimo_custo = VALUES(ultimo_custo),
                fator_conversao = VALUES(fator_conversao)`,
           [
                idProduto,
                idFornecedor,
                original.sku || null,
                normalizedEanFornecedor,
                original.descricao || null,
                mapped.unitsPerPackage || 1.000,
                original.valorUnitario || 0.0000
            ]
        );

        await connection.commit();
        res.json({ success: true, id_produto: idProduto });

    } catch (error: any) {
        await connection.rollback();
        console.error("ERRO NO MAPEAMENTO:", error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
}));











app.post('/api/products/check-mappings', asyncHandler(async (req, res) => {
    // 1. Ajuste de nomes: O front envia 'supplierCnpj', vamos garantir a limpeza
    const { supplierCnpj, skus } = req.body;

    console.log('\n=== CHECK MAPPINGS INICIADO ===');
    
    if (!skus || !Array.isArray(skus) || skus.length === 0) {
        return res.json([]);
    }

    // 2. Limpa o CNPJ para bater com o VARCHAR(14) do banco
    const cleanCnpj = supplierCnpj.replace(/\D/g, '');
    console.log('CNPJ Limpo para busca:', cleanCnpj);

    /**
     * NOTA: Removi a lógica de Hash/Prefixo. 
     * No seu banco (tabela produtos_fornecedores), o campo 'sku_fornecedor' 
     * deve guardar o código que vem na nota fiscal para que o vínculo funcione.
     */

    const placeholders = skus.map(() => '?').join(',');
    
    // 3. Query corrigida conforme seu Dump SQL:
    // - Tabela correta: produtos_fornecedores (plural)
    // - Coluna correta: nome_categoria (da tabela categorias)
    const query = `
        SELECT 
            pf.sku_fornecedor, 
            p.id_produto, 
            p.codigo_interno, 
            p.descricao, 
            p.unidade, 
            cat.nome_categoria
        FROM produtos_fornecedores pf
        JOIN produtos p ON pf.id_produto = p.id_produto
        JOIN fornecedores f ON pf.id_fornecedor = f.id_fornecedor
        LEFT JOIN categorias cat ON p.id_categoria = cat.id_categoria
        WHERE f.cnpj = ? AND pf.sku_fornecedor IN (${placeholders})
    `;

    try {
        const [mappings]: any = await pool.execute(query, [cleanCnpj, ...skus]);
        
        console.log(`Encontrados ${mappings.length} mapeamentos no banco.`);
        res.json(mappings);
    } catch (error: any) {
        console.error('Erro na query de mapeamento:', error.message);
        res.status(500).json({ error: "Erro interno ao buscar mapeamentos", details: error.message });
    }
}));



// 1. Tipagem para o parâmetro cnpj (corrigindo o erro TS7006)
const sanitizeCNPJ = (cnpj: string): string => cnpj.replace(/\D/g, '').substring(0, 14);

// Endpoint: Verifica se fornecedor existe pelo CNPJ
app.post('/api/suppliers/check', asyncHandler(async (req, res) => {
    const { cnpj } = req.body;
    if (!cnpj) return res.status(400).json({ error: 'CNPJ é obrigatório' });

    const cleanCnpj = sanitizeCNPJ(cnpj);

    // Forçamos o tipo para 'any' ou 'any[]' para acessar .length e [0] (corrigindo TS2339 e TS7053)
    const [rows]: any = await pool.execute(
        "SELECT id_fornecedor, razao_social FROM fornecedores WHERE cnpj = ? LIMIT 1",
        [cleanCnpj]
    );

    if (rows.length === 0) return res.json({ exists: false });

    const f = rows[0];
    res.json({ 
        exists: true, 
        supplier: { id: f.id_fornecedor, name: f.razao_social } 
    });
}));

// Endpoint: Cria um fornecedor
app.post('/api/suppliers', asyncHandler(async (req, res) => {
    const { cnpj, name, nomeFantasia, siglaGerada } = req.body;
    
    if (!cnpj || !name) {
        return res.status(400).json({ error: 'CNPJ e nome são obrigatórios' });
    }

    const cleanCnpj = sanitizeCNPJ(cnpj);

    try {
        // Tipamos o resultado como 'any' para acessar o .insertId (corrigindo TS2339)
        const [result]: any = await pool.execute(
            'INSERT INTO fornecedores (cnpj, razao_social, nome_fantasia, sigla) VALUES (?, ?, ?, ?)',
            [cleanCnpj, name, nomeFantasia || null, siglaGerada || null]
        );
        
        const insertId = result.insertId;
        res.status(201).json({ id: insertId, cnpj: cleanCnpj, name });
    } catch (err: any) { // Tipamos o erro como 'any' para acessar .code e .errno (corrigindo TS2339)
        if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
            return res.status(409).json({ error: 'Fornecedor ou Sigla já existem' });
        }
        throw err;
    }
}));

// Endpoint: Busca sigla pelo CNPJ
app.post('/api/suppliers/get-sigla', asyncHandler(async (req, res) => {
    const { cnpj } = req.body; 
    if (!cnpj) return res.status(400).json({ error: 'CNPJ é obrigatório' });

    const cleanCnpj = sanitizeCNPJ(cnpj);

    const [rows]: any = await pool.execute(
        'SELECT sigla FROM fornecedores WHERE cnpj = ?',
        [cleanCnpj]
    );

    if (rows.length === 0) {
        return res.status(404).json({ sigla: "", error: "Não encontrado" });
    }

    res.json({ sigla: rows[0].sigla });
}));

/**
 * GET /api/stock-entry
 * Busca todas as notas fiscais registradas com filtros opcionais
 * Query params: supplierCnpj, invoiceNumber, startDate, endDate
 */
app.get('/api/stock-entry', asyncHandler(async (req, res) => {
    const { supplierCnpj, invoiceNumber, startDate, endDate } = req.query;

    let query = `
        SELECT
            cn.id_nota AS id,
            cn.numero_nota AS invoiceNumber,
            cn.chave_acesso AS accessKey,
            DATE_FORMAT(cn.data_emissao, '%Y-%m-%dT%H:%i:%s.000Z') AS emissionDate,
            DATE_FORMAT(cn.data_entrada, '%Y-%m-%dT%H:%i:%s.000Z') AS entryDate,
            f.cnpj AS supplierCnpj,
            f.razao_social AS supplierName,
            cn.valor_total AS totalNoteValue,
            cn.status_nota AS status,
            COUNT(ci.id_item_nota) AS itemsCount
        FROM compras cn
        LEFT JOIN fornecedores f ON cn.id_fornecedor = f.id_fornecedor
        LEFT JOIN compras_itens ci ON cn.id_nota = ci.id_nota
        WHERE 1=1
    `;

    const params: any[] = [];
    if (supplierCnpj) { query += ' AND f.cnpj LIKE ?'; params.push(`%${supplierCnpj}%`); }
    if (invoiceNumber) { query += ' AND cn.numero_nota LIKE ?'; params.push(`%${invoiceNumber}%`); }
    if (startDate) { query += ' AND cn.data_entrada >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND cn.data_entrada <= ?'; params.push(endDate); }

    query += ' GROUP BY cn.id_nota ORDER BY cn.data_entrada DESC';

    const [rows]: any = await pool.execute(query, params);

    // Garantir que itemsCount seja number
    const formattedRows = rows.map((row: any) => ({
        ...row,
        itemsCount: Number(row.itemsCount || 0),
        totalNoteValue: Number(row.totalNoteValue || 0)
    }));

    res.json(formattedRows);
}));

/**
 * GET /api/stock-entry/:id
 * Busca detalhes completos de uma nota fiscal incluindo todos os itens
 */

app.get('/api/stock-entry/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 1. NOTA
    const [noteRows]: any = await pool.execute(`
        SELECT 
            cn.id_nota AS id,
            cn.numero_nota AS invoiceNumber,
            cn.serie AS series,
            cn.chave_acesso AS accessKey,

            -- datas normalizadas (ISO 8601)
            DATE_FORMAT(cn.data_emissao, '%Y-%m-%dT%H:%i:%s.000Z') AS emissionDate,
            DATE_FORMAT(cn.data_entrada, '%Y-%m-%dT%H:%i:%s.000Z') AS entryDate,
            DATE_FORMAT(cn.data_recebimento, '%Y-%m-%dT%H:%i:%s.000Z') AS receivementDate,

            f.cnpj AS supplierCnpj,
            f.razao_social AS supplierName,

            cn.valor_frete AS totalFreight,
            cn.valor_seguro AS totalInsurance,
            cn.valor_outras_despesas AS totalOtherExpenses,
            cn.valor_total AS totalNoteValue,
            cn.status_nota AS status
        FROM compras cn
        LEFT JOIN fornecedores f ON cn.id_fornecedor = f.id_fornecedor
        WHERE cn.id_nota = ?
    `, [id]);

    if (!noteRows?.length) {
        return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    }

    const note = noteRows[0];

    // 2. ITENS (garantido)
    const [itemRowsRaw]: any = await pool.execute(`
        SELECT 
            ci.id_item_nota AS id,
            p.codigo_interno AS codigoInterno,
            ci.sku_fornecedor_original AS skuFornecedor,
            ci.quantidade AS quantidadeRecebida,
            ci.unidade_xml AS unidadeXml,
            p.unidade AS unidade,
            ci.preco_unitario_custo AS custoUnitario,
            ci.valor_total_item AS valorTotalItem,
            ci.ncm,
            ci.cfop
        FROM compras_itens ci
        LEFT JOIN produtos p ON p.id_produto = ci.id_produto
        WHERE ci.id_nota = ?
        ORDER BY ci.id_item_nota
    `, [id]);

    // 3. NORMALIZAÇÃO (evita bug silencioso)
    const items = Array.isArray(itemRowsRaw) ? itemRowsRaw : [];

    // 4. CAST DE SEGURANÇA (evita string vindo do MySQL)
    const response = {
        ...note,
        totalNoteValue: Number(note.totalNoteValue || 0),
        totalFreight: Number(note.totalFreight || 0),
        totalInsurance: Number(note.totalInsurance || 0),
        totalOtherExpenses: Number(note.totalOtherExpenses || 0),

        items,
        itemsCount: items.length
    };

    res.json(response);
}));
/**
 * POST /api/stock-entry
 * Consolida a entrada de NF no banco de dados usando as tabelas compras_notas e compras_itens
 * Cria registros em: compras_notas, compras_itens, estoque_movimentos, e atualiza estoque_atual
 */
app.post('/api/stock-entry', asyncHandler(async (req, res) => {
    const {
        invoiceNumber,
        accessKey,
        entryDate,
        supplierCnpj,
        items = [],
        totalNoteValue = 0,
        totalFreight = 0,
        totalInsurance = 0,
        totalOtherExpenses = 0,
    } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Localizar Fornecedor
        const cleanCnpj = (supplierCnpj || '').replace(/\D/g, '');
        const [suppliers]: any = await connection.execute(
            'SELECT id_fornecedor FROM fornecedores WHERE cnpj = ?',
            [cleanCnpj]
        );

        if (suppliers.length === 0) throw new Error('Fornecedor não cadastrado.');
        const id_fornecedor = suppliers[0].id_fornecedor;

        const entryTimestamp = entryDate ? new Date(entryDate) : new Date();
        if (isNaN(entryTimestamp.getTime())) {
            throw new Error('entryDate inválida. Envie ISO 8601 válido.');
        }

        // 2. Inserir Nota fiscal imutável (Tabela: compras)
        const [notaResult]: any = await connection.execute(
            `INSERT INTO compras (
                chave_acesso,
                numero_nota,
                id_fornecedor,
                data_emissao,
                data_entrada,
                valor_total,
                valor_frete,
                valor_seguro,
                valor_outras_despesas,
                status_nota
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PROCESSADA')`,
            [
                accessKey,
                invoiceNumber,
                id_fornecedor,
                entryTimestamp,
                entryTimestamp,
                totalNoteValue,
                totalFreight,
                totalInsurance,
                totalOtherExpenses,
            ]
        );
        const id_nota = notaResult.insertId;

        // 3. Criar recebimento versionado para a nota
        const [receiptResult]: any = await connection.execute(
            `INSERT INTO recebimentos (
                id_nota,
                version,
                status,
                criado_por,
                observacoes
            ) VALUES (?, 1, 'PROCESSADO', 'API_IMPORT', 'Recebimento inicial importado automaticamente')`,
            [id_nota]
        );
        const id_recebimento = receiptResult.insertId;

        // 4. Processar itens e gerar eventos de estoque
        for (const item of items) {
            const [products]: any = await connection.execute(
                'SELECT id_produto FROM produtos WHERE codigo_interno = ?',
                [item.codigoInterno]
            );

            const id_p = products.length > 0 ? products[0].id_produto : null;

            await connection.execute(
                `INSERT INTO compras_itens (
                    id_nota,
                    id_produto,
                    sku_fornecedor_original,
                    quantidade,
                    unidade_xml,
                    preco_unitario_custo,
                    valor_total_item,
                    ncm,
                    cfop
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id_nota,
                    id_p,
                    item.skuFornecedor,
                    item.quantidadeRecebida,
                    item.unidade,
                    item.custoUnitario,
                    item.quantidadeRecebida * item.custoUnitario,
                    item.ncm || null,
                    item.cfop || null,
                ]
            );

            await connection.execute(
                `INSERT INTO recebimento_itens (
                    id_recebimento,
                    id_produto,
                    sku_fornecedor_original,
                    ncm,
                    cfop,
                    unidade_xml,
                    quantidade,
                    preco_unitario_custo,
                    valor_total_item
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id_recebimento,
                    id_p,
                    item.skuFornecedor,
                    item.ncm || null,
                    item.cfop || null,
                    item.unidade,
                    item.quantidadeRecebida,
                    item.custoUnitario,
                    item.quantidadeRecebida * item.custoUnitario,
                ]
            );

            if (id_p) {
                // Usar o serviço central de movimentação de estoque
                await processStockMovement({
                    idProduto: id_p,
                    tipo: 'ENTRADA',
                    quantidade: item.quantidadeRecebida,
                    valorUnitario: item.custoUnitario,
                    origem: STOCK_ORIGINS.RECEBIMENTO, // Padronizado para ledger
                    idOrigem: id_recebimento, // Vincula ao recebimento versionado
                    idRecebimento: id_recebimento, // Integração futura
                    idFornecedor: id_fornecedor,
                    referenciaAuditavel: `NF ${invoiceNumber} - Item ${item.skuFornecedor}`,
                    metadata: {
                        numeroNF: invoiceNumber,
                        skuFornecedor: item.skuFornecedor,
                        ncm: item.ncm,
                        cfop: item.cfop
                    }
                });
            }
        }

        await connection.commit();
        res.status(201).json({
            success: true,
            message: 'Nota consolidada com recebimento versionado e evento de estoque criado.',
            id_nota,
            id_recebimento,
        });
    } catch (error: any) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
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
// Rota para buscar estatísticas do Dashboard ajustada ao novo banco
app.get('/api/dashboard/stats', asyncHandler(async (req, res) => {
    const [rows]: any = await pool.execute(`
        SELECT 
            -- 1. Total de Produtos Ativos
            (SELECT COUNT(*) FROM produtos WHERE status = 'Ativo') AS totalProdutos,
            
            -- 2. Valor Total do Estoque (Quantidade em saldo * Valor médio)
            (SELECT SUM(quantidade * valor_medio) FROM estoque_saldos) AS valorTotalEstoque,
            
            -- 3. Produtos em Alerta (Abaixo ou igual ao estoque mínimo)
            (SELECT COUNT(*) 
             FROM produtos p 
             JOIN estoque_saldos es ON p.id_produto = es.id_produto 
             WHERE es.quantidade <= p.estoque_minimo) AS produtosEmAlerta,
            
            -- 4. Giro de Vendas (Produtos distintos vendidos nos últimos 30 dias)
            (SELECT COUNT(DISTINCT id_produto) 
             FROM vendas_itens vi 
             JOIN vendas v ON vi.id_venda = v.id_venda 
             WHERE v.data_venda > DATE_SUB(NOW(), INTERVAL 30 DAY)) AS giroVendas,

            -- 5. Inflação Interna (Alertas de preço pendentes)
            (SELECT COUNT(*) FROM alertas_precos WHERE status = 'PENDENTE') AS variacaoCusto,

            -- 6. Curva ABC (Categoria com maior valor investido em estoque)
            (SELECT c.nome_categoria 
             FROM categorias c
             JOIN produtos p ON c.id_categoria = p.id_categoria
             JOIN estoque_saldos es ON p.id_produto = es.id_produto
             GROUP BY c.id_categoria 
             ORDER BY SUM(es.quantidade * es.valor_medio) DESC 
             LIMIT 1) AS categoriaTopABC,

            -- 7. Estoque Parado (Produtos com saldo > 0 sem saída nos últimos 60 dias)
            (SELECT COUNT(*) 
             FROM estoque_saldos es 
             WHERE es.quantidade > 0 AND es.id_produto NOT IN (
                 SELECT id_produto 
                 FROM estoque_movimentacoes 
                 WHERE tipo = 'SAIDA' AND data_movimento > DATE_SUB(NOW(), INTERVAL 60 DAY)
             )) AS estoqueParado
    `);

    const r = rows[0];

    // Retorno formatado garantindo tipos numéricos
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

// Ajuste no Dashboard para usar estoque_saldos
// (SELECT SUM(quantidade * valor_medio) FROM estoque_saldos) AS valorTotalEstoque

app.get('/api/produtos/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [rows]: any = await pool.execute(`
      SELECT 
          p.*, 
          c.nome_categoria AS category, 
          m.nome_marca AS brand,
          p.preco_custo_novo AS costPrice,
          COALESCE(e.quantidade, 0) AS currentStock,
          GROUP_CONCAT(DISTINCT f.nome_fantasia SEPARATOR ', ') AS suppliers
      FROM produtos AS p
      LEFT JOIN marcas m ON p.id_marca = m.id_marca
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria  
      LEFT JOIN estoque_saldos e ON p.id_produto = e.id_produto -- Tabela corrigida
      LEFT JOIN produtos_fornecedores pf ON p.id_produto = pf.id_produto -- Tabela corrigida
      LEFT JOIN fornecedores f ON pf.id_fornecedor = f.id_fornecedor
      WHERE p.id_produto = ?
      GROUP BY p.id_produto
    `, [id]);

    if (!rows[0]) return res.status(404).json({ error: "Produto não encontrado" });
    res.json(rows[0]);
}));





app.put('/api/products/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates: any = { ...req.body };

    // 1. Verificação correta
    const [rows]: any = await pool.execute(
        'SELECT id_produto FROM produtos WHERE id_produto = ?', 
        [id]
    );

    if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "Produto não encontrado" });
    }

    // 2. Tratamento de estoque
    if (updates.currentStock !== undefined) {
        await pool.execute(
            `INSERT INTO estoque_saldos (id_produto, quantidade)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE quantidade = ?`,
            [id, updates.currentStock, updates.currentStock]
        );
    }
    delete updates.currentStock;

    // 🚨 3. REGRA DO MARKUP (ESSENCIAL)
    if (updates.priceMethod === 'MARKUP') {
        // Nunca aceitar preço manual nesse modo
        delete updates.salePrice;
    }

    if (updates.priceMethod === 'MANUAL') {
        // No modo manual, o preço vem do frontend
        updates.preco_venda_manual = updates.salePrice;
          updates.preco_venda_manual = updates.salePrice;
    }

    delete updates.salePrice;

    // 4. Normalização de status
    if (updates.status) {
        updates.status = updates.status === 'ACTIVE' ? 'Ativo' : 'Inativo';
    }

    // 5. Mapeamento
    const fieldMap: Record<string, string> = {
        name: 'descricao',
        sku: 'codigo_interno',
        barcode: 'codigo_barras',
        unitOfMeasure: 'unidade',
        priceMethod: 'metodo_precificacao',
        markup: 'markup_praticado',
        status: 'status',
        minStock: 'estoque_minimo',
        ncm: 'ncm',
        cest: 'cest',
        weight: 'peso',
        length: 'comprimento',
        height: 'altura',
        width: 'largura',
        seoTitle: 'seo_title',
        descriptionHtml: 'description_html',
        syncEcommerce: 'sync_ecommerce',
        pictureUrl: 'imagem_url',
        preco_venda_manual: 'preco_venda_manual'
    };

    const columns: string[] = [];
    const values: any[] = [];

    Object.keys(updates).forEach((key) => {
        if (fieldMap[key]) {
            columns.push(`${fieldMap[key]} = ?`);
            values.push(updates[key]);
        }
    });

    // 6. Proteção contra update vazio
    if (columns.length === 0) {
        return res.status(400).json({ message: 'Nenhum campo válido para atualizar' });
    }

    values.push(id);

    await pool.execute(
        `UPDATE produtos SET ${columns.join(', ')} WHERE id_produto = ?`,
        values
    );

    // 7. Retorno
    const [updatedRows]: any = await pool.execute(`
      SELECT 
          p.id_produto AS id, 
          p.codigo_interno AS sku, 
          p.codigo_barras AS barcode,
          p.descricao AS name, 
          p.status,
          p.unidade AS unitOfMeasure,
          p.preco_venda AS salePrice,
          p.preco_venda_manual,
          p.preco_custo,
          p.metodo_precificacao AS priceMethod,
          p.markup_praticado AS markup,
          COALESCE(e.quantidade, 0) AS currentStock
      FROM produtos p
      LEFT JOIN estoque_saldos e ON p.id_produto = e.id_produto
      WHERE p.id_produto = ?
    `, [id]);

    res.json(updatedRows[0]);
}));




















































// Venda Module 

/**
 * POST /api/sales
 * Registra a venda, baixa o estoque e calcula o lucro bruto baseado no custo médio atual.
 */
app.post('/api/sales', asyncHandler(async (req, res) => {
    const { items, totalVenda, idUsuario, idCliente, formaPagamento } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: "Carrinho vazio." });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Criar o cabeçalho da Venda
        const [vendaResult]: any = await connection.execute(
            `INSERT INTO vendas (id_usuario, id_cliente, data_venda, valor_total, forma_pagamento, status_venda) 
             VALUES (?, ?, NOW(), ?, ?, 'CONCLUIDA')`,
            [idUsuario || null, idCliente || null, totalVenda, formaPagamento || 'DINHEIRO']
        );
        const idVenda = vendaResult.insertId;

        // 2. Processar cada item do carrinho
        for (const item of items) {
            const { idProduto, quantidade, precoUnitario } = item;

            // 2a. Buscar o Custo Médio Atual para registrar o lucro real dessa venda
            const [estoque]: any = await connection.execute(
                "SELECT quantidade, valor_medio FROM estoque_saldos WHERE id_produto = ?",
                [idProduto]
            );

            const custoAtual = estoque.length > 0 ? parseFloat(estoque[0].valor_medio) : 0;
            const saldoAtual = estoque.length > 0 ? parseFloat(estoque[0].quantidade) : 0;

            // Verificação de estoque (Opcional: permitir venda negativa se configurado)
            if (saldoAtual < quantidade) {
                console.warn(`Atenção: Produto ${idProduto} com estoque insuficiente (Saldo: ${saldoAtual}).`);
            }

            // 2b. Inserir Item da Venda
            await connection.execute(
                `INSERT INTO vendas_itens (id_venda, id_produto, quantidade, preco_unitario, preco_unitario_custo , valor_total_item ) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [idVenda, idProduto, quantidade, precoUnitario, custoAtual, (quantidade * precoUnitario)]
            );

            // 2c. Registrar a SAÍDA no Ledger (estoque_movimentacoes)
            // Usar o serviço central - a trigger atualizará estoque_saldos automaticamente
            await processStockMovement({
                idProduto: idProduto,
                tipo: 'SAIDA',
                quantidade: quantidade, // Será negada automaticamente no serviço
                valorUnitario: precoUnitario,
                origem: STOCK_ORIGINS.VENDA,
                idOrigem: idVenda,
                referenciaAuditavel: `Venda ${idVenda} - Produto ${idProduto}`,
                metadata: {
                    idCliente,
                    formaPagamento
                }
            });

            // Nota: Removido UPDATE direto em estoque_saldos - agora via trigger do ledger
        }


        // 3. Gerar o Contas a Receber
// Se for "Dinheiro", já nasce como 'PAGO'. Se for "Cartão" ou "Prazo", nasce como 'PENDENTE'.
const statusInicial = (formaPagamento === 'DINHEIRO') ? 'PAGO' : 'PENDENTE';
const dataPagamento = (formaPagamento === 'DINHEIRO') ? new Date() : null;

await connection.execute(
    `INSERT INTO contas_receber (id_venda, id_cliente, valor_nominal, data_vencimento, data_pagamento, status, forma_pagamento) 
     VALUES (?, ?, ?, NOW(), ?, ?, ?)`,
    [
        idVenda, 
        idCliente || null, 
        totalVenda, 
        dataPagamento, 
        statusInicial, 
        formaPagamento
    ]
);

        await connection.commit();
        res.status(201).json({ 
            success: true, 
            message: "Venda realizada com sucesso!", 
            idVenda 
        });

    } catch (error: any) {
        await connection.rollback();
        console.error("ERRO NA VENDA:", error);
        res.status(500).json({ error: "Falha ao processar venda.", details: error.message });
    } finally {
        connection.release();
    }
}));


app.get('/api/financial/summary', asyncHandler(async (req, res) => {
    const [rows]: any = await pool.execute(`
        SELECT 
            (SELECT SUM(valor_nominal) FROM contas_receber WHERE status = 'PENDENTE') AS aReceber,
            (SELECT SUM(valor_nominal) FROM contas_pagar WHERE status = 'PENDENTE') AS aPagar,
            (SELECT SUM(valor_nominal) FROM contas_receber WHERE status = 'PAGO' AND MONTH(data_pagamento) = MONTH(NOW())) AS recebidoMes,
            (SELECT SUM(valor_nominal) FROM contas_pagar WHERE status = 'PAGO' AND MONTH(data_pagamento) = MONTH(NOW())) AS pagoMes
    `);

    const r = rows[0];
    const saldoPrevisto = (r.recebidoMes + r.aReceber) - (r.pagoMes + r.aPagar);

    res.json({
        ...r,
        saldoPrevisto
    });
}));



app.patch('/api/financial/pay/:tipo/:id', asyncHandler(async (req, res) => {
    const { tipo, id } = req.params; // tipo = 'pagar' ou 'receber'
    const tabela = tipo === 'pagar' ? 'contas_pagar' : 'contas_receber';
    const idNome = tipo === 'pagar' ? 'id_conta_pagar' : 'id_conta_receber';

    await pool.execute(
        `UPDATE ${tabela} SET status = 'PAGO', data_pagamento = NOW() WHERE ${idNome} = ?`,
        [id]
    );

    res.json({ success: true, message: "Pagamento registrado!" });
}));


/**
 * GET /api/financial/report
 * Retorna o resumo financeiro: Entradas, Saídas e Projeções.
 * Filtros opcionais: startDate, endDate
 */
app.get('/api/financial/report', asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    // Se não enviar data, assume o mês atual
    const start = startDate || 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
    const end = endDate || 'NOW()';

    const query = `
        SELECT 
            -- 1. Total Recebido (O que já caiu na conta)
            (SELECT SUM(valor_nominal) FROM contas_receber 
             WHERE status = 'PAGO' AND data_pagamento BETWEEN ${start} AND ${end}) AS totalRecebido,

            -- 2. Total Pago (Fornecedores e Despesas pagas)
            (SELECT SUM(valor_nominal) FROM contas_pagar 
             WHERE status = 'PAGO' AND data_pagamento BETWEEN ${start} AND ${end}) AS totalPago,

            -- 3. Inadimplência / A Receber (Vendas feitas mas não pagas)
            (SELECT SUM(valor_nominal) FROM contas_receber 
             WHERE status = 'PENDENTE' AND data_vencimento <= NOW()) AS totalAtrasadoReceber,

            -- 4. Compromissos / A Pagar (Notas que vão vencer)
            (SELECT SUM(valor_nominal) FROM contas_pagar 
             WHERE status = 'PENDENTE') AS totalAPagarFuturo,

            -- 5. Ticket Médio das Vendas no período
            (SELECT AVG(valor_total) FROM vendas 
             WHERE data_venda BETWEEN ${start} AND ${end}) AS ticketMedio
    `;

    const [rows]: any = await pool.execute(query);
    const data = rows[0];

    // Cálculo de Lucro Operacional (Simplificado: Entradas - Saídas)
    const lucroReal = (Number(data.totalRecebido) || 0) - (Number(data.totalPago) || 0);

    res.json({
        periodo: { inicio: startDate, fim: endDate },
        consolidado: {
            recebido: Number(data.totalRecebido) || 0,
            pago: Number(data.totalPago) || 0,
            lucroCaixa: lucroReal,
            ticketMedio: Number(data.ticketMedio) || 0
        },
        pendencias: {
            clientesDevedores: Number(data.totalAtrasadoReceber) || 0,
            contasParaPagar: Number(data.totalAPagarFuturo) || 0
        }
    });
}));





// Rota: lista fornecedores de um produto pelo id do produto
app.get('/api/products/:id/fornecedores', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'ID do produto é obrigatório' });
  }

  
const query = `
  SELECT 
      f.id_fornecedor,
      f.nome_fantasia,
      pf.sku_fornecedor,
      pf.fator_conversao,

      c.chave_acesso,
      c.data_emissao AS ultima_data_compra,
      ci.preco_unitario_custo AS ultimo_preco,
      ci.quantidade AS ultima_quantidade

  FROM produtos_fornecedores pf

  JOIN fornecedores f 
    ON f.id_fornecedor = pf.id_fornecedor

  LEFT JOIN compras c 
    ON c.id_fornecedor = f.id_fornecedor

  LEFT JOIN compras_itens ci 
    ON ci.id_nota = c.id_nota
    AND ci.id_produto = pf.id_produto

  WHERE pf.id_produto = ?

  AND (
    c.data_emissao IS NULL OR
    c.data_emissao = (
      SELECT MAX(c2.data_emissao)
      FROM compras c2
      JOIN compras_itens ci2 ON ci2.id_nota = c2.id_nota
      WHERE 
        c2.id_fornecedor = f.id_fornecedor
        AND ci2.id_produto = pf.id_produto
    )
  )

  ORDER BY f.nome_fantasia ASC
`;
 
  const [rows]: any = await pool.execute(query, [id]);

 const formatted = rows.map((r: any) => ({
  id_fornecedor: r.id_fornecedor,
  nome_fantasia: r.nome_fantasia,

  sku_fornecedor: r.sku_fornecedor,
  fator_conversao: Number(r.fator_conversao),

  chave_acesso: r.chave_acesso || null,
  ultima_data_compra: r.ultima_data_compra || null,
  ultimo_preco: r.ultimo_preco ? Number(r.ultimo_preco) : null,
  ultima_quantidade: r.ultima_quantidade ? Number(r.ultima_quantidade) : 0
}));

  res.json(formatted);
}));
