import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';

/**
 * 🔌 [READ] Buscar Categorias (Trazendo os atributos vinculados aninhados com governança)
 */
export const getCategoriasSelect = async (req: Request, res: Response) => {
  const rawTenantId = req.query.tenant_id || req.headers['x-tenant-id'] || 1;
  const tenantId = Number(rawTenantId);

  try {
    // 1. Busca todas as categorias (Ajustado de created_at/updated_at para criado_em/alterado_em se houver, ou omitido se não houver na tabela comercial_categorias)
    const queryCategorias = `
      SELECT id, tenant_id, categoria_pai_id, nome, slug, ativa, ordem, 
             descricao, margem_sugerida, modo_exibicao
      FROM comercial_categorias
      WHERE tenant_id = ?
      ORDER BY ordem ASC
    `;
    const [catRows] = await pool.execute(queryCategorias, [tenantId]);
    const categorias = catRows as any[];

    if (categorias.length === 0) return res.json([]);

    // 2. Busca TODOS os vínculos de atributos (Garantindo a exatidão das colunas do seu DESCRIBE)
    const queryAtributos = `
      SELECT ae.id_entidade, a.id, a.nome, a.tipo, ae.obrigatorio, ae.herdar, 
             ae.ordem, ae.bloqueado, ae.retransmitir, ae.sobrescreve, ae.exemplos,
             a.sufixo, a.escopo_padrao
      FROM atributos_core_entidades ae
      INNER JOIN atributos_comercial a ON a.id = ae.atributo_id AND a.tenant_id = ae.tenant_id
      WHERE ae.tenant_id = ? AND ae.tipo_entidade = 'categoria' AND ae.ativo = 1
    `;
    const [attrRows] = await pool.execute(queryAtributos, [tenantId]);
    const atributos = attrRows as any[];

    // 3. Agrupa e monta o objeto final esperado pelo Frontend
    const resultado = categorias.map(cat => {
      const meusAtributos = atributos
        .filter(attr => Number(attr.id_entidade) === Number(cat.id)) 
        .map(attr => ({
          id: String(attr.id),
          nome: attr.nome,
          tipoDado: attr.tipo,
          sufixo: attr.sufixo || undefined,
          escopoComercial: attr.escopo_padrao || 'ficha',
          obrigatorio: Boolean(attr.obrigatorio),
          herdar: Boolean(attr.herdar),
          ordem: Number(attr.ordem),
          bloqueado: Boolean(attr.bloqueado),
          retransmitir: Boolean(attr.retransmitir),
          sobrescreve: Boolean(attr.sobrescreve),
          exemplos: attr.exemplos || ''
        }));

      return {
        ...cat,
        id: String(cat.id),
        categoria_pai_id: cat.categoria_pai_id ? String(cat.categoria_pai_id) : null,
        ativa: Boolean(cat.ativa),
        margem_sugerida: cat.margem_sugerida ? Number(cat.margem_sugerida) : 0,
        atributosHeranca: meusAtributos 
      };
    });

    return res.json(resultado);
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar categorias' });
  }
};

/**
 * 🟢 [CREATE] Categoria + Vínculo de Atributos (Com suporte à Governança)
 */
export const createCategoria = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const {
      tenant_id,
      nome,
      categoria_pai_id,
      margem_sugerida,
      modo_exibicao,
      descricao,
      atributos_vinculados
    } = req.body;

    const vTenantId = Number(tenant_id || 1);
    const vNome = nome?.trim() || 'Nova Categoria';
    const vPai = categoria_pai_id ? Number(categoria_pai_id) : null;
    const vMargem = margem_sugerida ?? null;
    const vModo = modo_exibicao || 'grade';
    const vDescricao = descricao || '';

    const slug = vNome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    await connection.beginTransaction();

    // 1. Insere a Categoria
    const queryCategoria = `
      INSERT INTO comercial_categorias
        (tenant_id, categoria_pai_id, nome, slug, ativa, margem_sugerida, modo_exibicao, descricao, ordem)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, 0)
    `;
    const [result] = await connection.execute(queryCategoria, [
      vTenantId, vPai, vNome, slug, vMargem, vModo, vDescricao
    ]);
    
    const novaCategoriaId = (result as any).insertId;

    // 2. Insere os Vínculos na Tabela Pivô (Incluindo os novos campos de Governança)
    if (Array.isArray(atributos_vinculados) && atributos_vinculados.length > 0) {
      const queryPivot = `
        INSERT INTO atributos_core_entidades 
          (tenant_id, tipo_entidade, id_entidade, atributo_id, obrigatorio, herdar, ordem, 
           bloqueado, retransmitir, sobrescreve, exemplos, ativo)
        VALUES (?, 'categoria', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `;
      for (const attr of atributos_vinculados) {
        const vAtributoId = attr.atributo_id || attr.id;
        if (!vAtributoId) continue;

        await connection.execute(queryPivot, [
          vTenantId, 
          novaCategoriaId, 
          Number(vAtributoId), 
          attr.obrigatorio ? 1 : 0, 
          attr.herdar ? 1 : 0, 
          attr.ordem || 0,
          attr.bloqueado ? 1 : 0,
          attr.retransmitir ? 1 : 0,
          attr.sobrescreve ? 1 : 0,
          attr.exemplos || ''
        ]);
      }
    }

    await connection.commit();
    return res.status(201).json({ success: true, id: String(novaCategoriaId) });
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao criar categoria:', error);
    return res.status(500).json({ error: 'Erro ao criar categoria' });
  } finally {
    connection.release();
  }
};

/**
 * 🟡 [UPDATE] Categoria + Atualização Dinâmica de Atributos (Com suporte à Governança)
 */
export const updateCategoria = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const { idCategoria } = req.params;
    const tenantId = Number(req.query.tenant_id || req.body.tenant_id || 1);
    const { atributos_vinculados, ...body } = req.body;

    await connection.beginTransaction();

    // 1. Construção dinâmica segura
    const fields: string[] = [];
    const params: any[] = [];
    const allowedFields = ['nome', 'categoria_pai_id', 'ativa', 'margem_sugerida', 'modo_exibicao', 'descricao'];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);
        
        if (field === 'ativa') {
          params.push(body[field] ? 1 : 0);
        } else if (field === 'categoria_pai_id' && !body[field]) {
          params.push(null);
        } else {
          params.push(body[field] ?? null);
        }
      }
    });

    if (fields.length > 0) {
      params.push(idCategoria, tenantId);
      
      const queryUpdateCat = `
        UPDATE comercial_categorias 
        SET ${fields.join(', ')} 
        WHERE id = ? AND tenant_id = ?
      `;
      await connection.execute(queryUpdateCat, params);
    }

    // 2. Sincronização dos Atributos (Pivô) com os novos campos de Governança
    if (atributos_vinculados !== undefined) {
      await connection.execute(
        `DELETE FROM atributos_core_entidades WHERE id_entidade = ? AND tipo_entidade = 'categoria' AND tenant_id = ?`,
        [idCategoria, tenantId]
      );

      if (Array.isArray(atributos_vinculados) && atributos_vinculados.length > 0) {
        const queryPivot = `
          INSERT INTO atributos_core_entidades 
            (tenant_id, tipo_entidade, id_entidade, atributo_id, obrigatorio, herdar, ordem, 
             bloqueado, retransmitir, sobrescreve, exemplos, ativo)
          VALUES (?, 'categoria', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `;
        
        for (const attr of atributos_vinculados) {
          const vAtributoId = attr.atributo_id || attr.id;

          if (!vAtributoId) {
            console.warn('⚠️ Um atributo sem ID foi enviado pelo frontend e ignorado:', attr);
            continue;
          }

          await connection.execute(queryPivot, [
            tenantId, 
            idCategoria, 
            Number(vAtributoId), 
            attr.obrigatorio ? 1 : 0, 
            attr.herdar ? 1 : 0, 
            attr.ordem || 0,
            attr.bloqueado ? 1 : 0,
            attr.retransmitir ? 1 : 0,
            attr.sobrescreve ? 1 : 0,
            attr.exemplos || ''
          ]);
        }
      }
    }

    await connection.commit();
    return res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao atualizar categoria:', error);
    return res.status(500).json({ error: 'Erro ao atualizar categoria' });
  } finally {
    connection.release();
  }
};

/**
 * 🗑️ [DELETE]
 */
export const deleteCategoria = async (req: Request, res: Response) => {
  try {
    const { idCategoria } = req.params;
    const tenantId = Number(req.query.tenant_id || 1);

    const [filhos] = await pool.execute(
      `SELECT id FROM comercial_categorias WHERE categoria_pai_id = ? AND tenant_id = ? LIMIT 1`,
      [idCategoria, tenantId]
    );

    if ((filhos as any[]).length > 0) {
      return res.status(400).json({ error: 'Categoria possui subcategorias' });
    }

    await pool.execute(
      `DELETE FROM comercial_categorias WHERE id = ? AND tenant_id = ?`,
      [idCategoria, tenantId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir categoria:', error);
    return res.status(500).json({ error: 'Erro ao excluir categoria' });
  }
};

/**
 * 🔀 [PATCH] Order
 */
export const updateCategoriesOrder = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const { tenant_id, ordenacao } = req.body;

    if (!Array.isArray(ordenacao)) {
      return res.status(400).json({ error: 'Formato inválido' });
    }

    await connection.beginTransaction();

    for (const item of ordenacao) {
      await connection.execute(
        `UPDATE comercial_categorias SET ordem = ? WHERE id = ? AND tenant_id = ?`,
        [item.ordem, item.id, tenant_id || 1]
      );
    }

    await connection.commit();
    return res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao reordenar:', error);
    return res.status(500).json({ error: 'Erro interno ao reordenar' });
  } finally {
    connection.release();
  }
};

/**
 * 🧠 [ATRIBUTOS POR CATEGORIA] (Trazendo o status de Governança)
 */
export const getAtributosByCategoria = async (req: Request, res: Response) => {
  try {
    const { idCategoria } = req.params;
    const tenant_id = Number(req.query.tenant_id || 1);

    const query = `
      SELECT 
        a.id AS id, a.nome AS nome, a.tipo AS tipo, a.unidade_id AS unidadeId,
        ae.obrigatorio AS obrigatorio, ae.herdar AS herdar,
        ae.sobrescreve AS sobrescreve, ae.bloqueado AS bloqueado, 
        ae.retransmitir AS retransmitir, ae.exemplos AS exemplos, ae.ordem AS ordem
      FROM atributos_core_entidades ae
      INNER JOIN atributos_comercial a
        ON a.id = ae.atributo_id AND a.tenant_id = ae.tenant_id
      WHERE ae.id_entidade = ? AND ae.tipo_entidade = 'categoria'
        AND ae.tenant_id = ? AND ae.ativo = 1
      ORDER BY ae.ordem ASC
    `;

    const [rows] = await pool.execute(query, [idCategoria, tenant_id]);
    const result = (rows as any[]).map(attr => ({
      ...attr,
      id: String(attr.id),
      obrigatorio: Boolean(attr.obrigatorio),
      herdar: Boolean(attr.herdar),
      sobrescreve: Boolean(attr.sobrescreve),
      bloqueado: Boolean(attr.bloqueado),
      retransmitir: Boolean(attr.retransmitir)
    }));

    return res.json(result);
  } catch (error: any) {
    console.error('Erro ao buscar atributos:', error);
    return res.status(500).json({ error: 'Erro ao buscar atributos', detail: error.message });
  }
};

export const getAtributosGlobais = async (req: Request, res: Response) => {
  try {
    const tenant_id = Number(req.query.tenant_id || 1);
    
    const [atributos] = await pool.execute(
      'SELECT id, nome, tipo FROM atributos_comercial WHERE tenant_id = ?',
      [tenant_id]
    );

    return res.json(atributos);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao buscar atributos do banco.' });
  }
};