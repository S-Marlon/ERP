import express from 'express';
import estoqueRoutes from './estoque.routes';
import comercialRoutes from './comercial.routes';
import fiscalRoutes from './fiscal.routes';
import financeiroRoutes from './financeiro.routes';
import catalogoRoutes from './Catalogo/catalogo.routes';

const router = express.Router();

router.use('/estoque', estoqueRoutes);
router.use('/comercial', comercialRoutes);
router.use('/fiscal', fiscalRoutes);
router.use('/financeiro', financeiroRoutes);
router.use('/catalogo', catalogoRoutes);

export default router;
