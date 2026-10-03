import express from 'express';
import estoqueRoutes from './estoque.routes';
import comercialRoutes from './comercial.routes';
import fiscalRoutes from './fiscal.routes';
import financeiroRoutes from './financeiro.routes';
import catalogoRoutes from './Catalogo/catalogo.routes';
import parceirosRoutes from './Parceiros/parceiros.routes';
import comprasRoutes from './Compras/compras.routes'
import vendasRoutes from './Venda/vendas.routes';
import estoqueItensRoutes from './EstoqueItens/estoqueItens.routes';
import receberRoutes from './Financeiro/receber/receber.routes';
// Módulos plugáveis (cada um liga/desliga por loja em sistema_modulos)
import modulosRoutes from '../modulos/registro';
import { Router, Request, Response } from 'express';


const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Teste isolado de parceiros funcionando!' });
});

// Estoque no modelo novo primeiro (saldos, movimentos, ajustes); rotas legadas depois
router.use('/estoque', estoqueItensRoutes);
router.use('/estoque', estoqueRoutes);
router.use('/comercial', comercialRoutes);
router.use('/fiscal', fiscalRoutes);
// Contas a receber no modelo novo antes das rotas legadas do financeiro
router.use('/financeiro/receber', receberRoutes);
router.use('/financeiro', financeiroRoutes);
router.use('/catalogo', catalogoRoutes);
router.use('/parceiros', parceirosRoutes); // Adicione esta linha para incluir as rotas de parceiros
router.use('/compras' , comprasRoutes)
// PDV e vendas no modelo novo (itens_core)
router.use('/vendas', vendasRoutes);
// /sistema/modulos e /modulos/<area>/<assunto>
router.use(modulosRoutes);

export default router;
