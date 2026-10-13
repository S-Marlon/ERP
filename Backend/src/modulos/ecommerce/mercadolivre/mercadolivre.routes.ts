// Módulo Mercado Livre. Montado em /api/modulos/ecommerce/mercadolivre (bloqueado se o módulo estiver desligado)
import { Router } from 'express';
import { conectar, conta, desconectar, status } from './mercadolivre.controller';
import {
  adicionarItens, candidatos, criarAnuncio, detalheAnuncio, excluirAnuncio, listarAnuncios, navegarCategorias, salvarItem,
  removerItem, salvarAnuncio, sugerirCategoria,
} from './anuncios.controller';
import {
  importarAnuncios, previaImportacao, publicarAnuncio, sincronizarAnuncio, sincronizarTodos, situacaoSincronizacao, validarAnuncio,
} from './publicacao.controller';

const router = Router();

router.get('/status', status);
router.post('/conectar', conectar);
router.post('/desconectar', desconectar);
router.get('/conta', conta);

// Central de anúncios
router.get('/candidatos', candidatos);
router.get('/anuncios', listarAnuncios);
router.post('/anuncios', criarAnuncio);
router.get('/anuncios/:id', detalheAnuncio);
router.put('/anuncios/:id', salvarAnuncio);
router.delete('/anuncios/:id', excluirAnuncio);
router.post('/anuncios/:id/itens', adicionarItens);
router.put('/anuncios/:id/itens/:idItem', salvarItem);
router.delete('/anuncios/:id/itens/:idItem', removerItem);
router.post('/anuncios/:id/validar', validarAnuncio);
router.post('/anuncios/:id/publicar', publicarAnuncio);
router.post('/anuncios/:id/sincronizar', sincronizarAnuncio);
router.get('/sincronizar', situacaoSincronizacao);
router.post('/sincronizar', sincronizarTodos);
router.get('/importar', previaImportacao);
router.post('/importar', importarAnuncios);
router.get('/categorias/sugerir', sugerirCategoria);
router.get('/categorias', navegarCategorias);
router.get('/categorias/:id', navegarCategorias);

export default router;
