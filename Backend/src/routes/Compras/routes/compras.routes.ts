import { Router } from 'express';
import { criarFornecedor, verificarFornecedor } from '../controllers/comprasController';

const router = Router();

// Rota pura de consulta via Query Params (ex: ?tenant_id=1&cnpj=123456...)
router.get('/fornecedores/verificar', verificarFornecedor);

router.get('/fornecedores/', (req, res) => {
    res.json({ message: "Rota de fornecedores - GET" });
}
);


router.post('/fornecedores', criarFornecedor); // 🟢 Rota adicionada para o cadastro

export default router;