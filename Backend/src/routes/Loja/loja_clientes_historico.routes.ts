import { Router, Request, Response } from 'express';
import pool from '../Estoque/db.config';

const router = Router();

export default router;

/*
|--------------------------------------------------------------------------
| GET HISTÓRICO DO CLIENTE (LOJA)
|--------------------------------------------------------------------------
|
| Retorna timeline comercial/operacional do cliente
|
*/

router.get('/ping', (_req: Request, res: Response) => {
  return res.send('🟢 API LOJA OK - ROTA ATIVA');
});


router.get('/:id_cliente/historico', async (req: Request, res: Response) => {

  try {

    const { id_cliente } = req.params;

    const [rows]: any = await pool.query(`
      SELECT
        h.id,
        h.tenant_id,
        h.id_cliente,
        h.tipo,
        h.origem,
        h.canal,
        h.referencia_tipo,
        h.referencia_id,
        h.titulo,
        h.descricao,
        h.valor,
        h.metadata,
        h.criado_por,
        h.created_at,
        h.updated_at
      FROM loja_clientes_historico h
      WHERE h.id_cliente = ?
        AND h.deleted_at IS NULL
      ORDER BY h.created_at DESC
    `, [id_cliente]);

    const historico = rows.map((item: any) => ({
      id: item.id,
      tenant_id: item.tenant_id,
      id_cliente: item.id_cliente,
      tipo: item.tipo,
      origem: item.origem,
      canal: item.canal,
      referencia: {
        tipo: item.referencia_tipo,
        id: item.referencia_id
      },
      titulo: item.titulo,
      descricao: item.descricao,
      valor: item.valor ? Number(item.valor) : null,
      metadata: typeof item.metadata === 'string'
  ? JSON.parse(item.metadata)
  : item.metadata ?? null,
      criado_por: item.criado_por,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    return res.json(historico);

   } catch (error: any) {

  console.error('Erro ao buscar histórico:', error);

  return res.status(500).json({
    error: 'Erro ao buscar histórico do cliente',
    message: error?.message,
    stack: process.env.NODE_ENV === 'development'
      ? error?.stack
      : undefined
  });
}
});
