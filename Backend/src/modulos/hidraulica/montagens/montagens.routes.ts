// Módulo Hidráulica · Montagens (plugável). Montado em /api/modulos/hidraulica/montagens (registro em src/modulos/registro.ts).
import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => res.json({ success: true, modulo: 'HIDRAULICA_MONTAGENS' }));

export default router;
