// backend/src/modules/Catalogo/Atributos/unidadesMedida.controller.ts
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config'; // Conexão oficial via Pool de Clientes

/**
 * 🔍 LISTAR UNIDADES DE MEDIDA
 */
export const getUnidadesMedida = async (req: Request, res: Response): Promise<void> => {
  try {
    // 🔥 Correção: Captura o tenant padronizado priorizando os headers, exatamente como os outros controllers
    const tenantIdFinal = req.headers['x-tenant-id'] || req.query.tenant_id || 1;

    // Busca as unidades de medida (mm, ", BAR, etc) cadastradas e ativas
    const [rows] = await pool.execute(
      `SELECT id, nome, simbolo, tipo 
       FROM atributos_comercial_unidades 
       WHERE tenant_id = ? AND ativo = 1 
       ORDER BY nome ASC`,
      [Number(tenantIdFinal)] // 🔥 Correção: Garante que o ID do tenant seja tratado estritamente como Number
    );

    res.status(200).json(rows || []);
  } catch (error: any) {
    console.error('❌ Erro ao listar unidades de medida:', error);
    res.status(500).json({ 
      error: 'Erro interno ao carregar as unidades de medida.', 
      details: error.message 
    });
  }
};