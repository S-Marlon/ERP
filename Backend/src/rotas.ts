import express from 'express';
import estoqueRoutes from './areas/estoque/estoqueLegado.routes';
import fiscalRoutes from './areas/fiscal/fiscal.routes';
import financeiroRoutes from './areas/financeiro/resumo.routes';
import catalogoRoutes from './areas/catalogo/catalogo.routes';
import parceirosRoutes from './areas/parceiros/parceiros.routes';
import comprasRoutes from './areas/compras/compras.routes'
import vendasRoutes from './areas/vendas/vendas.routes';
import estoqueItensRoutes from './areas/estoque/estoqueItens.routes';
import receberRoutes from './areas/financeiro/receber/receber.routes';
import pagarRoutes from './areas/financeiro/pagar/pagar.routes';
// Módulos plugáveis (cada um liga/desliga por loja em sistema_modulos)
import modulosRoutes from './modulos/registro';
import { Router, Request, Response } from 'express';


const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Teste isolado de parceiros funcionando!' });
});

// Estoque no modelo novo primeiro (saldos, movimentos, ajustes); rotas legadas depois
router.use('/estoque', estoqueItensRoutes);
router.use('/estoque', estoqueRoutes);
router.use('/fiscal', fiscalRoutes);
// Contas a receber no modelo novo antes das rotas legadas do financeiro
router.use('/financeiro/receber', receberRoutes);
router.use('/financeiro/pagar', pagarRoutes);
router.use('/financeiro', financeiroRoutes);
router.use('/catalogo', catalogoRoutes);
router.use('/parceiros', parceirosRoutes); // Adicione esta linha para incluir as rotas de parceiros
router.use('/compras' , comprasRoutes)
// PDV e vendas no modelo novo (itens_core)
router.use('/vendas', vendasRoutes);
// /sistema/modulos e /modulos/<area>/<assunto>
router.use(modulosRoutes);

export default router;
