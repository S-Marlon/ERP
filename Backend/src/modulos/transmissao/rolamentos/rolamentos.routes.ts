// Módulo Rolamentos. Montado em /api/modulos/transmissao/rolamentos (bloqueado se o módulo estiver desligado)
import { Router } from 'express';
import { analisarLinhas, dicionario, excluirMedida, familiasDosCodigos, itensParaReorganizar, moverItens, renomearItens, obterConfig, salvarConfig, salvarMarca, salvarMedidas, verificarSkus } from './rolamentos.controller';

const router = Router();

router.get('/config', obterConfig);
router.put('/config', salvarConfig);
router.put('/marcas/:idMarca', salvarMarca);
router.post('/analisar', analisarLinhas);
router.get('/dicionario', dicionario);
router.post('/renomear', renomearItens);
router.post('/familias', familiasDosCodigos);
router.get('/reorganizar', itensParaReorganizar);
router.post('/reorganizar/mover', moverItens);
router.post('/skus', verificarSkus);
router.post('/medidas', salvarMedidas);
router.delete('/medidas/:id', excluirMedida);

export default router;
