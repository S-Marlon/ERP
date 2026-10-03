import { Router } from 'express';
import { buscarClientesPdv, categoriasPdv, detalheItemPdv, itensParaEtiqueta, listarItensPdv, marcasPdv } from './pdv/pdv.controller';
import { cancelarVenda, detalheVenda, listarVendas, registrarVenda } from './pdv/vendas.controller';
import { abrirCaixa, caixaAtual, detalheCaixa, fecharCaixa, lancarMovimento, listarCaixas } from './caixa/caixa.controller';
import { obterConfiguracoes, salvarConfiguracoes } from './regras/regrasVenda.controller';
import { obterTaxas, salvarTaxas } from './taxas/taxas.controller';

// Vendas no modelo novo (itens_core). Montado em /api/vendas
const router = Router();

router.get('/pdv/itens', listarItensPdv);
router.get('/pdv/itens/:idItem', detalheItemPdv);
router.get('/pdv/categorias', categoriasPdv);
router.get('/pdv/marcas', marcasPdv);
router.get('/pdv/etiquetas', itensParaEtiqueta);
router.get('/pdv/clientes', buscarClientesPdv);

router.post('/pdv/vendas', registrarVenda);
router.get('/pdv/vendas', listarVendas);
router.get('/pdv/vendas/:idVenda', detalheVenda);
router.post('/pdv/vendas/:idVenda/cancelar', cancelarVenda);

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

export default router;
