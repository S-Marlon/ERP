// Pedidos faturados (Vendas › Pedidos faturados): orçamento vira pedido (reserva o material), fatura com a NF-e emitida
// fora (número/chave em fiscal_documentos, emissor EXTERNO) e as parcelas no contas a receber (boleto do banco), entrega de
// uma vez (baixa do estoque). Não passa pelo caixa: o dinheiro entra na baixa de cada parcela. Regras em pedidosFaturados.ts.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../caixa/caixa.controller';
import { lancarMovimentoEstoque } from '../../estoque/depositos';
import { cancelarTitulosDaVenda } from '../../financeiro/receber/receber.controller';
import { ErroReceber } from '../../financeiro/receber/receber';
import { condicaoDaLinha } from '../negociacao/condicaoPagamento';
import {
  ErroPedido, etapaDoPedido, faltasNaEntrega, lerLinhaDigitavel, parcelasSugeridas, saidasDaEntrega, statusDoPedido,
  validarNotaExterna, validarParcelas, FORMAS_PARCELA,
} from './pedidosFaturados';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);
const n = (v: unknown) => Number(v) || 0;
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dataOuNull = (s: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : null);
const texto = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max) || null;

const ORIGEM_ENTREGA = 'PEDIDO_ENTREGA';

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroPedido || error instanceof ErroReceber) return res.status(error.status).json({ error: error.message, detalhes: (error as any).detalhes });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

// ------------------------------------------------------------------ reserva

/**
 * Material reservado por pedidos confirmados e ainda não entregues, por item (kit: cada componente).
 * `exceto` tira um pedido da conta (a entrega dele não concorre com a própria reserva).
 */
export const reservasPorItem = async (conn: any, tenant: number, exceto: number | null = null) => {
  const [rows]: any = await conn.execute(
    `SELECT x.id_item, SUM(x.qtd) AS qtd FROM (
       SELECT i.id_item, i.quantidade_base AS qtd
       FROM vendas_pedidos_itens i INNER JOIN vendas_pedidos p ON p.id_venda = i.id_venda
       WHERE p.tenant_id = ? AND p.status IN ('PEDIDO', 'FATURADO') AND p.entregue_em IS NULL AND p.id_venda <> ?
         AND NOT EXISTS (SELECT 1 FROM vendas_pedidos_itens_componentes c WHERE c.id_venda_item = i.id_venda_item)
       UNION ALL
       SELECT c.id_item, c.quantidade * i.quantidade_base
       FROM vendas_pedidos_itens_componentes c
       INNER JOIN vendas_pedidos_itens i ON i.id_venda_item = c.id_venda_item
       INNER JOIN vendas_pedidos p ON p.id_venda = i.id_venda
       WHERE p.tenant_id = ? AND p.status IN ('PEDIDO', 'FATURADO') AND p.entregue_em IS NULL AND p.id_venda <> ?
     ) x GROUP BY x.id_item`,
    [tenant, exceto ?? 0, tenant, exceto ?? 0]
  );
  return new Map<number, number>(rows.map((r: any) => [Number(r.id_item), Number(r.qtd) || 0]));
};

// ------------------------------------------------------------------ leitura

const carregarPedido = async (conn: any, tenant: number, id: number, trava = false) => {
  const [[p]]: any = await conn.execute(
    `SELECT p.*, DATE_FORMAT(p.previsao_entrega, '%Y-%m-%d') AS previsao_txt, DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS criado_txt,
            DATE_FORMAT(p.faturado_em, '%Y-%m-%d %H:%i') AS faturado_txt, DATE_FORMAT(p.entregue_em, '%Y-%m-%d %H:%i') AS entregue_txt,
            DATE_FORMAT(p.cancelado_em, '%Y-%m-%d %H:%i') AS cancelado_txt
     FROM vendas_pedidos p WHERE p.id_venda = ? AND p.tenant_id = ? AND p.origem = 'ERP' ${trava ? 'FOR UPDATE' : ''}`,
    [id, tenant]
  );
  if (!p) throw new ErroPedido('Pedido faturado não encontrado.', 404);
  return p;
};

const itensDoPedido = async (conn: any, tenant: number, id: number) => {
  const [itens]: any = await conn.execute(
    `SELECT i.id_venda_item, i.id_item, i.sku_snapshot, i.nome_snapshot, i.unidade_sigla, i.fator_conversao, i.quantidade, i.quantidade_base,
            i.preco_unitario, i.total_item, UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) AS tipo_recurso, ub.sigla AS sigla_base,
            COALESCE(cpd.pode_vender_sem_estoque, 0) AS pode_sem_estoque
     FROM vendas_pedidos_itens i
     LEFT JOIN itens_core ic ON ic.id_item = i.id_item
     LEFT JOIN itens_unidades_medida ub ON ub.id_unidade = ic.id_unidade
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = i.id_item AND cpd.tenant_id = i.tenant_id
     WHERE i.id_venda = ? AND i.tenant_id = ? ORDER BY i.id_venda_item`,
    [id, tenant]
  );
  const [comps]: any = await conn.execute(
    `SELECT c.id_venda_item, c.id_item, c.quantidade, UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) AS tipo_recurso,
            COALESCE(cpd.pode_vender_sem_estoque, 0) AS pode_sem_estoque,
            COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome
     FROM vendas_pedidos_itens_componentes c
     LEFT JOIN itens_core ic ON ic.id_item = c.id_item
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = c.id_item AND cpd.tenant_id = c.tenant_id
     WHERE c.id_venda = ? AND c.tenant_id = ? ORDER BY c.id_componente`,
    [id, tenant]
  );
  return itens.map((i: any) => ({ ...i, componentes: comps.filter((c: any) => Number(c.id_venda_item) === Number(i.id_venda_item)) }));
};

/** Saídas de estoque do pedido (serviço não sai) e o que dá para saber de cada item: nome, se pode sair sem saldo. */
const saidasDoPedido = (itens: any[]) => {
  const info = new Map<number, { nome: string; podeSem: boolean }>();
  const linhas = itens.map(i => {
    const componentes = i.componentes.filter((c: any) => c.tipo_recurso !== 'SERVICO').map((c: any) => {
      info.set(Number(c.id_item), { nome: c.nome || `Item ${c.id_item}`, podeSem: Boolean(Number(c.pode_sem_estoque)) });
      return { idItem: Number(c.id_item), quantidade: n(c.quantidade) };
    });
    if (!i.componentes.length) info.set(Number(i.id_item), { nome: i.nome_snapshot, podeSem: Boolean(Number(i.pode_sem_estoque)) });
    const servico = !i.componentes.length && i.tipo_recurso === 'SERVICO';
    return servico ? null : { idItem: Number(i.id_item), quantidadeBase: n(i.quantidade_base), componentes };
  }).filter(Boolean) as Array<{ idItem: number; quantidadeBase: number; componentes: Array<{ idItem: number; quantidade: number }> }>;
  return { saidas: saidasDaEntrega(linhas), info };
};

const saldosDe = async (conn: any, tenant: number, ids: number[], trava = false) => {
  if (!ids.length) return new Map<number, { saldo: number; custo: number }>();
  const ordenados = [...ids].sort((a, b) => a - b);
  const [rows]: any = await conn.execute(
    `SELECT id_item, quantidade_atual, custo_medio FROM estoque_saldos_itens
     WHERE tenant_id = ? AND deposito = 'VENDA' AND id_item IN (${ordenados.map(() => '?').join(',')}) ORDER BY id_item ${trava ? 'FOR UPDATE' : ''}`,
    [tenant, ...ordenados]
  );
  return new Map<number, { saldo: number; custo: number }>(rows.map((r: any) => [Number(r.id_item), { saldo: n(r.quantidade_atual), custo: n(r.custo_medio) }]));
};

const notaDoPedido = async (conn: any, tenant: number, id: number) => {
  const [[d]]: any = await conn.execute(
    `SELECT id_documento, status, serie, numero, chave, emissor, DATE_FORMAT(emitido_em, '%Y-%m-%d') AS emitida_txt, motivo_cancelamento
     FROM fiscal_documentos WHERE tenant_id = ? AND id_venda = ? AND modelo = '55' ORDER BY id_documento DESC LIMIT 1`,
    [tenant, id]
  );
  return d ? { idDocumento: Number(d.id_documento), status: d.status, serie: d.serie !== null ? Number(d.serie) : null, numero: d.numero !== null ? Number(d.numero) : null,
    chave: d.chave, emissor: d.emissor, emitidaEm: d.emitida_txt, motivoCancelamento: d.motivo_cancelamento } : null;
};

const parcelasDoPedido = async (conn: any, tenant: number, id: number) => {
  const [rows]: any = await conn.execute(
    `SELECT id_titulo, parcela, total_parcelas, DATE_FORMAT(vencimento, '%Y-%m-%d') AS vencimento, valor, valor_pago, status, forma, codigo_barras
     FROM financeiro_contas_receber WHERE tenant_id = ? AND id_venda = ? ORDER BY parcela`,
    [tenant, id]
  );
  return rows.map((r: any) => ({
    idTitulo: Number(r.id_titulo), parcela: Number(r.parcela), totalParcelas: Number(r.total_parcelas), vencimento: r.vencimento,
    valor: n(r.valor), valorPago: n(r.valor_pago), status: r.status, forma: r.forma, codigoBarras: r.codigo_barras,
  }));
};

const resumoDoPedido = (p: any) => ({
  id: Number(p.id_venda), etapa: etapaDoPedido(p.status, !!p.entregue_em), status: p.status,
  idCliente: p.id_cliente ? Number(p.id_cliente) : null, cliente: p.cliente_nome, contato: p.contato, idOrcamento: p.id_orcamento ? Number(p.id_orcamento) : null,
  pedidoCliente: p.pedido_cliente, previsaoEntrega: p.previsao_txt, enderecoEntrega: p.endereco_entrega, observacao: p.observacao,
  total: n(p.total_liquido), totalCusto: n(p.total_custo), condicaoPagamento: p.condicao_pagamento, condicao: condicaoDaLinha(p),
  operador: p.operador, criadoEm: p.criado_txt, faturadoEm: p.faturado_txt, entregueEm: p.entregue_txt, recebidoPor: p.recebido_por,
  canceladoEm: p.cancelado_txt, motivoCancelamento: p.motivo_cancelamento,
});

/** GET /api/vendas/pedidos-faturados?situacao=ABERTOS|TODOS */
export const listarPedidosFaturados = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const todos = String(req.query.situacao || 'ABERTOS').toUpperCase() === 'TODOS';
    const [rows]: any = await pool.execute(
      `SELECT p.*, DATE_FORMAT(p.previsao_entrega, '%Y-%m-%d') AS previsao_txt, DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS criado_txt,
              DATE_FORMAT(p.faturado_em, '%Y-%m-%d %H:%i') AS faturado_txt, DATE_FORMAT(p.entregue_em, '%Y-%m-%d %H:%i') AS entregue_txt,
              DATE_FORMAT(p.cancelado_em, '%Y-%m-%d %H:%i') AS cancelado_txt,
              (SELECT d.numero FROM fiscal_documentos d WHERE d.id_venda = p.id_venda AND d.modelo = '55' AND d.status = 'AUTORIZADA' LIMIT 1) AS nota_numero,
              (SELECT COUNT(*) FROM financeiro_contas_receber t WHERE t.id_venda = p.id_venda AND t.status = 'ABERTO') AS parcelas_abertas,
              (SELECT COALESCE(SUM(t.valor - t.valor_pago), 0) FROM financeiro_contas_receber t WHERE t.id_venda = p.id_venda AND t.status = 'ABERTO') AS a_receber,
              (SELECT COUNT(*) FROM financeiro_contas_receber t WHERE t.id_venda = p.id_venda AND t.status = 'ABERTO' AND t.forma = 'BOLETO' AND t.codigo_barras IS NULL) AS boletos_faltando
       FROM vendas_pedidos p
       WHERE p.tenant_id = ? AND p.origem = 'ERP' AND p.status IN ('PEDIDO', 'FATURADO', 'CONCLUIDA', 'CANCELADA')
         ${todos ? '' : `AND (p.status IN ('PEDIDO', 'FATURADO') OR p.updated_at >= NOW() - INTERVAL 30 DAY OR p.created_at >= NOW() - INTERVAL 30 DAY)`}
       ORDER BY (p.status IN ('PEDIDO', 'FATURADO')) DESC, p.previsao_entrega IS NULL, p.previsao_entrega, p.id_venda DESC
       LIMIT 300`,
      [tenant]
    );
    return res.json(rows.map((p: any) => ({
      ...resumoDoPedido(p), notaNumero: p.nota_numero !== null ? Number(p.nota_numero) : null,
      parcelasAbertas: Number(p.parcelas_abertas), aReceber: n(p.a_receber), boletosFaltando: Number(p.boletos_faltando),
    })));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar os pedidos faturados.');
  }
};

/** GET /api/vendas/pedidos-faturados/:id — itens com saldo e reserva, nota, parcelas e parcelas sugeridas. */
export const detalhePedidoFaturado = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const p = await carregarPedido(pool, tenant, id);
    const itens = await itensDoPedido(pool, tenant, id);
    const { saidas, info } = saidasDoPedido(itens);
    const [saldos, reservasOutros, nota, parcelas] = await Promise.all([
      saldosDe(pool, tenant, [...saidas.keys()]), reservasPorItem(pool, tenant, id), notaDoPedido(pool, tenant, id), parcelasDoPedido(pool, tenant, id),
    ]);
    const faltas = p.entregue_em ? [] : faltasNaEntrega(saidas, new Map([...saldos].map(([k, v]) => [k, v.saldo])), reservasOutros, new Map([...info].map(([k, v]) => [k, v.podeSem])));
    const resumo = resumoDoPedido(p);
    // Romaneio: onde cada item fica (separação) e os dados do cliente (documento, telefone, endereço do cadastro)
    const idsLocal = [...new Set([...itens.map((i: any) => Number(i.id_item)), ...itens.flatMap((i: any) => i.componentes.map((c: any) => Number(c.id_item)))])];
    const [[locais], [[cli]]]: any = await Promise.all([
      idsLocal.length
        ? pool.query(`SELECT id_item, localizacao FROM estoque_saldos_itens WHERE tenant_id = ? AND deposito = 'VENDA' AND id_item IN (?)`, [tenant, idsLocal])
        : Promise.resolve([[]]),
      p.id_cliente
        ? pool.execute(
          `SELECT COALESCE(pj.cnpj, pf.cpf) AS documento,
                  (SELECT t.telefone FROM pessoas_contatos t WHERE t.id_cliente = c.id_pessoa AND t.deleted_at IS NULL AND COALESCE(t.telefone, '') <> '' ORDER BY t.principal DESC, t.id_contato LIMIT 1) AS telefone,
                  (SELECT CONCAT_WS(' · ', CONCAT_WS(', ', NULLIF(e.logradouro, ''), NULLIF(e.numero, '')), NULLIF(e.complemento, ''), NULLIF(e.bairro, ''),
                                    CONCAT_WS('/', NULLIF(e.cidade, ''), NULLIF(e.estado, '')), NULLIF(e.cep, ''))
                   FROM pessoas_enderecos e WHERE e.id_cliente = c.id_pessoa AND e.deleted_at IS NULL ORDER BY e.principal DESC, e.id_endereco LIMIT 1) AS endereco
           FROM pessoas_core c LEFT JOIN pessoas_pj pj ON pj.id_cliente = c.id_pessoa LEFT JOIN pessoas_pf pf ON pf.id_cliente = c.id_pessoa
           WHERE c.id_pessoa = ? AND c.tenant_id = ?`, [p.id_cliente, tenant])
        : Promise.resolve([[null]]),
    ]);
    const localDe = new Map<number, string | null>(locais.map((l: any) => [Number(l.id_item), l.localizacao || null]));
    return res.json({
      ...resumo,
      itens: itens.map((i: any) => ({
        idItem: Number(i.id_item), sku: i.sku_snapshot, nome: i.nome_snapshot, unidade: i.unidade_sigla, fator: n(i.fator_conversao), siglaBase: i.sigla_base,
        quantidade: n(i.quantidade), quantidadeBase: n(i.quantidade_base), precoUnitario: n(i.preco_unitario), total: n(i.total_item),
        servico: i.tipo_recurso === 'SERVICO' && !i.componentes.length, localizacao: localDe.get(Number(i.id_item)) ?? null,
        componentes: i.componentes.map((c: any) => ({ idItem: Number(c.id_item), nome: c.nome, quantidade: n(c.quantidade), localizacao: localDe.get(Number(c.id_item)) ?? null })),
      })),
      clienteDados: cli ? { documento: cli.documento || null, telefone: cli.telefone || null, endereco: cli.endereco || null } : null,
      estoque: [...saidas.entries()].map(([idItem, sai]) => ({
        idItem, nome: info.get(idItem)?.nome, sai, saldo: saldos.get(idItem)?.saldo ?? 0, reservadoOutros: reservasOutros.get(idItem) ?? 0,
        podeSemEstoque: !!info.get(idItem)?.podeSem,
      })),
      faltas: faltas.map(f => ({ ...f, nome: info.get(f.idItem)?.nome })),
      nota, parcelas,
      parcelasSugeridas: p.status === 'PEDIDO' ? parcelasSugeridas(n(p.total_liquido), resumo.condicao, hojeIso()) : [],
      formasParcela: FORMAS_PARCELA,
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar o pedido.');
  }
};

// ------------------------------------------------------------------ criar

/**
 * POST /api/vendas/pedidos-faturados { idOrcamento, previsaoEntrega?, enderecoEntrega?, pedidoCliente?, observacao? }
 * O orçamento (válido, com cliente) vira pedido pelos preços dele; o material fica reservado; o orçamento fica CONVERTIDO.
 */
export const criarPedidoFaturado = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idOrcamento = Number(req.body?.idOrcamento);
  if (!(idOrcamento > 0)) return res.status(400).json({ error: 'Informe o orçamento.' });
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[o]]: any = await conn.execute(
      `SELECT *, validade >= CURDATE() AS valido FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ? FOR UPDATE`, [idOrcamento, tenant]);
    if (!o || o.status !== 'ORCAMENTO') throw new ErroPedido('Orçamento não encontrado ou já convertido.', 409);
    if (!Number(o.valido)) throw new ErroPedido('Orçamento vencido: renove a validade (renegocie ou salve de novo) antes de virar pedido.', 409);
    if (!o.id_cliente) throw new ErroPedido('Pedido faturado precisa do cliente do cadastro (nota e contas a receber): defina o cliente no orçamento.', 409);
    const previsao = dataOuNull(req.body?.previsaoEntrega);
    if (req.body?.previsaoEntrega && !previsao) throw new ErroPedido('Data de entrega inválida.');

    const [cab]: any = await conn.execute(
      `INSERT INTO vendas_pedidos
         (tenant_id, origem, status, operador, id_cliente, cliente_nome, contato, id_orcamento, autorizado_por, motivo_autorizacao,
          total_bruto, total_desconto, total_frete, total_liquido, total_custo, margem_alvo, observacao,
          condicao_pagamento, condicao_forma, condicao_parcelas, condicao_intervalo_dias, condicao_entrada,
          pedido_cliente, previsao_entrega, endereco_entrega)
       VALUES (?, 'ERP', 'PEDIDO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, operadorDe(req), o.id_cliente, o.cliente_nome, o.contato, idOrcamento, o.autorizado_por, o.motivo_autorizacao,
        o.total_bruto, o.total_desconto, o.total_frete, o.total_liquido, o.total_custo, o.margem_alvo,
        texto(req.body?.observacao ?? o.observacao, 255),
        o.condicao_pagamento, o.condicao_forma, o.condicao_parcelas, o.condicao_intervalo_dias, o.condicao_entrada,
        texto(req.body?.pedidoCliente, 60), previsao, texto(req.body?.enderecoEntrega, 255)]
    );
    const id = Number(cab.insertId);
    const [linhas]: any = await conn.execute(`SELECT * FROM vendas_pedidos_itens WHERE id_venda = ? AND tenant_id = ? ORDER BY id_venda_item`, [idOrcamento, tenant]);
    if (!linhas.length) throw new ErroPedido('O orçamento não tem itens.', 409);
    for (const l of linhas) {
      const [ins]: any = await conn.execute(
        `INSERT INTO vendas_pedidos_itens
           (tenant_id, id_venda, id_item, sku_snapshot, nome_snapshot, id_unidade, unidade_sigla, fator_conversao, quantidade, quantidade_base,
            preco_tabela, preco_unitario, desconto_valor, total_item, custo_unitario_base, custo_total, preco_travado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenant, id, l.id_item, l.sku_snapshot, l.nome_snapshot, l.id_unidade, l.unidade_sigla, l.fator_conversao, l.quantidade, l.quantidade_base,
          // negociado: o preço combinado é o de tabela (não aparece como desconto)
          o.margem_alvo !== null ? l.preco_unitario : l.preco_tabela, l.preco_unitario, l.desconto_valor, l.total_item, l.custo_unitario_base, l.custo_total, l.preco_travado]
      );
      await conn.execute(
        `INSERT INTO vendas_pedidos_itens_componentes
           (tenant_id, id_venda, id_venda_item, id_composicao, id_item, quantidade, id_item_padrao, quantidade_padrao, ajuste)
         SELECT tenant_id, ?, ?, id_composicao, id_item, quantidade, id_item_padrao, quantidade_padrao, ajuste
         FROM vendas_pedidos_itens_componentes WHERE id_venda_item = ? ORDER BY id_componente`,
        [id, Number(ins.insertId), l.id_venda_item]
      );
    }
    await conn.execute(`UPDATE vendas_pedidos SET status = 'CONVERTIDO' WHERE id_venda = ? AND tenant_id = ?`, [idOrcamento, tenant]);

    // Aviso (não bloqueia): o que ainda não tem saldo livre para este pedido (vai chegar do fornecedor)
    const { saidas, info } = saidasDoPedido(await itensDoPedido(conn, tenant, id));
    const saldos = await saldosDe(conn, tenant, [...saidas.keys()]);
    const faltas = faltasNaEntrega(saidas, new Map([...saldos].map(([k, v]) => [k, v.saldo])), await reservasPorItem(conn, tenant, id), new Map([...info].map(([k, v]) => [k, v.podeSem])));
    await conn.commit();
    return res.status(201).json({ success: true, id, faltas: faltas.map(f => ({ ...f, nome: info.get(f.idItem)?.nome })) });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao criar o pedido.');
  } finally {
    conn.release();
  }
};

/** PUT /api/vendas/pedidos-faturados/:id { previsaoEntrega, enderecoEntrega, pedidoCliente, observacao } */
export const atualizarPedidoFaturado = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const p = await carregarPedido(pool, tenant, id);
    if (p.status === 'CANCELADA') throw new ErroPedido('Pedido cancelado.', 409);
    const previsao = dataOuNull(req.body?.previsaoEntrega);
    if (req.body?.previsaoEntrega && !previsao) throw new ErroPedido('Data de entrega inválida.');
    await pool.execute(
      `UPDATE vendas_pedidos SET previsao_entrega = ?, endereco_entrega = ?, pedido_cliente = ?, observacao = ? WHERE id_venda = ? AND tenant_id = ?`,
      [previsao, texto(req.body?.enderecoEntrega, 255), texto(req.body?.pedidoCliente, 60), texto(req.body?.observacao, 255), id, tenant]
    );
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao salvar o pedido.');
  }
};

// ------------------------------------------------------------------ faturar

/**
 * POST /api/vendas/pedidos-faturados/:id/faturar
 * { nota: { numero, serie?, chave?, emitidaEm? }, parcelas: [{ vencimento, valor, forma, codigoBarras? }] }
 */
export const faturarPedido = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const p = await carregarPedido(conn, tenant, id, true);
    if (p.status !== 'PEDIDO') throw new ErroPedido(p.status === 'CANCELADA' ? 'Pedido cancelado.' : 'Este pedido já foi faturado.', 409);
    const nota = validarNotaExterna(req.body?.nota, hojeIso());
    const parcelas = validarParcelas(req.body?.parcelas, n(p.total_liquido));
    const [[dup]]: any = await conn.execute(
      `SELECT id_venda FROM fiscal_documentos WHERE tenant_id = ? AND modelo = '55' AND serie = ? AND numero = ? AND status = 'AUTORIZADA' LIMIT 1`,
      [tenant, nota.serie, nota.numero]
    );
    if (dup) throw new ErroPedido(`A NF-e ${nota.numero} série ${nota.serie} já está lançada (venda/pedido Nº ${dup.id_venda}).`, 409);

    await conn.execute(
      `INSERT INTO fiscal_documentos
         (tenant_id, id_venda, modelo, status, ambiente, emissor, serie, numero, chave, motivo_status, valor_total, destinatario_nome, aprovado_por, aprovado_em, emitido_em)
       VALUES (?, ?, '55', 'AUTORIZADA', 'PRODUCAO', 'EXTERNO', ?, ?, ?, 'Emitida fora do ERP (emissor da loja)', ?, ?, ?, NOW(), ?)`,
      [tenant, id, nota.serie, nota.numero, nota.chave, f4(n(p.total_liquido)), String(p.cliente_nome || '').slice(0, 120) || null,
        operadorDe(req), `${nota.emitidaEm} 12:00:00`]
    );
    for (const t of parcelas) {
      await conn.execute(
        `INSERT INTO financeiro_contas_receber
           (tenant_id, id_cliente, id_venda, parcela, total_parcelas, descricao, vencimento, valor, forma, codigo_barras, operador)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenant, p.id_cliente, id, t.parcela, t.totalParcelas, `Pedido ${id} · NF ${nota.numero} - parcela ${t.parcela}/${t.totalParcelas}`.slice(0, 150),
          t.vencimento, f4(t.valor), t.forma, t.codigoBarras, operadorDe(req)]
      );
    }
    await conn.execute(`UPDATE vendas_pedidos SET status = ?, faturado_em = NOW() WHERE id_venda = ?`, [statusDoPedido(true, !!p.entregue_em), id]);
    await conn.commit();
    return res.json({ success: true });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao faturar o pedido.');
  } finally {
    conn.release();
  }
};

/** PUT /api/vendas/pedidos-faturados/:id/parcelas/:idTitulo { codigoBarras?, forma?, vencimento? } — boleto gerado depois. */
export const atualizarParcelaPedido = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregarPedido(pool, tenant, id);
    const [[t]]: any = await pool.execute(
      `SELECT id_titulo, status, valor_pago, forma, DATE_FORMAT(vencimento, '%Y-%m-%d') AS vencimento FROM financeiro_contas_receber
       WHERE id_titulo = ? AND id_venda = ? AND tenant_id = ?`, [Number(req.params.idTitulo), id, tenant]);
    if (!t) throw new ErroPedido('Parcela não encontrada.', 404);
    if (t.status !== 'ABERTO') throw new ErroPedido('Só parcela em aberto pode ser alterada.', 409);
    const forma = req.body?.forma ? String(req.body.forma).toUpperCase() : t.forma || 'BOLETO';
    if (!(FORMAS_PARCELA as readonly string[]).includes(forma)) throw new ErroPedido('Forma inválida.');
    const vencimento = req.body?.vencimento ? dataOuNull(req.body.vencimento) : t.vencimento;
    if (req.body?.vencimento && !vencimento) throw new ErroPedido('Vencimento inválido.');
    if (vencimento !== t.vencimento && n(t.valor_pago) > 0) throw new ErroPedido('Parcela com recebimento: o vencimento não muda.', 409);
    const codigo = forma === 'BOLETO' ? lerLinhaDigitavel(req.body?.codigoBarras) : null;
    await pool.execute(`UPDATE financeiro_contas_receber SET forma = ?, codigo_barras = ?, vencimento = ? WHERE id_titulo = ?`, [forma, codigo, vencimento, t.id_titulo]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao salvar a parcela.');
  }
};

// ------------------------------------------------------------------ entregar

/** POST /api/vendas/pedidos-faturados/:id/entregar { recebidoPor } — baixa o estoque de tudo de uma vez. */
export const entregarPedido = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  const recebidoPor = texto(req.body?.recebidoPor, 100);
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const p = await carregarPedido(conn, tenant, id, true);
    if (p.status === 'CANCELADA') throw new ErroPedido('Pedido cancelado.', 409);
    if (p.entregue_em) throw new ErroPedido('Este pedido já foi entregue.', 409);
    if (!recebidoPor) throw new ErroPedido('Informe quem recebeu a entrega.');
    const itens = await itensDoPedido(conn, tenant, id);
    const { saidas, info } = saidasDoPedido(itens);
    const saldos = await saldosDe(conn, tenant, [...saidas.keys()], true);
    const faltas = faltasNaEntrega(saidas, new Map([...saldos].map(([k, v]) => [k, v.saldo])), await reservasPorItem(conn, tenant, id), new Map([...info].map(([k, v]) => [k, v.podeSem])));
    if (faltas.length) {
      throw new ErroPedido(`Falta material para entregar: ${faltas.map(f => `${info.get(f.idItem)?.nome} (precisa ${f.sai}, livre ${f.disponivel})`).join('; ')}.`, 409, { faltas });
    }
    // Custo de agora (custo médio) por item; a linha do pedido guarda o custo da saída
    const custoDe = (idItem: number) => saldos.get(idItem)?.custo || 0;
    let totalCusto = 0;
    for (const i of itens) {
      const partes = i.componentes.length
        ? i.componentes.filter((c: any) => c.tipo_recurso !== 'SERVICO').map((c: any) => ({ idItem: Number(c.id_item), q: n(c.quantidade) * n(i.quantidade_base), doKit: true }))
        : i.tipo_recurso === 'SERVICO' ? [] : [{ idItem: Number(i.id_item), q: n(i.quantidade_base), doKit: false }];
      let custoLinha = 0;
      for (const s of partes) {
        if (!(s.q > 0)) continue;
        await lancarMovimentoEstoque(conn, {
          tenant, idItem: s.idItem, deposito: 'VENDA', tipo: 'SAIDA', origem: ORIGEM_ENTREGA, idOrigem: id, idOrigemItem: Number(i.id_venda_item),
          documento: `PEDIDO ${id}`, tipoRecurso: 'PRODUTO', quantidade: s.q,
          quantidadeDocumento: s.doKit ? s.q : n(i.quantidade), unidadeDocumento: s.doKit ? null : i.unidade_sigla, fatorConversao: s.doKit ? 1 : n(i.fator_conversao) || 1,
          custoUnitario: custoDe(s.idItem), observacao: `Entrega do pedido ${id}${recebidoPor ? ` (recebido por ${recebidoPor})` : ''}`,
        });
        custoLinha += Math.round(custoDe(s.idItem) * s.q * 10000) / 10000;
      }
      totalCusto += custoLinha;
      const qb = n(i.quantidade_base);
      await conn.execute(`UPDATE vendas_pedidos_itens SET custo_unitario_base = ?, custo_total = ? WHERE id_venda_item = ?`,
        [f4(qb > 0 ? custoLinha / qb : 0), f4(custoLinha), i.id_venda_item]);
    }
    const faturado = p.status === 'FATURADO';
    await conn.execute(
      `UPDATE vendas_pedidos SET entregue_em = NOW(), recebido_por = ?, total_custo = ?, status = ? WHERE id_venda = ?`,
      [recebidoPor, f4(totalCusto), statusDoPedido(faturado, true), id]
    );
    await conn.commit();
    return res.json({ success: true, concluido: faturado });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao registrar a entrega.');
  } finally {
    conn.release();
  }
};

// ------------------------------------------------------------------ cancelar

/**
 * POST /api/vendas/pedidos-faturados/:id/cancelar { motivo, notaCanceladaNoEmissor? }
 * Só antes da entrega (depois, é devolução). Parcelas sem recebimento são canceladas; a nota emitida fora precisa ser
 * cancelada no emissor de vocês (o operador confirma) e fica CANCELADA aqui.
 */
export const cancelarPedidoFaturado = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  const motivo = texto(req.body?.motivo, 255);
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (!motivo || motivo.length < 3) throw new ErroPedido('Informe o motivo do cancelamento.');
    const p = await carregarPedido(conn, tenant, id, true);
    if (p.status === 'CANCELADA') throw new ErroPedido('O pedido já está cancelado.', 409);
    if (p.entregue_em) throw new ErroPedido('Pedido já entregue: o material saiu do estoque. Para desfazer, faça a devolução.', 409);
    const nota = await notaDoPedido(conn, tenant, id);
    if (nota?.status === 'AUTORIZADA') {
      if (!req.body?.notaCanceladaNoEmissor) {
        throw new ErroPedido(`A NF-e ${nota.numero} foi emitida fora do ERP: cancele-a no emissor de vocês e confirme.`, 409, { codigo: 'NOTA_EXTERNA', numero: nota.numero });
      }
      await conn.execute(`UPDATE fiscal_documentos SET status = 'CANCELADA', cancelado_em = NOW(), motivo_cancelamento = ? WHERE id_documento = ?`,
        [`Cancelada no emissor externo: ${motivo}`.slice(0, 255), nota.idDocumento]);
    }
    await cancelarTitulosDaVenda(conn, tenant, id);
    await conn.execute(`UPDATE vendas_pedidos SET status = 'CANCELADA', cancelado_em = NOW(), motivo_cancelamento = ? WHERE id_venda = ?`, [motivo, id]);
    await conn.commit();
    return res.json({ success: true });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao cancelar o pedido.');
  } finally {
    conn.release();
  }
};
