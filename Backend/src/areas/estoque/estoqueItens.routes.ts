import { Router } from 'express';
import { lancarAjustes, listarMovimentos, listarSaldos, salvarParametros, transferirEstoque } from './estoqueItens.controller';
import { etiquetasDesatualizadas, registrarImpressas } from './etiquetas/etiquetasGondola.controller';
import {
  atualizarArea, cancelarLista, criarArea, detalheLista, excluirArea, gerarLista, lancarLista, listarListas, painelInventario, pedirConferencia,
  retirarPedidoConferencia, salvarConfig,
} from './inventario/inventario.controller';

// Estoque no modelo novo (itens_core). Montado em /api/estoque, antes das rotas legadas.
const router = Router();

router.get('/saldos', listarSaldos);
router.get('/movimentos', listarMovimentos);
router.post('/ajustes', lancarAjustes);
router.put('/itens/:idItem/parametros', salvarParametros);
router.post('/transferencias', transferirEstoque);
// Etiquetas de gôndola: última etiqueta impressa e as que ficaram com preço antigo
router.post('/etiquetas/impressas', registrarImpressas);
router.get('/etiquetas/desatualizadas', etiquetasDesatualizadas);

// Inventário rotativo: lista do dia por área, folha impressa, lançamento da contagem
router.get('/inventario', painelInventario);
router.post('/inventario/listas', gerarLista);
router.get('/inventario/listas', listarListas);
router.get('/inventario/listas/:id', detalheLista);
router.post('/inventario/listas/:id/lancar', lancarLista);
router.post('/inventario/listas/:id/cancelar', cancelarLista);
router.post('/inventario/pedidos', pedirConferencia);
router.delete('/inventario/pedidos/:idItem', retirarPedidoConferencia);
router.put('/inventario/config', salvarConfig);
router.post('/inventario/areas', criarArea);
router.put('/inventario/areas/:id', atualizarArea);
router.delete('/inventario/areas/:id', excluirArea);

export default router;
