import { Router } from 'express';
import { categoriasPdv, detalheItemPdv, listarItensPdv, marcasPdv } from './pdv/pdv.controller';
import { cancelarVenda, detalheVenda, listarVendas, registrarVenda } from './pdv/vendas.controller';

// Vendas no modelo novo (itens_core). Montado em /api/vendas
const router = Router();

router.get('/pdv/itens', listarItensPdv);
router.get('/pdv/itens/:idItem', detalheItemPdv);
router.get('/pdv/categorias', categoriasPdv);
router.get('/pdv/marcas', marcasPdv);

router.post('/pdv/vendas', registrarVenda);
router.get('/pdv/vendas', listarVendas);
router.get('/pdv/vendas/:idVenda', detalheVenda);
router.post('/pdv/vendas/:idVenda/cancelar', cancelarVenda);

export default router;
