import { Router } from 'express';
import {
  atualizarParcelaPedido, atualizarPedidoFaturado, cancelarPedidoFaturado, criarPedidoFaturado, detalhePedidoFaturado, entregarPedido,
  faturarPedido, listarPedidosFaturados,
} from './pedidosFaturados.controller';

// Pedidos faturados (venda para empresa, entrega depois). Montado em /api/vendas/pedidos-faturados
const router = Router();
router.get('/', listarPedidosFaturados);
router.post('/', criarPedidoFaturado);
router.get('/:id', detalhePedidoFaturado);
router.put('/:id', atualizarPedidoFaturado);
router.post('/:id/faturar', faturarPedido);
router.put('/:id/parcelas/:idTitulo', atualizarParcelaPedido);
router.post('/:id/entregar', entregarPedido);
router.post('/:id/cancelar', cancelarPedidoFaturado);
export default router;
