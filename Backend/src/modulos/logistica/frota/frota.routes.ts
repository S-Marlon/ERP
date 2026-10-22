// Módulo Gestor de frotas (LOGISTICA_FROTA). Montado em /api/modulos/logistica/frota (bloqueado se o módulo estiver
// desligado). As rotas abrem por etapas (veículos, abastecimentos, manutenções, documentos, motoristas, viagens,
// custos); as tabelas são modulo_logistica_frota_*.
import { Request, Response, Router } from 'express';
import { ajustarKm, criarVeiculo, listarVeiculos, salvarVeiculo } from './veiculos.controller';

const router = Router();

/** GET /situacao — o módulo responde e as etapas que já abriram. */
router.get('/situacao', (_req: Request, res: Response) => res.json({ modulo: 'LOGISTICA_FROTA', etapasProntas: [1] }));

// Etapa 1: veículos
router.get('/veiculos', listarVeiculos);
router.post('/veiculos', criarVeiculo);
router.put('/veiculos/:id', salvarVeiculo);
router.post('/veiculos/:id/km', ajustarKm);

export default router;
