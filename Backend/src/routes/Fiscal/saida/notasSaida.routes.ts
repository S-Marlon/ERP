// Notas fiscais de saída: /api/fiscal/configuracao e /api/fiscal/notas
import { Router } from 'express';
import {
  cancelarNota, detalheNota, dispensarNotas, emitirNotas, listarNotas, obterConfiguracao, reabrirNotas, registrarEnvio, salvarConfiguracao,
} from './notasSaida.controller';

const router = Router();

router.get('/configuracao', obterConfiguracao);
router.put('/configuracao', salvarConfiguracao);
router.get('/notas', listarNotas);
router.post('/notas/emitir', emitirNotas);
router.post('/notas/dispensar', dispensarNotas);
router.post('/notas/reabrir', reabrirNotas);
router.get('/notas/:id', detalheNota);
router.post('/notas/:id/cancelar', cancelarNota);
router.post('/notas/:id/envio', registrarEnvio);

export default router;
