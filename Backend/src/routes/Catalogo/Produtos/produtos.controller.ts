import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';



/**
 * 📍 [READ] GET /produtos/search
 * Busca de itens usando as tabelas novas do ERP: itens_core + comercial_produtos_dados
 */
export const searchProdutos = async (req: Request, res: Response) => {
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || 1;
  const tenantId = Number(rawTenantId);
  const term = String(req.query.term || req.query.q || '').trim();

  if (!term) {
    return res.json([]);
  }

  const searchPattern = `%${term}%`;

  try {
    const query = `
      SELECT
        ic.id_item AS id,
        ic.sku,
        ic.nome_item AS name,
        ic.status,
        ic.descricao_variacao,
        COALESCE(um.sigla, '') AS unitOfMeasure,
        COALESCE(cpd.preco_venda, 0) AS salePrice,
        COALESCE(cf.nome, '') AS category,
        NULL AS barcode,
        0 AS currentStock,
        0 AS minStock,
        NULL AS pictureUrl
      FROM itens_core ic
      LEFT JOIN comercial_produtos_dados cpd
        ON ic.id_item = cpd.id_item AND ic.tenant_id = cpd.tenant_id
      LEFT JOIN comercial_familias cf
        ON cpd.familia_id = cf.id AND cpd.tenant_id = cf.tenant_id
      LEFT JOIN itens_unidades_medida um
        ON ic.id_unidade = um.id_unidade AND ic.tenant_id = um.tenant_id
      WHERE ic.tenant_id = ?
        AND (
          ic.sku LIKE ?
          OR ic.nome_item LIKE ?
          OR ic.descricao_variacao LIKE ?
          OR COALESCE(cpd.sku_customizado, '') LIKE ?
        )
      ORDER BY ic.nome_item ASC
      LIMIT 10
    `;

    const [rows] = await pool.execute(query, [
      tenantId,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    ]);

    return res.json((rows as any[]).map((row: any) => ({
      id: Number(row.id),
      sku: row.sku || '',
      barcode: row.barcode || '',
      name: row.name || row.nome_item || 'Produto',
      category: row.category || '',
      unitOfMeasure: row.unitOfMeasure || '',
      salePrice: Number(row.salePrice || 0),
      currentStock: Number(row.currentStock || 0),
      minStock: Number(row.minStock || 0),
      status: row.status || 'ATIVO',
      pictureUrl: row.pictureUrl || null,
    })));
  } catch (error: any) {
    console.error('Erro ao buscar produtos no catálogo novo:', error);
    return res.status(500).json({ error: 'Erro ao buscar produtos.', details: error.message });
  }
};

/**
 * 🔌 [READ] GET /produtos
 * Retorna array plano de SKUs individuais com dados comerciais
 * Para busca em formulário de etiquetas, a estrutura é simplificada
 */
export const getProdutos = async (req: Request, res: Response) => {
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || 1;
  const tenantId = Number(rawTenantId);

  try {
    const query = `
      SELECT 
        ic.id_item,
        ic.tenant_id,
        ic.sku,
        ic.nome_item,
        ic.tipo_recurso,
        ic.status,
        ic.descricao_variacao,
        cpd.categoria_id,
        cpd.familia_id,
        cpd.id_marca,
        cpd.custo_gerencial,
        cpd.preco_venda,
        fam.nome AS nome_familia,
        COALESCE(um.sigla, '') AS unidade
      FROM itens_core ic
      LEFT JOIN comercial_produtos_dados cpd 
        ON ic.id_item = cpd.id_item AND ic.tenant_id = cpd.tenant_id
      LEFT JOIN comercial_familias fam 
        ON cpd.familia_id = fam.id AND cpd.tenant_id = fam.tenant_id
      LEFT JOIN itens_unidades_medida um
        ON ic.id_unidade = um.id_unidade AND ic.tenant_id = um.tenant_id
      WHERE ic.tenant_id = ?
      ORDER BY ic.nome_item ASC
    `;

    const [rows] = await pool.execute(query, [tenantId]);
    const itens = rows as any[];

    if (itens.length === 0) {
      return res.json([]);
    }

    // Retorna um array plano de SKUs individuais com dados comerciais
    const skus = itens.map((item: any) => {
      const nomeItem = item.nome_item || item.name || 'Produto sem nome';
      const nomeFamilia = item.nome_familia || item.category || '';
      const unidade = item.unidade || item.unitOfMeasure || '';
      const preco = Number(item.preco_venda ?? item.salePrice ?? 0);
      const custo = Number(item.custo_gerencial ?? 0);
      const estoque = Number(item.estoque ?? item.currentStock ?? 0);
      const status = String(item.status || 'ATIVO').toUpperCase();

      return {
        id: Number(item.id_item),
        id_item: Number(item.id_item),
        tenant_id: Number(item.tenant_id || tenantId),
        sku: item.sku || '',
        name: nomeItem,
        nome_item: nomeItem,
        barcode: '',
        category: nomeFamilia,
        categoria: nomeFamilia,
        categoria_id: item.categoria_id ?? null,
        familia_id: item.familia_id ?? null,
        id_marca: item.id_marca ?? null,
        unitOfMeasure: unidade,
        unidade,
        salePrice: preco,
        preco_venda: preco,
        custo_gerencial: custo,
        currentStock: estoque,
        estoque,
        minStock: 0,
        status,
        tipo_recurso: item.tipo_recurso || 'PRODUTO',
        pictureUrl: null,
        variacao: item.descricao_variacao || item.variacao || '',
        descricao_variacao: item.descricao_variacao || item.variacao || '',
        marca: item.marca || 'Própria',
      };
    });

    return res.json(skus);

  } catch (error) {
    console.error('Erro ao agrupar produtos do catálogo:', error);
    return res.status(500).json({ error: 'Erro ao carregar o catálogo.' });
  }
};

/**
 * 🔄 [UPDATE] PUT /produtos/:id_item
 * Atualiza um produto ou variação existente no catálogo
 */
export const createProdutosLote = async (req: Request, res: Response) => {
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || req.body.tenant_id || 1;
  const tenantId = Number(rawTenantId);
  const produtos = Array.isArray(req.body?.produtos) ? req.body.produtos : [];

  if (!produtos.length) {
    return res.status(400).json({ error: 'Nenhum produto informado para o lote.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const created: Array<{ id_item: number; sku: string }> = [];

    for (const item of produtos) {
      const itemRecord = item ?? {};
      const itemRows = Array.isArray(itemRecord.skus) && itemRecord.skus.length > 0 ? itemRecord.skus : [itemRecord];

      for (const skuRow of itemRows) {
        const sku = String(skuRow?.sku ?? itemRecord.sku ?? `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).trim();
        const nomeItem = String(skuRow?.nome_item ?? itemRecord.nome_item ?? itemRecord.nome ?? 'Produto sem nome').trim();
        const variacao = String(skuRow?.variacao ?? itemRecord.variacao ?? 'Único').trim();
        const tipoRecurso = String(skuRow?.tipo_recurso ?? itemRecord.tipo_recurso ?? 'PRODUTO').toUpperCase();
        const status = String(skuRow?.status ?? itemRecord.status ?? 'ATIVO').toUpperCase();
        const categoriaId = skuRow?.categoria_id ?? itemRecord.categoria_id;
        const familiaId = skuRow?.familia_id ?? itemRecord.familia_id;
        const idMarca = skuRow?.id_marca ?? itemRecord.id_marca;
        const precoVenda = Number(skuRow?.preco_venda ?? itemRecord.preco_venda ?? itemRecord.preco ?? 0);
        const custoGerencial = Number(skuRow?.custo_gerencial ?? itemRecord.custo_gerencial ?? itemRecord.custo ?? 0);

        const [result] = await connection.execute(
          `INSERT INTO itens_core (tenant_id, sku, nome_item, tipo_recurso, status, descricao_variacao)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [tenantId, sku || `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, nomeItem || 'Produto sem nome', tipoRecurso, status, variacao || 'Único']
        );

        const insertId = (result as any).insertId;

        await connection.execute(
          `INSERT INTO comercial_produtos_dados (tenant_id, id_item, categoria_id, familia_id, id_marca, custo_gerencial, preco_venda)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, insertId, categoriaId ? Number(categoriaId) : null, familiaId ? Number(familiaId) : null, idMarca ? Number(idMarca) : null, custoGerencial, precoVenda]
        );

        created.push({ id_item: insertId, sku });
      }
    }

    await connection.commit();
    return res.status(201).json({
      success: true,
      message: `${created.length} produto(s) cadastrados no lote com sucesso.`,
      data: created,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao salvar lote de produtos no catálogo:', error);
    return res.status(500).json({
      error: 'Erro ao salvar lote de produtos no catálogo.',
      details: error.message,
    });
  } finally {
    connection.release();
  }
};

export const updateProduto = async (req: Request, res: Response) => {
  const rawId = req.params.id_item ?? req.params.idItem;
  const idItem = Number(rawId);
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || req.body.tenant_id || 1;
  const tenantId = Number(rawTenantId);
  const payload = req.body;

  if (rawId === undefined || rawId === null || rawId === '' || !Number.isFinite(idItem) || idItem <= 0) {
    return res.status(400).json({ error: 'ID do item não informado para atualização.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Atualiza os dados básicos em itens_core (caso tenham sido enviados)
    const updateCoreFields: string[] = [];
    const updateCoreValues: any[] = [];

    if (payload.sku !== undefined) {
      updateCoreFields.push('sku = ?');
      updateCoreValues.push(payload.sku);
    }
    if (payload.nome_item !== undefined || payload.nome !== undefined) {
      updateCoreFields.push('nome_item = ?');
      updateCoreValues.push(payload.nome_item || payload.nome);
    }
    if (payload.status !== undefined) {
      updateCoreFields.push('status = ?');
      updateCoreValues.push(payload.status);
    }
    if (payload.variacao !== undefined || payload.descricao_variacao !== undefined) {
      updateCoreFields.push('descricao_variacao = ?');
      updateCoreValues.push(payload.descricao_variacao || payload.variacao);
    }

    if (updateCoreFields.length > 0) {
      updateCoreValues.push(idItem, tenantId);
      await connection.execute(
        `UPDATE itens_core SET ${updateCoreFields.join(', ')} WHERE id_item = ? AND tenant_id = ?`,
        updateCoreValues
      );
    }

    // 2. Atualiza os dados comerciais em comercial_produtos_dados
    const updateComercialFields: string[] = [];
    const updateComercialValues: any[] = [];

    if (payload.categoria_id !== undefined) {
      updateComercialFields.push('categoria_id = ?');
      updateComercialValues.push(payload.categoria_id ? Number(payload.categoria_id) : null);
    }
    if (payload.familia_id !== undefined) {
      updateComercialFields.push('familia_id = ?');
      updateComercialValues.push(payload.familia_id ? Number(payload.familia_id) : null);
    }
    if (payload.id_marca !== undefined) {
      updateComercialFields.push('id_marca = ?');
      updateComercialValues.push(payload.id_marca ? Number(payload.id_marca) : null);
    }
    if (payload.custo_gerencial !== undefined) {
      updateComercialFields.push('custo_gerencial = ?');
      updateComercialValues.push(Number(payload.custo_gerencial));
    }
    if (payload.preco_venda !== undefined) {
      updateComercialFields.push('preco_venda = ?');
      updateComercialValues.push(Number(payload.preco_venda));
    }

    if (updateComercialFields.length > 0) {
      updateComercialValues.push(idItem, tenantId);
      await connection.execute(
        `UPDATE comercial_produtos_dados SET ${updateComercialFields.join(', ')} WHERE id_item = ? AND tenant_id = ?`,
        updateComercialValues
      );
    }

    await connection.commit();

    return res.json({
      success: true,
      message: 'Produto atualizado com sucesso.',
      id_item: idItem,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao atualizar produto:', error);
    return res.status(500).json({ error: 'Erro ao atualizar produto.', details: error.message });
  } finally {
    await connection.release();
  }
};
