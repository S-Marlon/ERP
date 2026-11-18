// Orçamentos e vendas suspensas: ficam em vendas_pedidos com status ORCAMENTO / SUSPENSA (itens em vendas_pedidos_itens).
// Não mexem em estoque, caixa nem contas a receber. Orçamento convertido vira CONVERTIDO e a venda guarda id_orcamento.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { calcularItensDoPedido } from './vendas.controller';
import { ErroVenda, fecharVenda } from './vendaPdv';
import { operadorDe } from '../caixa/caixa.controller';
import { nomeComTrocas } from '../../catalogo/kits/kits';
import { carregarDadosComponentes } from '../../catalogo/kits/kitsBanco';
import { escolhasDasLinhas, gravarEscolhasKit } from '../../catalogo/kits/kitsVenda';
import { carregarMargensNegociacao, carregarRegras } from '../regras/regrasVenda.controller';
import { conferirSenha } from '../regras/regrasVenda';
import { abaixoDaMinima, normalizarFaixas } from '../negociacao/negociacao';
import { condicaoDaLinha, lerCondicao, textoDaCondicao } from '../negociacao/condicaoPagamento';

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
 * Custo de referência de cada linha (margem do orçamento), por unidade base: custo médio do depósito Venda, senão o
 * gerencial; kit = custo dos componentes escolhidos.
 */
export const custoDasLinhas = async (conn: any, tenant: number, ids: number[], itensBanco: Map<number, any>) => {
  const [saldos]: any = await conn.execute(
    `SELECT id_item, custo_medio FROM estoque_saldos_itens WHERE tenant_id = ? AND deposito = 'VENDA' AND id_item IN (${ids.map(() => '?').join(',')})`,
    [tenant, ...ids]
  );
  const medio = new Map<number, number>(saldos.map((s: any) => [Number(s.id_item), Number(s.custo_medio) || 0]));
  const custoBase = (id: number) => medio.get(id) || Number(itensBanco.get(id)?.custo_gerencial) || 0;
  return async (linhas: Array<{ idItem: number; kit?: { componentes: Array<{ idItem: number; quantidade: number }> } | null }>) => {
    const componentes = await carregarDadosComponentes(conn, tenant, linhas.flatMap(l => (l.kit?.componentes || []).map(c => c.idItem)));
    return (l: typeof linhas[number]) => (l.kit
      ? l.kit.componentes.reduce((a, c) => a + Math.round((componentes.get(c.idItem)?.custo || 0) * c.quantidade * 10000) / 10000, 0)
      : custoBase(l.idItem));
  };
};

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
  // Negociação (só orçamento): margem alvo, condição de pagamento, itens travados e faixas por quantidade
  const neg = tipo === 'ORCAMENTO' && req.body?.negociacao ? req.body.negociacao : null;
  const margemAlvo = neg ? Number(neg.margemAlvo) : null;
  if (neg && !(Number.isFinite(margemAlvo) && margemAlvo! >= 0 && margemAlvo! <= 0.9)) return res.status(400).json({ error: 'Margem alvo inválida (0 a 90%).' });
  // Orçamento já salvo sendo renegociado: mesmo número, itens trocados
  const idExistente = tipo === 'ORCAMENTO' && Number(req.body?.idPedido) > 0 ? Number(req.body.idPedido) : null;

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { ids, itensBanco, linhas } = await calcularItensDoPedido(connection, tenant, itens);
    // Na negociação o preço combinado é o "de tabela" do orçamento (não conta como desconto ao vender)
    if (neg) for (const l of linhas) l.precoTabela = l.precoPraticado;
    const venda = fecharVenda(linhas, Number(req.body?.descontoGeral) || 0);
    // Condição de pagamento em campos (forma, parcelas, intervalo, entrada); o texto da proposta sai dela
    let condicao: ReturnType<typeof lerCondicao> = null;
    if (neg) {
      try { condicao = lerCondicao(neg.condicao, venda.totalLiquido); } catch (e: any) { throw new ErroVenda(e.message); }
    }

    const custoDaLinha = await (await custoDasLinhas(connection, tenant, ids, itensBanco))(venda.linhas);
    const totalCusto = venda.linhas.reduce((a, l) => a + custoDaLinha(l) * l.quantidadeBase, 0);

    // Negociação: item (ou faixa) abaixo da margem mínima precisa da senha de autorização
    const faixasDe = (i: number) => (neg ? normalizarFaixas(itens[i]?.faixas) : []);
    let autorizadoPor: string | null = null;
    let motivoAutorizacao: string | null = null;
    if (neg) {
      const { margemMinimaNegociacao } = await carregarMargensNegociacao(connection, tenant);
      const abaixo = abaixoDaMinima(venda.linhas.map((l, i) => ({
        nome: itensBanco.get(l.idItem).nome_comercial || itensBanco.get(l.idItem).nome_item,
        preco: l.precoUnitarioFinal, custoUnitario: custoDaLinha(l) * l.fator, faixas: faixasDe(i),
      })), margemMinimaNegociacao);
      if (abaixo.length) {
        const regras = await carregarRegras(connection, tenant);
        const detalhes = { codigo: 'AUTORIZACAO_NECESSARIA', motivos: abaixo, temSenha: Boolean(regras.senhaHash) };
        if (!regras.senhaHash) throw new ErroVenda(`Abaixo da margem mínima: ${abaixo.join('; ')}. Defina a senha de autorização em Vendas › Regras de venda.`, 403, detalhes);
        const aut = req.body?.autorizacao;
        if (!aut) throw new ErroVenda(`Autorização necessária: ${abaixo.join('; ')}.`, 403, detalhes);
        if (!conferirSenha(String(aut.senha || ''), regras.senhaHash)) throw new ErroVenda('Senha de autorização incorreta.', 403, { ...detalhes, senhaIncorreta: true });
        autorizadoPor = String(aut.nome || '').trim().slice(0, 60);
        motivoAutorizacao = String(aut.motivo || '').trim().slice(0, 255);
        if (!autorizadoPor || !motivoAutorizacao) throw new ErroVenda('Informe quem autorizou e o motivo.', 403, detalhes);
      }
    }

    const valoresCab = [
      req.body?.idCliente ? Number(req.body.idCliente) : null,
      String(req.body?.clienteNome || '').trim().slice(0, 150) || 'CONSUMIDOR',
      String(req.body?.contato || '').trim().slice(0, 100) || null,
      f4(venda.totalBruto), f4(venda.totalDesconto), f4(venda.totalLiquido), f4(totalCusto),
      String(req.body?.observacao || '').trim().slice(0, 255) || null,
      neg ? Number(margemAlvo).toFixed(4) : null,
      neg ? (condicao ? textoDaCondicao(condicao) : String(neg.condicaoPagamento || '').trim()).slice(0, 150) || null : null,
      condicao?.forma ?? null, condicao ? condicao.parcelas : null, condicao?.intervaloDias ?? null, condicao && condicao.entrada > 0 ? f4(condicao.entrada) : null,
      autorizadoPor, motivoAutorizacao,
    ];
    let id: number;
    if (idExistente) {
      const [[atual]]: any = await connection.execute(
        `SELECT status FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ? FOR UPDATE`, [idExistente, tenant]);
      if (!atual || atual.status !== 'ORCAMENTO') throw new ErroVenda('Orçamento não encontrado ou já convertido em venda.', 409);
      await connection.execute(
        `UPDATE vendas_pedidos SET operador = ?, id_cliente = ?, cliente_nome = ?, contato = ?, total_bruto = ?, total_desconto = ?, total_liquido = ?,
           total_custo = ?, observacao = ?, margem_alvo = ?, condicao_pagamento = ?,
           condicao_forma = ?, condicao_parcelas = ?, condicao_intervalo_dias = ?, condicao_entrada = ?, autorizado_por = ?, motivo_autorizacao = ?,
           validade = CURDATE() + INTERVAL ? DAY WHERE id_venda = ?`,
        [operadorDe(req), ...valoresCab, validadeDias, idExistente]);
      await connection.execute(`DELETE FROM vendas_pedidos_itens_componentes WHERE id_venda = ? AND tenant_id = ?`, [idExistente, tenant]);
      await connection.execute(`DELETE FROM vendas_pedidos_itens WHERE id_venda = ? AND tenant_id = ?`, [idExistente, tenant]);
      id = idExistente;
    } else {
      const [cab]: any = await connection.execute(
        `INSERT INTO vendas_pedidos
           (tenant_id, origem, status, operador, id_cliente, cliente_nome, contato, total_bruto, total_desconto, total_liquido, total_custo, observacao,
            margem_alvo, condicao_pagamento, condicao_forma, condicao_parcelas, condicao_intervalo_dias, condicao_entrada, autorizado_por, motivo_autorizacao, validade)
         VALUES (?, 'PDV', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${tipo === 'ORCAMENTO' ? 'CURDATE() + INTERVAL ? DAY' : 'NULL'})`,
        [tenant, tipo, operadorDe(req), ...valoresCab, ...(tipo === 'ORCAMENTO' ? [validadeDias] : [])]
      );
      id = Number(cab.insertId);
    }
    for (const [indice, l] of venda.linhas.entries()) {
      const item = itensBanco.get(l.idItem);
      const custo = custoDaLinha(l);
      const [insItem]: any = await connection.execute(
        `INSERT INTO vendas_pedidos_itens
           (tenant_id, id_venda, id_item, sku_snapshot, nome_snapshot, id_unidade, unidade_sigla, fator_conversao,
            quantidade, quantidade_base, preco_tabela, preco_unitario, desconto_valor, total_item, custo_unitario_base, custo_total, preco_travado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenant, id, l.idItem, item.sku_customizado || item.sku_core, nomeComTrocas(item.nome_comercial || item.nome_item, l.kit),
          l.idUnidade, l.sigla, Number(l.fator).toFixed(6), f4(l.quantidade), f4(l.quantidadeBase),
          f4(l.precoTabela), f4(l.precoUnitarioFinal), f4(l.descontoValor), f4(l.totalItem), f4(custo), f4(custo * l.quantidadeBase),
          neg && itens[indice]?.travado ? 1 : 0,
        ]
      );
      await gravarEscolhasKit(connection, tenant, id, Number(insItem.insertId), l.kit ?? null);
      for (const f of faixasDe(indice)) {
        await connection.execute(
          `INSERT INTO vendas_pedidos_itens_faixas (tenant_id, id_venda_item, quantidade_minima, preco_unitario) VALUES (?, ?, ?, ?)`,
          [tenant, Number(insItem.insertId), f4(f.quantidadeMinima), f4(f.precoUnitario)]);
      }
    }
    await connection.commit();
    return res.status(idExistente ? 200 : 201).json({ success: true, id, tipo, totalLiquido: venda.totalLiquido });
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
    `SELECT i.id_venda_item, i.id_item, i.sku_snapshot, i.nome_snapshot, i.id_unidade, i.unidade_sigla, i.fator_conversao, i.quantidade, i.preco_tabela,
            i.preco_unitario, i.desconto_valor, i.total_item, i.custo_unitario_base, i.preco_travado,
            cat.nome AS categoria, ub.sigla AS sigla_base
     FROM vendas_pedidos_itens i
     LEFT JOIN itens_core ic ON ic.id_item = i.id_item
     LEFT JOIN itens_unidades_medida ub ON ub.id_unidade = ic.id_unidade
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = i.id_item AND cpd.tenant_id = i.tenant_id
     LEFT JOIN comercial_familias fam ON fam.id = cpd.familia_id
     LEFT JOIN comercial_categorias cat ON cat.id = COALESCE(fam.categoria_id, cpd.categoria_id)
     WHERE i.id_venda = ? AND i.tenant_id = ? ORDER BY i.id_venda_item`,
    [id, tenant]
  );
  const [faixas]: any = await conn.execute(
    `SELECT f.id_venda_item, f.quantidade_minima, f.preco_unitario FROM vendas_pedidos_itens_faixas f
     JOIN vendas_pedidos_itens i ON i.id_venda_item = f.id_venda_item WHERE i.id_venda = ? AND i.tenant_id = ? ORDER BY f.quantidade_minima`,
    [id, tenant]
  );
  // Kit configurável: as escolhas voltam com a linha (o carrinho remonta o kit igual)
  const escolhas = await escolhasDasLinhas(conn, tenant, id);
  return {
    id: Number(p.id_venda), tipo: p.status === 'SUSPENSA' ? 'SUSPENSA' : 'ORCAMENTO', situacao: situacao(p.status, p.valido),
    cliente: p.cliente_nome, idCliente: p.id_cliente ? Number(p.id_cliente) : null, contato: p.contato, operador: p.operador,
    observacao: p.observacao, validade: p.validade_txt, criadoEm: p.created_at,
    // negociação (null = orçamento comum)
    margemAlvo: p.margem_alvo === null || p.margem_alvo === undefined ? null : Number(p.margem_alvo), condicaoPagamento: p.condicao_pagamento || null,
    condicao: condicaoDaLinha(p),
    autorizadoPor: p.autorizado_por || null,
    totalBruto: Number(p.total_bruto), totalDesconto: Number(p.total_desconto), total: Number(p.total_liquido),
    itens: itens.map((i: any) => ({
      idItem: Number(i.id_item), sku: i.sku_snapshot, nome: i.nome_snapshot, idUnidade: i.id_unidade ? Number(i.id_unidade) : null,
      unidade: i.unidade_sigla, quantidade: Number(i.quantidade), precoTabela: Number(i.preco_tabela), precoUnitario: Number(i.preco_unitario),
      desconto: Number(i.desconto_valor), total: Number(i.total_item),
      componentes: escolhas.get(Number(i.id_venda_item))?.escolhas,
      fator: Number(i.fator_conversao) || 1, siglaBase: i.sigla_base || null, categoria: i.categoria || null,
      custoUnitarioBase: Number(i.custo_unitario_base) || 0, travado: !!Number(i.preco_travado),
      faixas: faixas.filter((f: any) => Number(f.id_venda_item) === Number(i.id_venda_item))
        .map((f: any) => ({ quantidadeMinima: Number(f.quantidade_minima), precoUnitario: Number(f.preco_unitario) })),
    })),
  };
};

/** GET /api/vendas/pdv/pedidos-abertos/:id */
export const detalhePedidoAberto = async (req: Request, res: Response) => {
  try {
    const d = await carregarDetalhe(pool, tenantDe(req), Number(req.params.id));
    if (!d) return res.status(404).json({ error: 'Orçamento ou venda suspensa não encontrado.' });
    // Telefone principal do cliente cadastrado (para mandar o orçamento pelo WhatsApp)
    let telefoneCliente: string | null = null;
    if (d.idCliente) {
      const [t]: any = await pool.execute(
        `SELECT telefone FROM pessoas_contatos WHERE id_cliente = ? AND deleted_at IS NULL AND COALESCE(telefone, '') <> ''
         ORDER BY principal DESC, id_contato LIMIT 1`,
        [d.idCliente]
      );
      telefoneCliente = t[0]?.telefone || null;
    }
    return res.json({ ...d, telefoneCliente });
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

/** PUT /api/vendas/pdv/pedidos-abertos/:id/cliente — liga um orçamento em aberto (ou venda suspensa) a um cliente do cadastro */
export const definirClientePedidoAberto = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const idCliente = Number(req.body?.idCliente);
    if (!idCliente) throw new ErroVenda('Informe o cliente.');
    const [[c]]: any = await pool.execute(
      `SELECT c.id_pessoa, COALESCE(pf.nome, pj.nome_fantasia, pj.razao_social) AS nome
       FROM pessoas_core c
       LEFT JOIN pessoas_pf pf ON pf.id_cliente = c.id_pessoa
       LEFT JOIN pessoas_pj pj ON pj.id_cliente = c.id_pessoa
       WHERE c.id_pessoa = ? AND c.tenant_id = ? AND c.deleted_at IS NULL`,
      [idCliente, tenant]
    );
    if (!c) throw new ErroVenda('Cliente não encontrado.', 404);
    const [r]: any = await pool.execute(
      `UPDATE vendas_pedidos SET id_cliente = ?, cliente_nome = ?
       WHERE id_venda = ? AND tenant_id = ? AND status IN ('ORCAMENTO', 'SUSPENSA')`,
      [idCliente, String(c.nome || '').slice(0, 150), Number(req.params.id), tenant]
    );
    if (!r.affectedRows) throw new ErroVenda('Orçamento não encontrado (o que já virou venda não muda).', 404);
    return res.json({ success: true, idCliente, cliente: c.nome });
  } catch (error) {
    return responderErro(res, error, 'Erro ao definir o cliente.');
  }
};
