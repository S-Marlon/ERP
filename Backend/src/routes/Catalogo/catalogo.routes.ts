// backend/src/modules/Catalogo/routes/catalogo.routes.ts

import { Router, Request, Response } from 'express';

// 🧬 Controller de Atributos Globais (Dicionário do ERP)
import {
  getAtributosGlobais,
  createAtributoGlobal,
  createAtributoGlobalRapido, 
  updateAtributoGlobal,
  deleteAtributoGlobal
} from './Atributos/atributosGlobais.controller';

// 📂 Controller de Grupos de Atributos Semânticos
import { 
  getGruposAtributos, 
  createGrupoAtributo, 
  updateGrupoAtributo, 
  deleteGrupoAtributo 
} from './Atributos/gruposAtributos.controller'; 

// 📏 Controller de Unidades de Medida
import { getUnidadesMedida } from './Atributos/unidadesMedida.controller'; 

// 📂 Controller de Categorias
import { 
  updateCategoriesOrder,
  getCategoriasSelect,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  getAtributosByCategoria
} from './Categorias/categorias';

// 📦 Controller de Famílias de Itens
import { 
  createFamilia, 
  deleteFamilia, 
  getFamilias, 
  updateFamilia 
} from './Familias/familias.controller';

// 🏷️ Controller de Produtos do Catálogo
import {
  getProdutos,
  searchProdutos,
  updateProduto,
  createProdutosLote
} from './Produtos/produtos.controller';

// 🟡 Controller Comercial de Produtos (Vínculo de Família e Atributos)
import {
  updateProdutoFamiliaEAtributos,
  testarRotaProduto
} from './Produtos/comercialProdutoController'

// 🏷️ Controller de Marcas Comerciais
import {
  getMarcas,
  createMarca
} from './Marcas/comercialMarcas.controller';

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

// =========================================================================
// 📁 GRUPOS DE ATRIBUTOS SEMÂNTICOS
// =========================================================================
router.get('/atributos-grupos', getGruposAtributos);
router.post('/atributos-grupos', createGrupoAtributo);
router.put('/atributos-grupos/:idGrupo', updateGrupoAtributo);
router.delete('/atributos-grupos/:idGrupo', deleteGrupoAtributo);
router.get('/cadastros/atributos-grupos', getGruposAtributos);

// =========================================================================
// 📏 DICIONÁRIO DE UNIDADES DE MEDIDA
// =========================================================================
router.get('/unidades', getUnidadesMedida);
router.get('/cadastros/unidades-medida', getUnidadesMedida);

// =========================================================================
// 📂 ROTAS DE CATEGORIAS
// =========================================================================
router.get('/cadastros/categorias', getCategoriasSelect);
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

// =========================================================================
// 🏷️ ROTAS DE PRODUTOS E CATÁLOGO
// =========================================================================
router.get('/produtos/search', searchProdutos);
router.get('/produtos', getProdutos);
router.post('/produtos/lote', createProdutosLote);
router.put('/produtos/:id_item', updateProduto);

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