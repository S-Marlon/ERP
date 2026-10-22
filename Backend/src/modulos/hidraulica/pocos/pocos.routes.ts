// Módulo Obras de poços (HIDRAULICA_POCOS). Montado em /api/modulos/hidraulica/pocos (bloqueado se o módulo estiver
// desligado). Etapa 1: obras e poços (tabelas modulo_hidraulica_pocos_*); o relatório técnico fica dentro da obra.
import { Router } from 'express';
import { criarObra, criarPoco, detalheObra, listarObras, listarPocos, mudarSituacao, salvarObra, salvarPoco, salvarRelatorio } from './obras.controller';

const router = Router();

router.get('/obras', listarObras);
router.post('/obras', criarObra);
router.get('/obras/:id', detalheObra);
router.put('/obras/:id', salvarObra);
router.put('/obras/:id/relatorio', salvarRelatorio);
router.post('/obras/:id/situacao', mudarSituacao);
router.get('/pocos', listarPocos);
router.post('/pocos', criarPoco);
router.put('/pocos/:id', salvarPoco);

export default router;
