// Registro, consulta e cancelamento de vendas do PDV no modelo novo.
// Venda -> vendas_pedidos (+itens, +pagamentos); saída de estoque -> estoque_movimentos + estoque_saldos_itens.
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { calcularCustoMedio } from '../../Compras/staging/penteFino';
import { carregarPrecos, SELECT_ITENS } from './pdv.controller';
import { calcularLinha, conferirEstoque, ErroVenda, fecharVenda, LinhaPedido, validarPagamentos } from './vendaPdv';
import { carregarCaixaAberto, operadorDe } from '../caixa/caixa.controller';
import { estornoDaVenda } from '../caixa/caixa';
import { cancelarTitulosDaVenda, gravarTitulosDaVenda, planejarPrazo, PrazoDaVenda } from '../../Financeiro/receber/receber.controller';
import { ErroReceber } from '../../Financeiro/receber/receber';
import { carregarRegras } from '../regras/regrasVenda.controller';
import { avaliarRegras, conferirSenha } from '../regras/regrasVenda';

const ORIGEM_VENDA = 'VENDA_PDV';
const ORIGEM_CANCELAMENTO = 'CANCELAMENTO_VENDA';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroVenda || error instanceof ErroReceber) return res.status(error.status).json({ error: error.message, detalhes: error.detalhes });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

/**
 * POST /api/vendas/pdv/vendas
 * { clienteNome?, idCliente?, observacao?, descontoGeral?,
 *   itens: [{ idItem, quantidade, idUnidade?, precoUnitario? }],
 *   pagamentos: [{ forma: DINHEIRO|PIX|DEBITO|CREDITO|PRAZO|TRANSFERENCIA, valor, parcelas?,
 *                  intervaloDias?, primeiroVencimento? (só PRAZO: gera as parcelas em contas a receber) }] }
 * O preço de tabela é recalculado aqui; precoUnitario é o preço praticado (desconto individual).
 * Desconto acima do limite / abaixo do custo: 403 AUTORIZACAO_NECESSARIA até vir
 *   autorizacao: { senha, nome, motivo } (vendas_configuracoes).
 */
export const registrarVenda = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const { itens, pagamentos, descontoGeral, clienteNome, idCliente, observacao } = req.body || {};
  if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ error: 'A venda não tem itens.' });

  const connection = await pool.getConnection();
  try {
    const pedidos: LinhaPedido[] = itens.map((i: any) => ({
      idItem: Number(i.idItem),
      quantidade: Number(i.quantidade),
      idUnidade: i.idUnidade ? Number(i.idUnidade) : null,
      precoUnitario: i.precoUnitario === undefined || i.precoUnitario === null ? null : Number(i.precoUnitario),
    }));
    if (pedidos.some(p => !Number.isInteger(p.idItem) || p.idItem <= 0)) throw new ErroVenda('Item inválido na venda.');
    const ids = [...new Set(pedidos.map(p => p.idItem))].sort((a, b) => a - b);

    await connection.beginTransaction();

    // Toda venda pertence ao caixa aberto (trava compartilhada: o fechamento espera as vendas em andamento)
    const caixa = await carregarCaixaAberto(connection as any, tenant, 'LOCK IN SHARE MODE');
    if (!caixa) throw new ErroVenda('Abra o caixa antes de vender.', 409, { codigo: 'CAIXA_FECHADO' });

    const [rows] = await connection.execute(
      `${SELECT_ITENS} WHERE ic.tenant_id = ? AND ic.id_item IN (${ids.map(() => '?').join(',')})`,
      [tenant, ...ids]
    );
    const itensBanco = new Map((rows as any[]).map(r => [Number(r.id_item), r]));
    const faltando = ids.filter(id => !itensBanco.has(id));
    if (faltando.length > 0) throw new ErroVenda(`Item não encontrado: ${faltando.join(', ')}.`, 404);
    for (const item of itensBanco.values()) {
      if (String(item.status).toUpperCase() !== 'ATIVO') throw new ErroVenda(`"${item.nome_comercial || item.nome_item}" está inativo.`);
      if (String(item.tipo_recurso).toUpperCase() !== 'PRODUTO') throw new ErroVenda(`"${item.nome_comercial || item.nome_item}" não é um produto de venda.`);
    }

    const precos = await carregarPrecos(connection as any, tenant, [...itensBanco.values()]);
    const linhas = pedidos.map(p => {
      const item = itensBanco.get(p.idItem);
      return calcularLinha(p, {
        unidades: precos.unidadesPorItem.get(p.idItem) || [],
        faixas: precos.faixasPorItem.get(p.idItem) || [],
        precoCadastro: item.preco_venda !== null ? Number(item.preco_venda) : null,
      });
    });
    const venda = fecharVenda(linhas, Number(descontoGeral) || 0);
    const pagamentosOk = validarPagamentos(pagamentos, venda.totalLiquido);

    // Trava os saldos (ordem fixa de ids para evitar deadlock)
    const [saldoRows] = await connection.execute(
      `SELECT id_item, quantidade_atual, custo_medio FROM estoque_saldos_itens
       WHERE tenant_id = ? AND deposito = 'VENDA' AND id_item IN (${ids.map(() => '?').join(',')}) ORDER BY id_item FOR UPDATE`,
      [tenant, ...ids]
    );
    const saldos = new Map<number, number>();
    const custos = new Map<number, number>();
    for (const s of saldoRows as any[]) {
      saldos.set(Number(s.id_item), Number(s.quantidade_atual) || 0);
      custos.set(Number(s.id_item), Number(s.custo_medio) || 0);
    }
    const podeSemEstoque = new Map(ids.map(id => [id, Boolean(Number(itensBanco.get(id).pode_vender_sem_estoque))]));
    const estoque = conferirEstoque(venda.linhas, saldos, podeSemEstoque);
    if (estoque.faltas.length > 0) {
      throw new ErroVenda(
        `Estoque insuficiente: ${estoque.faltas.map(f => {
          const item = itensBanco.get(f.idItem);
          return `${item.nome_comercial || item.nome_item} (saldo ${f.saldo} ${item.sigla_base || ''}, venda ${f.saida})`;
        }).join('; ')}.`,
        409,
        estoque.faltas
      );
    }

    // A prazo: exige cliente, respeita o crédito e planeja as parcelas (gravadas depois da venda)
    const prazos: PrazoDaVenda[] = (Array.isArray(pagamentos) ? pagamentos : [])
      .filter((p: any) => String(p?.forma || '').toUpperCase() === 'PRAZO')
      .map((p: any) => ({ valor: Number(p.valor), parcelas: p.parcelas, intervaloDias: p.intervaloDias, primeiroVencimento: p.primeiroVencimento }));
    const parcelasPrazo = await planejarPrazo(connection as any, tenant, idCliente ? Number(idCliente) : null, String(clienteNome || '').trim(), prazos);

    // Custo base: custo médio do estoque; sem ele, custo gerencial do cadastro
    const custoBase = (idItem: number) => {
      const medio = custos.get(idItem) || 0;
      return medio > 0 ? medio : Number(itensBanco.get(idItem).custo_gerencial) || 0;
    };
    const totalCusto = venda.linhas.reduce((a, l) => a + custoBase(l.idItem) * l.quantidadeBase, 0);

    // Regras de desconto e margem (servidor): acima do limite ou abaixo do custo exige autorização
    const regras = await carregarRegras(connection as any, tenant);
    const avaliacao = avaliarRegras(venda.totalBruto, venda.totalDesconto, venda.linhas.map(l => ({
      idItem: l.idItem,
      nome: itensBanco.get(l.idItem).nome_comercial || itensBanco.get(l.idItem).nome_item,
      totalItem: l.totalItem,
      custoTotal: custoBase(l.idItem) * l.quantidadeBase,
    })), regras);
    if (avaliacao.bloqueio) throw new ErroVenda(avaliacao.bloqueio, 409, { codigo: 'ABAIXO_DO_CUSTO' });
    let autorizadoPor: string | null = null;
    let motivoAutorizacao: string | null = null;
    if (avaliacao.exigeAutorizacao) {
      const aut = req.body?.autorizacao;
      const detalhes = { codigo: 'AUTORIZACAO_NECESSARIA', motivos: avaliacao.motivos, percentualDesconto: avaliacao.percentualDesconto, temSenha: Boolean(regras.senhaHash) };
      if (!regras.senhaHash) {
        throw new ErroVenda(`${avaliacao.motivos.join(' ')} Nenhuma senha de autorização definida: configure em Vendas › Regras de venda.`, 403, detalhes);
      }
      if (!aut) throw new ErroVenda(`Autorização necessária: ${avaliacao.motivos.join(' ')}`, 403, detalhes);
      if (!conferirSenha(String(aut.senha || ''), regras.senhaHash)) throw new ErroVenda('Senha de autorização incorreta.', 403, { ...detalhes, senhaIncorreta: true });
      autorizadoPor = String(aut.nome || '').trim().slice(0, 60);
      motivoAutorizacao = String(aut.motivo || '').trim().slice(0, 255);
      if (!autorizadoPor || !motivoAutorizacao) throw new ErroVenda('Informe quem autorizou e o motivo.', 403, detalhes);
    }

    const [cab] = await connection.execute(
      `INSERT INTO vendas_pedidos
         (tenant_id, origem, status, id_caixa, operador, autorizado_por, motivo_autorizacao, id_cliente, cliente_nome, total_bruto, total_desconto, total_liquido, total_custo, observacao)
       VALUES (?, 'PDV', 'CONCLUIDA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenant, caixa.id_caixa, operadorDe(req), autorizadoPor, motivoAutorizacao, idCliente ? Number(idCliente) : null, String(clienteNome || '').trim().slice(0, 150) || 'CONSUMIDOR',
        f4(venda.totalBruto), f4(venda.totalDesconto), f4(venda.totalLiquido), f4(totalCusto),
        String(observacao || '').trim().slice(0, 255) || null,
      ]
    );
    const idVenda = Number((cab as any).insertId);

    for (const l of venda.linhas) {
      const item = itensBanco.get(l.idItem);
      const custo = custoBase(l.idItem);
      const [ins] = await connection.execute(
        `INSERT INTO vendas_pedidos_itens
           (tenant_id, id_venda, id_item, sku_snapshot, nome_snapshot, id_unidade, unidade_sigla, fator_conversao,
            quantidade, quantidade_base, preco_tabela, preco_unitario, desconto_valor, total_item, custo_unitario_base, custo_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenant, idVenda, l.idItem, item.sku_customizado || item.sku_core, item.nome_comercial || item.nome_item,
          l.idUnidade, l.sigla, Number(l.fator).toFixed(6), f4(l.quantidade), f4(l.quantidadeBase),
          f4(l.precoTabela), f4(l.precoUnitarioFinal), f4(l.descontoValor), f4(l.totalItem),
          f4(custo), f4(custo * l.quantidadeBase),
        ]
      );
      const idVendaItem = Number((ins as any).insertId);

      const saldoAnterior = saldos.get(l.idItem) || 0;
      const saldoPosterior = saldoAnterior - l.quantidadeBase;
      saldos.set(l.idItem, saldoPosterior);

      await connection.execute(
        `INSERT INTO estoque_movimentos
           (tenant_id, id_item, deposito, tipo_movimento, origem, id_origem, id_origem_item, documento_origem, tipo_recurso,
            quantidade, quantidade_documento, unidade_documento, fator_conversao,
            custo_unitario, custo_total, saldo_anterior, saldo_posterior, observacao)
         VALUES (?, ?, 'VENDA', 'SAIDA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenant, l.idItem, ORIGEM_VENDA, idVenda, idVendaItem, `VENDA ${idVenda}`, item.tipo_recurso || 'PRODUTO',
          f4(l.quantidadeBase), f4(l.quantidade), l.sigla, Number(l.fator).toFixed(6),
          f4(custo), f4(custo * l.quantidadeBase), f4(saldoAnterior), f4(saldoPosterior),
          `Venda PDV ${idVenda}`,
        ]
      );
    }

    // Saldo final por item (custo médio não muda na saída)
    for (const id of estoque.saidaPorItem.keys()) {
      await connection.execute(
        `INSERT INTO estoque_saldos_itens (tenant_id, id_item, deposito, quantidade_atual, custo_medio)
         VALUES (?, ?, 'VENDA', ?, ?)
         ON DUPLICATE KEY UPDATE quantidade_atual = VALUES(quantidade_atual)`,
        [tenant, id, f4(saldos.get(id) || 0), f4(custos.get(id) || 0)]
      );
    }

    for (const p of pagamentosOk) {
      await connection.execute(
        `INSERT INTO vendas_pedidos_pagamentos (tenant_id, id_venda, forma, valor, parcelas, troco) VALUES (?, ?, ?, ?, ?, ?)`,
        [tenant, idVenda, p.forma, f4(p.valor), p.parcelas, f4(p.troco)]
      );
    }

    if (parcelasPrazo.length > 0) {
      await gravarTitulosDaVenda(connection as any, tenant, idVenda, Number(idCliente), parcelasPrazo, operadorDe(req));
    }

    await connection.commit();
    return res.status(201).json({
      success: true,
      idVenda,
      parcelas: parcelasPrazo,
      totalBruto: venda.totalBruto,
      totalDesconto: venda.totalDesconto,
      totalLiquido: venda.totalLiquido,
      troco: pagamentosOk.reduce((a, p) => a + p.troco, 0),
    });
  } catch (error: any) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao registrar a venda.');
  } finally {
    connection.release();
  }
};

/**
 * POST /api/vendas/pdv/vendas/:idVenda/cancelar { motivo }
 * Devolve o estoque (entrada com o custo registrado na venda) e marca a venda como CANCELADA.
 */
export const cancelarVenda = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idVenda = Number(req.params.idVenda);
  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return res.status(400).json({ error: 'Informe o motivo do cancelamento.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[venda]]: any = await connection.execute(
      `SELECT id_venda, status, id_caixa FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ? FOR UPDATE`,
      [idVenda, tenant]
    );
    if (!venda) throw new ErroVenda('Venda não encontrada.', 404);
    if (venda.status !== 'CONCLUIDA') throw new ErroVenda(`A venda já está ${String(venda.status).toLowerCase()}.`, 409);

    // A prazo: parcelas sem recebimento são canceladas (com recebimento, pede o estorno antes)
    await cancelarTitulosDaVenda(connection as any, tenant, idVenda);

    // Venda do caixa aberto: basta sair da soma. De outro caixa (já fechado): o dinheiro sai do caixa aberto.
    const caixaAberto = await carregarCaixaAberto(connection as any, tenant, 'LOCK IN SHARE MODE');
    const mesmoCaixa = caixaAberto && venda.id_caixa && Number(venda.id_caixa) === Number(caixaAberto.id_caixa);
    if (!mesmoCaixa) {
      const [pags]: any = await connection.execute(
        `SELECT forma, valor, troco FROM vendas_pedidos_pagamentos WHERE id_venda = ? AND tenant_id = ?`, [idVenda, tenant]
      );
      const estornos = estornoDaVenda(pags.map((p: any) => ({ forma: p.forma, valor: Number(p.valor), troco: Number(p.troco) })));
      if (estornos.length > 0 && !caixaAberto) {
        throw new ErroVenda('Esta venda é de um caixa já fechado: abra o caixa para devolver o valor ao cliente.', 409, { codigo: 'CAIXA_FECHADO' });
      }
      for (const e of estornos) {
        await connection.execute(
          `INSERT INTO vendas_caixas_movimentos (tenant_id, id_caixa, tipo, forma, valor, id_origem, motivo, operador)
           VALUES (?, ?, 'ESTORNO_VENDA', ?, ?, ?, ?, ?)`,
          [tenant, caixaAberto.id_caixa, e.forma, f4(e.valor), idVenda, `Cancelamento da venda ${idVenda}: ${motivo}`.slice(0, 255), operadorDe(req)]
        );
      }
    }

    const [itens]: any = await connection.execute(
      `SELECT vi.id_venda_item, vi.id_item, vi.quantidade, vi.quantidade_base, vi.unidade_sigla, vi.fator_conversao,
              vi.custo_unitario_base, ic.tipo_recurso
       FROM vendas_pedidos_itens vi
       INNER JOIN itens_core ic ON ic.id_item = vi.id_item
       WHERE vi.id_venda = ? AND vi.tenant_id = ? ORDER BY vi.id_item`,
      [idVenda, tenant]
    );

    for (const it of itens) {
      const qtd = Number(it.quantidade_base);
      const custo = Number(it.custo_unitario_base) || 0;
      const [[saldo]]: any = await connection.execute(
        `SELECT quantidade_atual, custo_medio FROM estoque_saldos_itens WHERE tenant_id = ? AND id_item = ? AND deposito = 'VENDA' FOR UPDATE`,
        [tenant, it.id_item]
      );
      const saldoAnterior = Number(saldo?.quantidade_atual) || 0;
      const custoMedioAnterior = Number(saldo?.custo_medio) || 0;
      const saldoPosterior = saldoAnterior + qtd;
      const custoMedio = custo > 0 ? calcularCustoMedio(saldoAnterior, custoMedioAnterior, qtd, custo) : custoMedioAnterior;

      await connection.execute(
        `INSERT INTO estoque_movimentos
           (tenant_id, id_item, deposito, tipo_movimento, origem, id_origem, id_origem_item, documento_origem, tipo_recurso,
            quantidade, quantidade_documento, unidade_documento, fator_conversao,
            custo_unitario, custo_total, saldo_anterior, saldo_posterior, observacao)
         VALUES (?, ?, 'VENDA', 'ENTRADA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenant, it.id_item, ORIGEM_CANCELAMENTO, idVenda, it.id_venda_item, `VENDA ${idVenda}`, it.tipo_recurso || 'PRODUTO',
          f4(qtd), f4(Number(it.quantidade)), it.unidade_sigla, Number(it.fator_conversao).toFixed(6),
          f4(custo), f4(custo * qtd), f4(saldoAnterior), f4(saldoPosterior),
          `Cancelamento da venda ${idVenda}: ${motivo}`.slice(0, 255),
        ]
      );
      await connection.execute(
        `INSERT INTO estoque_saldos_itens (tenant_id, id_item, deposito, quantidade_atual, custo_medio)
         VALUES (?, ?, 'VENDA', ?, ?)
         ON DUPLICATE KEY UPDATE quantidade_atual = VALUES(quantidade_atual), custo_medio = VALUES(custo_medio)`,
        [tenant, it.id_item, f4(saldoPosterior), f4(custoMedio)]
      );
    }

    await connection.execute(
      `UPDATE vendas_pedidos SET status = 'CANCELADA', cancelado_em = NOW(), motivo_cancelamento = ? WHERE id_venda = ? AND tenant_id = ?`,
      [motivo.slice(0, 255), idVenda, tenant]
    );
    await connection.commit();
    return res.json({ success: true });
  } catch (error: any) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao cancelar a venda.');
  } finally {
    connection.release();
  }
};

// GET /api/vendas/pdv/vendas?data=AAAA-MM-DD (padrão: hoje)
export const listarVendas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.data || '')) ? String(req.query.data) : null;
    const [rows] = await pool.execute(
      `SELECT v.id_venda, v.status, v.cliente_nome, v.operador, v.id_caixa, v.total_bruto, v.total_desconto, v.total_liquido, v.total_custo,
              v.created_at, v.cancelado_em, v.motivo_cancelamento,
              (SELECT COUNT(*) FROM vendas_pedidos_itens i WHERE i.id_venda = v.id_venda) AS qtd_itens,
              (SELECT GROUP_CONCAT(DISTINCT p.forma) FROM vendas_pedidos_pagamentos p WHERE p.id_venda = v.id_venda) AS formas
       FROM vendas_pedidos v
       WHERE v.tenant_id = ? AND DATE(v.created_at) = COALESCE(?, CURDATE())
       ORDER BY v.id_venda DESC`,
      [tenant, data]
    );
    return res.json((rows as any[]).map(r => ({
      idVenda: Number(r.id_venda),
      status: r.status,
      clienteNome: r.cliente_nome,
      operador: r.operador,
      idCaixa: r.id_caixa ? Number(r.id_caixa) : null,
      totalBruto: Number(r.total_bruto),
      totalDesconto: Number(r.total_desconto),
      totalLiquido: Number(r.total_liquido),
      totalCusto: Number(r.total_custo),
      qtdItens: Number(r.qtd_itens),
      formas: r.formas ? String(r.formas).split(',') : [],
      criadoEm: r.created_at,
      canceladoEm: r.cancelado_em,
      motivoCancelamento: r.motivo_cancelamento,
    })));
  } catch (error: any) {
    return responderErro(res, error, 'Erro ao listar vendas.');
  }
};

// GET /api/vendas/pdv/vendas/:idVenda
export const detalheVenda = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const idVenda = Number(req.params.idVenda);
    const [[venda]]: any = await pool.execute(`SELECT * FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ?`, [idVenda, tenant]);
    if (!venda) return res.status(404).json({ error: 'Venda não encontrada.' });
    const [itens] = await pool.execute(`SELECT * FROM vendas_pedidos_itens WHERE id_venda = ? AND tenant_id = ? ORDER BY id_venda_item`, [idVenda, tenant]);
    const [pagamentos] = await pool.execute(`SELECT * FROM vendas_pedidos_pagamentos WHERE id_venda = ? AND tenant_id = ? ORDER BY id_pagamento`, [idVenda, tenant]);
    return res.json({ ...venda, itens, pagamentos });
  } catch (error: any) {
    return responderErro(res, error, 'Erro ao carregar a venda.');
  }
};
