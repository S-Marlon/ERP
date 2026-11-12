// Módulo Obras de poços (HIDRAULICA_POCOS). Montado em /api/modulos/hidraulica/pocos (bloqueado se o módulo estiver
// desligado). Etapa 1: obras, poços e clientes de poço (tabelas modulo_hidraulica_pocos_*); o relatório técnico fica
// dentro da obra. Etapa 2: o mapa regional (nossos poços do banco; referência e potencial lidos dos GeoJSON do maperf).
// Etapa 3: sinal, adicionais aprovados pelo cliente, parcelas do saldo e recebimentos. O módulo é um sistema à parte:
// não usa o caixa, o financeiro nem os clientes da loja. Etapa 4: materiais (cadastro próprio, previsto × usado).
// Etapa 5: agenda, equipe e equipamentos (cadastros próprios; avisos de conflito). Etapa 8: painel e resultado.
// Etapa 6: histórico (linha do tempo, medições) e plano de manutenção do poço; garantias vencendo.
// Etapa 7: monitoramento remoto (aparelhos, rota das leituras com a chave do aparelho, quadro de comando, alertas, painel,
// simulador, importação do poço sem internet, relatório do mês e fila de comandos remotos).
// Processo: leads (prazo de resposta), checklist da obra, fotos, orçamento/laudo/adesivo, pós-venda e indicadores.
// Central: contratos a finalizar, informações a completar e a prévia do plano mensal.
// Orçamento rápido (itens), duplicar, termos aditivos e a ficha completa do cliente.
import { Router } from 'express';
import { criarObra, criarPoco, definirContrato, detalheObra, listarObras, listarPocos, mudarSituacao, salvarObra, salvarPoco, salvarRelatorio } from './obras.controller';
import { criarCliente, detalheCliente, listarClientes, salvarCliente } from './clientes.controller';
import {
  aReceberDeObras, cancelarParcela, cobrancaDaObra, criarAdicional, estornarRecebimento, lancarParcelas, mudarAdicional, receberParcela, salvarAdicional,
} from './cobranca.controller';
import {
  adicionarMaterial, cobrarMaterial, copiarMateriais, criarMaterial, listarMateriais, materiaisDaObra, removerLinhaMaterial, salvarLinhaMaterial, salvarMaterial,
} from './materiais.controller';
import {
  criarCompromisso, criarEquipamento, criarMembro, listarAgenda, listarEquipamentos, listarEquipe, mudarCompromisso, removerCompromisso, salvarCompromisso,
  salvarEquipamento, salvarMembro,
} from './agenda.controller';
import { painelPocos } from './painel.controller';
import {
  cancelarComando, chaveDoAparelho, comandosDoDispositivo, criarDispositivo, enviarComando, importarLeituras, leiturasDoDispositivo, listarAlertas, listarDispositivos,
  marcarVisto, painelIot, receberLeituras, relatorioMensal, salvarDispositivo, simularLeitura,
} from './iot.controller';
import {
  criarPlano, criarRegistro, historicoDoPoco, listaManutencoes, removerRegistro, salvarPlano, salvarRegistro,
} from './manutencao.controller';
import {
  apagarFoto, dadosDoDocumento, criarLead, desfazerEtapa, enviarFoto, galeria, listarLeads, marcarEtapa, marcarRespondido, mudarLead, obraDoLead, pendencias,
  processoDaObra, salvarConfig, salvarFoto, salvarLead, verConfig, verIndicadores,
} from './processo.controller';
import { central } from './central.controller';
import { clienteCompleto } from './clienteCompleto.controller';
import { buscar, pocoCompleto } from './busca.controller';
import {
  apagarConjunto, apagarFotoPoco, conjuntoDoPoco, criarConjunto, enviarFotoPoco, retirarConjunto, salvarConjunto, salvarFotoPoco,
} from './conjuntos.controller';
import {
  aditivosDaObra, apagarAditivo, criarOrcamento, duplicarOrcamento, emitirAditivo, itensDaObra, marcarAditivoAssinado, salvarItens,
} from './orcamento.controller';
import { analiseDoMapa, pocosDoMapa, potencialDoMapa, referenciasDoMapa, resumoMapa } from './mapa.controller';

const router = Router();

router.get('/obras', listarObras);
router.post('/obras', criarObra);
router.get('/obras/:id', detalheObra);
router.put('/obras/:id', salvarObra);
router.put('/obras/:id/relatorio', salvarRelatorio);
router.post('/obras/:id/situacao', mudarSituacao);
router.put('/obras/:id/contrato', definirContrato);
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
router.get('/equipe', listarEquipe);
router.post('/equipe', criarMembro);
router.put('/equipe/:id', salvarMembro);
router.get('/equipamentos', listarEquipamentos);
router.post('/equipamentos', criarEquipamento);
router.put('/equipamentos/:id', salvarEquipamento);
router.get('/agenda', listarAgenda);
router.post('/agenda', criarCompromisso);
router.put('/agenda/:id', salvarCompromisso);
router.post('/agenda/:id/situacao', mudarCompromisso);
router.delete('/agenda/:id', removerCompromisso);
router.get('/painel', painelPocos);
router.get('/pocos/:id/historico', historicoDoPoco);
router.post('/pocos/:id/historico', criarRegistro);
router.put('/historico/:id', salvarRegistro);
router.delete('/historico/:id', removerRegistro);
router.post('/pocos/:id/planos', criarPlano);
router.put('/planos/:id', salvarPlano);
router.get('/manutencoes', listaManutencoes);
router.post('/iot/leituras', receberLeituras);
router.get('/iot/painel', painelIot);
router.get('/iot/alertas', listarAlertas);
router.post('/iot/alertas/:id/visto', marcarVisto);
router.get('/iot/dispositivos', listarDispositivos);
router.post('/iot/dispositivos', criarDispositivo);
router.put('/iot/dispositivos/:id', salvarDispositivo);
router.get('/iot/dispositivos/:id/chave', chaveDoAparelho);
router.get('/iot/dispositivos/:id/leituras', leiturasDoDispositivo);
router.post('/iot/dispositivos/:id/simular', simularLeitura);
router.post('/iot/dispositivos/:id/importar', importarLeituras);
router.get('/iot/dispositivos/:id/relatorio', relatorioMensal);
router.get('/iot/dispositivos/:id/comandos', comandosDoDispositivo);
router.post('/iot/dispositivos/:id/comandos', enviarComando);
router.post('/iot/comandos/:id/cancelar', cancelarComando);
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
router.get('/central', central);
router.post('/orcamentos', criarOrcamento);
router.get('/obras/:id/itens', itensDaObra);
router.put('/obras/:id/itens', salvarItens);
router.post('/obras/:id/duplicar', duplicarOrcamento);
router.get('/obras/:id/aditivos', aditivosDaObra);
router.post('/obras/:id/aditivos', emitirAditivo);
router.post('/aditivos/:id/assinado', marcarAditivoAssinado);
router.delete('/aditivos/:id', apagarAditivo);
router.get('/clientes/:id/completo', clienteCompleto);
router.get('/busca', buscar);
router.get('/pocos/:id/completo', pocoCompleto);
router.get('/pocos/:id/conjunto', conjuntoDoPoco);
router.post('/pocos/:id/conjuntos', criarConjunto);
router.put('/conjuntos/:id', salvarConjunto);
router.post('/conjuntos/:id/retirar', retirarConjunto);
router.delete('/conjuntos/:id', apagarConjunto);
router.post('/pocos/:id/fotos', enviarFotoPoco);
router.put('/pocos-fotos/:id', salvarFotoPoco);
router.delete('/pocos-fotos/:id', apagarFotoPoco);
router.get('/processo/config', verConfig);
router.put('/processo/config', salvarConfig);
router.get('/processo/pendencias', pendencias);
router.get('/processo/indicadores', verIndicadores);
router.get('/processo/galeria', galeria);
router.get('/leads', listarLeads);
router.post('/leads', criarLead);
router.put('/leads/:id', salvarLead);
router.post('/leads/:id/respondido', marcarRespondido);
router.post('/leads/:id/situacao', mudarLead);
router.post('/leads/:id/obra', obraDoLead);
router.get('/obras/:id/processo', processoDaObra);
router.post('/obras/:id/processo/:etapa', marcarEtapa);
router.delete('/obras/:id/processo/:etapa', desfazerEtapa);
router.get('/obras/:id/documento', dadosDoDocumento);
router.post('/obras/:id/fotos', enviarFoto);
router.put('/fotos/:id', salvarFoto);
router.delete('/fotos/:id', apagarFoto);

export default router;
