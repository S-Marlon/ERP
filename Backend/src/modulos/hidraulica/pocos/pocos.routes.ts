// Módulo Obras de poços (HIDRAULICA_POCOS). Montado em /api/modulos/hidraulica/pocos (bloqueado se o módulo estiver
// desligado). Etapa 1: obras, poços e clientes de poço (tabelas modulo_hidraulica_pocos_*); o relatório técnico fica
// dentro da obra. Etapa 2: o mapa regional (camadas, análise de raio e importação do maperf).
import { Router } from 'express';
import { criarObra, criarPoco, detalheObra, listarObras, listarPocos, mudarSituacao, salvarObra, salvarPoco, salvarRelatorio } from './obras.controller';
import { criarCliente, detalheCliente, listarClientes, salvarCliente } from './clientes.controller';
import { analiseDoMapa, importarGeojson, pocosDoMapa, potencialDoMapa, referenciasDoMapa, removerImportacao, resumoMapa } from './mapa.controller';

const router = Router();

router.get('/obras', listarObras);
router.post('/obras', criarObra);
router.get('/obras/:id', detalheObra);
router.put('/obras/:id', salvarObra);
router.put('/obras/:id/relatorio', salvarRelatorio);
router.post('/obras/:id/situacao', mudarSituacao);
router.get('/pocos', listarPocos);
router.post('/pocos', criarPoco);
router.put('/pocos/:id', salvarPoco);
router.get('/clientes', listarClientes);
router.post('/clientes', criarCliente);
router.get('/clientes/:id', detalheCliente);
router.put('/clientes/:id', salvarCliente);
router.get('/mapa/resumo', resumoMapa);
router.get('/mapa/pocos', pocosDoMapa);
router.get('/mapa/referencias', referenciasDoMapa);
router.get('/mapa/potencial', potencialDoMapa);
router.get('/mapa/analise', analiseDoMapa);
router.post('/mapa/importar', importarGeojson);
router.delete('/mapa/importacoes', removerImportacao);

export default router;
