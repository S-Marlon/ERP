// Módulo Hidráulica · Montagens (plugável). Montado em /api/modulos/hidraulica/montagens (registro em src/modulos/registro.ts).
import { Router } from 'express';
import { listarFichas, salvarFichasDaVenda } from './fichas.controller';

const router = Router();

router.get('/', (_req, res) => res.json({ success: true, modulo: 'HIDRAULICA_MONTAGENS' }));

// Fichas técnicas (montagem na hora ligada à venda; histórico para refazer)
router.post('/fichas', salvarFichasDaVenda);
router.get('/fichas', listarFichas);

export default router;
