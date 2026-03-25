/**
 * POST /api/sales
 * Registra a venda, baixa o estoque e calcula o lucro bruto baseado no custo médio atual.
 */
app.post('/api/sales', asyncHandler(async (req, res) => {
    const { items, totalVenda, idUsuario, idCliente, formaPagamento } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: "Carrinho vazio." });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Criar o cabeçalho da Venda
        const [vendaResult]: any = await connection.execute(
            `INSERT INTO vendas (id_usuario, id_cliente, data_venda, valor_total, forma_pagamento, status_venda) 
             VALUES (?, ?, NOW(), ?, ?, 'CONCLUIDA')`,
            [idUsuario || null, idCliente || null, totalVenda, formaPagamento || 'DINHEIRO']
        );
        const idVenda = vendaResult.insertId;

        // 2. Processar cada item do carrinho
        for (const item of items) {
            const { idProduto, quantidade, precoUnitario } = item;

            // 2a. Buscar o Custo Médio Atual para registrar o lucro real dessa venda
            const [estoque]: any = await connection.execute(
                "SELECT quantidade, valor_medio FROM estoque_saldos WHERE id_produto = ?",
                [idProduto]
            );

            const custoAtual = estoque.length > 0 ? parseFloat(estoque[0].valor_medio) : 0;
            const saldoAtual = estoque.length > 0 ? parseFloat(estoque[0].quantidade) : 0;

            // Verificação de estoque (Opcional: permitir venda negativa se configurado)
            if (saldoAtual < quantidade) {
                console.warn(`Atenção: Produto ${idProduto} com estoque insuficiente (Saldo: ${saldoAtual}).`);
            }

            // 2b. Inserir Item da Venda
            await connection.execute(
                `INSERT INTO vendas_itens (id_venda, id_produto, quantidade, preco_unitario, custo_unitario, subtotal) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [idVenda, idProduto, quantidade, precoUnitario, custoAtual, (quantidade * precoUnitario)]
            );

            // 2c. Registrar a SAÍDA no Histórico (estoque_movimentos)
            await connection.execute(
                `INSERT INTO estoque_movimentos (id_produto, tipo, origem, id_origem, quantidade, valor_unitario, valor_total) 
                 VALUES (?, 'SAIDA', 'VENDA', ?, ?, ?, ?)`,
                [idProduto, idVenda, quantidade, precoUnitario, (quantidade * precoUnitario)]
            );

            // 2d. Atualizar o Saldo Real (estoque_saldos)
            // Aqui apenas subtraímos a quantidade. O custo médio não muda na saída.
            await connection.execute(
                "UPDATE estoque_saldos SET quantidade = quantidade - ? WHERE id_produto = ?",
                [quantidade, idProduto]
            );
        }


        // 3. Gerar o Contas a Receber
// Se for "Dinheiro", já nasce como 'PAGO'. Se for "Cartão" ou "Prazo", nasce como 'PENDENTE'.
const statusInicial = (formaPagamento === 'DINHEIRO') ? 'PAGO' : 'PENDENTE';
const dataPagamento = (formaPagamento === 'DINHEIRO') ? new Date() : null;

await connection.execute(
    `INSERT INTO contas_receber (id_venda, id_cliente, valor_nominal, data_vencimento, data_pagamento, status, forma_pagamento) 
     VALUES (?, ?, ?, NOW(), ?, ?, ?)`,
    [
        idVenda, 
        idCliente || null, 
        totalVenda, 
        dataPagamento, 
        statusInicial, 
        formaPagamento
    ]
);

        await connection.commit();
        res.status(201).json({ 
            success: true, 
            message: "Venda realizada com sucesso!", 
            idVenda 
        });

    } catch (error: any) {
        await connection.rollback();
        console.error("ERRO NA VENDA:", error);
        res.status(500).json({ error: "Falha ao processar venda.", details: error.message });
    } finally {
        connection.release();
    }
}));


app.get('/api/financial/summary', asyncHandler(async (req, res) => {
    const [rows]: any = await pool.execute(`
        SELECT 
            (SELECT SUM(valor_nominal) FROM contas_receber WHERE status = 'PENDENTE') AS aReceber,
            (SELECT SUM(valor_nominal) FROM contas_pagar WHERE status = 'PENDENTE') AS aPagar,
            (SELECT SUM(valor_nominal) FROM contas_receber WHERE status = 'PAGO' AND MONTH(data_pagamento) = MONTH(NOW())) AS recebidoMes,
            (SELECT SUM(valor_nominal) FROM contas_pagar WHERE status = 'PAGO' AND MONTH(data_pagamento) = MONTH(NOW())) AS pagoMes
    `);

    const r = rows[0];
    const saldoPrevisto = (r.recebidoMes + r.aReceber) - (r.pagoMes + r.aPagar);

    res.json({
        ...r,
        saldoPrevisto
    });
}));



app.patch('/api/financial/pay/:tipo/:id', asyncHandler(async (req, res) => {
    const { tipo, id } = req.params; // tipo = 'pagar' ou 'receber'
    const tabela = tipo === 'pagar' ? 'contas_pagar' : 'contas_receber';
    const idNome = tipo === 'pagar' ? 'id_conta_pagar' : 'id_conta_receber';

    await pool.execute(
        `UPDATE ${tabela} SET status = 'PAGO', data_pagamento = NOW() WHERE ${idNome} = ?`,
        [id]
    );

    res.json({ success: true, message: "Pagamento registrado!" });
}));