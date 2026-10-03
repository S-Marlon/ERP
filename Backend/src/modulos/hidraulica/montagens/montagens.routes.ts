// Módulo Hidráulica · Montagens (plugável). Montado em /api/modulos/hidraulica/montagens (registro em src/modulos/registro.ts).
import { Router } from 'express';
import { listarFichas, salvarFichasDaVenda } from './fichas.controller';
import { atualizarOs, cancelarOs, criarOs, detalheOs, entregarOs, listarOs, mudarEtapaOs, receberSinalOs } from './os.controller';

const router = Router();

router.get('/', (_req, res) => res.json({ success: true, modulo: 'HIDRAULICA_MONTAGENS' }));

// Fichas técnicas (montagem na hora ligada à venda; histórico para refazer)
router.post('/fichas', salvarFichasDaVenda);
router.get('/fichas', listarFichas);

// OS de montagem: abrir, editar, etapas, sinal, cancelar e entregar (a entrega vira venda no PDV)
router.post('/os', criarOs);
router.get('/os', listarOs);
router.get('/os/:id', detalheOs);
router.put('/os/:id', atualizarOs);
router.post('/os/:id/status', mudarEtapaOs);
router.post('/os/:id/sinal', receberSinalOs);
router.post('/os/:id/cancelar', cancelarOs);
router.post('/os/:id/entregar', entregarOs);

export default router;
