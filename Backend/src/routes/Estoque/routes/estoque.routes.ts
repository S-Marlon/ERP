// backend/src/modules/Estoque/routes/estoque.routes.ts

import { Router } from 'express';
import { 
  getCategoriasSelect, 
  createCategoria, 
  updateCategoria, 
  deleteCategoria,
  updateCategoriesOrder 
} from '../Categorias/routes/categorias';

import {
  getGrupos,
  createGrupo,
  updateGrupo,
  deleteGrupo
} from '../Grupos/grupos.controller'; // Ajuste o caminho conforme sua árvore de pastas

const router = Router();

// ==========================================
// ROTAS DE CATEGORIAS
// ==========================================
router.get('/cadastros/categorias', getCategoriasSelect);
router.post('/cadastros/categorias', createCategoria);
router.put('/cadastros/categorias/:idCategoria', updateCategoria);
router.delete('/cadastros/categorias/:idCategoria', deleteCategoria);
router.patch('/cadastros/categorias/reordenar', updateCategoriesOrder);

// ==========================================
// ROTAS DE GRUPOS DE PRODUTOS 
// ==========================================
router.get('/cadastros/grupos', getGrupos);
router.post('/cadastros/grupos', createGrupo);
router.put('/cadastros/grupos/:idGrupo', updateGrupo);
router.delete('/cadastros/grupos/:idGrupo', deleteGrupo);

export default router;