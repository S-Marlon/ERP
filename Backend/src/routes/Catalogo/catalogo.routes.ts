// backend/src/modules/Catalogo/routes/catalogo.routes.ts

import { Router } from 'express';
// backend/src/modules/Catalogo/routes/catalogo.routes.ts

// ... seus outros imports ...
import {
  getAtributosGlobais,
  createAtributoGlobal,
  updateAtributoGlobal,
  deleteAtributoGlobal
} from './Atributos/atributosGlobais.controller';

// 💡 IMPORTANTE: Importe os controllers correspondentes a Grupos e Unidades
// (Ajuste o caminho do arquivo de acordo com a sua estrutura interna)
import { getGruposAtributos } from './Atributos/gruposAtributos.controller'; 
import { getUnidadesMedida } from './Atributos/unidadesMedida.controller'; 
import { updateCategoriesOrder,
    getCategoriasSelect,
    createCategoria,
    updateCategoria,
    deleteCategoria,
    getAtributosByCategoria
 } from './Categorias/categorias';
import { createFamilia, deleteFamilia, getFamilias, updateFamilia } from './Familias/familias.controller';


 

const router = Router();

// =========================================================================
// 🧬 POOL DE ATRIBUTOS GLOBAIS (Dicionário de Especificações)
// =========================================================================
router.get('/atributos-globais', getAtributosGlobais);
router.post('/atributos-globais', createAtributoGlobal);
router.put('/atributos-globais/:idAtributo', updateAtributoGlobal);
router.delete('/atributos-globais/:idAtributo', deleteAtributoGlobal);


// ==========================================
// ROTAS DE CATEGORIAS
// ==========================================
router.get('/cadastros/categorias', getCategoriasSelect);
router.post('/cadastros/categorias', createCategoria);
router.put('/cadastros/categorias/:idCategoria', updateCategoria);
router.delete('/cadastros/categorias/:idCategoria', deleteCategoria);
router.patch('/cadastros/categorias/reordenar', updateCategoriesOrder);


// 🚀 NOVA ROTA: Busca os atributos vinculados a uma categoria específica
router.get('/cadastros/categorias/:idCategoria/atributos', getAtributosByCategoria);



// ==========================================
// ROTAS DE GRUPOS DE PRODUTOS 
// ==========================================
router.get('/cadastros/grupos', getFamilias);
router.post('/cadastros/grupos', createFamilia);
router.put('/cadastros/grupos/:idGrupo', updateFamilia);
router.delete('/cadastros/grupos/:idGrupo', deleteFamilia);



// 🚀 ADICIONE ESTES DOIS ENDPOINTS AQUI:
router.get('/grupos', getGruposAtributos);
router.get('/unidades', getUnidadesMedida);

export default router;