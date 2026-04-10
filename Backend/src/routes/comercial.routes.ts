import express, { Request, Response, NextFunction } from 'express';
import pool from '../routes/Estoque/db.config';

const router = express.Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post('/sales', asyncHandler(async (req, res) => {
  const { items, totalVenda, idUsuario, idCliente, formaPagamento } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Carrinho vazio.' });

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [vendaResult]: any = await connection.execute(
      `INSERT INTO vendas (id_usuario, id_cliente, data_venda, valor_total, forma_pagamento, status_venda) VALUES (?, ?, NOW(), ?, ?, 'CONCLUIDA')`,
      [idUsuario || null, idCliente || null, totalVenda, formaPagamento || 'DINHEIRO']
    );

    const idVenda = vendaResult.insertId;

    for (const item of items) {
      const { idProduto, quantidade, precoUnitario } = item;
      const [estoque]: any = await connection.execute('SELECT quantidade, valor_medio FROM estoque_saldos WHERE id_produto = ?', [idProduto]);
      const custoAtual = estoque.length > 0 ? parseFloat(estoque[0].valor_medio) : 0;
      const saldoAtual = estoque.length > 0 ? parseFloat(estoque[0].quantidade) : 0;

      if (saldoAtual < quantidade) console.warn(`Produto ${idProduto} com estoque insuficiente (Saldo: ${saldoAtual}).`);

      await connection.execute(
        `INSERT INTO vendas_itens (id_venda, id_produto, quantidade, preco_unitario, custo_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [idVenda, idProduto, quantidade, precoUnitario, custoAtual, quantidade * precoUnitario]
      );

      await connection.execute(
        `INSERT INTO estoque_movimentos (id_produto, tipo, origem, id_origem, quantidade, valor_unitario, valor_total) VALUES (?, 'SAIDA', 'VENDA', ?, ?, ?, ?)`,
        [idProduto, idVenda, quantidade, precoUnitario, quantidade * precoUnitario]
      );

      await connection.execute('UPDATE estoque_saldos SET quantidade = quantidade - ? WHERE id_produto = ?', [quantidade, idProduto]);
    }

    const statusInicial = (formaPagamento === 'DINHEIRO') ? 'PAGO' : 'PENDENTE';
    const dataPagamento = (formaPagamento === 'DINHEIRO') ? new Date() : null;

    await connection.execute(
      `INSERT INTO contas_receber (id_venda, id_cliente, valor_nominal, data_vencimento, data_pagamento, status, forma_pagamento) VALUES (?, ?, ?, NOW(), ?, ?, ?)`,
      [idVenda, idCliente || null, totalVenda, dataPagamento, statusInicial, formaPagamento]
    );

    await connection.commit();
    res.status(201).json({ success: true, message: 'Venda realizada com sucesso!', idVenda });
  } catch (error: any) {
    await connection.rollback();
    console.error('ERRO NA VENDA:', error);
    res.status(500).json({ error: 'Falha ao processar venda.', details: error.message || error });
  } finally {
    connection.release();
  }
}));

router.get('/orders', asyncHandler(async (_req, res) => {
  res.json({ message: 'Rota de Pedidos em construção.' });
}));

router.get('/quotes', asyncHandler(async (_req, res) => {
  res.json({ message: 'Rota de Orçamentos em construção.' });
}));

router.get('/customers', asyncHandler(async (_req, res) => {
  const [rows]: any = await pool.execute('SELECT id_cliente, nome FROM clientes LIMIT 100');
  res.json({ data: rows });
}));

router.get('/vendors', asyncHandler(async (_req, res) => {
  const [rows]: any = await pool.execute('SELECT id_vendedor, nome FROM vendedores LIMIT 100');
  res.json({ data: rows });
}));

export default router;
