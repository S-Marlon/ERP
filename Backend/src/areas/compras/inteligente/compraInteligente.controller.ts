// Compra inteligente: giro (vendas) × saldo × vínculos de fornecedor; condições do fornecedor (pedido mínimo, prazo);
// pedidos de compra que viram cotação (memória de preços mesmo sem comprar) e histórico de preços por item.
// Tabelas: compras_fornecedores_condicoes, compras_pedidos, compras_pedidos_itens (+ comercial_fornecedores_produtos).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../vendas/caixa/caixa.controller';
import {
  completarPedidoMinimo, escolherPrincipal, ItemDoFornecedor, precoPorUnidadeBase, sugerirItem, SugestaoItem, textoDoPedido, totalDoPedido,
  VinculoFornecedor,
} from './compraInteligente';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);
const n = (v: unknown) => Number(v) || 0;
const STATUS = ['RASCUNHO', 'ENVIADO', 'COTADO', 'COMPRADO', 'CANCELADO'] as const;

export class ErroCompra extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroCompra) return res.status(error.status).json({ error: error.message });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

const parametros = (req: Request, prazoEntregaDias = 0) => ({
  dias: Math.min(365, Math.max(7, Number(req.query.dias ?? req.body?.dias) || 90)),
  coberturaDias: Math.min(365, Math.max(0, Number(req.query.cobertura ?? req.body?.cobertura) || 30)),
  prazoEntregaDias,
});

const nomeFornecedor = `COALESCE(NULLIF(TRIM(pj.nome_fantasia), ''), pj.razao_social)`;

const carregarCondicoes = async (conn: Conn, tenant: number, ids?: number[]) => {
  const filtro = ids?.length ? `AND id_fornecedor IN (${ids.map(() => '?').join(',')})` : '';
  const [rows] = await conn.execute(
    `SELECT id_fornecedor, pedido_minimo, prazo_entrega_dias, contato_pedido, observacao FROM compras_fornecedores_condicoes WHERE tenant_id = ? ${filtro}`,
    [tenant, ...(ids || [])]
  );
  return new Map<number, { pedidoMinimo: number; prazoEntregaDias: number; contato: string; observacao: string }>(
    (rows as any[]).map(r => [Number(r.id_fornecedor), {
      pedidoMinimo: n(r.pedido_minimo), prazoEntregaDias: n(r.prazo_entrega_dias), contato: r.contato_pedido || '', observacao: r.observacao || '',
    }])
  );
};

/** Vendido por item no período (saídas de venda menos cancelamentos e devoluções), na unidade base. Inclui componentes de kit. */
const vendidoNoPeriodo = async (conn: Conn, tenant: number, dias: number, ids?: number[]) => {
  const filtro = ids?.length ? `AND id_item IN (${ids.map(() => '?').join(',')})` : '';
  const [rows] = await conn.execute(
    `SELECT id_item,
            SUM(CASE WHEN tipo_movimento = 'SAIDA' THEN quantidade ELSE -quantidade END) AS vendido
     FROM estoque_movimentos
     WHERE tenant_id = ? AND deposito = 'VENDA' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND ((origem = 'VENDA_PDV' AND tipo_movimento = 'SAIDA')
         OR (origem IN ('CANCELAMENTO_VENDA', 'DEVOLUCAO_VENDA') AND tipo_movimento = 'ENTRADA')) ${filtro}
     GROUP BY id_item`,
    [tenant, dias, ...(ids || [])]
  );
  return new Map<number, number>((rows as any[]).map(r => [Number(r.id_item), Math.max(0, n(r.vendido))]));
};

/** Último preço cotado (cotação ainda válida ou sem validade) por item+fornecedor. */
const ultimasCotacoes = async (conn: Conn, tenant: number, idFornecedor: number) => {
  const [rows] = await conn.execute(
    `SELECT i.id_item, i.preco_cotado, DATE_FORMAT(p.cotado_em, '%Y-%m-%d') AS data
     FROM compras_pedidos_itens i
     INNER JOIN compras_pedidos p ON p.id_pedido = i.id_pedido
     WHERE p.tenant_id = ? AND p.id_fornecedor = ? AND p.status IN ('COTADO', 'COMPRADO') AND i.preco_cotado > 0
       AND (p.validade_cotacao IS NULL OR p.validade_cotacao >= CURDATE())
     ORDER BY p.cotado_em DESC, i.id_pedido_item DESC`,
    [tenant, idFornecedor]
  );
  const mapa = new Map<number, { preco: number; data: string }>();
  for (const r of rows as any[]) if (!mapa.has(Number(r.id_item))) mapa.set(Number(r.id_item), { preco: n(r.preco_cotado), data: r.data });
  return mapa;
};

/**
 * Todos os fornecedores de cada item: código, descrição como o fornecedor escreve (última nota), embalagem,
 * preço e quantas vezes foi comprado de cada um (para achar o principal).
 */
const vinculosDosItens = async (conn: Conn, tenant: number, ids: number[]) => {
  const mapa = new Map<number, VinculoFornecedor[]>();
  if (ids.length === 0) return mapa;
  const marc = ids.map(() => '?').join(',');
  const [links] = await conn.execute(
    `SELECT cfp.id_item, cfp.id_fornecedor, ${nomeFornecedor} AS fornecedor, cfp.codigo_produto_fornecedor, cfp.unidade_compra,
            cfp.fator_compra, cfp.preco_ultima_compra, cfp.padrao
     FROM comercial_fornecedores_produtos cfp INNER JOIN pessoas_pj pj ON pj.id_cliente = cfp.id_fornecedor
     WHERE cfp.tenant_id = ? AND cfp.id_item IN (${marc})`,
    [tenant, ...ids]
  );
  const [notas] = await conn.execute(
    `SELECT s.produto_id_sistema AS id_item, pj.id_cliente AS id_fornecedor, COUNT(*) AS notas, MAX(l.id) AS ultima,
            SUBSTRING_INDEX(GROUP_CONCAT(s.nome_fornecedor ORDER BY l.id DESC SEPARATOR '\n'), '\n', 1) AS descricao
     FROM importacao_produtos_staging s
     INNER JOIN importacoes_lotes l ON l.id = s.lote_importacao_id AND l.status = 'IMPORTADO'
     INNER JOIN pessoas_pj pj ON pj.cnpj = l.cnpj_fornecedor
     WHERE s.tenant_id = ? AND s.produto_id_sistema IN (${marc})
     GROUP BY s.produto_id_sistema, pj.id_cliente`,
    [tenant, ...ids]
  );
  const porPar = new Map<string, any>((notas as any[]).map(r => [`${r.id_item}:${r.id_fornecedor}`, r]));
  for (const r of links as any[]) {
    const id = Number(r.id_item);
    const nf = porPar.get(`${id}:${r.id_fornecedor}`);
    if (!mapa.has(id)) mapa.set(id, []);
    mapa.get(id)!.push({
      idFornecedor: Number(r.id_fornecedor), fornecedor: r.fornecedor, codigo: r.codigo_produto_fornecedor || null,
      descricao: nf?.descricao || null, unidadeCompra: r.unidade_compra || '', fatorCompra: n(r.fator_compra) || 1,
      preco: n(r.preco_ultima_compra), padrao: Boolean(Number(r.padrao)), notas: n(nf?.notas), ultimaNota: n(nf?.ultima),
    });
  }
  return mapa;
};

/** Pedidos em aberto (rascunho salvo, enviado ou cotado) que já têm o item, de qualquer fornecedor. */
const pedidosAbertosDosItens = async (conn: Conn, tenant: number, ids: number[]) => {
  const mapa = new Map<number, Array<{ idPedido: number; idFornecedor: number; fornecedor: string; status: string; quantidade: number; unidade: string }>>();
  if (ids.length === 0) return mapa;
  const [rows] = await conn.execute(
    `SELECT i.id_item, p.id_pedido, p.id_fornecedor, ${nomeFornecedor} AS fornecedor, p.status, i.quantidade, i.unidade_compra
     FROM compras_pedidos_itens i
     INNER JOIN compras_pedidos p ON p.id_pedido = i.id_pedido
     LEFT JOIN pessoas_pj pj ON pj.id_cliente = p.id_fornecedor
     WHERE p.tenant_id = ? AND p.status IN ('RASCUNHO', 'ENVIADO', 'COTADO') AND i.id_item IN (${ids.map(() => '?').join(',')})
     ORDER BY p.id_pedido DESC`,
    [tenant, ...ids]
  );
  for (const r of rows as any[]) {
    const id = Number(r.id_item);
    if (!mapa.has(id)) mapa.set(id, []);
    mapa.get(id)!.push({ idPedido: Number(r.id_pedido), idFornecedor: Number(r.id_fornecedor), fornecedor: r.fornecedor || '', status: r.status, quantidade: n(r.quantidade), unidade: r.unidade_compra || '' });
  }
  return mapa;
};

/** Itens do fornecedor com giro, saldo, preço e sugestão. */
const analisarFornecedor = async (
  conn: Conn, tenant: number, idFornecedor: number, p: { dias: number; coberturaDias: number; prazoEntregaDias: number },
  vendidoPronto?: Map<number, number>,
  detalhado = true // vínculos de outros fornecedores e pedidos abertos (o resumo não precisa)
) => {
  const [rows] = await conn.execute(
    `SELECT cfp.id_item, cfp.codigo_produto_fornecedor, cfp.unidade_compra, cfp.fator_compra, cfp.preco_ultima_compra, cfp.padrao,
            ic.sku AS sku_core, ic.nome_item, ic.status, um.sigla AS unidade,
            cpd.sku_customizado, cpd.nome_comercial, f.estoque_minimo AS minimo_familia,
            COALESCE(es.quantidade_atual, 0) AS saldo, es.estoque_minimo, es.estoque_maximo
     FROM comercial_fornecedores_produtos cfp
     INNER JOIN itens_core ic ON ic.id_item = cfp.id_item AND ic.tenant_id = cfp.tenant_id
     LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
     LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'
     WHERE cfp.tenant_id = ? AND cfp.id_fornecedor = ? AND ic.status = 'ATIVO'`,
    [tenant, idFornecedor]
  );
  const ids = (rows as any[]).map(r => Number(r.id_item));
  const [vendido, cotacoes] = await Promise.all([
    vendidoPronto ? Promise.resolve(vendidoPronto) : vendidoNoPeriodo(conn, tenant, p.dias, ids),
    ultimasCotacoes(conn, tenant, idFornecedor),
  ]);
  const [vinculos, emPedidos] = detalhado
    ? await Promise.all([vinculosDosItens(conn, tenant, ids), pedidosAbertosDosItens(conn, tenant, ids)])
    : [new Map<number, VinculoFornecedor[]>(), new Map<number, any[]>()];
  return (rows as any[]).map(r => {
    const id = Number(r.id_item);
    const cotacao = cotacoes.get(id);
    const minimo = r.estoque_minimo !== null ? n(r.estoque_minimo) : r.minimo_familia !== null ? n(r.minimo_familia) : null;
    const item: ItemDoFornecedor = {
      idItem: id,
      sku: r.sku_customizado || r.sku_core,
      nome: r.nome_comercial || r.nome_item,
      unidade: r.unidade || '',
      saldo: n(r.saldo),
      minimo,
      maximo: r.estoque_maximo !== null ? n(r.estoque_maximo) : null,
      vendido: vendido.get(id) || 0,
      codigoFornecedor: r.codigo_produto_fornecedor || null,
      unidadeCompra: r.unidade_compra || r.unidade || 'UN',
      fatorCompra: n(r.fator_compra) || 1,
      precoCompra: cotacao ? cotacao.preco : n(r.preco_ultima_compra),
    };
    const todos = vinculos.get(id) || [];
    const principal = escolherPrincipal(todos);
    const deste = todos.find(v => v.idFornecedor === idFornecedor);
    return {
      ...sugerirItem(item, p),
      origemPreco: cotacao ? 'COTACAO' : 'NOTA',
      dataCotacao: cotacao?.data || null,
      precoUltimaNota: n(r.preco_ultima_compra),
      fornecedorPadrao: Boolean(Number(r.padrao)),
      // Como ESTE fornecedor escreve o item (vai no pedido para ele)
      descricaoFornecedor: deste?.descricao || null,
      // Como a loja conhece o item: o fornecedor principal (marcado ou o mais comprado)
      ehPrincipal: !principal || principal.idFornecedor === idFornecedor,
      principal: principal ? { idFornecedor: principal.idFornecedor, fornecedor: principal.fornecedor, codigo: principal.codigo, descricao: principal.descricao } : null,
      outrosFornecedores: todos.filter(v => v.idFornecedor !== idFornecedor).map(v => ({
        idFornecedor: v.idFornecedor, fornecedor: v.fornecedor, codigo: v.codigo, descricao: v.descricao, unidadeCompra: v.unidadeCompra,
        fatorCompra: v.fatorCompra, preco: v.preco, precoBase: precoPorUnidadeBase(v), principal: principal?.idFornecedor === v.idFornecedor,
      })),
      precoBase: precoPorUnidadeBase({ preco: item.precoCompra, fatorCompra: item.fatorCompra }),
      // Já pedido (pedido salvo em aberto), deste ou de outro fornecedor
      emPedidos: emPedidos.get(id) || [],
    };
  });
};

/** GET /api/compras/inteligente/fornecedores?dias=90&cobertura=30 — resumo por fornecedor (o que precisa comprar de cada um) */
export const resumoFornecedores = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [forn]: any = await pool.execute(
      `SELECT pj.id_cliente AS id, ${nomeFornecedor} AS nome, pj.cnpj, COUNT(*) AS itens
       FROM comercial_fornecedores_produtos cfp INNER JOIN pessoas_pj pj ON pj.id_cliente = cfp.id_fornecedor
       WHERE cfp.tenant_id = ? GROUP BY pj.id_cliente ORDER BY nome`,
      [tenant]
    );
    const condicoes = await carregarCondicoes(pool as any, tenant);
    const [ultimos]: any = await pool.execute(
      `SELECT id_fornecedor, MAX(created_at) AS ultimo, SUM(status IN ('RASCUNHO', 'ENVIADO')) AS abertos
       FROM compras_pedidos WHERE tenant_id = ? GROUP BY id_fornecedor`, [tenant]
    );
    const pedidos = new Map<number, any>(ultimos.map((u: any) => [Number(u.id_fornecedor), u]));
    // Vendas do período: uma consulta só para todos os fornecedores
    const vendido = await vendidoNoPeriodo(pool as any, tenant, parametros(req).dias);
    const saida = [];
    for (const f of forn) {
      const c = condicoes.get(Number(f.id));
      const itens = await analisarFornecedor(pool as any, tenant, Number(f.id), parametros(req, c?.prazoEntregaDias || 0), vendido, false);
      const repor = itens.filter(i => i.quantidade > 0);
      const valor = totalDoPedido(repor);
      saida.push({
        idFornecedor: Number(f.id), nome: f.nome, cnpj: f.cnpj, itensVinculados: Number(f.itens),
        itensRepor: repor.length, abaixoMinimo: repor.filter(i => i.motivo === 'ABAIXO_MINIMO').length,
        valorSugerido: valor, pedidoMinimo: c?.pedidoMinimo || 0, prazoEntregaDias: c?.prazoEntregaDias || 0,
        atingeMinimo: !c?.pedidoMinimo || valor >= c.pedidoMinimo,
        ultimoPedido: pedidos.get(Number(f.id))?.ultimo || null, pedidosAbertos: n(pedidos.get(Number(f.id))?.abertos),
      });
    }
    saida.sort((a, b) => b.itensRepor - a.itensRepor || b.valorSugerido - a.valorSugerido);
    return res.json(saida);
  } catch (error) {
    return responderErro(res, error, 'Erro ao analisar os fornecedores.');
  }
};

/** GET /api/compras/inteligente/fornecedores/:id?dias=90&cobertura=30 — itens do fornecedor com a sugestão */
export const analiseFornecedor = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idFornecedor = Number(req.params.id);
  try {
    const [[f]]: any = await pool.execute(`SELECT pj.id_cliente AS id, ${nomeFornecedor} AS nome, pj.cnpj FROM pessoas_pj pj WHERE pj.id_cliente = ?`, [idFornecedor]);
    if (!f) throw new ErroCompra('Fornecedor não encontrado.', 404);
    const c = (await carregarCondicoes(pool as any, tenant, [idFornecedor])).get(idFornecedor)
      || { pedidoMinimo: 0, prazoEntregaDias: 0, contato: '', observacao: '' };
    const p = parametros(req, c.prazoEntregaDias);
    const itens = await analisarFornecedor(pool as any, tenant, idFornecedor, p);
    itens.sort((a, b) => (b.quantidade > 0 ? 1 : 0) - (a.quantidade > 0 ? 1 : 0)
      || (a.coberturaAtual ?? 1e9) - (b.coberturaAtual ?? 1e9) || b.vendido - a.vendido);
    return res.json({ fornecedor: { idFornecedor, nome: f.nome, cnpj: f.cnpj }, condicoes: c, parametros: p, itens });
  } catch (error) {
    return responderErro(res, error, 'Erro ao analisar o fornecedor.');
  }
};

/**
 * POST /api/compras/inteligente/fornecedores/:id/completar { quantidades: { idItem: qtd }, dias?, cobertura?, limiteCobertura? }
 * Acrescenta embalagens nos itens que acabam primeiro até o pedido mínimo.
 */
export const completarMinimo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idFornecedor = Number(req.params.id);
  try {
    const c = (await carregarCondicoes(pool as any, tenant, [idFornecedor])).get(idFornecedor);
    const minimo = Number(req.body?.pedidoMinimo) || c?.pedidoMinimo || 0;
    if (!(minimo > 0)) throw new ErroCompra('Informe o pedido mínimo deste fornecedor.');
    const itens: SugestaoItem[] = await analisarFornecedor(pool as any, tenant, idFornecedor, parametros(req, c?.prazoEntregaDias || 0));
    const atuais = new Map<number, number>(Object.entries(req.body?.quantidades || {}).map(([k, v]) => [Number(k), Math.max(0, Number(v) || 0)]));
    const limite = Math.min(365, Math.max(15, Number(req.body?.limiteCobertura) || 120));
    const r = completarPedidoMinimo(itens, atuais, minimo, limite);
    return res.json({
      quantidades: Object.fromEntries(r.quantidades), acrescentados: Object.fromEntries(r.acrescentados), total: r.total, falta: r.falta, pedidoMinimo: minimo,
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao completar o pedido.');
  }
};

/** PUT /api/compras/fornecedores/:id/condicoes { pedidoMinimo, prazoEntregaDias, contato, observacao } */
export const salvarCondicoes = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const minimo = Math.max(0, Number(req.body?.pedidoMinimo) || 0);
    const prazo = Math.min(365, Math.max(0, Math.floor(Number(req.body?.prazoEntregaDias) || 0)));
    await pool.execute(
      `INSERT INTO compras_fornecedores_condicoes (tenant_id, id_fornecedor, pedido_minimo, prazo_entrega_dias, contato_pedido, observacao)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE pedido_minimo = VALUES(pedido_minimo), prazo_entrega_dias = VALUES(prazo_entrega_dias),
         contato_pedido = VALUES(contato_pedido), observacao = VALUES(observacao)`,
      [tenant, Number(req.params.id), f4(minimo), prazo, String(req.body?.contato || '').trim().slice(0, 150) || null,
        String(req.body?.observacao || '').trim().slice(0, 255) || null]
    );
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao salvar as condições do fornecedor.');
  }
};

// ---------------------------------------------------------------- pedidos de compra / cotações

const carregarPedido = async (conn: Conn, tenant: number, id: number) => {
  const [[p]]: any = await conn.execute(
    `SELECT p.*, ${nomeFornecedor} AS fornecedor, DATE_FORMAT(p.validade_cotacao, '%Y-%m-%d') AS validade_txt,
            DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS criado_txt, DATE_FORMAT(p.cotado_em, '%Y-%m-%d') AS cotado_txt
     FROM compras_pedidos p LEFT JOIN pessoas_pj pj ON pj.id_cliente = p.id_fornecedor
     WHERE p.id_pedido = ? AND p.tenant_id = ?`, [id, tenant]
  );
  if (!p) return null;
  const [itens]: any = await conn.execute(
    `SELECT i.*, COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome_catalogo,
            COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku_catalogo
     FROM compras_pedidos_itens i
     LEFT JOIN itens_core ic ON ic.id_item = i.id_item
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = i.id_item AND cpd.tenant_id = i.tenant_id
     WHERE i.id_pedido = ? ORDER BY i.id_pedido_item`, [id]
  );
  const linhas = itens.map((i: any) => ({
    idPedidoItem: Number(i.id_pedido_item), idItem: i.id_item ? Number(i.id_item) : null, codigoFornecedor: i.codigo_fornecedor,
    nome: i.descricao, nomeCatalogo: i.nome_catalogo || i.descricao, skuCatalogo: i.sku_catalogo || '', unidadeCompra: i.unidade_compra || '', fatorCompra: n(i.fator_compra) || 1, quantidade: n(i.quantidade),
    precoEstimado: n(i.preco_estimado), precoCotado: i.preco_cotado !== null ? n(i.preco_cotado) : null, origem: i.origem,
  }));
  return {
    idPedido: Number(p.id_pedido), idFornecedor: Number(p.id_fornecedor), fornecedor: p.fornecedor, status: p.status,
    operador: p.operador, observacao: p.observacao || '', totalEstimado: n(p.total_estimado),
    totalCotado: p.total_cotado !== null ? n(p.total_cotado) : null, validadeCotacao: p.validade_txt, criadoEm: p.criado_txt, cotadoEm: p.cotado_txt,
    itens: linhas,
    texto: textoDoPedido(p.fornecedor || 'fornecedor', linhas.map((l: any) => ({ codigoFornecedor: l.codigoFornecedor, nome: l.nome, quantidade: l.quantidade, unidadeCompra: l.unidadeCompra })), p.observacao || ''),
  };
};

/**
 * POST /api/compras/pedidos { idFornecedor, observacao?, itens: [{ idItem, quantidade, origem? }] }
 * Grava o pedido (RASCUNHO) com código, unidade, fator e preço estimado do vínculo do fornecedor.
 */
export const criarPedido = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idFornecedor = Number(req.body?.idFornecedor);
  const itens = (Array.isArray(req.body?.itens) ? req.body.itens : []).filter((i: any) => Number(i?.quantidade) > 0);
  if (!idFornecedor) return res.status(400).json({ error: 'Informe o fornecedor.' });
  if (itens.length === 0) return res.status(400).json({ error: 'O pedido não tem itens com quantidade.' });
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const analise = await analisarFornecedor(connection, tenant, idFornecedor, { dias: 90, coberturaDias: 0, prazoEntregaDias: 0 });
    const porId = new Map(analise.map(a => [a.idItem, a]));
    const linhas = itens.map((i: any) => {
      const a = porId.get(Number(i.idItem));
      if (!a) throw new ErroCompra(`O item ${i.idItem} não tem vínculo com este fornecedor.`);
      return { a, quantidade: Number(i.quantidade), origem: ['SUGESTAO', 'COMPLETAR', 'MANUAL'].includes(i.origem) ? i.origem : 'MANUAL' };
    });
    const total = totalDoPedido(linhas.map((l: any) => ({ quantidade: l.quantidade, precoCompra: l.a.precoCompra })));
    const [cab]: any = await connection.execute(
      `INSERT INTO compras_pedidos (tenant_id, id_fornecedor, status, operador, observacao, total_estimado) VALUES (?, ?, 'RASCUNHO', ?, ?, ?)`,
      [tenant, idFornecedor, operadorDe(req), String(req.body?.observacao || '').trim().slice(0, 255) || null, f4(total)]
    );
    const idPedido = Number(cab.insertId);
    for (const l of linhas) {
      await connection.execute(
        `INSERT INTO compras_pedidos_itens (tenant_id, id_pedido, id_item, codigo_fornecedor, descricao, unidade_compra, fator_compra, quantidade, preco_estimado, origem)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenant, idPedido, l.a.idItem, l.a.codigoFornecedor, String(l.a.descricaoFornecedor || l.a.nome).slice(0, 255), String(l.a.unidadeCompra || '').slice(0, 10),
          Number(l.a.fatorCompra).toFixed(6), f4(l.quantidade), f4(l.a.precoCompra), l.origem]
      );
    }
    await connection.commit();
    return res.status(201).json(await carregarPedido(pool as any, tenant, idPedido));
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao gravar o pedido.');
  } finally {
    connection.release();
  }
};

/** GET /api/compras/pedidos?status=&idFornecedor= */
export const listarPedidos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const filtros = ['p.tenant_id = ?'];
    const params: any[] = [tenant];
    const status = String(req.query.status || '').toUpperCase();
    if (STATUS.includes(status as any)) { filtros.push('p.status = ?'); params.push(status); }
    if (Number(req.query.idFornecedor)) { filtros.push('p.id_fornecedor = ?'); params.push(Number(req.query.idFornecedor)); }
    const [rows]: any = await pool.execute(
      `SELECT p.id_pedido, p.id_fornecedor, ${nomeFornecedor} AS fornecedor, p.status, p.total_estimado, p.total_cotado,
              DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS criado, DATE_FORMAT(p.validade_cotacao, '%Y-%m-%d') AS validade,
              (SELECT COUNT(*) FROM compras_pedidos_itens i WHERE i.id_pedido = p.id_pedido) AS itens
       FROM compras_pedidos p LEFT JOIN pessoas_pj pj ON pj.id_cliente = p.id_fornecedor
       WHERE ${filtros.join(' AND ')} ORDER BY p.id_pedido DESC LIMIT 300`,
      params
    );
    return res.json(rows.map((r: any) => ({
      idPedido: Number(r.id_pedido), idFornecedor: Number(r.id_fornecedor), fornecedor: r.fornecedor, status: r.status,
      totalEstimado: n(r.total_estimado), totalCotado: r.total_cotado !== null ? n(r.total_cotado) : null,
      criadoEm: r.criado, validadeCotacao: r.validade, itens: Number(r.itens),
    })));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar os pedidos.');
  }
};

/** GET /api/compras/pedidos/:id */
export const detalhePedido = async (req: Request, res: Response) => {
  try {
    const p = await carregarPedido(pool as any, tenantDe(req), Number(req.params.id));
    if (!p) throw new ErroCompra('Pedido não encontrado.', 404);
    return res.json(p);
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar o pedido.');
  }
};

/** PUT /api/compras/pedidos/:id/status { status: ENVIADO | COMPRADO | CANCELADO | RASCUNHO } */
export const mudarStatusPedido = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const status = String(req.body?.status || '').toUpperCase();
  try {
    if (!['RASCUNHO', 'ENVIADO', 'COMPRADO', 'CANCELADO'].includes(status)) throw new ErroCompra('Situação inválida.');
    const [r]: any = await pool.execute(
      `UPDATE compras_pedidos SET status = ?, enviado_em = IF(? = 'ENVIADO' AND enviado_em IS NULL, NOW(), enviado_em) WHERE id_pedido = ? AND tenant_id = ?`,
      [status, status, Number(req.params.id), tenant]
    );
    if (!r.affectedRows) throw new ErroCompra('Pedido não encontrado.', 404);
    return res.json(await carregarPedido(pool as any, tenant, Number(req.params.id)));
  } catch (error) {
    return responderErro(res, error, 'Erro ao mudar a situação do pedido.');
  }
};

/**
 * PUT /api/compras/pedidos/:id/cotacao { itens: [{ idPedidoItem, precoCotado }], validade? (AAAA-MM-DD) }
 * Guarda os preços que o fornecedor respondeu: viram a referência de preço do item mesmo sem comprar.
 */
export const registrarCotacao = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const atual = await carregarPedido(connection, tenant, id);
    if (!atual) throw new ErroCompra('Pedido não encontrado.', 404);
    if (atual.status === 'CANCELADO') throw new ErroCompra('Pedido cancelado.', 409);
    const precos = new Map<number, number | null>((Array.isArray(req.body?.itens) ? req.body.itens : []).map((i: any) => [
      Number(i.idPedidoItem), i.precoCotado === null || i.precoCotado === '' || i.precoCotado === undefined ? null : Math.max(0, Number(i.precoCotado) || 0),
    ]));
    for (const l of atual.itens) {
      if (!precos.has(l.idPedidoItem)) continue;
      const preco = precos.get(l.idPedidoItem);
      await connection.execute(`UPDATE compras_pedidos_itens SET preco_cotado = ? WHERE id_pedido_item = ? AND id_pedido = ?`, [preco === null ? null : f4(preco!), l.idPedidoItem, id]);
    }
    const validade = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.validade || '')) ? String(req.body.validade) : null;
    await connection.execute(
      `UPDATE compras_pedidos p SET status = IF(p.status = 'COMPRADO', 'COMPRADO', 'COTADO'), cotado_em = NOW(), validade_cotacao = ?,
         total_cotado = (SELECT SUM(ROUND(i.quantidade * i.preco_cotado, 2)) FROM compras_pedidos_itens i WHERE i.id_pedido = p.id_pedido AND i.preco_cotado IS NOT NULL)
       WHERE p.id_pedido = ? AND p.tenant_id = ?`,
      [validade, id, tenant]
    );
    await connection.commit();
    return res.json(await carregarPedido(pool as any, tenant, id));
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao registrar a cotação.');
  } finally {
    connection.release();
  }
};

/** PUT /api/compras/itens/:idItem/fornecedor-principal { idFornecedor } — marca o fornecedor padrão (principal) do item */
export const definirFornecedorPrincipal = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const idItem = Number(req.params.idItem);
    const idFornecedor = Number(req.body?.idFornecedor);
    const [[existe]]: any = await pool.execute(
      `SELECT 1 FROM comercial_fornecedores_produtos WHERE tenant_id = ? AND id_item = ? AND id_fornecedor = ?`, [tenant, idItem, idFornecedor]
    );
    if (!existe) throw new ErroCompra('Este fornecedor não tem vínculo com o item.', 404);
    await pool.execute(
      `UPDATE comercial_fornecedores_produtos SET padrao = (id_fornecedor = ?) WHERE tenant_id = ? AND id_item = ?`, [idFornecedor, tenant, idItem]
    );
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao definir o fornecedor principal.');
  }
};

/** DELETE /api/compras/pedidos/:id — só rascunho */
export const excluirPedido = async (req: Request, res: Response) => {
  try {
    const [r]: any = await pool.execute(`DELETE FROM compras_pedidos WHERE id_pedido = ? AND tenant_id = ? AND status = 'RASCUNHO'`, [Number(req.params.id), tenantDe(req)]);
    if (!r.affectedRows) throw new ErroCompra('Só pedido em rascunho pode ser excluído (os outros podem ser cancelados).', 409);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao excluir o pedido.');
  }
};

/**
 * GET /api/compras/precos/:idItem — memória de preços do item: compras (notas de entrada) e cotações, por fornecedor.
 * Preço por unidade de compra e convertido para a unidade de estoque (para comparar fornecedores).
 */
export const historicoPrecos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idItem = Number(req.params.idItem);
  try {
    const [notas]: any = await pool.execute(
      `SELECT DATE_FORMAT(COALESCE(l.data_emissao, l.created_at), '%Y-%m-%d') AS data, l.numero_nf,
              COALESCE(pj.id_cliente, 0) AS id_fornecedor,
              COALESCE(${nomeFornecedor}, l.nome_fantasia_fornecedor, l.razao_social_fornecedor) AS fornecedor,
              s.unidade_original AS unidade, s.quantidade, COALESCE(NULLIF(s.custo_unitario_final, 0), s.preco_custo_unitario) AS preco,
              cfp.fator_compra
       FROM importacao_produtos_staging s
       INNER JOIN importacoes_lotes l ON l.id = s.lote_importacao_id AND l.status = 'IMPORTADO'
       LEFT JOIN pessoas_pj pj ON pj.cnpj = l.cnpj_fornecedor
       LEFT JOIN comercial_fornecedores_produtos cfp ON cfp.tenant_id = s.tenant_id AND cfp.id_item = s.produto_id_sistema AND cfp.id_fornecedor = pj.id_cliente
       WHERE s.tenant_id = ? AND s.produto_id_sistema = ?
       ORDER BY data DESC LIMIT 50`,
      [tenant, idItem]
    );
    const [cotacoes]: any = await pool.execute(
      `SELECT DATE_FORMAT(p.cotado_em, '%Y-%m-%d') AS data, p.id_pedido, p.id_fornecedor, ${nomeFornecedor} AS fornecedor, p.status,
              DATE_FORMAT(p.validade_cotacao, '%Y-%m-%d') AS validade, i.unidade_compra AS unidade, i.quantidade, i.preco_cotado AS preco, i.fator_compra
       FROM compras_pedidos_itens i
       INNER JOIN compras_pedidos p ON p.id_pedido = i.id_pedido
       LEFT JOIN pessoas_pj pj ON pj.id_cliente = p.id_fornecedor
       WHERE p.tenant_id = ? AND i.id_item = ? AND i.preco_cotado IS NOT NULL
       ORDER BY p.cotado_em DESC LIMIT 50`,
      [tenant, idItem]
    );
    const linha = (tipo: 'NOTA' | 'COTACAO') => (r: any) => {
      const fator = n(r.fator_compra) || 1;
      return {
        tipo, data: r.data, fornecedor: r.fornecedor || '—', idFornecedor: n(r.id_fornecedor) || null,
        documento: tipo === 'NOTA' ? `NF ${r.numero_nf || ''}`.trim() : `Pedido ${r.id_pedido}`,
        unidade: r.unidade || '', quantidade: n(r.quantidade), preco: n(r.preco),
        precoBase: Math.round((n(r.preco) / fator) * 10000) / 10000, validade: r.validade || null,
      };
    };
    const historico = [...notas.map(linha('NOTA')), ...cotacoes.map(linha('COTACAO'))]
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));
    return res.json({ idItem, historico });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar o histórico de preços.');
  }
};
