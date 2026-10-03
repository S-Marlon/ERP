// Contas a receber: parcelas da venda a prazo, crédito do cliente, recebimentos (entram no caixa) e estorno.
// Tabelas: financeiro_contas_receber, financeiro_contas_receber_baixas, financeiro_clientes_credito.
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { carregarCaixaAberto, operadorDe } from '../../Venda/caixa/caixa.controller';
import {
  aplicarBaixa, CreditoCliente, diasDeAtraso, ErroReceber, estornarBaixa, gerarParcelas, situacaoTitulo, validarCredito,
} from './receber';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);

const NOME_CLIENTE = `COALESCE(NULLIF(pf.nome, ''), NULLIF(pj.nome_fantasia, ''), pj.razao_social, CONCAT('Cliente ', c.id_pessoa))`;
const JOIN_CLIENTE = `LEFT JOIN pessoas_core c ON c.id_pessoa = t.id_cliente
       LEFT JOIN pessoas_pf pf ON pf.id_cliente = c.id_pessoa
       LEFT JOIN pessoas_pj pj ON pj.id_cliente = c.id_pessoa`;

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroReceber) return res.status(error.status).json({ error: error.message, detalhes: error.detalhes });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

// ---------------------------------------------------------------------------------------------
// Usado pela venda do PDV
// ---------------------------------------------------------------------------------------------
export const carregarCredito = async (conn: Conn, tenant: number, idCliente: number): Promise<CreditoCliente | null> => {
  const [[cr]]: any = await conn.execute(
    `SELECT limite_credito, bloqueado FROM financeiro_clientes_credito WHERE id_cliente = ? AND tenant_id = ?`, [idCliente, tenant]
  );
  return cr ? { limite: cr.limite_credito === null ? null : Number(cr.limite_credito), bloqueado: Boolean(Number(cr.bloqueado)) } : null;
};

export const saldoDevedor = async (conn: Conn, tenant: number, idCliente: number) => {
  const [[s]]: any = await conn.execute(
    `SELECT COALESCE(SUM(valor - valor_pago), 0) AS aberto,
            COALESCE(SUM(CASE WHEN vencimento < CURDATE() THEN valor - valor_pago END), 0) AS vencido,
            SUM(vencimento < CURDATE()) AS qtd_vencidas
     FROM financeiro_contas_receber WHERE tenant_id = ? AND id_cliente = ? AND status = 'ABERTO'`,
    [tenant, idCliente]
  );
  return { aberto: Number(s?.aberto) || 0, vencido: Number(s?.vencido) || 0, qtdVencidas: Number(s?.qtd_vencidas) || 0 };
};

export interface PrazoDaVenda { valor: number; parcelas?: number; intervaloDias?: number; primeiroVencimento?: string | null }

/** Venda a prazo: exige cliente, confere crédito e devolve as parcelas planejadas (gravadas depois da venda). */
export const planejarPrazo = async (conn: Conn, tenant: number, idCliente: number | null, nomeCliente: string, prazos: PrazoDaVenda[]) => {
  if (prazos.length === 0) return [];
  if (!idCliente) throw new ErroReceber('Venda a prazo precisa do cliente identificado (F4).', 400, { codigo: 'PRAZO_SEM_CLIENTE' });
  const total = prazos.reduce((a, p) => a + Number(p.valor), 0);
  validarCredito(await carregarCredito(conn, tenant, idCliente), (await saldoDevedor(conn, tenant, idCliente)).aberto, total, nomeCliente || 'O cliente');
  return prazos.flatMap(p => gerarParcelas(Number(p.valor), p.parcelas ?? 1, new Date(), p.intervaloDias ?? 30, p.primeiroVencimento || null));
};

export const gravarTitulosDaVenda = async (
  conn: Conn, tenant: number, idVenda: number, idCliente: number, parcelas: ReturnType<typeof gerarParcelas>, operador: string
) => {
  for (const p of parcelas) {
    await conn.execute(
      `INSERT INTO financeiro_contas_receber
         (tenant_id, id_cliente, id_venda, parcela, total_parcelas, descricao, vencimento, valor, operador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, idCliente, idVenda, p.parcela, p.totalParcelas, `Venda ${idVenda} - parcela ${p.parcela}/${p.totalParcelas}`, p.vencimento, f4(p.valor), operador]
    );
  }
};

/** Cancelamento da venda: parcelas sem recebimento são canceladas; com recebimento, pede o estorno antes. */
export const cancelarTitulosDaVenda = async (conn: Conn, tenant: number, idVenda: number) => {
  const [[pago]]: any = await conn.execute(
    `SELECT COUNT(*) AS n FROM financeiro_contas_receber_baixas b
     INNER JOIN financeiro_contas_receber t ON t.id_titulo = b.id_titulo
     WHERE t.tenant_id = ? AND t.id_venda = ? AND b.estornado_em IS NULL`,
    [tenant, idVenda]
  );
  if (Number(pago?.n) > 0) {
    throw new ErroReceber('Esta venda tem parcelas com recebimento: estorne os recebimentos em Financeiro › Contas a Receber antes de cancelar.', 409);
  }
  await conn.execute(
    `UPDATE financeiro_contas_receber SET status = 'CANCELADO' WHERE tenant_id = ? AND id_venda = ? AND status = 'ABERTO'`,
    [tenant, idVenda]
  );
};

// ---------------------------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------------------------
const formatarTitulo = (t: any, hoje: Date) => ({
  idTitulo: Number(t.id_titulo),
  idCliente: Number(t.id_cliente),
  cliente: t.cliente,
  idVenda: t.id_venda ? Number(t.id_venda) : null,
  parcela: Number(t.parcela),
  totalParcelas: Number(t.total_parcelas),
  descricao: t.descricao,
  vencimento: String(t.vencimento_txt),
  valor: Number(t.valor),
  valorPago: Number(t.valor_pago),
  saldo: Number((Number(t.valor) - Number(t.valor_pago)).toFixed(2)),
  status: t.status,
  situacao: situacaoTitulo(t.status, String(t.vencimento_txt), hoje),
  diasAtraso: t.status === 'ABERTO' ? diasDeAtraso(String(t.vencimento_txt), hoje) : 0,
  criadoEm: t.created_at,
});

const SELECT_TITULO = `SELECT t.*, DATE_FORMAT(t.vencimento, '%Y-%m-%d') AS vencimento_txt, ${NOME_CLIENTE} AS cliente
       FROM financeiro_contas_receber t
       ${JOIN_CLIENTE}`;

/** GET /api/financeiro/receber?situacao=ABERTO|VENCIDO|A_VENCER|PAGO|CANCELADO|TODOS&busca=&idCliente= */
export const listarTitulos = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const situacao = String(req.query.situacao || 'ABERTO').toUpperCase();
    const filtros: string[] = ['t.tenant_id = ?'];
    const params: any[] = [tenant];
    if (situacao === 'ABERTO') filtros.push(`t.status = 'ABERTO'`);
    else if (situacao === 'VENCIDO') filtros.push(`t.status = 'ABERTO' AND t.vencimento < CURDATE()`);
    else if (situacao === 'A_VENCER') filtros.push(`t.status = 'ABERTO' AND t.vencimento >= CURDATE()`);
    else if (situacao === 'PAGO' || situacao === 'CANCELADO') { filtros.push('t.status = ?'); params.push(situacao); }
    if (Number(req.query.idCliente) > 0) { filtros.push('t.id_cliente = ?'); params.push(Number(req.query.idCliente)); }
    const busca = String(req.query.busca || '').trim();
    if (busca) {
      filtros.push(`(${NOME_CLIENTE} LIKE ? OR t.descricao LIKE ? OR t.id_venda = ?)`);
      params.push(`%${busca}%`, `%${busca}%`, Number(busca) || 0);
    }
    const [rows]: any = await pool.execute(
      `${SELECT_TITULO} WHERE ${filtros.join(' AND ')} ORDER BY t.status = 'ABERTO' DESC, t.vencimento, t.id_titulo LIMIT 500`, params
    );
    const hoje = new Date();
    return res.json(rows.map((t: any) => formatarTitulo(t, hoje)));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar as contas a receber.');
  }
};

/** GET /api/financeiro/receber/resumo */
export const resumoReceber = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const [[r]]: any = await pool.execute(
      `SELECT COALESCE(SUM(CASE WHEN status = 'ABERTO' THEN valor - valor_pago END), 0) AS em_aberto,
              COALESCE(SUM(CASE WHEN status = 'ABERTO' AND vencimento < CURDATE() THEN valor - valor_pago END), 0) AS vencido,
              SUM(status = 'ABERTO' AND vencimento < CURDATE()) AS qtd_vencidos,
              COALESCE(SUM(CASE WHEN status = 'ABERTO' AND vencimento = CURDATE() THEN valor - valor_pago END), 0) AS vence_hoje,
              COALESCE(SUM(CASE WHEN status = 'ABERTO' AND vencimento > CURDATE() AND vencimento <= CURDATE() + INTERVAL 7 DAY THEN valor - valor_pago END), 0) AS proximos_7
       FROM financeiro_contas_receber WHERE tenant_id = ?`,
      [tenant]
    );
    const [[m]]: any = await pool.execute(
      `SELECT COALESCE(SUM(valor), 0) AS recebido FROM financeiro_contas_receber_baixas
       WHERE tenant_id = ? AND estornado_em IS NULL AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
      [tenant]
    );
    return res.json({
      emAberto: Number(r?.em_aberto) || 0, vencido: Number(r?.vencido) || 0, qtdVencidos: Number(r?.qtd_vencidos) || 0,
      venceHoje: Number(r?.vence_hoje) || 0, proximos7: Number(r?.proximos_7) || 0, recebidoMes: Number(m?.recebido) || 0,
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar o resumo.');
  }
};

/** GET /api/financeiro/receber/clientes/:idCliente — dívida, crédito e parcelas em aberto (PDV e financeiro) */
export const situacaoCliente = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const idCliente = Number(req.params.idCliente);
    const credito = await carregarCredito(pool as any, tenant, idCliente);
    const saldo = await saldoDevedor(pool as any, tenant, idCliente);
    const [abertos]: any = await pool.execute(
      `${SELECT_TITULO} WHERE t.tenant_id = ? AND t.id_cliente = ? AND t.status = 'ABERTO' ORDER BY t.vencimento LIMIT 100`, [tenant, idCliente]
    );
    const [[obs]]: any = await pool.execute(
      `SELECT observacao FROM financeiro_clientes_credito WHERE id_cliente = ? AND tenant_id = ?`, [idCliente, tenant]
    );
    const hoje = new Date();
    return res.json({
      idCliente,
      limite: credito?.limite ?? null,
      bloqueado: credito?.bloqueado ?? false,
      observacao: obs?.observacao ?? null,
      emAberto: saldo.aberto,
      vencido: saldo.vencido,
      qtdVencidas: saldo.qtdVencidas,
      disponivel: credito?.limite === null || credito?.limite === undefined ? null : Number(Math.max(0, credito.limite - saldo.aberto).toFixed(2)),
      titulos: abertos.map((t: any) => formatarTitulo(t, hoje)),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar a situação do cliente.');
  }
};

/** PUT /api/financeiro/receber/clientes/:idCliente/credito { limite (null = sem limite), bloqueado, observacao } */
export const salvarCredito = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const idCliente = Number(req.params.idCliente);
    const limiteBruto = req.body?.limite;
    const limite = limiteBruto === null || limiteBruto === undefined || limiteBruto === '' ? null : Number(limiteBruto);
    if (limite !== null && (!Number.isFinite(limite) || limite < 0)) throw new ErroReceber('Limite de crédito inválido.');
    const [[existe]]: any = await pool.execute(`SELECT id_pessoa FROM pessoas_core WHERE id_pessoa = ? AND tenant_id = ?`, [idCliente, tenant]);
    if (!existe) throw new ErroReceber('Cliente não encontrado.', 404);
    await pool.execute(
      `INSERT INTO financeiro_clientes_credito (id_cliente, tenant_id, limite_credito, bloqueado, observacao) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE limite_credito = VALUES(limite_credito), bloqueado = VALUES(bloqueado), observacao = VALUES(observacao)`,
      [idCliente, tenant, limite === null ? null : f4(limite), req.body?.bloqueado ? 1 : 0, String(req.body?.observacao || '').trim().slice(0, 255) || null]
    );
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao salvar o crédito do cliente.');
  }
};

/** GET /api/financeiro/receber/:idTitulo/baixas */
export const listarBaixas = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const [rows]: any = await pool.execute(
      `SELECT * FROM financeiro_contas_receber_baixas WHERE id_titulo = ? AND tenant_id = ? ORDER BY id_baixa`, [Number(req.params.idTitulo), tenant]
    );
    return res.json(rows.map((b: any) => ({
      idBaixa: Number(b.id_baixa), forma: b.forma, valor: Number(b.valor), idCaixa: b.id_caixa ? Number(b.id_caixa) : null,
      observacao: b.observacao, operador: b.operador, estornadoEm: b.estornado_em, criadoEm: b.created_at,
    })));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar os recebimentos.');
  }
};

/** POST /api/financeiro/receber/:idTitulo/baixas { forma, valor, observacao, operador } — o valor entra no caixa aberto */
export const receberTitulo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const caixa = await carregarCaixaAberto(connection, tenant, 'LOCK IN SHARE MODE');
    if (!caixa) throw new ErroReceber('Abra o caixa para receber (o valor entra no caixa do dia).', 409, { codigo: 'CAIXA_FECHADO' });
    const [[t]]: any = await connection.execute(
      `SELECT * FROM financeiro_contas_receber WHERE id_titulo = ? AND tenant_id = ? FOR UPDATE`, [Number(req.params.idTitulo), tenant]
    );
    if (!t) throw new ErroReceber('Parcela não encontrada.', 404);
    const baixa = aplicarBaixa(Number(t.valor), Number(t.valor_pago), Number(req.body?.valor), req.body?.forma, t.status);
    const operador = operadorDe(req);
    const [ins]: any = await connection.execute(
      `INSERT INTO financeiro_contas_receber_baixas (tenant_id, id_titulo, forma, valor, id_caixa, observacao, operador)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tenant, t.id_titulo, baixa.forma, f4(baixa.valor), caixa.id_caixa, String(req.body?.observacao || '').trim().slice(0, 255) || null, operador]
    );
    await connection.execute(
      `UPDATE financeiro_contas_receber SET valor_pago = ?, status = ? WHERE id_titulo = ?`, [f4(baixa.valorPago), baixa.status, t.id_titulo]
    );
    await connection.execute(
      `INSERT INTO vendas_caixas_movimentos (tenant_id, id_caixa, tipo, forma, valor, id_origem, motivo, operador)
       VALUES (?, ?, 'RECEBIMENTO', ?, ?, ?, ?, ?)`,
      [tenant, caixa.id_caixa, baixa.forma, f4(baixa.valor), t.id_titulo, `${t.descricao || `Parcela ${t.id_titulo}`}`.slice(0, 255), operador]
    );
    await connection.commit();
    return res.status(201).json({ success: true, idBaixa: Number(ins.insertId), status: baixa.status, valorPago: baixa.valorPago });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao registrar o recebimento.');
  } finally {
    connection.release();
  }
};

/** POST /api/financeiro/receber/baixas/:idBaixa/estornar { motivo } — o valor sai do caixa aberto e a parcela reabre */
export const estornarRecebimento = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return res.status(400).json({ error: 'Informe o motivo do estorno.' });
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const caixa = await carregarCaixaAberto(connection, tenant, 'LOCK IN SHARE MODE');
    if (!caixa) throw new ErroReceber('Abra o caixa para estornar (o valor sai do caixa do dia).', 409, { codigo: 'CAIXA_FECHADO' });
    const [[b]]: any = await connection.execute(
      `SELECT * FROM financeiro_contas_receber_baixas WHERE id_baixa = ? AND tenant_id = ? FOR UPDATE`, [Number(req.params.idBaixa), tenant]
    );
    if (!b) throw new ErroReceber('Recebimento não encontrado.', 404);
    if (b.estornado_em) throw new ErroReceber('Recebimento já estornado.', 409);
    const [[t]]: any = await connection.execute(`SELECT * FROM financeiro_contas_receber WHERE id_titulo = ? FOR UPDATE`, [b.id_titulo]);
    if (t.status === 'CANCELADO') throw new ErroReceber('A parcela está cancelada.', 409);
    const novo = estornarBaixa(Number(t.valor), Number(t.valor_pago), Number(b.valor));
    const operador = operadorDe(req);
    await connection.execute(`UPDATE financeiro_contas_receber_baixas SET estornado_em = NOW() WHERE id_baixa = ?`, [b.id_baixa]);
    await connection.execute(`UPDATE financeiro_contas_receber SET valor_pago = ?, status = ? WHERE id_titulo = ?`, [f4(novo.valorPago), novo.status, t.id_titulo]);
    await connection.execute(
      `INSERT INTO vendas_caixas_movimentos (tenant_id, id_caixa, tipo, forma, valor, id_origem, motivo, operador)
       VALUES (?, ?, 'ESTORNO_RECEBIMENTO', ?, ?, ?, ?, ?)`,
      [tenant, caixa.id_caixa, b.forma, f4(Number(b.valor)), t.id_titulo, `Estorno: ${motivo}`.slice(0, 255), operador]
    );
    await connection.commit();
    return res.json({ success: true, status: novo.status, valorPago: novo.valorPago });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao estornar o recebimento.');
  } finally {
    connection.release();
  }
};
