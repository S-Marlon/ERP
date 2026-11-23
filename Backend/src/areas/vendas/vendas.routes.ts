import { Router } from 'express';
import { buscarClientesPdv, cadastrarClienteRapido, categoriasPdv, detalheItemPdv, equivalentesItemPdv, itensParaEtiqueta, listarItensPdv, marcasPdv } from './pdv/pdv.controller';
import { cancelarVenda, detalheVenda, listarVendas, registrarVenda } from './pdv/vendas.controller';
import { abrirCaixa, caixaAtual, detalheCaixa, fecharCaixa, lancarMovimento, listarCaixas } from './caixa/caixa.controller';
import { obterConfiguracoes, salvarConfiguracoes } from './regras/regrasVenda.controller';
import { obterTaxas, salvarTaxas } from './taxas/taxas.controller';
import { painelVendas } from './painel/painelVendas.controller';
import { criarAdiantamento, devolverAdiantamentoRota, listarAdiantamentos } from './adiantamentos/adiantamentos.controller';
import { dadosDevolucao, detalheDevolucao, registrarDevolucao } from './devolucoes/devolucoes.controller';
import { ajustarVenda, vendaCompleta } from './ajustes/ajustes.controller';
import { prepararNegociacao } from './negociacao/negociacao.controller';
import pedidosFaturadosRoutes from './pedidos/pedidosFaturados.routes';
import { definirClientePedidoAberto, detalhePedidoAberto, excluirPedidoAberto, listarPedidosAbertos, retomarPedidoAberto, salvarPedidoAberto } from './pdv/pedidosAbertos.controller';

// Vendas no modelo novo (itens_core). Montado em /api/vendas
const router = Router();

router.get('/pdv/itens', listarItensPdv);
router.get('/pdv/itens/:idItem', detalheItemPdv);
router.get('/pdv/itens/:idItem/equivalentes', equivalentesItemPdv);
router.get('/pdv/categorias', categoriasPdv);
router.get('/pdv/marcas', marcasPdv);
router.get('/pdv/etiquetas', itensParaEtiqueta);
router.get('/pdv/clientes', buscarClientesPdv);
router.post('/pdv/clientes', cadastrarClienteRapido);

router.post('/pdv/vendas', registrarVenda);
router.get('/pdv/vendas', listarVendas);
router.get('/pdv/vendas/:idVenda', detalheVenda);
router.post('/pdv/vendas/:idVenda/cancelar', cancelarVenda);
// Venda completa e ajuste de venda a prazo (quantidade, preço, item incluído ou tirado)
router.get('/pdv/vendas/:idVenda/completa', vendaCompleta);
router.post('/pdv/vendas/:idVenda/ajustes', ajustarVenda);
// Devolução parcial/total e troca
router.get('/pdv/vendas/:idVenda/devolucao', dadosDevolucao);
router.post('/pdv/vendas/:idVenda/devolucoes', registrarDevolucao);
router.get('/pdv/devolucoes/:id', detalheDevolucao);

// Orçamentos e vendas suspensas (não mexem em estoque, caixa nem contas a receber)
router.post('/pdv/pedidos-abertos', salvarPedidoAberto);
router.post('/negociacao/preparar', prepararNegociacao);
router.get('/pdv/pedidos-abertos', listarPedidosAbertos);
router.get('/pdv/pedidos-abertos/:id', detalhePedidoAberto);
router.post('/pdv/pedidos-abertos/:id/retomar', retomarPedidoAberto);
router.delete('/pdv/pedidos-abertos/:id', excluirPedidoAberto);
router.put('/pdv/pedidos-abertos/:id/cliente', definirClientePedidoAberto);

// Pedidos faturados (empresa, entrega depois): reserva, NF-e emitida fora, boletos no contas a receber
router.use('/pedidos-faturados', pedidosFaturadosRoutes);

// Caixa: abertura, sangria/suprimento, fechamento com conferência e histórico
router.get('/caixa/atual', caixaAtual);
router.post('/caixa/abrir', abrirCaixa);
router.post('/caixa/movimentos', lancarMovimento);
router.post('/caixa/fechar', fecharCaixa);
router.get('/caixas', listarCaixas);
router.get('/caixas/:idCaixa', detalheCaixa);

// Regras de venda: limite de desconto, senha de autorização, política abaixo do custo
router.get('/configuracoes', obterConfiguracoes);
router.put('/configuracoes', salvarConfiguracoes);

// Taxas dos meios de pagamento (maquininha) e parcelamento
router.get('/taxas', obterTaxas);
router.put('/taxas', salvarTaxas);

// Central de Vendas (painel)
router.get('/painel', painelVendas);

// Adiantamentos (sinais) de clientes
router.post('/adiantamentos', criarAdiantamento);
router.get('/adiantamentos', listarAdiantamentos);
router.post('/adiantamentos/:id/devolver', devolverAdiantamentoRota);

export default router;
