import { Router, Request, Response } from 'express';
import {getClientes, createCliente} from './Clientes/clientes.controller';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Teste isolado de parceiros funcionando!' });
});

router.get('/clientes', getClientes);
router.post('/clientes', createCliente);


export default router;