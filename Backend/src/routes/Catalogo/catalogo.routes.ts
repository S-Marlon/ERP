// backend/src/modules/Catalogo/routes/catalogo.routes.ts

import { Router } from 'express';

// 🧬 Controller de Atributos Globais (Dicionário do ERP)
import {
  getAtributosGlobais,
  createAtributoGlobal,
  createAtributoGlobalRapido, 
  updateAtributoGlobal,
  deleteAtributoGlobal
} from './Atributos/atributosGlobais.controller';

// 📂 Controller de Grupos de Atributos Semânticos (Ex: Características Físicas)
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

// 📦 Controller de Famílias de Itens (Antigo controller "grupos" agora refatorado para Famílias)
import { 
  createFamilia, 
  deleteFamilia, 
  getFamilias, 
  updateFamilia 
} from './Familias/familias.controller';

const router = Router();

// =========================================================================
// 🧬 POOL DE ATRIBUTOS GLOBAIS (Dicionário de Especificações)
// =========================================================================
// Rotas de consumo dos Atributos Globais (Termos Disponíveis no ERP)
router.get('/atributos-globais', getAtributosGlobais);
router.post('/atributos-globais', createAtributoGlobal);

// Padrão de cadastros exigido pelo frontend para o seletor global de termos
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

// Alias para retrocompatibilidade do front-end
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
// Endpoints oficiais usando o nome correto "familias"
router.get('/cadastros/familias', getFamilias);
router.post('/cadastros/familias', createFamilia);
router.put('/cadastros/familias/:idFamilia', updateFamilia);
router.delete('/cadastros/familias/:idFamilia', deleteFamilia);

// // ALIAS LEGADO: Mantido para que o frontend que consome "/cadastros/grupos" não pare de funcionar
//  router.get('/cadastros/grupos', getFamilias);
// router.post('/cadastros/grupos', createFamilia);
// router.put('/cadastros/grupos/:idGrupo', updateFamilia);
// router.delete('/cadastros/grupos/:idGrupo', deleteFamilia);

export default router;