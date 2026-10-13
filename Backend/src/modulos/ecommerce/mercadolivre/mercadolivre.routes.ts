// Módulo Mercado Livre. Montado em /api/modulos/ecommerce/mercadolivre (bloqueado se o módulo estiver desligado)
import { Router } from 'express';
import { conectar, conta, desconectar, status } from './mercadolivre.controller';
import {
  adicionarItens, candidatos, criarAnuncio, detalheAnuncio, excluirAnuncio, listarAnuncios, navegarCategorias, salvarItem,
  removerItem, salvarAnuncio, sugerirCategoria, desligarDoMl, encerrarNoMl,
} from './anuncios.controller';
import {
  atualizarNoMl, importarAnuncios, pausarNoMl, previaImportacao, publicarAnuncio, sincronizarAnuncio, sincronizarTodos, situacaoSincronizacao, validarAnuncio,
} from './publicacao.controller';

import { faixasNoMl } from './faixas.controller';
import { buscarClientes, buscarPedidos, listarPedidos, obterConfig, reprocessarPedido, salvarConfig } from './pedidos.controller';

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
router.delete('/anuncios/:id/itens/:idItem/ml', desligarDoMl);
router.post('/anuncios/:id/encerrar', encerrarNoMl);
router.post('/anuncios/:id/validar', validarAnuncio);
router.post('/anuncios/:id/publicar', publicarAnuncio);
router.post('/anuncios/:id/atualizar-ml', atualizarNoMl);
router.post('/anuncios/:id/pausar', pausarNoMl);
router.get('/anuncios/:id/faixas/ml', faixasNoMl);
router.post('/anuncios/:id/sincronizar', sincronizarAnuncio);
router.get('/sincronizar', situacaoSincronizacao);
router.post('/sincronizar', sincronizarTodos);
router.get('/config', obterConfig);
router.put('/config', salvarConfig);
router.get('/clientes', buscarClientes);
router.get('/pedidos', listarPedidos);
router.post('/pedidos/buscar', buscarPedidos);
router.post('/pedidos/:id/processar', reprocessarPedido);
router.get('/importar', previaImportacao);
router.post('/importar', importarAnuncios);
router.get('/categorias/sugerir', sugerirCategoria);
router.get('/categorias', navegarCategorias);
router.get('/categorias/:id', navegarCategorias);

export default router;
