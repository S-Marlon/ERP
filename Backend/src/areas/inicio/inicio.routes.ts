// Página inicial (central do dia)
import { Router } from 'express';
import { tarefasDoDia } from './inicio.controller';

const router = Router();
router.get('/tarefas', tarefasDoDia);

export default router;
