import { Router } from 'express';
import {
  ajustarTitulo, cobrancaDaNota, criarConta, desfazerCobranca, dispensarCobranca, lancarCobranca, listarTitulos, pagarTitulo, reabrirTitulo,
} from './pagar.controller';
import { criarRecorrente, listarRecorrentes, mudarStatusRecorrente, salvarRecorrente } from './recorrentes.controller';

// Contas a pagar. Montado em /api/financeiro/pagar
const router = Router();

router.get('/', listarTitulos);
router.post('/', criarConta);
router.get('/fixas', listarRecorrentes);
router.post('/fixas', criarRecorrente);
router.put('/fixas/:id', salvarRecorrente);
router.post('/fixas/:id/status', mudarStatusRecorrente);
router.get('/notas/:idLote/cobranca', cobrancaDaNota);
router.post('/notas/:idLote/cobranca/lancar', lancarCobranca);
router.post('/notas/:idLote/cobranca/dispensar', dispensarCobranca);
router.post('/notas/:idLote/cobranca/desfazer', desfazerCobranca);
router.put('/:idTitulo', ajustarTitulo);
router.post('/:idTitulo/pagar', pagarTitulo);
router.post('/:idTitulo/reabrir', reabrirTitulo);

export default router;
