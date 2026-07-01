import { Router } from 'express';
import { 
    criarFornecedor, 
    verificarFornecedor, 
    processarItemXML // 🟢 Importando a nova função do controller
} from '../controllers/comprasController';

const router = Router();

// ==========================================
// ROTAS DE FORNECEDORES (Passo 1)
// ==========================================

// Rota pura de consulta via Query Params (ex: ?tenant_id=1&cnpj=123456...)
router.get('/fornecedores/verificar', verificarFornecedor);

router.get('/fornecedores', (req, res) => {
    res.json({ message: "Rota de fornecedores - GET" });
});

// Rota para o cadastro automático/manual do fornecedor
router.post('/fornecedores', criarFornecedor); 

// ==========================================
// ROTAS DE PROCESSAMENTO DE XML (Passo 2)
// ==========================================

// 🟢 Rota que será chamada dentro do loop de itens (<det><prod>) do seu XML
router.post('/itens/processar-xml', processarItemXML);

export default router;