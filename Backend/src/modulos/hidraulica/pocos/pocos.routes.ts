// Módulo Obras de poços (HIDRAULICA_POCOS). Montado em /api/modulos/hidraulica/pocos (bloqueado se o módulo estiver
// desligado). Etapa 1: obras, poços e clientes de poço (tabelas modulo_hidraulica_pocos_*); o relatório técnico fica
// dentro da obra. Etapa 2: o mapa regional (nossos poços do banco; referência e potencial lidos dos GeoJSON do maperf).
// Etapa 3: sinal, adicionais aprovados pelo cliente, parcelas do saldo e recebimentos. O módulo é um sistema à parte:
// não usa o caixa, o financeiro nem os clientes da loja. Etapa 4: materiais (cadastro próprio, previsto × usado).
import { Router } from 'express';
import { criarObra, criarPoco, detalheObra, listarObras, listarPocos, mudarSituacao, salvarObra, salvarPoco, salvarRelatorio } from './obras.controller';
import { criarCliente, detalheCliente, listarClientes, salvarCliente } from './clientes.controller';
import {
  aReceberDeObras, cancelarParcela, cobrancaDaObra, criarAdicional, estornarRecebimento, lancarParcelas, mudarAdicional, receberParcela, salvarAdicional,
} from './cobranca.controller';
import {
  adicionarMaterial, cobrarMaterial, copiarMateriais, criarMaterial, listarMateriais, materiaisDaObra, removerLinhaMaterial, salvarLinhaMaterial, salvarMaterial,
} from './materiais.controller';
import { analiseDoMapa, pocosDoMapa, potencialDoMapa, referenciasDoMapa, resumoMapa } from './mapa.controller';

const router = Router();

router.get('/obras', listarObras);
router.post('/obras', criarObra);
router.get('/obras/:id', detalheObra);
router.put('/obras/:id', salvarObra);
router.put('/obras/:id/relatorio', salvarRelatorio);
router.post('/obras/:id/situacao', mudarSituacao);
router.get('/obras/:id/cobranca', cobrancaDaObra);
router.post('/obras/:id/adicionais', criarAdicional);
router.post('/obras/:id/parcelas', lancarParcelas);
router.put('/adicionais/:id', salvarAdicional);
router.post('/adicionais/:id/situacao', mudarAdicional);
router.post('/parcelas/:id/cancelar', cancelarParcela);
router.post('/parcelas/:id/receber', receberParcela);
router.post('/recebimentos/:id/estornar', estornarRecebimento);
router.get('/receber', aReceberDeObras);
router.get('/materiais', listarMateriais);
router.post('/materiais', criarMaterial);
router.put('/materiais/:id', salvarMaterial);
router.get('/obras/:id/materiais', materiaisDaObra);
router.post('/obras/:id/materiais', adicionarMaterial);
router.post('/obras/:id/materiais/copiar', copiarMateriais);
router.put('/obra-materiais/:id', salvarLinhaMaterial);
router.delete('/obra-materiais/:id', removerLinhaMaterial);
router.post('/obra-materiais/:id/cobrar', cobrarMaterial);
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

export default router;
