// Módulo Mercado Livre. Montado em /api/modulos/ecommerce/mercadolivre (bloqueado se o módulo estiver desligado)
import { Router } from 'express';
import { conectar, conta, desconectar, status } from './mercadolivre.controller';

const router = Router();

router.get('/status', status);
router.post('/conectar', conectar);
router.post('/desconectar', desconectar);
router.get('/conta', conta);

export default router;
