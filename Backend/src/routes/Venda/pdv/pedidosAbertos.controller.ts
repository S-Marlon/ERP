// Orçamentos e vendas suspensas: ficam em vendas_pedidos com status ORCAMENTO / SUSPENSA (itens em vendas_pedidos_itens).
// Não mexem em estoque, caixa nem contas a receber. Orçamento convertido vira CONVERTIDO e a venda guarda id_orcamento.
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { calcularItensDoPedido } from './vendas.controller';
import { ErroVenda, fecharVenda } from './vendaPdv';
import { operadorDe } from '../caixa/caixa.controller';

const TIPOS = ['ORCAMENTO', 'SUSPENSA'] as const;
type TipoAberto = typeof TIPOS[number];

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroVenda) return res.status(error.status).json({ error: error.message, detalhes: error.detalhes });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

const situacao = (status: string, valido: number | null) =>
  status === 'CONVERTIDO' ? 'CONVERTIDO' : status === 'SUSPENSA' ? 'SUSPENSA' : Number(valido) ? 'VALIDO' : 'VENCIDO';

/**
 * POST /api/vendas/pdv/pedidos-abertos
 * { tipo: ORCAMENTO | SUSPENSA, itens: [{ idItem, quantidade, idUnidade?, precoUnitario? }], descontoGeral?,
 *   clienteNome?, idCliente?, contato?, observacao?, validadeDias? (orçamento, padrão 7) }
 */
export const salvarPedidoAberto = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const tipo = String(req.body?.tipo || '').toUpperCase() as TipoAberto;
  if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido (ORCAMENTO ou SUSPENSA).' });
  const itens = req.body?.itens;
  if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ error: 'Sem itens para salvar.' });
  const validadeDias = Math.min(180, Math.max(1, Math.floor(Number(req.body?.validadeDias) || 7)));

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { ids, itensBanco, linhas } = await calcularItensDoPedido(connection, tenant, itens);
    const venda = fecharVenda(linhas, Number(req.body?.descontoGeral) || 0);

    // Custo de referência (margem do orçamento): custo médio do depósito Venda, senão o gerencial
    const [saldos]: any = await connection.execute(
      `SELECT id_item, custo_medio FROM estoque_saldos_itens WHERE tenant_id = ? AND deposito = 'VENDA' AND id_item IN (${ids.map(() => '?').join(',')})`,
      [tenant, ...ids]
    );
    const medio = new Map<number, number>(saldos.map((s: any) => [Number(s.id_item), Number(s.custo_medio) || 0]));
    const custoBase = (id: number) => medio.get(id) || Number(itensBanco.get(id).custo_gerencial) || 0;
    const totalCusto = venda.linhas.reduce((a, l) => a + custoBase(l.idItem) * l.quantidadeBase, 0);

    const [cab]: any = await connection.execute(
      `INSERT INTO vendas_pedidos
         (tenant_id, origem, status, operador, id_cliente, cliente_nome, contato, total_bruto, total_desconto, total_liquido, total_custo, observacao, validade)
       VALUES (?, 'PDV', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${tipo === 'ORCAMENTO' ? 'CURDATE() + INTERVAL ? DAY' : 'NULL'})`,
      [
        tenant, tipo, operadorDe(req), req.body?.idCliente ? Number(req.body.idCliente) : null,
        String(req.body?.clienteNome || '').trim().slice(0, 150) || 'CONSUMIDOR',
        String(req.body?.contato || '').trim().slice(0, 100) || null,
        f4(venda.totalBruto), f4(venda.totalDesconto), f4(venda.totalLiquido), f4(totalCusto),
        String(req.body?.observacao || '').trim().slice(0, 255) || null,
        ...(tipo === 'ORCAMENTO' ? [validadeDias] : []),
      ]
    );
    const id = Number(cab.insertId);
    for (const l of venda.linhas) {
      const item = itensBanco.get(l.idItem);
      const custo = custoBase(l.idItem);
      await connection.execute(
        `INSERT INTO vendas_pedidos_itens
           (tenant_id, id_venda, id_item, sku_snapshot, nome_snapshot, id_unidade, unidade_sigla, fator_conversao,
            quantidade, quantidade_base, preco_tabela, preco_unitario, desconto_valor, total_item, custo_unitario_base, custo_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenant, id, l.idItem, item.sku_customizado || item.sku_core, item.nome_comercial || item.nome_item,
          l.idUnidade, l.sigla, Number(l.fator).toFixed(6), f4(l.quantidade), f4(l.quantidadeBase),
          f4(l.precoTabela), f4(l.precoUnitarioFinal), f4(l.descontoValor), f4(l.totalItem), f4(custo), f4(custo * l.quantidadeBase),
        ]
      );
    }
    await connection.commit();
    return res.status(201).json({ success: true, id, tipo, totalLiquido: venda.totalLiquido });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao salvar.');
  } finally {
    connection.release();
  }
};

/** GET /api/vendas/pdv/pedidos-abertos?tipo=ORCAMENTO|SUSPENSA&situacao=VALIDO|VENCIDO|CONVERTIDO|TODOS&busca= */
export const listarPedidosAbertos = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const tipo = String(req.query.tipo || 'ORCAMENTO').toUpperCase();
    const sit = String(req.query.situacao || 'ABERTOS').toUpperCase();
    const filtros = ['p.tenant_id = ?'];
    const params: any[] = [tenant];
    if (tipo === 'SUSPENSA') filtros.push(`p.status = 'SUSPENSA'`);
    else if (sit === 'CONVERTIDO') filtros.push(`p.status = 'CONVERTIDO'`);
    else if (sit === 'VALIDO') filtros.push(`p.status = 'ORCAMENTO' AND p.validade >= CURDATE()`);
    else if (sit === 'VENCIDO') filtros.push(`p.status = 'ORCAMENTO' AND p.validade < CURDATE()`);
    else if (sit === 'TODOS') filtros.push(`p.status IN ('ORCAMENTO', 'CONVERTIDO')`);
    else filtros.push(`p.status = 'ORCAMENTO'`);
    const busca = String(req.query.busca || '').trim();
    if (busca) {
      filtros.push(`(p.cliente_nome LIKE ? OR p.contato LIKE ? OR p.id_venda = ? OR EXISTS (SELECT 1 FROM vendas_pedidos_itens i WHERE i.id_venda = p.id_venda AND (i.nome_snapshot LIKE ? OR i.sku_snapshot LIKE ?)))`);
      params.push(`%${busca}%`, `%${busca}%`, Number(busca) || 0, `%${busca}%`, `%${busca}%`);
    }
    const [rows]: any = await pool.execute(
      `SELECT p.id_venda, p.status, p.cliente_nome, p.id_cliente, p.contato, p.operador, p.total_liquido, p.total_custo, p.observacao,
              p.created_at, DATE_FORMAT(p.validade, '%Y-%m-%d') AS validade, p.validade >= CURDATE() AS valido,
              (SELECT COUNT(*) FROM vendas_pedidos_itens i WHERE i.id_venda = p.id_venda) AS qtd_itens,
              (SELECT v.id_venda FROM vendas_pedidos v WHERE v.id_orcamento = p.id_venda LIMIT 1) AS id_venda_gerada
       FROM vendas_pedidos p WHERE ${filtros.join(' AND ')} ORDER BY p.id_venda DESC LIMIT 200`,
      params
    );
    return res.json(rows.map((r: any) => ({
      id: Number(r.id_venda), tipo: r.status === 'SUSPENSA' ? 'SUSPENSA' : 'ORCAMENTO', situacao: situacao(r.status, r.valido),
      cliente: r.cliente_nome, idCliente: r.id_cliente ? Number(r.id_cliente) : null, contato: r.contato, operador: r.operador,
      total: Number(r.total_liquido), custo: Number(r.total_custo), observacao: r.observacao, criadoEm: r.created_at,
      validade: r.validade, qtdItens: Number(r.qtd_itens), idVendaGerada: r.id_venda_gerada ? Number(r.id_venda_gerada) : null,
    })));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar.');
  }
};

const carregarDetalhe = async (conn: any, tenant: number, id: number, trava = false) => {
  const [[p]]: any = await conn.execute(
    `SELECT p.*, DATE_FORMAT(p.validade, '%Y-%m-%d') AS validade_txt, p.validade >= CURDATE() AS valido
     FROM vendas_pedidos p WHERE p.id_venda = ? AND p.tenant_id = ? ${trava ? 'FOR UPDATE' : ''}`,
    [id, tenant]
  );
  if (!p || !['ORCAMENTO', 'SUSPENSA', 'CONVERTIDO'].includes(p.status)) return null;
  const [itens]: any = await conn.execute(
    `SELECT id_item, sku_snapshot, nome_snapshot, id_unidade, unidade_sigla, quantidade, preco_tabela, preco_unitario, desconto_valor, total_item
     FROM vendas_pedidos_itens WHERE id_venda = ? AND tenant_id = ? ORDER BY id_venda_item`,
    [id, tenant]
  );
  return {
    id: Number(p.id_venda), tipo: p.status === 'SUSPENSA' ? 'SUSPENSA' : 'ORCAMENTO', situacao: situacao(p.status, p.valido),
    cliente: p.cliente_nome, idCliente: p.id_cliente ? Number(p.id_cliente) : null, contato: p.contato, operador: p.operador,
    observacao: p.observacao, validade: p.validade_txt, criadoEm: p.created_at,
    totalBruto: Number(p.total_bruto), totalDesconto: Number(p.total_desconto), total: Number(p.total_liquido),
    itens: itens.map((i: any) => ({
      idItem: Number(i.id_item), sku: i.sku_snapshot, nome: i.nome_snapshot, idUnidade: i.id_unidade ? Number(i.id_unidade) : null,
      unidade: i.unidade_sigla, quantidade: Number(i.quantidade), precoTabela: Number(i.preco_tabela), precoUnitario: Number(i.preco_unitario),
      desconto: Number(i.desconto_valor), total: Number(i.total_item),
    })),
  };
};

/** GET /api/vendas/pdv/pedidos-abertos/:id */
export const detalhePedidoAberto = async (req: Request, res: Response) => {
  try {
    const d = await carregarDetalhe(pool, tenantDe(req), Number(req.params.id));
    if (!d) return res.status(404).json({ error: 'Orçamento ou venda suspensa não encontrado.' });
    return res.json(d);
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar.');
  }
};

/** POST /api/vendas/pdv/pedidos-abertos/:id/retomar — devolve os itens; a venda suspensa é apagada (volta ao carrinho) */
export const retomarPedidoAberto = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const d = await carregarDetalhe(connection, tenant, Number(req.params.id), true);
    if (!d) throw new ErroVenda('Orçamento ou venda suspensa não encontrado.', 404);
    if (d.situacao === 'CONVERTIDO') throw new ErroVenda('Este orçamento já virou venda.', 409);
    if (d.tipo === 'SUSPENSA') await connection.execute(`DELETE FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ?`, [d.id, tenant]);
    await connection.commit();
    return res.json(d);
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao retomar.');
  } finally {
    connection.release();
  }
};

/** DELETE /api/vendas/pdv/pedidos-abertos/:id — só orçamento em aberto ou venda suspensa */
export const excluirPedidoAberto = async (req: Request, res: Response) => {
  try {
    const [r]: any = await pool.execute(
      `DELETE FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ? AND status IN ('ORCAMENTO', 'SUSPENSA')`,
      [Number(req.params.id), tenantDe(req)]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Não encontrado (orçamento convertido não pode ser excluído).' });
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao excluir.');
  }
};
