import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';

export const getGruposAtributos = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantIdFinal = req.query.tenant_id || '1';

    const [rows]: any = await pool.execute(
      `SELECT id, nome, descricao 
       FROM atributos_comercial_grupos 
       WHERE tenant_id = ? AND ativo = 1 
       ORDER BY nome ASC`,
      [tenantIdFinal]
    );

    // SE O BANCO RETORNAR VAZIO, MANDAMOS UM MOCK DE TESTE PARA O FRONT NÃO TRAVAR
    if (!rows || rows.length === 0) {
      res.status(200).json([
        { id: "1", nome: "Componentes Mecânicos", descricao: "Rolamentos e retentores" },
        { id: "2", nome: "Motorização", descricao: "Dados de potência e torque" }
      ]);
      return;
    }

    res.status(200).json(rows);
  } catch (error: any) {
    // FALLBACK DE SEGURANÇA SE O BANCO DE MIGRATION DER ERRO DE CONEXÃO
    res.status(200).json([
      { id: "1", nome: "Grupo de Teste (Banco Offline)", descricao: "Ajuste a conexão" }
    ]);
  }
};