// Página inicial (central do dia)
import { Router } from 'express';
import {
  adiarLembrete, adiarTarefa, criarLembrete, desfazerAdiamento, editarLembrete, lembretesFeitos, situacaoLembrete, tarefasDoDia,
} from './inicio.controller';

const router = Router();
router.get('/tarefas', tarefasDoDia);
router.post('/lembretes', criarLembrete);
router.get('/lembretes/feitos', lembretesFeitos);
router.put('/lembretes/:id', editarLembrete);
router.post('/lembretes/:id/situacao', situacaoLembrete);
router.post('/lembretes/:id/adiar', adiarLembrete);
router.post('/adiar', adiarTarefa);
router.post('/adiar/desfazer', desfazerAdiamento);

export default router;
