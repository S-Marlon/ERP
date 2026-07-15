// backend/src/modules/Catalogo/Atributos/gruposAtributos.controller.ts
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';

/**
 * 🔍 LISTAR GRUPOS DE ATRIBUTOS
 */
export const getGruposAtributos = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || 1;

    const [rows]: any = await pool.execute(
      `SELECT id, nome, descricao 
       FROM atributos_comercial_grupos 
       WHERE tenant_id = ? AND ativo = 1 
       ORDER BY nome ASC`,
      [Number(tenantId)]
    );

    res.status(200).json(rows || []);
  } catch (error: any) {
    console.error('❌ Erro ao listar grupos de atributos:', error);
    res.status(500).json({ error: 'Erro interno ao buscar grupos de atributos.' });
  }
};

/**
 * ➕ CRIAR GRUPO DE ATRIBUTOS
 */
export const createGrupoAtributo = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 1;
    const { nome, descricao } = req.body;

    if (!nome || !nome.trim()) {
      res.status(400).json({ error: '❌ O nome do grupo é obrigatório.' });
      return;
    }

    const nomeTratado = nome.trim();

    // 🛡️ Validação de Unicidade: Evita grupos duplicados com o mesmo nome para o mesmo tenant
    const [grupoExistente]: any = await pool.execute(
      'SELECT id FROM atributos_comercial_grupos WHERE tenant_id = ? AND nome = ? AND ativo = 1 LIMIT 1',
      [Number(tenantId), nomeTratado]
    );

    if (grupoExistente.length > 0) {
      res.status(400).json({ error: '❌ Já existe um grupo de atributos ativo com este nome.' });
      return;
    }

    const [result]: any = await pool.execute(
      `INSERT INTO atributos_comercial_grupos (tenant_id, nome, descricao, ativo) 
       VALUES (?, ?, ?, 1)`,
      [Number(tenantId), nomeTratado, descricao?.trim() || null]
    );

    res.status(201).json({ id: result.insertId, message: 'Grupo criado com sucesso!' });
  } catch (error: any) {
    console.error('❌ Erro ao criar grupo de atributo:', error);
    res.status(500).json({ error: 'Erro ao salvar o grupo de atributo.' });
  }
};

/**
 * ✏️ ATUALIZAR GRUPO DE ATRIBUTOS
 */
export const updateGrupoAtributo = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 1;
    const { idGrupo } = req.params;
    const { nome, descricao } = req.body;

    // 🛡️ Validação de entrada para evitar estouro de erro no trim()
    if (!nome || !nome.trim()) {
      res.status(400).json({ error: '❌ O nome do grupo não pode ser vazio.' });
      return;
    }

    const nomeTratado = nome.trim();

    // 🛡️ Validação de Unicidade no Update: Impede renomear para um nome que outro grupo já usa
    const [grupoExistente]: any = await pool.execute(
      'SELECT id FROM atributos_comercial_grupos WHERE tenant_id = ? AND nome = ? AND id <> ? AND ativo = 1 LIMIT 1',
      [Number(tenantId), nomeTratado, Number(idGrupo)]
    );

    if (grupoExistente.length > 0) {
      res.status(400).json({ error: '❌ Já existe outro grupo ativo com este nome.' });
      return;
    }

    await pool.execute(
      `UPDATE atributos_comercial_grupos 
       SET nome = ?, descricao = ? 
       WHERE id = ? AND tenant_id = ?`,
      [nomeTratado, descricao?.trim() || null, Number(idGrupo), Number(tenantId)]
    );

    res.status(200).json({ message: 'Grupo atualizado com sucesso.' });
  } catch (error: any) {
    console.error('❌ Erro ao atualizar grupo de atributo:', error);
    res.status(500).json({ error: 'Erro ao modificar o grupo de atributo.' });
  }
};

/**
 * 🗑️ DELETAR GRUPO DE ATRIBUTOS (SOFT DELETE)
 */
export const deleteGrupoAtributo = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 1;
    const { idGrupo } = req.params;

    // Proteção de integridade: Verifica se há algum atributo usando esse grupo
    const [vinculos]: any = await pool.execute(
      'SELECT id FROM atributos_comercial WHERE grupo_id = ? AND tenant_id = ? AND ativo = 1 LIMIT 1',
      [Number(idGrupo), Number(tenantId)]
    );

    if (vinculos.length > 0) {
      res.status(400).json({ error: '❌ Não é possível remover um grupo que possui atributos vinculados.' });
      return;
    }

    await pool.execute(
      `UPDATE atributos_comercial_grupos SET ativo = 0 WHERE id = ? AND tenant_id = ?`,
      [Number(idGrupo), Number(tenantId)]
    );

    res.status(200).json({ message: 'Grupo removido com sucesso.' });
  } catch (error: any) {
    console.error('❌ Erro ao deletar grupo de atributo:', error);
    res.status(500).json({ error: 'Erro ao remover o grupo de atributo.' });
  }
};