import { Router, Request, Response } from 'express';
import { 
    processarItemXML, 
    sincronizarItensLoteXML, 
    getLoteStaging, 
    atualizarStatusItemStaging,
    listarLotesStaging, // <-- Importado do controller
    listarItensDoLoteStaging
} from './controllers/comprasController';
import { getCabecalhoLote, analisarLote, aprovarLote, descartarLote, getEstadoLote } from './controllers/stagingLoteController';
import { detalheNotaEntrada, listarNotasEntrada } from './controllers/notasEntrada.controller';
import { corrigirLinhaNota, listarCorrecoesNota } from './controllers/correcaoEntrada.controller';
import { classificacaoItens, sugerirVinculos } from './controllers/sugestoesVinculo.controller';
import { excluirEquivalencia, listarEquivalencias, resolverUnidadesEntrada, salvarEquivalencia } from './controllers/unidadesEntrada.controller';

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

// Tela de Staging: pente-fino e entrada definitiva no estoque
router.get('/lotes/:loteId/analise', analisarLote);
// Retomada da conferência (tela de entrada): por id do lote ou pela chave de acesso da NF
router.get('/lotes/chave/:chave/estado', getEstadoLote);
router.get('/lotes/:loteId/estado', getEstadoLote);
router.post('/lotes/:loteId/aprovar', aprovarLote);
router.get('/lotes/:loteId', getCabecalhoLote);
router.delete('/lotes/:loteId', descartarLote);

// Registro das notas de entrada (tela Notas de Entrada)
router.get('/notas', listarNotasEntrada);
router.get('/notas/:loteId', detalheNotaEntrada);
// Correção de linha de nota já aprovada (vínculo/conversão errados) e histórico
router.post('/notas/:loteId/itens/:idStaging/correcao', corrigirLinhaNota);
router.get('/notas/:loteId/correcoes', listarCorrecoesNota);

// Reconhecimento automático: sugere o item do catálogo por código do fornecedor ou GTIN
router.post('/sugestoes-vinculo', sugerirVinculos);
// Família/categoria dos itens já cadastrados vinculados na nota
router.post('/classificacao-itens', classificacaoItens);
// Dicionário de unidades de entrada (sigla da NF -> unidade interna, geral ou por fornecedor)
router.get('/unidades-entrada', resolverUnidadesEntrada);
router.get('/unidades-equivalencias', listarEquivalencias);
router.post('/unidades-equivalencias', salvarEquivalencia);
router.delete('/unidades-equivalencias/:id', excluirEquivalencia);

export default router;