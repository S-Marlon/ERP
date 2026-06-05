import { Router } from 'express';
const router = Router();
// Considere que 'db' é o seu pool de conexões do MySQL (ex: mysql2/promise)

router.get('/api/produtos/buscar-mapeamento', async (req, res) => {
    try {
        const { query, tenant_id } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'Termo de busca não fornecido.' });
        }

        // Busca produtos ativos pelo código interno, descrição ou código de barras
        // Verifica se há grade calculando se o produto aceita variações (Exemplo de lógica de catálogo)
        const [produtos] = await db.execute(`
            SELECT 
                p.id_produto as id,
                p.descricao,
                p.codigo_interno,
                p.codigo_barras,
                -- Lógica fictícia para 'temGrade': se o tipo de produto exigir ou se houver flag na loja
                IF(p.tipo_produto = 'COMPRADO' AND lp.id_produto IS NOT NULL, 1, 0) as temGrade
            FROM produtos_core p
            LEFT JOIN loja_produtos_core lp ON p.id_produto = lp.id_produto
            WHERE p.tenant_id = ? 
              AND p.status = 'ATIVO'
              AND (p.descricao LIKE ? OR p.codigo_interno LIKE ? OR p.codigo_barras LIKE ?)
            LIMIT 5
        `, [tenant_id, `%${query}%`, `%${query}%`, `%${query}%`]);

        // Simula uma pontuação simples de Match para o Front-end baseado na busca
        const resultadosComMatch = produtos.map(prod => ({
            ...prod,
            temGrade: Boolean(prod.temGrade),
            matchPercentage: prod.descricao.toLowerCase().includes(String(query).toLowerCase()) ? 95 : 70
        }));

        return res.json(resultadosComMatch);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao buscar produtos.' });
    }
});