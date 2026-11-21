import { Router } from 'express';
import { atualizarFundo, criarFundo, excluirAjuste, excluirFundo, extratoFundo, lancarAjuste, listarFundos } from './reservas.controller';

// Fundos de reposição (dinheiro separado para recompra). Montado em /api/financeiro/reservas
const router = Router();
router.get('/', listarFundos);
router.post('/', criarFundo);
router.get('/:id/extrato', extratoFundo);
router.put('/:id', atualizarFundo);
router.delete('/:id', excluirFundo);
router.post('/:id/ajustes', lancarAjuste);
router.delete('/:id/ajustes/:idAjuste', excluirAjuste);
export default router;
