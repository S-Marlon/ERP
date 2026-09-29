import { Router, Request, Response } from 'express';
import { 
    processarItemXML, 
    sincronizarItensLoteXML, 
    getLoteStaging, 
    atualizarStatusItemStaging,
    listarLotesStaging, // <-- Importado do controller
    listarItensDoLoteStaging
} from './controllers/comprasController';

const router = Router();

// Rota raiz do módulo
router.get('/', (req: Request, res: Response) => {
    return res.status(200).json({
        success: true,
        message: 'API de Staging de Compras e NF-e está online e operando!'
    });
});

// Rota para listar os lotes de importação
router.get('/lotes', listarLotesStaging);

// Rota para processar/popular item a item
router.post('/itens/processar-xml', processarItemXML);

// Rota para sincronizar o array completo de itens do XML de uma vez
router.post('/lotes/sincronizar-xml', sincronizarItensLoteXML);

// Rota para buscar o espelho do lote e todos os seus itens na staging
router.get('/lotes/:loteId/staging', getLoteStaging);

// Rota para atualizar o status de um item específico na staging
router.patch('/itens/staging/:id/status', atualizarStatusItemStaging);

router.get('/lotes/:loteId/itens', listarItensDoLoteStaging);

export default router;