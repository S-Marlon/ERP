import express, { Request, Response, NextFunction } from 'express';
import pool from '../routes/Estoque/db.config';

const router = express.Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

async function getAllCategoryIdsRecursive(categoryName: string): Promise<number[]> {
  try {
    const [rows]: any = await pool.execute(`
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

router.get('/check-db', asyncHandler(async (req, res) => {
  await pool.execute('SELECT 1');
  res.status(200).json({ status: 'OK', message: 'Conex�o com o Banco de Dados bem-sucedida!' });
}));

router.get('/products', asyncHandler(async (req, res) => {
  const query = (req.query.query as string) || '';
  const category = (req.query.category as string) || '';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(1000, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const minPrice = parseFloat(req.query.minPrice as string) || 0;
  const maxPrice = parseFloat(req.query.maxPrice as string) || 999999;
  const minStock = parseInt(req.query.minStock as string) || -1;
  const status = (req.query.status as string) || '';
  const brand = (req.query.brand as string) || '';
  const sort = (req.query.sort as string) || 'name_asc';

  let orderBy = 'p.descricao ASC';
  if (sort === 'price_desc') orderBy = 'p.preco_venda DESC';
  if (sort === 'price_asc') orderBy = 'p.preco_venda ASC';
  if (sort === 'stock_desc') orderBy = 'currentStock DESC';

  const isSearchEmpty = query.trim() === '';
  const searchPattern = isSearchEmpty ? '%' : `%${query}%`;

  const params: any[] = [searchPattern, searchPattern, searchPattern, searchPattern];
  let categoryFilter = '';
  const filterClauses: string[] = [];

  if (category && category !== 'Todas') {
    const categoryIds = await getAllCategoryIdsRecursive(category);
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

  const filterString = filterClauses.length > 0 ? ' AND ' + filterClauses.join(' AND ') : '';

  const countQuery = `
    SELECT COUNT(p.id_produto) as total
    FROM produtos AS p
    LEFT JOIN estoque_saldos es ON p.id_produto = es.id_produto
    WHERE (? = '%' OR p.codigo_interno LIKE ? OR p.descricao LIKE ? OR p.codigo_barras LIKE ?)
    ${categoryFilter}
    ${filterString}
  `;

  const [countRows]: any = await pool.execute(countQuery, params);
  const total = countRows[0]?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const rowsQuery = `
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
    WHERE (? = '%' OR p.codigo_interno LIKE ? OR p.codigo_barras LIKE ? OR p.descricao LIKE ?)
    ${categoryFilter}
    ${filterString}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const queryParams = [...params, limit, offset];
  const [rows]: any = await pool.execute(rowsQuery, queryParams);

  const formattedRows = rows.map((row: any) => ({ ...row, isStockLow: row.currentStock <= row.minStock }));

  res.json({
    data: formattedRows,
    pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
  });
}));



// Rota: lista fornecedores de um produto pelo id do produto
router.get('/products/:id/fornecedores', asyncHandler(async (req: Request, res: Response) => {
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

export default router;
