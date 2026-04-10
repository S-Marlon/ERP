import express, { Request, Response, NextFunction } from 'express';
import pool from '../routes/Estoque/db.config';

const router = express.Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.get('/summary', asyncHandler(async (_req, res) => {
  const [rows]: any = await pool.execute(`
    SELECT 
      (SELECT SUM(valor_nominal) FROM contas_receber WHERE status = 'PENDENTE') AS aReceber,
      (SELECT SUM(valor_nominal) FROM contas_pagar WHERE status = 'PENDENTE') AS aPagar,
      (SELECT SUM(valor_nominal) FROM contas_receber WHERE status = 'PAGO' AND MONTH(data_pagamento) = MONTH(NOW())) AS recebidoMes,
      (SELECT SUM(valor_nominal) FROM contas_pagar WHERE status = 'PAGO' AND MONTH(data_pagamento) = MONTH(NOW())) AS pagoMes
  `);

  const r = rows[0] || { aReceber: 0, aPagar: 0, recebidoMes: 0, pagoMes: 0 };
  const saldoPrevisto = (Number(r.recebidoMes) + Number(r.aReceber)) - (Number(r.pagoMes) + Number(r.aPagar));

  res.json({ ...r, saldoPrevisto });
}));

router.patch('/pay/:tipo/:id', asyncHandler(async (req, res) => {
  const { tipo, id } = req.params;
  const tabela = tipo === 'pagar' ? 'contas_pagar' : 'contas_receber';
  const idNome = tipo === 'pagar' ? 'id_conta_pagar' : 'id_conta_receber';

  await pool.execute(`UPDATE ${tabela} SET status = 'PAGO', data_pagamento = NOW() WHERE ${idNome} = ?`, [id]);
  res.json({ success: true, message: 'Pagamento registrado!' });
}));

export default router;
