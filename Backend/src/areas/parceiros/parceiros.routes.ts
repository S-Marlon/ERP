import { Router, Request, Response } from 'express';
import { getClientes, createCliente } from './clientes/clientes.controller';
import {
  atualizarFornecedor,
  detalheFornecedor,
  getFornecedores,
  obterOuCriarFornecedorPorCnpj,
  verificarFornecedorPorCnpj
} from './fornecedores/fornecedorController';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Módulo de Parceiros funcionando!' });
});

// --- Clientes ---
router.get('/clientes', getClientes);
router.post('/clientes', createCliente);

// --- Fornecedores (Centralizados em Parceiros) ---
router.get('/fornecedores/verificar', verificarFornecedorPorCnpj); // GET /api/parceiros/fornecedores/verificar?cnpj=...
router.get('/fornecedores', getFornecedores);                    // GET /api/parceiros/fornecedores
router.post('/fornecedores', obterOuCriarFornecedorPorCnpj);     // POST /api/parceiros/fornecedores
router.get('/fornecedores/:id', detalheFornecedor);               // cadastro + notas, contas a pagar e produtos
router.put('/fornecedores/:id', atualizarFornecedor);

export default router;