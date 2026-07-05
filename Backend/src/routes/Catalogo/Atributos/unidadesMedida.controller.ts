import { Request, Response } from 'express';
import pool from '../../Estoque/db.config'; // Conexão oficial via Pool de Clientes

export const getUnidadesMedida = async (req: Request, res: Response): Promise<void> => {
  try {
    // Pega o tenant_id da query; se não existir, assume '1' por padrão
    const tenantIdFinal = req.query.tenant_id || '1';

    // Busca as unidades de medida (mm, ", BAR, etc) cadastradas e ativas
    const [rows] = await pool.execute(
      `SELECT id, nome, simbolo, tipo 
       FROM atributos_comercial_unidades 
       WHERE tenant_id = ? AND ativo = 1 
       ORDER BY nome ASC`,
      [tenantIdFinal]
    );

    res.status(200).json(rows);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Erro interno ao carregar as unidades de medida.', 
      details: error.message 
    });
  }
};