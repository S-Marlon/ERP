import { Router } from 'express';
import {
  estornarRecebimento, listarBaixas, listarTitulos, receberTitulo, resumoReceber, salvarCredito, situacaoCliente,
} from './receber.controller';

// Contas a receber no modelo novo. Montado em /api/financeiro/receber
const router = Router();

router.get('/', listarTitulos);
router.get('/resumo', resumoReceber);
router.get('/clientes/:idCliente', situacaoCliente);
router.put('/clientes/:idCliente/credito', salvarCredito);
router.post('/baixas/:idBaixa/estornar', estornarRecebimento);
router.get('/:idTitulo/baixas', listarBaixas);
router.post('/:idTitulo/baixas', receberTitulo);

export default router;
