import { Router } from 'express';
import { lancarAjustes, listarMovimentos, listarSaldos, salvarParametros, transferirEstoque } from './estoqueItens.controller';
import { etiquetasDesatualizadas, registrarImpressas } from './etiquetas/etiquetasGondola.controller';

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

export default router;
