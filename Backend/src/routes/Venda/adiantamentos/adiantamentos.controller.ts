// Adiantamentos (sinais) de clientes: o valor entra no caixa ao receber e depois paga a venda
// (forma ADIANTAMENTO). Saldo não usado pode ser devolvido pelo caixa. Origem livre (ex.: OS de um módulo).
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { carregarCaixaAberto, operadorDe } from '../caixa/caixa.controller';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);
const FORMAS = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'TRANSFERENCIA'];

class ErroAdiantamento extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroAdiantamento) return res.status(error.status).json({ error: error.message });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

const formatar = (a: any) => ({
  idAdiantamento: Number(a.id_adiantamento), idCliente: a.id_cliente ? Number(a.id_cliente) : null, cliente: a.cliente_nome,
  valor: Number(a.valor), valorUsado: Number(a.valor_usado), saldo: Number((Number(a.valor) - Number(a.valor_usado)).toFixed(2)),
  status: a.status, forma: a.forma, idCaixa: a.id_caixa ? Number(a.id_caixa) : null, origem: a.origem,
  idOrigem: a.id_origem ? Number(a.id_origem) : null, operador: a.operador, observacao: a.observacao, criadoEm: a.created_at,
});

/**
 * Registra um adiantamento dentro de uma transação já aberta (usado pela rota e por módulos, ex.: sinal da OS).
 * Exige caixa aberto: o valor entra no caixa como ADIANTAMENTO.
 */
export const registrarAdiantamento = async (conn: any, tenant: number, dados: {
  idCliente?: number | null; clienteNome?: string; valor: number; forma: string; observacao?: string;
  origem?: string | null; idOrigem?: number | null; operador: string;
}) => {
  const forma = String(dados.forma || '').toUpperCase();
  if (!FORMAS.includes(forma)) throw new ErroAdiantamento(`Forma inválida: ${dados.forma}.`);
  const valor = Number(dados.valor);
  if (!(valor > 0)) throw new ErroAdiantamento('Informe um valor maior que zero.');
  const caixa = await carregarCaixaAberto(conn, tenant, 'LOCK IN SHARE MODE');
  if (!caixa) throw new ErroAdiantamento('Abra o caixa para receber o adiantamento (o valor entra no caixa do dia).', 409);
  const [ins]: any = await conn.execute(
    `INSERT INTO vendas_adiantamentos (tenant_id, id_cliente, cliente_nome, valor, forma, id_caixa, origem, id_origem, operador, observacao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenant, dados.idCliente || null, String(dados.clienteNome || '').trim().slice(0, 150) || 'CONSUMIDOR', f4(valor), forma,
      caixa.id_caixa, dados.origem || null, dados.idOrigem || null, dados.operador, String(dados.observacao || '').trim().slice(0, 255) || null]
  );
  const id = Number(ins.insertId);
  await conn.execute(
    `INSERT INTO vendas_caixas_movimentos (tenant_id, id_caixa, tipo, forma, valor, id_origem, motivo, operador)
     VALUES (?, ?, 'ADIANTAMENTO', ?, ?, ?, ?, ?)`,
    [tenant, caixa.id_caixa, forma, f4(valor), id, `Adiantamento ${id}${dados.clienteNome ? ` · ${dados.clienteNome}` : ''}`.slice(0, 255), dados.operador]
  );
  return id;
};

/**
 * Crédito na loja (ex.: devolução com reembolso em crédito): fica como adiantamento ABERTO do cliente, sem
 * passar pelo caixa (não entrou dinheiro). Usado depois como forma de pagamento "Sinal/Crédito".
 */
export const registrarCreditoLoja = async (conn: any, tenant: number, dados: {
  idCliente?: number | null; clienteNome?: string; valor: number; origem: string; idOrigem: number; observacao?: string; operador: string;
}) => {
  const valor = Number(dados.valor);
  if (!(valor > 0)) throw new ErroAdiantamento('Crédito sem valor.');
  const [ins]: any = await conn.execute(
    `INSERT INTO vendas_adiantamentos (tenant_id, id_cliente, cliente_nome, valor, forma, id_caixa, origem, id_origem, operador, observacao)
     VALUES (?, ?, ?, ?, 'CREDITO_LOJA', NULL, ?, ?, ?, ?)`,
    [tenant, dados.idCliente || null, String(dados.clienteNome || '').trim().slice(0, 150) || 'CONSUMIDOR', f4(valor),
      dados.origem, dados.idOrigem, dados.operador, String(dados.observacao || '').trim().slice(0, 255) || null]
  );
  return Number(ins.insertId);
};

/** Devolve o saldo de um adiantamento (sai do caixa aberto). Usado pela rota e por módulos (cancelar OS). */
export const devolverAdiantamento = async (conn: any, tenant: number, idAdiantamento: number, motivo: string, operador: string) => {
  const [[a]]: any = await conn.execute(`SELECT * FROM vendas_adiantamentos WHERE id_adiantamento = ? AND tenant_id = ? FOR UPDATE`, [idAdiantamento, tenant]);
  if (!a) throw new ErroAdiantamento('Adiantamento não encontrado.', 404);
  if (a.status !== 'ABERTO') throw new ErroAdiantamento(`Adiantamento ${String(a.status).toLowerCase()}: nada a devolver.`, 409);
  const saldo = Number(a.valor) - Number(a.valor_usado);
  if (!(saldo > 0.004)) throw new ErroAdiantamento('Adiantamento sem saldo.', 409);
  if (a.forma === 'CREDITO_LOJA') throw new ErroAdiantamento('Crédito na loja não é devolvido em dinheiro: use-o numa compra.', 409);
  const caixa = await carregarCaixaAberto(conn, tenant, 'LOCK IN SHARE MODE');
  if (!caixa) throw new ErroAdiantamento('Abra o caixa para devolver (o valor sai do caixa do dia).', 409);
  await conn.execute(`UPDATE vendas_adiantamentos SET status = 'DEVOLVIDO' WHERE id_adiantamento = ?`, [idAdiantamento]);
  await conn.execute(
    `INSERT INTO vendas_caixas_movimentos (tenant_id, id_caixa, tipo, forma, valor, id_origem, motivo, operador)
     VALUES (?, ?, 'DEVOLUCAO_SINAL', ?, ?, ?, ?, ?)`,
    [tenant, caixa.id_caixa, a.forma, f4(saldo), idAdiantamento, `Devolução do adiantamento ${idAdiantamento}: ${motivo}`.slice(0, 255), operador]
  );
  return Number(saldo.toFixed(2));
};

/** POST /api/vendas/adiantamentos { idCliente?, clienteNome?, valor, forma, observacao?, origem?, idOrigem? } */
export const criarAdiantamento = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const id = await registrarAdiantamento(connection, tenant, {
      idCliente: Number(req.body?.idCliente) || null, clienteNome: req.body?.clienteNome, valor: Number(req.body?.valor),
      forma: req.body?.forma, observacao: req.body?.observacao, origem: req.body?.origem || null, idOrigem: Number(req.body?.idOrigem) || null,
      operador: operadorDe(req),
    });
    await connection.commit();
    return res.status(201).json({ success: true, idAdiantamento: id });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao registrar o adiantamento.');
  } finally {
    connection.release();
  }
};

/** GET /api/vendas/adiantamentos?idCliente=&status=ABERTO|USADO|DEVOLVIDO|TODOS&origem=&idOrigem= */
export const listarAdiantamentos = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const filtros = ['tenant_id = ?'];
    const params: any[] = [tenant];
    const status = String(req.query.status || 'ABERTO').toUpperCase();
    if (status !== 'TODOS') { filtros.push('status = ?'); params.push(status); }
    if (Number(req.query.idCliente) > 0) { filtros.push('id_cliente = ?'); params.push(Number(req.query.idCliente)); }
    if (req.query.origem) { filtros.push('origem = ?'); params.push(String(req.query.origem)); }
    if (Number(req.query.idOrigem) > 0) { filtros.push('id_origem = ?'); params.push(Number(req.query.idOrigem)); }
    const [rows]: any = await pool.execute(
      `SELECT * FROM vendas_adiantamentos WHERE ${filtros.join(' AND ')} ORDER BY id_adiantamento DESC LIMIT 200`, params
    );
    return res.json(rows.map(formatar));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar os adiantamentos.');
  }
};

/** POST /api/vendas/adiantamentos/:id/devolver { motivo } */
export const devolverAdiantamentoRota = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return res.status(400).json({ error: 'Informe o motivo da devolução.' });
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const valor = await devolverAdiantamento(connection, tenant, Number(req.params.id), motivo, operadorDe(req));
    await connection.commit();
    return res.json({ success: true, valorDevolvido: valor });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao devolver o adiantamento.');
  } finally {
    connection.release();
  }
};
