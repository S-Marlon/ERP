// produtos.controller.ts

import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';

/**
 * 📍 [READ] GET /produtos/search
 * Busca de itens priorizando dados comerciais e incluindo marcas
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
        COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku,
        -- REGRA DE PRIORIDADE DO NOME: 
        -- 1º Tenta o comercial_produtos_dados.nome_comercial (se não for vazio/null)
        -- 2º Se estiver vazio ou null, pega o itens_core.nome_item
        COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS name,
        ic.status,
        ic.descricao_variacao,
        COALESCE(um.sigla, '') AS unitOfMeasure,
        COALESCE(cpd.preco_venda, 0) AS salePrice,
        COALESCE(cf.nome, '') AS category,
        COALESCE(cm.nome, '') AS brand,
        NULL AS barcode,
        0 AS currentStock,
        0 AS minStock,
        NULL AS pictureUrl
      FROM itens_core ic
      LEFT JOIN comercial_produtos_dados cpd
        ON ic.id_item = cpd.id_item AND ic.tenant_id = cpd.tenant_id
      LEFT JOIN comercial_familias cf
        ON cpd.familia_id = cf.id AND cpd.tenant_id = cf.tenant_id
      LEFT JOIN comercial_marcas cm
        ON cpd.id_marca = cm.id AND cpd.tenant_id = cm.tenant_id
      LEFT JOIN itens_unidades_medida um
        ON ic.id_unidade = um.id_unidade AND ic.tenant_id = um.tenant_id
      WHERE ic.tenant_id = ?
        AND (
          ic.sku LIKE ?
          OR COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), '') LIKE ?
          OR ic.nome_item LIKE ?
          OR COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), '') LIKE ?
          OR ic.descricao_variacao LIKE ?
          OR cm.nome LIKE ?
        )
      ORDER BY COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) ASC
      LIMIT 10
    `;

    const [rows] = await pool.execute(query, [
      tenantId,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    ]);

    return res.json((rows as any[]).map((row: any) => ({
      id: Number(row.id),
      sku: row.sku || '',
      barcode: row.barcode || '',
      name: row.name || 'Produto',
      category: row.category || '',
      unitOfMeasure: row.unitOfMeasure || '',
      salePrice: Number(row.salePrice || 0),
      currentStock: Number(row.currentStock || 0),
      minStock: Number(row.minStock || 0),
      status: row.status || 'ATIVO',
      pictureUrl: row.pictureUrl || null,
      variacao: row.descricao_variacao || 'Principal',
      marca: row.brand || ''
    })));
  } catch (error: any) {
    console.error('Erro ao buscar produtos no catálogo novo:', error);
    return res.status(500).json({ error: 'Erro ao buscar produtos.', details: error.message });
  }
};

/**
 * 🔌 [READ] GET /produtos
 * Retorna array unificado aplicando precedência comercial e dados de marca
 */
export const getProdutos = async (req: Request, res: Response) => {
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || 1;
  const tenantId = Number(rawTenantId);

  try {
    const query = `
      SELECT 
        ic.id_item,
        ic.tenant_id,
        ic.sku AS sku_core,
        cpd.sku_customizado,
        COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku,
        ic.nome_item AS nome_core,
        cpd.nome_comercial,
        COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome_item,
        ic.tipo_recurso,
        ic.status,
        ic.descricao_variacao,
        cpd.categoria_id,
        cpd.familia_id,
        cpd.id_marca,
        cpd.custo_gerencial,
        cpd.preco_venda,
        cat.nome AS nome_categoria,  -- Adicionado
        fam.nome AS nome_familia,
        COALESCE(mar.nome, 'Própria') AS nome_marca,
        COALESCE(um.sigla, '') AS unidade
      FROM itens_core ic
      LEFT JOIN comercial_produtos_dados cpd 
        ON ic.id_item = cpd.id_item AND ic.tenant_id = cpd.tenant_id
      LEFT JOIN comercial_categorias cat 
        ON cpd.categoria_id = cat.id AND cpd.tenant_id = cat.tenant_id  -- Adicionado
      LEFT JOIN comercial_familias fam 
        ON cpd.familia_id = fam.id AND cpd.tenant_id = fam.tenant_id
      LEFT JOIN comercial_marcas mar 
        ON cpd.id_marca = mar.id AND cpd.tenant_id = mar.tenant_id
      LEFT JOIN itens_unidades_medida um
        ON ic.id_unidade = um.id_unidade AND ic.tenant_id = um.tenant_id
      WHERE ic.tenant_id = ?
      ORDER BY COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) ASC
    `;

    const [rows] = await pool.execute(query, [tenantId]);
    const itens = rows as any[];

    if (itens.length === 0) {
      return res.json([]);
    }

    const skus = itens.map((item: any) => {
      const nomeItem = item.nome_comercial || item.nome_item || 'Produto sem nome';
      const skuFinal = item.sku_customizado || item.sku || '';
      const nomeFamilia = item.nome_familia || '';
      const nomeMarca = item.nome_marca || '';
      const unidade = item.unidade || '';
      const preco = Number(item.preco_venda ?? 0);
      const custo = Number(item.custo_gerencial ?? 0);
      const status = String(item.status || 'ATIVO').toUpperCase();
      const nomeCategoria = item.nome_categoria || '';

      return {
        id: Number(item.id_item),
        id_item: Number(item.id_item),
        tenant_id: Number(item.tenant_id || tenantId),
        sku: skuFinal,
        sku_customizado: item.sku_customizado || '',
        sku_core: item.sku_core || '',
        name: nomeItem,
        nome_item: nomeItem,
        nome_comercial: item.nome_comercial || '',
        barcode: '',
        category: nomeCategoria,
        categoria: nomeCategoria,
        categoria_id: item.categoria_id ?? null,
        family: nomeFamilia,              // Nova propriedade para a Família
        familia: nomeFamilia,             // Nova propriedade para a Família
        familia_id: item.familia_id ?? null,
        id_marca: item.id_marca ?? null,
        unitOfMeasure: unidade,
        unidade,
        salePrice: preco,
        preco_venda: preco,
        custo_gerencial: custo,
        currentStock: 0,
        estoque: 0,
        minStock: 0,
        status,
        tipo_recurso: item.tipo_recurso || 'PRODUTO',
        pictureUrl: null,
        variacao: item.descricao_variacao || 'Principal',
        descricao_variacao: item.descricao_variacao || 'Principal',
        marca: nomeMarca,
      };
    });

    return res.json(skus);

  } catch (error) {
    console.error('Erro ao agrupar produtos do catálogo:', error);
    return res.status(500).json({ error: 'Erro ao carregar o catálogo.' });
  }
};

/**
 * 📦 [CREATE] POST /produtos/lote
 * Cadastra lote de itens core e dados comerciais associados com suporte a marcas
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
        const skuCore = String(skuRow?.sku ?? itemRecord.sku ?? `SKU-${Date.now()}`).trim();
        const skuCustom = skuRow?.sku_customizado ? String(skuRow.sku_customizado).trim() : null;
        
        const nomeCore = String(skuRow?.nome_item ?? skuRow?.name ?? skuRow?.nome ?? itemRecord.nome_item ?? itemRecord.name ?? itemRecord.nome ?? 'Produto sem nome').trim();
        const nomeComerc = skuRow?.nome_comercial ?? skuRow?.name ?? skuRow?.nome ?? itemRecord.nome_comercial ?? itemRecord.name ?? null;
        const nomeComercial = nomeComerc ? String(nomeComerc).trim() : null;

        const variacao = String(skuRow?.variacao ?? itemRecord.variacao ?? 'Principal').trim();
        const tipoRecurso = String(skuRow?.tipo_recurso ?? itemRecord.tipo_recurso ?? 'PRODUTO').toUpperCase();
        const status = String(skuRow?.status ?? itemRecord.status ?? 'ATIVO').toUpperCase();
        const categoriaId = skuRow?.categoria_id ?? itemRecord.categoria_id;
        const familiaId = skuRow?.familia_id ?? itemRecord.familia_id;
        const idMarca = skuRow?.id_marca ?? itemRecord.id_marca;
        const precoVenda = Number(skuRow?.preco_venda ?? skuRow?.salePrice ?? itemRecord.preco ?? 0);
        const custoGerencial = Number(skuRow?.custo_gerencial ?? skuRow?.custo ?? itemRecord.custo ?? 0);

        const [result] = await connection.execute(
          `INSERT INTO itens_core (tenant_id, sku, nome_item, tipo_recurso, status, descricao_variacao)
            VALUES (?, ?, ?, ?, ?, ?)`,
          [tenantId, skuCore, nomeCore, tipoRecurso, status, variacao]
        );

        const insertId = (result as any).insertId;

        await connection.execute(
          `INSERT INTO comercial_produtos_dados (tenant_id, id_item, sku_customizado, nome_comercial, categoria_id, familia_id, id_marca, custo_gerencial, preco_venda)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, insertId, skuCustom, nomeComercial, categoriaId ? Number(categoriaId) : null, familiaId ? Number(familiaId) : null, idMarca ? Number(idMarca) : null, custoGerencial, precoVenda]
        );

        created.push({ id_item: insertId, sku: skuCustom || skuCore });
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
    return res.status(500).json({ error: 'Erro ao salvar lote de produtos no catálogo.', details: error.message });
  } finally {
    connection.release();
  }
};

/**
 * 🔄 [UPDATE] PUT /produtos/:id_item
 * Atualiza produto unificado com suporte a marcas e aliases comerciais
 */
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

    const updateCoreFields: string[] = [];
    const updateCoreValues: any[] = [];

    const coreName = payload.nome_core ?? payload.nome_item;
    if (coreName !== undefined) {
      updateCoreFields.push('nome_item = ?');
      updateCoreValues.push(coreName);
    }
    if (payload.sku_core !== undefined) {
      updateCoreFields.push('sku = ?');
      updateCoreValues.push(payload.sku_core);
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

    const skuCustomizado = payload.sku_customizado !== undefined ? (payload.sku_customizado ? String(payload.sku_customizado).trim() : null) : undefined;
    const rawNomeComercial = payload.nome_comercial ?? payload.name ?? payload.nome;
    const nomeComercial = rawNomeComercial !== undefined ? (rawNomeComercial ? String(rawNomeComercial).trim() : null) : undefined;

    const categoriaId = payload.categoria_id !== undefined ? (payload.categoria_id ? Number(payload.categoria_id) : null) : undefined;
    const familiaId = payload.familia_id !== undefined ? (payload.familia_id ? Number(payload.familia_id) : null) : undefined;
    const idMarca = payload.id_marca !== undefined ? (payload.id_marca ? Number(payload.id_marca) : null) : undefined;
    const custoGerencial = payload.custo_gerencial !== undefined ? Number(payload.custo_gerencial) : undefined;
    const precoVenda = payload.preco_venda ?? payload.salePrice !== undefined ? Number(payload.preco_venda ?? payload.salePrice) : undefined;

    await connection.execute(
      `INSERT INTO comercial_produtos_dados 
        (id_item, tenant_id, sku_customizado, nome_comercial, categoria_id, familia_id, id_marca, custo_gerencial, preco_venda)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
          sku_customizado = COALESCE(?, sku_customizado),
          nome_comercial = COALESCE(?, nome_comercial),
          categoria_id = COALESCE(?, categoria_id),
          familia_id = COALESCE(?, familia_id),
          id_marca = COALESCE(?, id_marca),
          custo_gerencial = COALESCE(?, custo_gerencial),
          preco_venda = COALESCE(?, preco_venda)`,
      [
        idItem, tenantId, 
        skuCustomizado ?? null, 
        nomeComercial ?? null, 
        categoriaId ?? null, 
        familiaId ?? null, 
        idMarca ?? null, 
        custoGerencial ?? 0, 
        precoVenda ?? 0,
        skuCustomizado ?? null, 
        nomeComercial ?? null, 
        categoriaId ?? null, 
        familiaId ?? null, 
        idMarca ?? null, 
        custoGerencial ?? 0, 
        precoVenda ?? 0
      ]
    );

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
    connection.release();
  }
};