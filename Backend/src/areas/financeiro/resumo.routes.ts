// Resumo do financeiro (a receber, a pagar, recebido e pago no mês) a partir das tabelas do modelo novo:
// financeiro_contas_receber (+ _baixas) e financeiro_contas_pagar. Montado em /api/financeiro.
import express, { Request, Response } from 'express';
import pool from '../../infra/db';

const router = express.Router();
const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);
const n = (v: unknown) => Number(v) || 0;

// GET /api/financeiro/summary
router.get('/summary', async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [[receber]]: any = await pool.execute(
      `SELECT COALESCE(SUM(valor - valor_pago), 0) AS aberto,
              COALESCE(SUM(CASE WHEN vencimento < CURDATE() THEN valor - valor_pago END), 0) AS vencido
       FROM financeiro_contas_receber WHERE tenant_id = ? AND status = 'ABERTO'`,
      [tenant]
    );
    const [[recebido]]: any = await pool.execute(
      `SELECT COALESCE(SUM(valor), 0) AS total FROM financeiro_contas_receber_baixas
       WHERE tenant_id = ? AND estornado_em IS NULL AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
      [tenant]
    );
    const [[pagar]]: any = await pool.execute(
      `SELECT COALESCE(SUM(CASE WHEN status = 'ABERTO' THEN valor - valor_pago END), 0) AS aberto,
              COALESCE(SUM(CASE WHEN status = 'ABERTO' AND vencimento < CURDATE() THEN valor - valor_pago END), 0) AS vencido,
              COALESCE(SUM(CASE WHEN status = 'PAGO' AND pago_em >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN valor_pago END), 0) AS pagoMes
       FROM financeiro_contas_pagar WHERE tenant_id = ?`,
      [tenant]
    );
    const aReceber = n(receber?.aberto);
    const aPagar = n(pagar?.aberto);
    return res.json({
      aReceber, aPagar, recebidoMes: n(recebido?.total), pagoMes: n(pagar?.pagoMes),
      receberVencido: n(receber?.vencido), pagarVencido: n(pagar?.vencido),
      // O que ainda entra menos o que ainda sai (títulos em aberto)
      saldoPrevisto: Number((aReceber - aPagar).toFixed(2)),
    });
  } catch (error: any) {
    console.error('Erro no resumo financeiro:', error);
    return res.status(500).json({ error: 'Erro ao montar o resumo financeiro.', details: error?.message });
  }
});

export default router;
