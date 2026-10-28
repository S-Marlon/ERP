// Venda completa (itens, pagamentos, parcelas, devoluções, ajustes e nota) e ajuste de venda a prazo já concluída:
// quantidade e preço das linhas, linha tirada (fica com quantidade 0) e item incluído. O estoque acompanha (sai o que
// aumentou, volta o que diminuiu) e a diferença vai para as parcelas abertas. Histórico em vendas_pedidos_ajustes(_itens).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { calcularCustoMedio } from '../../compras/staging/penteFino';
import { operadorDe } from '../caixa/caixa.controller';
import { calcularItensDoPedido } from '../pdv/vendas.controller';
import { ErroVenda } from '../pdv/vendaPdv';
import { saidasDoKitNaVenda } from '../../catalogo/kits/kitsBanco';
import { carregarCredito, saldoDevedor } from '../../financeiro/receber/receber.controller';
import { ErroReceber, validarCredito } from '../../financeiro/receber/receber';
import { Destino, DESTINOS, distribuirDiferenca, ErroAjuste, LinhaAtual, LinhaNova, planejarAjuste, totaisDaVenda } from './ajustesVenda';

const ORIGEM_AJUSTE = 'AJUSTE_VENDA';
const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);
const n = (v: unknown) => Number(v) || 0;

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroAjuste || error instanceof ErroVenda || error instanceof ErroReceber) return res.status(error.status).json({ error: error.message });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

/** Linhas da venda com o já devolvido e se é kit. */
const carregarLinhas = async (conn: any, tenant: number, idVenda: number, trava = false) => {
  const [rows]: any = await conn.execute(
    `SELECT vi.*, ic.tipo_recurso, COALESCE(cpd.pode_vender_sem_estoque, 0) AS pode_sem_estoque,
            COALESCE((SELECT SUM(di.quantidade) FROM vendas_devolucoes_itens di WHERE di.id_venda_item = vi.id_venda_item), 0) AS devolvido
     FROM vendas_pedidos_itens vi
     INNER JOIN itens_core ic ON ic.id_item = vi.id_item
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = vi.id_item AND cpd.tenant_id = vi.tenant_id
     WHERE vi.id_venda = ? AND vi.tenant_id = ? ORDER BY vi.id_venda_item ${trava ? 'FOR UPDATE' : ''}`, [idVenda, tenant]);
  const linhas = [];
  for (const r of rows) {
    const kit = await saidasDoKitNaVenda(conn, tenant, idVenda, Number(r.id_venda_item), Number(r.id_item));
    linhas.push({ ...r, kit: !!kit });
  }
  return linhas as any[];
};

/** Por que a venda não pode ser ajustada (null = pode). */
const travaDoAjuste = (venda: any, temPrazo: boolean, nota: any) => {
  if (venda.status !== 'CONCLUIDA') return `A venda está ${String(venda.status).toLowerCase()}.`;
  if (!temPrazo) return 'Por enquanto só venda a prazo pode ser ajustada (a diferença vai para as parcelas).';
  if (nota?.status === 'AUTORIZADA') return 'A venda tem nota fiscal autorizada: cancele a nota em Vendas › Notas fiscais antes de ajustar.';
  if (nota?.status === 'PROCESSANDO') return 'A nota fiscal desta venda está sendo emitida: aguarde e tente de novo.';
  return null;
};
const notaDaVenda = async (conn: any, idVenda: number) => {
  const [[nota]]: any = await conn.execute(
    `SELECT status, numero, serie, modelo FROM fiscal_documentos WHERE id_venda = ? ORDER BY FIELD(status, 'AUTORIZADA', 'PROCESSANDO') DESC, id_documento DESC LIMIT 1`, [idVenda]);
  return nota || null;
};

// GET /api/vendas/pdv/vendas/:idVenda/completa
export const vendaCompleta = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const idVenda = Number(req.params.idVenda);
    const [[v]]: any = await pool.execute(
      `SELECT v.*, DATE_FORMAT(v.created_at, '%Y-%m-%d %H:%i') AS criada_txt, DATE_FORMAT(v.cancelado_em, '%Y-%m-%d %H:%i') AS cancelada_txt
       FROM vendas_pedidos v WHERE v.id_venda = ? AND v.tenant_id = ?`, [idVenda, tenant]);
    if (!v) throw new ErroAjuste('Venda não encontrada.', 404);
    const linhas = await carregarLinhas(pool, tenant, idVenda);
    const [pagamentos]: any = await pool.execute(`SELECT forma, valor, parcelas, troco FROM vendas_pedidos_pagamentos WHERE id_venda = ? AND tenant_id = ? ORDER BY id_pagamento`, [idVenda, tenant]);
    const [titulos]: any = await pool.execute(
      `SELECT id_titulo, parcela, total_parcelas, descricao, DATE_FORMAT(vencimento, '%Y-%m-%d') AS venc, valor, valor_pago, status
       FROM financeiro_contas_receber WHERE id_venda = ? AND tenant_id = ? ORDER BY vencimento IS NULL, vencimento, parcela`, [idVenda, tenant]);
    const [devolucoes]: any = await pool.execute(
      `SELECT id_devolucao, reembolso, valor_total, motivo, operador, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS em FROM vendas_devolucoes WHERE id_venda = ? AND tenant_id = ? ORDER BY id_devolucao`, [idVenda, tenant]);
    const [ajustes]: any = await pool.execute(
      `SELECT id_ajuste, total_antes, total_depois, diferenca, destino_parcelas, motivo, operador, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS em
       FROM vendas_pedidos_ajustes WHERE id_venda = ? AND tenant_id = ? ORDER BY id_ajuste`, [idVenda, tenant]);
    const [ajItens]: any = ajustes.length ? await pool.query(
      `SELECT ai.*, vi.nome_snapshot, vi.unidade_sigla FROM vendas_pedidos_ajustes_itens ai JOIN vendas_pedidos_itens vi ON vi.id_venda_item = ai.id_venda_item
       WHERE ai.id_ajuste IN (?) ORDER BY ai.id_ajuste_item`, [ajustes.map((a: any) => a.id_ajuste)]) : [[]];
    const nota = await notaDaVenda(pool, idVenda);
    const temPrazo = pagamentos.some((p: any) => p.forma === 'PRAZO');
    return res.json({
      idVenda, status: v.status, cliente: v.cliente_nome, idCliente: v.id_cliente ? Number(v.id_cliente) : null, operador: v.operador, criadaEm: v.criada_txt,
      canceladaEm: v.cancelada_txt || null, motivoCancelamento: v.motivo_cancelamento || null, observacao: v.observacao || null,
      totalBruto: n(v.total_bruto), totalDesconto: n(v.total_desconto), totalFrete: n(v.total_frete), totalLiquido: n(v.total_liquido),
      totalDevolvido: n(v.total_devolvido), totalCusto: n(v.total_custo),
      itens: linhas.map(l => ({
        idVendaItem: Number(l.id_venda_item), idItem: Number(l.id_item), sku: l.sku_snapshot, nome: l.nome_snapshot, unidade: l.unidade_sigla, fator: n(l.fator_conversao),
        quantidade: n(l.quantidade), precoTabela: n(l.preco_tabela), precoUnitario: n(l.preco_unitario), desconto: n(l.desconto_valor), total: n(l.total_item),
        devolvido: n(l.devolvido), kit: l.kit, servico: String(l.tipo_recurso).toUpperCase() === 'SERVICO',
      })),
      pagamentos: pagamentos.map((p: any) => ({ forma: p.forma, valor: n(p.valor), parcelas: Number(p.parcelas) || 1, troco: n(p.troco) })),
      parcelas: titulos.map((t: any) => ({ idTitulo: Number(t.id_titulo), parcela: Number(t.parcela), totalParcelas: Number(t.total_parcelas), descricao: t.descricao,
        vencimento: t.venc || null, valor: n(t.valor), valorPago: n(t.valor_pago), status: t.status })),
      devolucoes: devolucoes.map((d: any) => ({ idDevolucao: Number(d.id_devolucao), reembolso: d.reembolso, valor: n(d.valor_total), motivo: d.motivo, operador: d.operador, em: d.em })),
      ajustes: ajustes.map((a: any) => ({
        idAjuste: Number(a.id_ajuste), totalAntes: n(a.total_antes), totalDepois: n(a.total_depois), diferenca: n(a.diferenca), destino: a.destino_parcelas,
        motivo: a.motivo, operador: a.operador, em: a.em,
        itens: ajItens.filter((x: any) => Number(x.id_ajuste) === Number(a.id_ajuste)).map((x: any) => ({
          nome: x.nome_snapshot, unidade: x.unidade_sigla, tipo: x.tipo, quantidadeAntes: n(x.quantidade_antes), quantidadeDepois: n(x.quantidade_depois),
          precoAntes: n(x.preco_antes), precoDepois: n(x.preco_depois), totalAntes: n(x.total_antes), totalDepois: n(x.total_depois),
        })),
      })),
      nota: nota ? { status: nota.status, numero: nota.numero ? Number(nota.numero) : null, serie: nota.serie ?? null, modelo: nota.modelo ?? null } : null,
      travaAjuste: travaDoAjuste(v, temPrazo, nota),
    });
  } catch (e) { return responderErro(res, e, 'Erro ao abrir a venda.'); }
};

/**
 * Movimento de estoque de uma linha (saída do que aumentou, entrada do que diminuiu) e o saldo do item. Origem: o ajuste
 * (id_origem) e a linha do histórico (id_origem_item), única por movimento.
 */
const moverEstoque = async (conn: any, tenant: number, idVenda: number, idAjuste: number, idAjusteItem: number, l: { idItem: number; tipo: string; deltaBase: number; quantidadeDoc: number; sigla: string | null; fator: number; custo: number; podeSem: boolean; nome: string }, motivo: string) => {
  if (!l.deltaBase || l.tipo === 'SERVICO') return;
  const [[saldo]]: any = await conn.execute(
    `SELECT quantidade_atual, custo_medio FROM estoque_saldos_itens WHERE tenant_id = ? AND id_item = ? AND deposito = 'VENDA' FOR UPDATE`, [tenant, l.idItem]);
  const antes = n(saldo?.quantidade_atual), medio = n(saldo?.custo_medio);
  const saida = l.deltaBase > 0, qtd = Math.abs(l.deltaBase);
  if (saida && qtd > antes + 1e-9 && !l.podeSem) throw new ErroAjuste(`Estoque insuficiente de "${l.nome}" (saldo ${antes}, o ajuste tira ${qtd}).`, 409);
  const depois = saida ? antes - qtd : antes + qtd;
  const novoMedio = !saida && l.custo > 0 ? calcularCustoMedio(antes, medio, qtd, l.custo) : medio;
  await conn.execute(
    `INSERT INTO estoque_movimentos
       (tenant_id, id_item, deposito, tipo_movimento, origem, id_origem, id_origem_item, documento_origem, tipo_recurso,
        quantidade, quantidade_documento, unidade_documento, fator_conversao, custo_unitario, custo_total, saldo_anterior, saldo_posterior, observacao)
     VALUES (?, ?, 'VENDA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenant, l.idItem, saida ? 'SAIDA' : 'ENTRADA', ORIGEM_AJUSTE, idAjuste, idAjusteItem, `VENDA ${idVenda}`, l.tipo, f4(qtd), f4(l.quantidadeDoc), l.sigla,
      Number(l.fator).toFixed(6), f4(l.custo), f4(l.custo * qtd), f4(antes), f4(depois), `Ajuste da venda ${idVenda}: ${motivo}`.slice(0, 255)]);
  await conn.execute(
    `INSERT INTO estoque_saldos_itens (tenant_id, id_item, deposito, quantidade_atual, custo_medio) VALUES (?, ?, 'VENDA', ?, ?)
     ON DUPLICATE KEY UPDATE quantidade_atual = VALUES(quantidade_atual), custo_medio = VALUES(custo_medio)`,
    [tenant, l.idItem, f4(depois), f4(novoMedio)]);
};

/**
 * POST /api/vendas/pdv/vendas/:idVenda/ajustes
 * { linhas: [{ idVendaItem, quantidade, precoUnitario }], novos: [{ idItem, idUnidade?, quantidade, precoUnitario? }],
 *   destino: ESPALHAR|ULTIMA|NOVA, vencimentoNova?, motivo }
 */
export const ajustarVenda = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idVenda = Number(req.params.idVenda);
  const motivo = String(req.body?.motivo || '').trim().slice(0, 255);
  const destino = String(req.body?.destino || 'ESPALHAR').toUpperCase() as Destino;
  const conn: any = await pool.getConnection();
  try {
    if (!motivo) throw new ErroAjuste('Informe o motivo do ajuste.');
    if (!DESTINOS.includes(destino)) throw new ErroAjuste('Destino da diferença inválido.');
    await conn.beginTransaction();
    const [[venda]]: any = await conn.execute(`SELECT * FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ? FOR UPDATE`, [idVenda, tenant]);
    if (!venda) throw new ErroAjuste('Venda não encontrada.', 404);
    const [pagamentos]: any = await conn.execute(`SELECT id_pagamento, forma, valor FROM vendas_pedidos_pagamentos WHERE id_venda = ? AND tenant_id = ? ORDER BY id_pagamento FOR UPDATE`, [idVenda, tenant]);
    const prazo = pagamentos.filter((p: any) => p.forma === 'PRAZO').pop();
    const trava = travaDoAjuste(venda, !!prazo, await notaDaVenda(conn, idVenda));
    if (trava) throw new ErroAjuste(trava, 409);

    const linhas = await carregarLinhas(conn, tenant, idVenda, true);
    const atuais: LinhaAtual[] = linhas.map(l => ({
      idVendaItem: Number(l.id_venda_item), idItem: Number(l.id_item), nome: l.nome_snapshot, quantidade: n(l.quantidade), fator: n(l.fator_conversao) || 1,
      precoTabela: n(l.preco_tabela), precoUnitario: n(l.preco_unitario), totalItem: n(l.total_item), devolvido: n(l.devolvido), kit: l.kit,
    }));
    // itens novos: preço de tabela pela faixa da unidade (como no PDV); o preço informado é o praticado
    const pedidosNovos = Array.isArray(req.body?.novos) ? req.body.novos : [];
    let novas: LinhaNova[] = [];
    let bancoNovos = new Map<number, any>();
    if (pedidosNovos.length) {
      const calc = await calcularItensDoPedido(conn, tenant, pedidosNovos.map((x: any) => ({ idItem: x.idItem, idUnidade: x.idUnidade, quantidade: x.quantidade, precoUnitario: x.precoUnitario })));
      bancoNovos = calc.itensBanco;
      novas = calc.linhas.map(l => {
        if (l.kit) throw new ErroAjuste(`"${calc.itensBanco.get(l.idItem).nome_comercial || calc.itensBanco.get(l.idItem).nome_item}" é um kit: venda o kit pelo PDV.`);
        const it = calc.itensBanco.get(l.idItem);
        return { idItem: l.idItem, nome: it.nome_comercial || it.nome_item, quantidade: l.quantidade, fator: l.fator, precoTabela: l.precoTabela, precoUnitario: l.precoPraticado, idUnidade: l.idUnidade, sigla: l.sigla };
      });
    }
    const plano = planejarAjuste(atuais, Array.isArray(req.body?.linhas) ? req.body.linhas : [], novas);

    // acréscimo a prazo respeita o crédito do cliente
    if (plano.diferenca > 0 && venda.id_cliente) {
      const devedor = await saldoDevedor(conn, tenant, Number(venda.id_cliente));
      validarCredito(await carregarCredito(conn, tenant, Number(venda.id_cliente)), devedor.aberto, plano.diferenca, venda.cliente_nome || 'O cliente');
    }
    const [titulos]: any = await conn.execute(
      `SELECT id_titulo, id_cliente, parcela, total_parcelas, DATE_FORMAT(vencimento, '%Y-%m-%d') AS venc, valor, valor_pago, status
       FROM financeiro_contas_receber WHERE id_venda = ? AND tenant_id = ? FOR UPDATE`, [idVenda, tenant]);
    const dist = distribuirDiferenca(titulos.map((t: any) => ({ idTitulo: Number(t.id_titulo), parcela: Number(t.parcela), vencimento: t.venc || null, valor: n(t.valor), valorPago: n(t.valor_pago), status: t.status })),
      plano.diferenca, destino, req.body?.vencimentoNova ? String(req.body.vencimentoNova).slice(0, 10) : null);

    // histórico (o total depois é acertado no fim), linhas e estoque
    const operador = operadorDe(req);
    const totalAntes = n(venda.total_liquido);
    const [aj]: any = await conn.execute(
      `INSERT INTO vendas_pedidos_ajustes (tenant_id, id_venda, total_antes, total_depois, diferenca, destino_parcelas, motivo, operador) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, idVenda, f4(totalAntes), f4(totalAntes + plano.diferenca), f4(plano.diferenca), destino, motivo, operador]);
    const idAjuste = Number(aj.insertId);
    const historico = async (idVendaItem: number, m: typeof plano.mudancas[number]) => {
      const [ins]: any = await conn.execute(
        `INSERT INTO vendas_pedidos_ajustes_itens (tenant_id, id_ajuste, id_venda_item, id_item, tipo, quantidade_antes, quantidade_depois, preco_antes, preco_depois, total_antes, total_depois)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenant, idAjuste, idVendaItem, m.idItem, m.tipo, f4(m.quantidadeAntes), f4(m.quantidadeDepois), f4(m.precoAntes), f4(m.precoDepois), f4(m.totalAntes), f4(m.totalDepois)]);
      return Number(ins.insertId);
    };
    for (const m of plano.mudancas) {
      if (m.nova) {
        const it = bancoNovos.get(m.idItem);
        const medio = n(it.custo_medio);
        const custo = medio > 0 ? medio : n(it.custo_gerencial);
        const qBase = m.nova.quantidade * m.nova.fator;
        const [ins]: any = await conn.execute(
          `INSERT INTO vendas_pedidos_itens (tenant_id, id_venda, id_item, sku_snapshot, nome_snapshot, id_unidade, unidade_sigla, fator_conversao,
             quantidade, quantidade_base, preco_tabela, preco_unitario, desconto_valor, total_item, custo_unitario_base, custo_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenant, idVenda, m.idItem, it.sku_customizado || it.sku_core, m.nova.nome, m.nova.idUnidade, m.nova.sigla, Number(m.nova.fator).toFixed(6),
            f4(m.nova.quantidade), f4(qBase), f4(m.nova.precoTabela), f4(m.precoDepois), f4(m.descontoValor), f4(m.totalDepois), f4(custo), f4(custo * qBase)]);
        const idVendaItem = Number(ins.insertId);
        await moverEstoque(conn, tenant, idVenda, idAjuste, await historico(idVendaItem, m), { idItem: m.idItem, tipo: String(it.tipo_recurso).toUpperCase(), deltaBase: m.deltaBase, quantidadeDoc: m.nova.quantidade,
          sigla: m.nova.sigla, fator: m.nova.fator, custo, podeSem: !!Number(it.pode_vender_sem_estoque), nome: m.nova.nome }, motivo);
        continue;
      }
      const l = linhas.find(x => Number(x.id_venda_item) === m.idVendaItem);
      const fator = n(l.fator_conversao) || 1;
      const custo = n(l.custo_unitario_base);
      await conn.execute(
        `UPDATE vendas_pedidos_itens SET quantidade = ?, quantidade_base = ?, preco_unitario = ?, desconto_valor = ?, total_item = ?, custo_total = ? WHERE id_venda_item = ?`,
        [f4(m.quantidadeDepois), f4(m.quantidadeDepois * fator), f4(m.precoDepois), f4(m.descontoValor), f4(m.totalDepois), f4(custo * m.quantidadeDepois * fator), m.idVendaItem]);
      await moverEstoque(conn, tenant, idVenda, idAjuste, await historico(m.idVendaItem as number, m), { idItem: m.idItem, tipo: String(l.tipo_recurso).toUpperCase(), deltaBase: m.deltaBase,
        quantidadeDoc: Math.abs(m.quantidadeDepois - m.quantidadeAntes), sigla: l.unidade_sigla, fator, custo, podeSem: !!Number(l.pode_sem_estoque), nome: l.nome_snapshot }, motivo);
    }

    // totais da venda (pelas linhas) e o pagamento a prazo
    const [depois]: any = await conn.execute(`SELECT quantidade, preco_tabela, preco_unitario, total_item, custo_total FROM vendas_pedidos_itens WHERE id_venda = ?`, [idVenda]);
    const tot = totaisDaVenda(depois.map((x: any) => ({ quantidade: n(x.quantidade), precoTabela: n(x.preco_tabela), precoUnitario: n(x.preco_unitario), totalItem: n(x.total_item) })), n(venda.total_frete));
    const custoTotal = depois.reduce((s: number, x: any) => s + n(x.custo_total), 0);
    await conn.execute(`UPDATE vendas_pedidos SET total_bruto = ?, total_desconto = ?, total_liquido = ?, total_custo = ? WHERE id_venda = ?`,
      [f4(tot.totalBruto), f4(tot.totalDesconto), f4(tot.totalLiquido), f4(custoTotal), idVenda]);
    await conn.execute(`UPDATE vendas_pedidos_ajustes SET total_depois = ? WHERE id_ajuste = ?`, [f4(tot.totalLiquido), idAjuste]);
    await conn.execute(`UPDATE vendas_pedidos_pagamentos SET valor = GREATEST(0, valor + ?) WHERE id_pagamento = ?`, [f4(plano.diferenca), prazo.id_pagamento]);

    // parcelas
    for (const a of dist.alteracoes) {
      await conn.execute(`UPDATE financeiro_contas_receber SET valor = ?, status = ?, operador = ? WHERE id_titulo = ?`, [f4(a.novoValor), a.status, operador, a.idTitulo]);
    }
    if (dist.nova) {
      const total = titulos.length + 1;
      const idCliente = titulos[0]?.id_cliente ?? venda.id_cliente;
      if (!idCliente) throw new ErroAjuste('Venda sem cliente: não dá para criar a parcela nova.');
      await conn.execute(
        `INSERT INTO financeiro_contas_receber (tenant_id, id_cliente, id_venda, parcela, total_parcelas, descricao, vencimento, valor, operador) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenant, idCliente, idVenda, total, total, dist.nova.vencimento ? `Venda ${idVenda} - parcela ${total}/${total} (ajuste)` : `Venda ${idVenda} - ajuste, sem prazo`,
          dist.nova.vencimento, f4(dist.nova.valor), operador]);
      await conn.execute(`UPDATE financeiro_contas_receber SET total_parcelas = ? WHERE id_venda = ? AND tenant_id = ?`, [total, idVenda, tenant]);
    }

    await conn.commit();
    return res.status(201).json({ idAjuste, totalAntes, totalDepois: tot.totalLiquido, diferenca: plano.diferenca, parcelaNova: !!dist.nova });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao ajustar a venda.');
  } finally { conn.release(); }
};
