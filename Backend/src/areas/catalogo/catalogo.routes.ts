// backend/src/modules/Catalogo/routes/catalogo.routes.ts

import { Router, Request, Response } from 'express';

// 🧬 Controller de Atributos Globais (Dicionário do ERP)
import { getAtributosGlobais, createAtributoGlobal, createAtributoGlobalRapido, updateAtributoGlobal, deleteAtributoGlobal, mesclarAtributos } from './atributos/atributosGlobais.controller';

// 📂 Controller de Grupos de Atributos Semânticos
import { 
  getGruposAtributos, 
  createGrupoAtributo, 
  updateGrupoAtributo, 
  deleteGrupoAtributo 
} from './atributos/gruposAtributos.controller'; 

// 📏 Controller de Unidades de Medida
import { getUnidadesMedida } from './atributos/unidadesMedida.controller'; 

// 📂 Controller de Categorias
import { 
  updateCategoriesOrder,
  getCategoriasSelect,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  getAtributosByCategoria,
  getUsoCategoria,
  vincularItensCategoria,
} from './categorias/categorias';

// 📦 Controller de Famílias de Itens
import { 
  createFamilia, 
  deleteFamilia, 
  getFamilias, 
  getProdutosPorFamilia, 
  getDiagnosticoFormalizacao,
  formalizarItensFamilia,
  vincularItensFamilia,
  updateFamilia 
} from './familias/familias.controller';

// 🏷️ Controller de Produtos do Catálogo
import {
  getProdutos,
  searchProdutos,
  updateProduto,
  createProdutosLote
} from './produtos/produtos.controller';

// 🟡 Controller Comercial de Produtos (Vínculo de Família e Atributos)
import {
  updateProdutoFamiliaEAtributos,
  testarRotaProduto
} from './produtos/comercialProdutoController'

// 🏷️ Controller de Marcas Comerciais
import {
  getMarcas,
  createMarca
} from './marcas/comercialMarcas.controller';
import { getAtributosPorProduto } from './atributos/atributos.controller';
import { getConfigVendas, salvarConfigVendas, atualizarCustoGerencial, listarUnidadesItens, criarUnidadeItem } from './precos/configVendas.controller';
import { listarPendenciasPim } from './produtos/pendencias.controller';
import { resumoCatalogo } from './produtos/resumoCatalogo.controller';
import { painelPrecos } from './precos/painelPrecos.controller';
import { aplicarPrecosComTaxa, previaPrecosComTaxa } from './precos/precosTaxa.controller';
import { salvarPrecosLote } from './precos/precosLote.controller';
import { apagarItens, conferirExclusao } from './produtos/exclusaoItens.controller';
import { listarDuplicados, unificarItens } from './produtos/unificacao.controller';
import { atualizarCustosKits, atualizarKit, criarKit, desfazerKit, detalheKit, listarKits, relatorioKits } from './kits/kits.controller';
import { getProdutoDetalhe, updateProdutoParcial, adicionarAnexo, removerAnexo, definirImagemPrincipal, getFichaTecnica, salvarFichaTecnica, getAtributosParaItem } from './produtos/produtoDetalhe.controller';

const router = Router();

// =========================================================================
// 🧪 ROTA DE TESTE DA RAIZ DO MÓDULO CATÁLOGO
// =========================================================================
router.get('/', (req: Request, res: Response) => {
  return res.json({ 
    success: true, 
    message: 'Módulo Catálogo está online e operando com sucesso! 🚀',
    timestamp: new Date().toISOString()
  });
});

// =========================================================================
// 🧬 POOL DE ATRIBUTOS GLOBAIS (Dicionário de Especificações)
// =========================================================================
router.get('/atributos-globais', getAtributosGlobais);
router.post('/atributos-globais', createAtributoGlobal);
router.get('/cadastros/atributos', getAtributosGlobais); 
router.get('/cadastros/atributos-globais', getAtributosGlobais);
router.post('/cadastros/atributos-globais/rapido', createAtributoGlobalRapido);
router.put('/atributos-globais/:idAtributo', updateAtributoGlobal);
router.delete('/atributos-globais/:idAtributo', deleteAtributoGlobal);
// Junta atributos duplicados (valores, vínculos e templates vão para o destino)
router.post('/atributos-globais/:idAtributo/mesclar', mesclarAtributos);

// =========================================================================
// 📁 GRUPOS DE ATRIBUTOS SEMÂNTICOS
// =========================================================================
router.get('/atributos-grupos', getGruposAtributos);
router.post('/atributos-grupos', createGrupoAtributo);
router.put('/atributos-grupos/:idGrupo', updateGrupoAtributo);
router.delete('/atributos-grupos/:idGrupo', deleteGrupoAtributo);
router.get('/cadastros/atributos-grupos', getGruposAtributos);

router.get('/:id_item/atributos', getAtributosPorProduto);

// Configuração de vendas: unidades (fracionamento/atacado), faixas de preço e custo gerencial
router.get('/itens-unidades', listarUnidadesItens);
router.post('/itens-unidades', criarUnidadeItem);
router.get('/itens/:idItem/config-vendas', getConfigVendas);
router.put('/itens/:idItem/config-vendas', salvarConfigVendas);
router.post('/itens/:idItem/custo-gerencial', atualizarCustoGerencial);

// =========================================================================
// 📏 DICIONÁRIO DE UNIDADES DE MEDIDA
// =========================================================================
router.get('/unidades', getUnidadesMedida);
router.get('/cadastros/unidades-medida', getUnidadesMedida);

// =========================================================================
// 📂 ROTAS DE CATEGORIAS
// =========================================================================
router.get('/cadastros/categorias', getCategoriasSelect);
// Famílias e itens de uma categoria (lateral "Uso da categoria")
router.get('/cadastros/categorias/:idCategoria/uso', getUsoCategoria);
router.post('/cadastros/categorias/:idCategoria/itens', vincularItensCategoria);
router.post('/cadastros/categorias', createCategoria);
router.put('/cadastros/categorias/:idCategoria', updateCategoria);
router.delete('/cadastros/categorias/:idCategoria', deleteCategoria);
router.patch('/cadastros/categorias/reordenar', updateCategoriesOrder);
router.get('/cadastros/categorias/:idCategoria/atributos', getAtributosByCategoria);

// =========================================================================
// 📦 ROTAS DE FAMÍLIAS DE PRODUTOS
// =========================================================================
router.get('/cadastros/familias', getFamilias);
router.post('/cadastros/familias', createFamilia);
router.put('/cadastros/familias/:idFamilia', updateFamilia);
router.delete('/cadastros/familias/:idFamilia', deleteFamilia);
router.get('/cadastros/familias/:idFamilia/formalizacao', getDiagnosticoFormalizacao);
router.post('/cadastros/familias/:idFamilia/formalizacao', formalizarItensFamilia);
router.get('/cadastros/familias/:idFamilia/produtos', getProdutosPorFamilia);
// Incluir / tirar itens da família (tela de famílias)
router.post('/cadastros/familias/:idFamilia/itens', vincularItensFamilia);

// =========================================================================
// 🏷️ ROTAS DE PRODUTOS E CATÁLOGO
// =========================================================================
router.get('/produtos/search', searchProdutos);
router.get('/produtos', getProdutos);
router.post('/produtos/lote', createProdutosLote);
// Atualização parcial (campo ausente mantém, null limpa); substitui o updateProduto antigo, que zerava custo/preço
router.put('/produtos/:id_item', updateProdutoParcial);
router.get('/produtos/:id_item/detalhe', getProdutoDetalhe);
// Ficha técnica (atributos da categoria + família com os valores do item)
router.get('/produtos/:id_item/ficha-tecnica', getFichaTecnica);
// Atributos de um item novo pela família/categoria (entrada de NF)
router.get('/atributos-para-item', getAtributosParaItem);
// Pendências do PIM (todos os itens com algo a resolver)
router.get('/pendencias', listarPendenciasPim);
// Resumo do catálogo (painel do PIM)
router.get('/resumo', resumoCatalogo);
// Painel de precificação (custo, preço, margem e situação dos itens de venda)
router.get('/precos/painel', painelPrecos);
// Preços com a taxa da maquininha embutida (Vendas › Taxas de pagamento): prévia e aplicação
router.get('/precos/taxa/previa', previaPrecosComTaxa);
router.post('/precos/lote', salvarPrecosLote);
// Exclusão de itens sem histórico (itens de teste)
router.post('/itens/exclusao/conferir', conferirExclusao);
router.post('/itens/exclusao', apagarItens);
router.post('/precos/taxa/aplicar', aplicarPrecosComTaxa);
// Itens duplicados: suspeitas e unificação de um item em outro
router.get('/itens/duplicados', listarDuplicados);
router.post('/itens/unificar', unificarItens);
// Kits de venda (composição em itens_composicoes; na venda a baixa sai dos componentes)
router.get('/kits', listarKits);
router.get('/kits/relatorio', relatorioKits);
router.post('/kits/atualizar-custos', atualizarCustosKits);
router.post('/kits', criarKit);
router.get('/kits/:idItem', detalheKit);
router.put('/kits/:idItem', atualizarKit);
router.delete('/kits/:idItem', desfazerKit);
router.put('/produtos/:id_item/ficha-tecnica', salvarFichaTecnica);
// Anexos (links de imagens/documentos em itens_anexos)
router.post('/produtos/:id_item/anexos', adicionarAnexo);
router.delete('/produtos/:id_item/anexos/:id_anexo', removerAnexo);
router.put('/produtos/:id_item/anexos/:id_anexo/principal', definirImagemPrincipal);

// =========================================================================
// 🟡 ROTAS COMERCIAIS DE PRODUTOS (Família e Atributos Customizados)
// =========================================================================
router.get('/cadastros/produtos/familia/teste', testarRotaProduto);
router.put('/cadastros/produtos/familia', updateProdutoFamiliaEAtributos);



// =========================================================================
// 🧪 ROTA DE TESTE DA RAIZ DO MÓDULO CATÁLOGO
// =========================================================================
router.get('/parceiros', (req: Request, res: Response) => {
  return res.json({ 
    success: true, 
    message: 'Módulo parcero está online e operando com sucesso! 🚀',
    timestamp: new Date().toISOString()
  });
});


// =========================================================================
// 🏷️ ROTAS DE MARCAS COMERCIAIS (PIM)
// =========================================================================
// =========================================================================
// 🏷️ ROTAS DE MARCAS COMERCIAIS (PIM)
// =========================================================================
router.get('/marcas', getMarcas);
router.post('/marcas', createMarca);
router.get('/cadastros/marcas', getMarcas);
router.post('/cadastros/marcas', createMarca); // 👈 Adicione esta linha aqui


export default router;