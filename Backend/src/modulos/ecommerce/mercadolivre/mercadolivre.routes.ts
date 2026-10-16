// Módulo Mercado Livre. Montado em /api/modulos/ecommerce/mercadolivre (bloqueado se o módulo estiver desligado)
import { Router } from 'express';
import { conectar, conta, desconectar, status } from './mercadolivre.controller';
import {
  adicionarItens, candidatos, criarAnuncio, detalheAnuncio, excluirAnuncio, listarAnuncios, navegarCategorias, salvarItem, modoDaLinha, corrigirUnidade,
  removerItem, salvarAnuncio, adicionarUnidade, adicionarKit, sugerirCategoria, desligarDoMl, encerrarNoMl,
} from './anuncios.controller';
import {
  atualizarNoMl, divergenciasAnuncio, divergenciasTodas, importarAnuncios, pausarNoMl, previaImportacao, publicarAnuncio, sincronizarAnuncio, sincronizarTodos, situacaoSincronizacao, validarAnuncio,
} from './publicacao.controller';

import { faixasNoMl } from './faixas.controller';
import { faixasDeFrete, listarSugestoes } from './sugestoes.controller';
import { desempenhoAnuncios } from './desempenho.controller';
import { entrarNoCatalogo, verificarCatalogo } from './catalogo.controller';
import { buscarFotosMl, fotosDoAnuncio, importarFotos, repassarImagem } from './fotos.controller';
import { analisarPreco, financeiroAnuncio, financeiroAnuncios, formasDeVenda, simularPreco } from './precificacao.controller';
import { buscarClientes, buscarPedidos, listarPedidos, resultadoPedidos, obterConfig, reprocessarPedido, salvarConfig } from './pedidos.controller';

const router = Router();

router.get('/status', status);
router.post('/conectar', conectar);
router.post('/desconectar', desconectar);
router.get('/conta', conta);

// Central de anúncios
router.get('/candidatos', candidatos);
router.get('/anuncios', listarAnuncios);
router.get('/anuncios/financeiro', financeiroAnuncios);
router.get('/anuncios/sugestoes', listarSugestoes);
router.get('/anuncios/divergencias', divergenciasTodas);
router.get('/anuncios/desempenho', desempenhoAnuncios);
router.get('/frete/faixas', faixasDeFrete);
router.get('/fotos-ml/buscar', buscarFotosMl);
router.get('/fotos-ml/imagem', repassarImagem);
router.post('/anuncios', criarAnuncio);
router.get('/anuncios/:id', detalheAnuncio);
router.put('/anuncios/:id', salvarAnuncio);
router.delete('/anuncios/:id', excluirAnuncio);
router.post('/anuncios/:id/itens', adicionarItens);
router.put('/anuncios/:id/itens/:idLinha', salvarItem);
router.post('/anuncios/:id/itens/:idLinha/modo', modoDaLinha);
router.get('/anuncios/:id/divergencias', divergenciasAnuncio);
router.post('/anuncios/:id/itens/:idLinha/corrigir-unidade', corrigirUnidade);
router.post('/anuncios/:id/itens/:idLinha/unidade', adicionarUnidade);
router.post('/anuncios/:id/itens/:idLinha/kit', adicionarKit);
router.delete('/anuncios/:id/itens/:idLinha', removerItem);
router.delete('/anuncios/:id/itens/:idLinha/ml', desligarDoMl);
router.post('/anuncios/:id/encerrar', encerrarNoMl);
router.post('/anuncios/:id/validar', validarAnuncio);
router.post('/anuncios/:id/publicar', publicarAnuncio);
router.post('/anuncios/:id/atualizar-ml', atualizarNoMl);
router.post('/anuncios/:id/pausar', pausarNoMl);
router.get('/anuncios/:id/faixas/ml', faixasNoMl);
router.get('/anuncios/:id/catalogo', verificarCatalogo);
router.get('/anuncios/:id/itens/:idLinha/preco', analisarPreco);
router.get('/anuncios/:id/itens/:idLinha/simular', simularPreco);
router.get('/anuncios/:id/itens/:idLinha/formas', formasDeVenda);
router.get('/anuncios/:id/financeiro', financeiroAnuncio);
router.get('/anuncios/:id/fotos', fotosDoAnuncio);
router.post('/anuncios/:id/fotos/importar', importarFotos);
router.post('/anuncios/:id/itens/:idLinha/catalogo', entrarNoCatalogo);
router.post('/anuncios/:id/sincronizar', sincronizarAnuncio);
router.get('/sincronizar', situacaoSincronizacao);
router.post('/sincronizar', sincronizarTodos);
router.get('/config', obterConfig);
router.put('/config', salvarConfig);
router.get('/clientes', buscarClientes);
router.get('/pedidos', listarPedidos);
router.get('/pedidos/resultado', resultadoPedidos);
router.post('/pedidos/buscar', buscarPedidos);
router.post('/pedidos/:id/processar', reprocessarPedido);
router.get('/importar', previaImportacao);
router.post('/importar', importarAnuncios);
router.get('/categorias/sugerir', sugerirCategoria);
router.get('/categorias', navegarCategorias);
router.get('/categorias/:id', navegarCategorias);

export default router;
