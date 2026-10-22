// Módulo Gestor de frotas (LOGISTICA_FROTA). Montado em /api/modulos/logistica/frota (bloqueado se o módulo estiver
// desligado). As rotas abrem por etapas (veículos, abastecimentos, manutenções, documentos, motoristas, viagens,
// custos); as tabelas são modulo_logistica_frota_*.
import { Request, Response, Router } from 'express';

const router = Router();

/** GET /situacao — o módulo responde (as funcionalidades entram etapa por etapa). */
router.get('/situacao', (_req: Request, res: Response) => res.json({ modulo: 'LOGISTICA_FROTA', etapasProntas: [] }));

export default router;
