import express from 'express';
import estoqueRoutes from './estoque.routes';
import comercialRoutes from './comercial.routes';
import fiscalRoutes from './fiscal.routes';
import financeiroRoutes from './financeiro.routes';
import catalogoRoutes from './Catalogo/catalogo.routes';
import parceirosRoutes from './Parceiros/parceiros.routes';
import { Router, Request, Response } from 'express';


const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Teste isolado de parceiros funcionando!' });
});

router.use('/estoque', estoqueRoutes);
router.use('/comercial', comercialRoutes);
router.use('/fiscal', fiscalRoutes);
router.use('/financeiro', financeiroRoutes);
router.use('/catalogo', catalogoRoutes);
router.use('/parceiros', parceirosRoutes); // Adicione esta linha para incluir as rotas de parceiros

export default router;
