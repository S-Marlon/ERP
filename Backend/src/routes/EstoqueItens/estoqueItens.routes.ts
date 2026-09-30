import { Router } from 'express';
import { lancarAjustes, listarMovimentos, listarSaldos, salvarParametros } from './estoqueItens.controller';

// Estoque no modelo novo (itens_core). Montado em /api/estoque, antes das rotas legadas.
const router = Router();

router.get('/saldos', listarSaldos);
router.get('/movimentos', listarMovimentos);
router.post('/ajustes', lancarAjustes);
router.put('/itens/:idItem/parametros', salvarParametros);

export default router;
