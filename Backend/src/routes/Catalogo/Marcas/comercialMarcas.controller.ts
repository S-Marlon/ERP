import { Request, Response } from 'express';
import pool from '../../Estoque/db.config'; // Ajuste o caminho do seu pool do banco conforme necessário

// 🟢 [CREATE] Cadastrar Nova Marca Comercial
export const createMarca = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || req.body.tenant_id || 1);
  const dados = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const nome = dados.nome ? dados.nome.trim() : '';
    if (!nome) {
      return res.status(400).json({
        success: false,
        error: 'O nome da marca é obrigatório.'
      });
    }

    // 1. Gera o slug de forma simples (ex: "Nike" -> "nike", "Adidas Originals" -> "adidas-originals")
    const slug = dados.slug || nome.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const codigo = dados.codigo || null;
    const site = dados.site || null;
    const logoUrl = dados.logo_url || null;
    const descricao = dados.descricao || null;
    const status = dados.status || 'Ativo';

    // 2. Insere na tabela comercial_marcas
    const queryInsert = `
      INSERT INTO comercial_marcas (
        tenant_id, codigo, nome, slug, site, logo_url, descricao, status, criado_em, alterado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [result]: any = await connection.execute(queryInsert, [
      tenantId,
      codigo,
      nome,
      slug,
      site,
      logoUrl,
      descricao,
      status
    ]);

    const idMarca = result.insertId;

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Marca cadastrada com sucesso!',
      id_marca: idMarca
    });

  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao cadastrar marca:', error);

    // Trata erro de duplicidade de nome (Unique Key)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Já existe uma marca cadastrada com este nome.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar o cadastro da marca.',
      details: error.message
    });
  } finally {
    connection.release();
  }
};

// 🔌 [READ] Buscar Marcas Comerciais (Com filtros opcionais por busca e status)
export const getMarcas = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
  const search = req.query.search ? String(req.query.search) : '';
  const status = req.query.status ? String(req.query.status) : '';

  const connection = await pool.getConnection();
  try {
    let query = `
      SELECT 
        m.id,
        m.tenant_id,
        m.codigo,
        m.nome,
        m.slug,
        m.site,
        m.logo_url,
        m.descricao,
        m.status,
        m.criado_em,
        m.alterado_em,
        (
          SELECT COUNT(*) 
          FROM comercial_produtos_dados p 
          WHERE p.id_marca = m.id AND p.tenant_id = m.tenant_id
        ) AS qtd_produtos
      FROM comercial_marcas m
      WHERE m.tenant_id = ?
    `;

    const queryParams: any[] = [tenantId];

    // Filtro por texto (Nome ou Código)
    if (search) {
      query += ` AND (m.nome LIKE ? OR m.codigo LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // Filtro por Status
    if (status) {
      query += ` AND m.status = ?`;
      queryParams.push(status);
    }

    query += ` ORDER BY m.nome ASC`;

    const [rows]: [any[], any] = await connection.execute(query, queryParams);

    return res.json(rows);

  } catch (error: any) {
    console.error('Erro ao buscar lista de marcas:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar lista de marcas.',
      details: error.message
    });
  } finally {
    connection.release();
  }
};