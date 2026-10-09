// Devolução parcial ou total de venda: itens voltam ao estoque (ou não, se defeituosos) e o valor volta ao
// cliente pelo caixa, como crédito na loja (adiantamento) ou abatido das parcelas a prazo da venda.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { calcularCustoMedio } from '../../compras/staging/penteFino';
import { carregarCaixaAberto, operadorDe } from '../caixa/caixa.controller';
import { registrarCreditoLoja } from '../adiantamentos/adiantamentos.controller';
import { saidasDoKitNaVenda } from '../../catalogo/kits/kitsBanco';
import { voltaDaDevolucao } from '../../catalogo/kits/kits';
import { abaterParcelas, calcularDevolucao, ErroDevolucao, LinhaVendida, Reembolso, REEMBOLSOS, REEMBOLSOS_CAIXA } from './devolucoes';

export const ORIGEM_DEVOLUCAO = 'DEVOLUCAO_VENDA';
export const ORIGEM_CREDITO_DEVOLUCAO = 'DEVOLUCAO';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroDevolucao || typeof error?.status === 'number') return res.status(error.status || 400).json({ error: error.message });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

/** Linhas da venda com o que já foi devolvido. */
const carregarLinhas = async (conn: any, tenant: number, idVenda: number, trava = false) => {
  const [rows]: any = await conn.execute(
    `SELECT vi.id_venda_item, vi.id_item, vi.nome_snapshot, vi.sku_snapshot, vi.unidade_sigla, vi.quantidade, vi.fator_conversao,
            vi.total_item, vi.custo_unitario_base, ic.tipo_recurso,
            COALESCE((SELECT SUM(di.quantidade) FROM vendas_devolucoes_itens di WHERE di.id_venda_item = vi.id_venda_item), 0) AS dev_qtd,
            COALESCE((SELECT SUM(di.valor) FROM vendas_devolucoes_itens di WHERE di.id_venda_item = vi.id_venda_item), 0) AS dev_valor
     FROM vendas_pedidos_itens vi INNER JOIN itens_core ic ON ic.id_item = vi.id_item
     WHERE vi.id_venda = ? AND vi.tenant_id = ? ORDER BY vi.id_venda_item ${trava ? 'FOR UPDATE' : ''}`,
    [idVenda, tenant]
  );
  return rows as any[];
};

const paraLinhaVendida = (r: any): LinhaVendida => ({
  idVendaItem: Number(r.id_venda_item), nome: r.nome_snapshot, quantidade: Number(r.quantidade), fator: Number(r.fator_conversao) || 1,
  totalItem: Number(r.total_item), devolvidoQtd: Number(r.dev_qtd), devolvidoValor: Number(r.dev_valor),
});

/** GET /api/vendas/pdv/vendas/:idVenda/devolucao — o que ainda pode ser devolvido e como reembolsar */
export const dadosDevolucao = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const idVenda = Number(req.params.idVenda);
    const [[venda]]: any = await pool.execute(
      `SELECT id_venda, status, id_cliente, cliente_nome, total_liquido, total_devolvido, created_at FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ?`,
      [idVenda, tenant]
    );
    if (!venda) throw new ErroDevolucao('Venda não encontrada.', 404);
    const linhas = await carregarLinhas(pool, tenant, idVenda);
    const [[prazo]]: any = await pool.execute(
      `SELECT COALESCE(SUM(valor - valor_pago), 0) AS saldo FROM financeiro_contas_receber WHERE tenant_id = ? AND id_venda = ? AND status = 'ABERTO'`,
      [tenant, idVenda]
    );
    const [devs]: any = await pool.execute(
      `SELECT id_devolucao, reembolso, valor_total, motivo, operador, created_at FROM vendas_devolucoes WHERE id_venda = ? AND tenant_id = ? ORDER BY id_devolucao`,
      [idVenda, tenant]
    );
    return res.json({
      idVenda, status: venda.status, idCliente: venda.id_cliente ? Number(venda.id_cliente) : null, cliente: venda.cliente_nome,
      total: Number(venda.total_liquido), totalDevolvido: Number(venda.total_devolvido), criadoEm: venda.created_at,
      saldoPrazo: Number(prazo?.saldo) || 0,
      itens: linhas.map(r => {
        const l = paraLinhaVendida(r);
        return {
          idVendaItem: l.idVendaItem, idItem: Number(r.id_item), nome: l.nome, sku: r.sku_snapshot, unidade: r.unidade_sigla || '',
          quantidade: l.quantidade, devolvido: l.devolvidoQtd, restante: Number((l.quantidade - l.devolvidoQtd).toFixed(4)),
          valorUnitarioPago: l.quantidade > 0 ? Number((l.totalItem / l.quantidade).toFixed(4)) : 0, total: l.totalItem,
          servico: String(r.tipo_recurso).toUpperCase() === 'SERVICO',
        };
      }),
      devolucoes: devs.map((d: any) => ({ idDevolucao: Number(d.id_devolucao), reembolso: d.reembolso, valor: Number(d.valor_total), motivo: d.motivo, operador: d.operador, criadoEm: d.created_at })),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar a venda.');
  }
};

/**
 * POST /api/vendas/pdv/vendas/:idVenda/devolucoes
 * { itens: [{ idVendaItem, quantidade, voltaEstoque? }], reembolso, motivo, operador }
 */
export const registrarDevolucao = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idVenda = Number(req.params.idVenda);
  const reembolso = String(req.body?.reembolso || '').toUpperCase() as Reembolso;
  const motivo = String(req.body?.motivo || '').trim();
  const pedidos: Array<{ idVendaItem: number; quantidade: number; voltaEstoque?: boolean }> = Array.isArray(req.body?.itens) ? req.body.itens : [];
  if (!REEMBOLSOS.includes(reembolso)) return res.status(400).json({ error: 'Escolha como devolver o valor.' });
  if (!motivo) return res.status(400).json({ error: 'Informe o motivo da devolução.' });

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[venda]]: any = await connection.execute(
      `SELECT id_venda, status, id_cliente, cliente_nome FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ? FOR UPDATE`, [idVenda, tenant]
    );
    if (!venda) throw new ErroDevolucao('Venda não encontrada.', 404);
    if (venda.status !== 'CONCLUIDA') throw new ErroDevolucao('Só vendas concluídas podem ter devolução.', 409);

    const linhasBanco = await carregarLinhas(connection, tenant, idVenda, true);
    const calculo = calcularDevolucao(linhasBanco.map(paraLinhaVendida), pedidos.map(p => ({ idVendaItem: Number(p.idVendaItem), quantidade: Number(p.quantidade) })));
    const operador = operadorDe(req);

    // Reembolso
    let idCaixa: number | null = null;
    if (REEMBOLSOS_CAIXA.includes(reembolso)) {
      const caixa = await carregarCaixaAberto(connection, tenant, 'LOCK IN SHARE MODE');
      if (!caixa) throw new ErroDevolucao('Abra o caixa para devolver o valor (sai do caixa do dia).', 409);
      idCaixa = Number(caixa.id_caixa);
    }
    if (reembolso === 'ABATER_PRAZO') {
      const [titulos]: any = await connection.execute(
        `SELECT id_titulo, DATE_FORMAT(vencimento, '%Y-%m-%d') AS venc, valor, valor_pago FROM financeiro_contas_receber
         WHERE tenant_id = ? AND id_venda = ? AND status = 'ABERTO' FOR UPDATE`,
        [tenant, idVenda]
      );
      if (titulos.length === 0) throw new ErroDevolucao('Esta venda não tem parcelas a prazo em aberto.', 409);
      const alteracoes = abaterParcelas(titulos.map((t: any) => ({ idTitulo: Number(t.id_titulo), vencimento: t.venc, valor: Number(t.valor), valorPago: Number(t.valor_pago) })), calculo.total);
      for (const a of alteracoes) {
        await connection.execute(`UPDATE financeiro_contas_receber SET valor = ?, status = ? WHERE id_titulo = ?`, [f4(a.novoValor), a.status, a.idTitulo]);
      }
    }

    const [cab]: any = await connection.execute(
      `INSERT INTO vendas_devolucoes (tenant_id, id_venda, id_cliente, reembolso, valor_total, id_caixa, motivo, operador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, idVenda, venda.id_cliente || null, reembolso, f4(calculo.total), idCaixa, motivo.slice(0, 255), operador]
    );
    const idDevolucao = Number(cab.insertId);

    if (idCaixa) {
      await connection.execute(
        `INSERT INTO vendas_caixas_movimentos (tenant_id, id_caixa, tipo, forma, valor, id_origem, motivo, operador)
         VALUES (?, ?, 'DEVOLUCAO_VENDA', ?, ?, ?, ?, ?)`,
        [tenant, idCaixa, reembolso, f4(calculo.total), idDevolucao, `Devolução ${idDevolucao} da venda ${idVenda}: ${motivo}`.slice(0, 255), operador]
      );
    }
    let idAdiantamento: number | null = null;
    if (reembolso === 'CREDITO_LOJA') {
      idAdiantamento = await registrarCreditoLoja(connection, tenant, {
        idCliente: venda.id_cliente ? Number(venda.id_cliente) : null, clienteNome: venda.cliente_nome, valor: calculo.total,
        origem: ORIGEM_CREDITO_DEVOLUCAO, idOrigem: idDevolucao, observacao: `Crédito da devolução ${idDevolucao} (venda ${idVenda})`, operador,
      });
      await connection.execute(`UPDATE vendas_devolucoes SET id_adiantamento = ? WHERE id_devolucao = ?`, [idAdiantamento, idDevolucao]);
    }

    // Itens e estoque (serviço não tem estoque; defeituoso não volta)
    for (const l of calculo.linhas) {
      const banco = linhasBanco.find(b => Number(b.id_venda_item) === l.idVendaItem);
      const servico = String(banco.tipo_recurso).toUpperCase() === 'SERVICO';
      const voltaEstoque = !servico && pedidos.find(p => Number(p.idVendaItem) === l.idVendaItem)?.voltaEstoque !== false;
      const custo = Number(banco.custo_unitario_base) || 0;
      const [insItem]: any = await connection.execute(
        `INSERT INTO vendas_devolucoes_itens (tenant_id, id_devolucao, id_venda_item, id_item, quantidade, quantidade_base, valor, custo_unitario_base, voltou_estoque)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenant, idDevolucao, l.idVendaItem, banco.id_item, f4(l.quantidade), f4(l.quantidadeBase), f4(l.valor), f4(custo), voltaEstoque ? 1 : 0]
      );
      if (!voltaEstoque) continue;
      // Referência do movimento: a linha da devolução (a mesma linha da venda pode ter várias devoluções)
      const idDevolucaoItem = Number(insItem.insertId);
      // Kit: voltam os componentes, na proporção do que saiu deles na venda
      const doKit = await saidasDoKitNaVenda(connection, tenant, idVenda, l.idVendaItem, Number(banco.id_item));
      const entradas = doKit
        ? voltaDaDevolucao(doKit, Number(banco.quantidade), l.quantidade).map(v => {
          const s = doKit.find(x => x.idItem === v.idItem)!;
          return { idItem: v.idItem, tipoRecurso: s.tipoRecurso, qtd: v.quantidade, qtdDocumento: v.quantidade, sigla: s.sigla, fator: 1, custo: v.custo };
        })
        : [{
          idItem: Number(banco.id_item), tipoRecurso: banco.tipo_recurso || 'PRODUTO', qtd: l.quantidadeBase, qtdDocumento: l.quantidade,
          sigla: banco.unidade_sigla, fator: Number(banco.fator_conversao), custo,
        }];
      for (const e of entradas) {
        const [[saldo]]: any = await connection.execute(
          `SELECT quantidade_atual, custo_medio FROM estoque_saldos_itens WHERE tenant_id = ? AND id_item = ? AND deposito = 'VENDA' FOR UPDATE`,
          [tenant, e.idItem]
        );
        const anterior = Number(saldo?.quantidade_atual) || 0;
        const medioAnterior = Number(saldo?.custo_medio) || 0;
        const posterior = anterior + e.qtd;
        const medio = e.custo > 0 ? calcularCustoMedio(anterior, medioAnterior, e.qtd, e.custo) : medioAnterior;
        await connection.execute(
          `INSERT INTO estoque_movimentos
             (tenant_id, id_item, deposito, tipo_movimento, origem, id_origem, id_origem_item, documento_origem, tipo_recurso,
              quantidade, quantidade_documento, unidade_documento, fator_conversao, custo_unitario, custo_total, saldo_anterior, saldo_posterior, observacao)
           VALUES (?, ?, 'VENDA', 'ENTRADA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tenant, e.idItem, ORIGEM_DEVOLUCAO, idDevolucao, idDevolucaoItem, `VENDA ${idVenda}`, e.tipoRecurso,
            f4(e.qtd), f4(e.qtdDocumento), e.sigla, Number(e.fator).toFixed(6),
            f4(e.custo), f4(e.custo * e.qtd), f4(anterior), f4(posterior), `Devolução ${idDevolucao}: ${motivo}`.slice(0, 255),
          ]
        );
        await connection.execute(
          `INSERT INTO estoque_saldos_itens (tenant_id, id_item, deposito, quantidade_atual, custo_medio) VALUES (?, ?, 'VENDA', ?, ?)
           ON DUPLICATE KEY UPDATE quantidade_atual = VALUES(quantidade_atual), custo_medio = VALUES(custo_medio)`,
          [tenant, e.idItem, f4(posterior), f4(medio)]
        );
      }
    }

    await connection.execute(`UPDATE vendas_pedidos SET total_devolvido = total_devolvido + ? WHERE id_venda = ?`, [f4(calculo.total), idVenda]);
    await connection.commit();
    return res.status(201).json({ success: true, idDevolucao, valor: calculo.total, idAdiantamento });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao registrar a devolução.');
  } finally {
    connection.release();
  }
};

/** GET /api/vendas/pdv/devolucoes/:id — usado pela troca (cliente e crédito gerado) */
export const detalheDevolucao = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const [[d]]: any = await pool.execute(
      `SELECT d.*, v.cliente_nome FROM vendas_devolucoes d INNER JOIN vendas_pedidos v ON v.id_venda = d.id_venda
       WHERE d.id_devolucao = ? AND d.tenant_id = ?`, [Number(req.params.id), tenant]
    );
    if (!d) throw new ErroDevolucao('Devolução não encontrada.', 404);
    return res.json({
      idDevolucao: Number(d.id_devolucao), idVenda: Number(d.id_venda), idCliente: d.id_cliente ? Number(d.id_cliente) : null,
      cliente: d.cliente_nome, reembolso: d.reembolso, valor: Number(d.valor_total), idAdiantamento: d.id_adiantamento ? Number(d.id_adiantamento) : null,
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar a devolução.');
  }
};
