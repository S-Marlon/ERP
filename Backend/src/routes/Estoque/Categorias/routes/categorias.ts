import { Request, Response } from 'express';
import pool from '../../db.config';

// 🔌 [READ] Buscar e Higienizar as Categorias
export const getCategoriasSelect = async (req: Request, res: Response) => {
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || 1; 
  const tenantId = Number(rawTenantId);

  try {
    const query = `
      SELECT 
        id_categoria, id_categoria_pai, nome_categoria as nome, slug, ativa, ordem,
        percentual_margem_sugerida, modo_exibicao, descricao, atributos_heranca, seo, integracoes, assets
      FROM categorias_global
      WHERE tenant_id = ?
      ORDER BY ordem ASC
    `;

    const [rows] = await pool.execute(query, [tenantId]);
    const categorias = rows as any[];

    const formatadas = categorias.map(cat => {
      const rawAtributos = typeof cat.atributos_heranca === 'string' ? JSON.parse(cat.atributos_heranca) : cat.atributos_heranca;
      const rawSeo = typeof cat.seo === 'string' ? JSON.parse(cat.seo) : cat.seo;
      const rawIntegracoes = typeof cat.integracoes === 'string' ? JSON.parse(cat.integracoes) : cat.integracoes;
      const rawAssets = typeof cat.assets === 'string' ? JSON.parse(cat.assets) : cat.assets;

      return {
        ...cat,
        id_categoria: String(cat.id_categoria), 
        id_categoria_pai: cat.id_categoria_pai ? String(cat.id_categoria_pai) : null,
        ativa: Boolean(cat.ativa),
        percentual_margem_sugerida: cat.percentual_margem_sugerida ? Number(cat.percentual_margem_sugerida) : 0,
        atributos_heranca: Array.isArray(rawAtributos) ? rawAtributos : [],
        seo: { tags: rawSeo?.tags || '', metaTitle: rawSeo?.metaTitle || '', metaDescription: rawSeo?.metaDescription || '', ...rawSeo },
        integracoes: { erpId: rawIntegracoes?.erpId || '', vtexId: rawIntegracoes?.vtexId || '', mercadolivreId: rawIntegracoes?.mercadolivreId || '', ...rawIntegracoes },
        assets: { iconeUrl: rawAssets?.iconeUrl || '', bannerUrl: rawAssets?.bannerUrl || '', ...rawAssets }
      };
    });

    return res.json(formatadas);
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao buscar categorias' });
  }
};

// 🟢 [CREATE] Criar Categoria
export const createCategoria = async (req: Request, res: Response) => {
  try {
    const { tenant_id, nome, id_categoria_pai, percentual_margem_sugerida, modo_exibicao, descricao } = req.body;
    
    // 1. Tratamento seguro para evitar que qualquer valor vá como 'undefined'
    const vTenantId = Number(tenant_id || 1);
    const vNome = nome || 'Nova Categoria';
    const vIdPai = id_categoria_pai ? String(id_categoria_pai) : null;
    const vMargem = percentual_margem_sugerida !== undefined && percentual_margem_sugerida !== null ? Number(percentual_margem_sugerida) : 0;
    const vModo = modo_exibicao || 'grade';
    const vDescricao = descricao || '';

    // 2. Gerar o slug de forma segura
    const slug = vNome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    // 3. Query estruturada com exatamente 7 placeholders (?)
    const query = `
      INSERT INTO categorias_global 
        (tenant_id, nome_categoria, id_categoria_pai, percentual_margem_sugerida, modo_exibicao, descricao, slug, ativa)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `;

    // 4. Array contendo EXATAMENTE 7 elementos bem definidos
    const params = [
      vTenantId,   // 1
      vNome,       // 2
      vIdPai,      // 3
      vMargem,     // 4
      vModo,       // 5
      vDescricao,  // 6
      slug         // 7
    ];

    const [result] = await pool.execute(query, params);
    const insertId = (result as any).insertId;

    return res.status(201).json({ 
      success: true, 
      message: 'Categoria criada com sucesso!', 
      id_categoria: String(insertId) 
    });

  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao criar categoria' });
  }
};

// 🟡 [UPDATE] Atualizar Categoria Completa
export const updateCategoria = async (req: Request, res: Response) => {
  try {
    const { idCategoria } = req.params;
    const tenantId = Number(req.query.tenant_id || 1);
    const { nome, id_categoria_pai, ativa, percentual_margem_sugerida, modo_exibicao, descricao, atributos_heranca, seo, integracoes } = req.body;

    const query = `
      UPDATE categorias_global SET
        nome_categoria = COALESCE(?, nome_categoria),
        id_categoria_pai = ?,
        ativa = COALESCE(?, ativa),
        percentual_margem_sugerida = COALESCE(?, percentual_margem_sugerida),
        modo_exibicao = COALESCE(?, modo_exibicao),
        descricao = COALESCE(?, descricao),
        atributos_heranca = ?,
        seo = ?,
        integracoes = ?
      WHERE id_categoria = ? AND tenant_id = ?
    `;

    // Processa os objetos/arrays em string JSON para salvar com segurança no MySQL
    await pool.execute(query, [
      nome || null,
      id_categoria_pai || null,
      ativa !== undefined ? (ativa ? 1 : 0) : null,
      percentual_margem_sugerida !== undefined ? percentual_margem_sugerida : null,
      modo_exibicao || null,
      descricao || null,
      JSON.stringify(atributos_heranca || []),
      JSON.stringify(seo || {}),
      JSON.stringify(integracoes || {}),
      idCategoria,
      tenantId
    ]);

    return res.json({ success: true, message: 'Categoria atualizada com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao atualizar categoria' });
  }
};

// 🗑️ [DELETE] Excluir Categoria (Físico)
export const deleteCategoria = async (req: Request, res: Response) => {
  try {
    const { idCategoria } = req.params;
    const tenantId = Number(req.query.tenant_id || 1);

    // Opcional: Se quiser impedir que deletem uma categoria que possui subcategorias filhas:
    const [filhos] = await pool.execute('SELECT id_categoria FROM categorias_global WHERE id_categoria_pai = ? AND tenant_id = ? LIMIT 1', [idCategoria, tenantId]);
    if ((filhos as any[]).length > 0) {
      return res.status(400).json({ error: 'Não é possível excluir uma categoria que possui subcategorias associadas.' });
    }

    await pool.execute('DELETE FROM categorias_global WHERE id_categoria = ? AND tenant_id = ?', [idCategoria, tenantId]);

    return res.json({ success: true, message: 'Categoria excluída com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir categoria:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao excluir categoria' });
  }
};

// 🔀 [PATCH] Reordenar Categorias (Bulk Update simplificado)
export const updateCategoriesOrder = async (req: Request, res: Response) => {
  try {
    const { tenant_id, ordenacao } = req.body; // ordenacao = [{ id: "10", ordem: 1 }, { id: "12", ordem: 2 }]

    if (!Array.isArray(ordenacao)) {
      return res.status(400).json({ error: 'Formato de ordenação inválido.' });
    }

    // Executa as atualizações em paralelo usando Promise.all
    const promessas = ordenacao.map(item => {
      return pool.execute(
        'UPDATE categorias_global SET ordem = ? WHERE id_categoria = ? AND tenant_id = ?',
        [item.ordem, item.id, tenant_id || 1]
      );
    });

    await Promise.all(promessas);

    return res.json({ success: true, message: 'Ordenação atualizada com sucesso!' });
  } catch (error) {
    console.error('Erro ao reordenar categorias:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao reordenar categorias' });
  }
};