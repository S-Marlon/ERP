// Fiscal: notas fiscais de saída das vendas (NFC-e/NF-e). Montado em /api/fiscal.
import express from 'express';
import notasSaidaRoutes from './Fiscal/saida/notasSaida.routes';

const router = express.Router();

router.use(notasSaidaRoutes);

export default router;
