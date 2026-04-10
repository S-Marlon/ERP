import express, { Request, Response, NextFunction } from 'express';
import pool from '../routes/Estoque/db.config';

const router = express.Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post('/invoices', asyncHandler(async (req, res) => {
  const invoice = req.body;
  // obter payload, validar e persistir conforme model fiscal
  res.status(201).json({ message: 'NFe recebida com sucesso (placeholder).', invoice });
}));

router.get('/ncm', asyncHandler(async (_req, res) => {
  const [rows]: any = await pool.execute('SELECT id_ncm, codigo, descricao FROM ncm LIMIT 200');
  res.json({ data: rows });
}));

router.get('/taxes', asyncHandler(async (_req, res) => {
  const [rows]: any = await pool.execute('SELECT id_imposto, nome, aliquota FROM impostos LIMIT 200');
  res.json({ data: rows });
}));

export default router;
