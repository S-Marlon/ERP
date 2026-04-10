import express from 'express';

// Arquivo legado de vendas. Roteamento principal agora em src/routes/comercial.routes.ts
// Mantenha este módulo caso outro lugar importe, mas não expõe rotas independentes.

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ message: 'VendaModule legado: utilize /api/comercial/sales' });
});

export default router;
