// Contas fixas (financeiro_contas_recorrentes): cadastro, pausa e encerramento, e a geração dos títulos do mês atual e
// dos próximos no contas a pagar. A chave única (id_recorrente, competencia) impede gerar o mesmo mês duas vezes.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../vendas/caixa/caixa.controller';
import { ErroPagar } from './pagar';
import { validarContaFixa } from './contasLoja';
import { Periodicidade, titulosQueFaltam } from './recorrencia';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);
const HORIZONTE_MESES = 2;   // gera o mês atual e os 2 seguintes
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloCompetencia = (c: string) => `${MESES[Number(c.slice(5, 7)) - 1]}/${c.slice(2, 4)}`;

const NOME_FORNECEDOR = `COALESCE(NULLIF(pj.nome_fantasia, ''), NULLIF(pj.razao_social, ''), NULLIF(pf.nome, ''))`;

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroPagar) return res.status(error.status).json({ error: error.message });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

/**
 * Lança no contas a pagar os meses que faltam de cada conta fixa ativa (do mês atual ao horizonte). Chamado ao abrir o
 * contas a pagar, o painel e ao salvar uma conta fixa; INSERT IGNORE porque duas telas podem gerar ao mesmo tempo.
 */
export const gerarTitulosRecorrentes = async (conn: any, tenant: number, idRecorrente?: number) => {
  const [contas]: any = await conn.execute(
    `SELECT *, DATE_FORMAT(inicio, '%Y-%m-%d') AS inicio_txt, DATE_FORMAT(fim, '%Y-%m-%d') AS fim_txt
     FROM financeiro_contas_recorrentes WHERE tenant_id = ? AND status = 'ATIVA' ${idRecorrente ? 'AND id_recorrente = ?' : ''}`,
    idRecorrente ? [tenant, idRecorrente] : [tenant]
  );
  if (!contas.length) return 0;
  const [[{ hoje }]]: any = await conn.query(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoje`);
  const [existentes]: any = await conn.execute(
    `SELECT id_recorrente, DATE_FORMAT(competencia, '%Y-%m-%d') AS competencia FROM financeiro_contas_pagar
     WHERE tenant_id = ? AND id_recorrente IN (${contas.map(() => '?').join(',')})`,
    [tenant, ...contas.map((c: any) => c.id_recorrente)]
  );
  let gerados = 0;
  for (const c of contas) {
    const faltam = titulosQueFaltam(
      { inicio: c.inicio_txt, fim: c.fim_txt || null, periodicidade: c.periodicidade as Periodicidade, diaVencimento: Number(c.dia_vencimento) },
      { hoje, horizonteMeses: HORIZONTE_MESES, existentes: existentes.filter((e: any) => Number(e.id_recorrente) === Number(c.id_recorrente)).map((e: any) => e.competencia) }
    );
    for (const t of faltam) {
      const [r]: any = await conn.execute(
        `INSERT IGNORE INTO financeiro_contas_pagar (tenant_id, id_fornecedor, favorecido, id_categoria, id_recorrente, competencia, parcela, total_parcelas,
           descricao, vencimento, valor, valor_estimado, forma_pagamento, operador)
         VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?)`,
        [tenant, c.id_fornecedor, c.favorecido, c.id_categoria, c.id_recorrente, t.competencia,
          `${c.descricao} - ${rotuloCompetencia(t.competencia)}`.slice(0, 150), t.vencimento, f4(Number(c.valor)), Number(c.valor_variavel) ? 1 : 0,
          c.forma_pagamento, 'AUTOMATICO']
      );
      gerados += Number(r.affectedRows) || 0;
    }
  }
  return gerados;
};

/**
 * Tira os títulos futuros que a conta fixa gerou e ninguém mexeu (sem pagamento, sem ajuste, sem linha digitável), para
 * a conta ser pausada, encerrada ou regerada com os dados novos. O mês atual fica: pode já estar em uso.
 */
const tirarFuturosIntocados = (conn: any, tenant: number, idRecorrente: number) =>
  conn.execute(
    `DELETE FROM financeiro_contas_pagar
     WHERE tenant_id = ? AND id_recorrente = ? AND status = 'ABERTO' AND valor_pago = 0 AND codigo_barras IS NULL AND updated_at IS NULL
       AND competencia > DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
    [tenant, idRecorrente]
  );

const formatar = (r: any) => ({
  idRecorrente: Number(r.id_recorrente), descricao: r.descricao, idCategoria: r.id_categoria ? Number(r.id_categoria) : null,
  categoria: r.categoria || null, grupo: r.grupo || null, idFornecedor: r.id_fornecedor ? Number(r.id_fornecedor) : null,
  favorecido: r.favorecido || null, quemRecebe: r.favorecido || r.fornecedor || null, valor: Number(r.valor), valorVariavel: !!Number(r.valor_variavel),
  diaVencimento: Number(r.dia_vencimento), periodicidade: r.periodicidade, inicio: r.inicio_txt, fim: r.fim_txt || null,
  forma: r.forma_pagamento, status: r.status, observacao: r.observacao || null,
  proximo: r.proximo_venc ? { vencimento: r.proximo_venc, valor: Number(r.proximo_valor), estimado: !!Number(r.proximo_estimado) } : null,
  pagoNoAno: Number(r.pago_ano) || 0,
});

// GET /api/financeiro/pagar/fixas
export const listarRecorrentes = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    await gerarTitulosRecorrentes(pool, tenant);
    const [rows]: any = await pool.execute(
      `SELECT r.*, DATE_FORMAT(r.inicio, '%Y-%m-%d') AS inicio_txt, DATE_FORMAT(r.fim, '%Y-%m-%d') AS fim_txt,
              cat.nome AS categoria, cat.grupo, ${NOME_FORNECEDOR} AS fornecedor,
              (SELECT DATE_FORMAT(MIN(t.vencimento), '%Y-%m-%d') FROM financeiro_contas_pagar t
                WHERE t.id_recorrente = r.id_recorrente AND t.status = 'ABERTO') AS proximo_venc,
              (SELECT t.valor - t.valor_pago FROM financeiro_contas_pagar t
                WHERE t.id_recorrente = r.id_recorrente AND t.status = 'ABERTO' ORDER BY t.vencimento LIMIT 1) AS proximo_valor,
              (SELECT t.valor_estimado FROM financeiro_contas_pagar t
                WHERE t.id_recorrente = r.id_recorrente AND t.status = 'ABERTO' ORDER BY t.vencimento LIMIT 1) AS proximo_estimado,
              (SELECT COALESCE(SUM(t.valor_pago), 0) FROM financeiro_contas_pagar t
                WHERE t.id_recorrente = r.id_recorrente AND t.status = 'PAGO' AND t.pago_em >= DATE_FORMAT(CURDATE(), '%Y-01-01')) AS pago_ano
       FROM financeiro_contas_recorrentes r
       LEFT JOIN financeiro_categorias cat ON cat.id_categoria = r.id_categoria
       LEFT JOIN pessoas_core c ON c.id_pessoa = r.id_fornecedor
       LEFT JOIN pessoas_pf pf ON pf.id_cliente = c.id_pessoa
       LEFT JOIN pessoas_pj pj ON pj.id_cliente = c.id_pessoa
       WHERE r.tenant_id = ?
       ORDER BY r.status = 'ENCERRADA', r.status = 'PAUSADA', r.dia_vencimento, r.descricao`,
      [tenant]
    );
    return res.json(rows.map(formatar));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar as contas fixas.');
  }
};

// POST /api/financeiro/pagar/fixas
export const criarRecorrente = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const c = validarContaFixa(req.body);
    const [ins]: any = await pool.execute(
      `INSERT INTO financeiro_contas_recorrentes (tenant_id, descricao, id_categoria, id_fornecedor, favorecido, valor, valor_variavel,
         dia_vencimento, periodicidade, inicio, fim, forma_pagamento, observacao, operador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, c.descricao, c.idCategoria, c.idFornecedor, c.favorecido, f4(c.valor), c.valorVariavel ? 1 : 0,
        c.diaVencimento, c.periodicidade, c.inicio, c.fim, c.forma, c.observacao, operadorDe(req)]
    );
    const gerados = await gerarTitulosRecorrentes(pool, tenant, Number(ins.insertId));
    return res.status(201).json({ idRecorrente: Number(ins.insertId), gerados });
  } catch (error) {
    return responderErro(res, error, 'Erro ao cadastrar a conta fixa.');
  }
};

// PUT /api/financeiro/pagar/fixas/:id — os meses futuros ainda não mexidos saem com os dados novos
export const salvarRecorrente = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  const conn: any = await pool.getConnection();
  try {
    const c = validarContaFixa(req.body);
    await conn.beginTransaction();
    const [r]: any = await conn.execute(
      `UPDATE financeiro_contas_recorrentes SET descricao = ?, id_categoria = ?, id_fornecedor = ?, favorecido = ?, valor = ?, valor_variavel = ?,
         dia_vencimento = ?, periodicidade = ?, inicio = ?, fim = ?, forma_pagamento = ?, observacao = ?, operador = ?
       WHERE id_recorrente = ? AND tenant_id = ?`,
      [c.descricao, c.idCategoria, c.idFornecedor, c.favorecido, f4(c.valor), c.valorVariavel ? 1 : 0, c.diaVencimento, c.periodicidade,
        c.inicio, c.fim, c.forma, c.observacao, operadorDe(req), id, tenant]
    );
    if (!r.affectedRows) throw new ErroPagar('Conta fixa não encontrada.', 404);
    await tirarFuturosIntocados(conn, tenant, id);
    const gerados = await gerarTitulosRecorrentes(conn, tenant, id);
    await conn.commit();
    return res.json({ success: true, gerados });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao salvar a conta fixa.');
  } finally {
    conn.release();
  }
};

// POST /api/financeiro/pagar/fixas/:id/status { status: ATIVA | PAUSADA | ENCERRADA }
export const mudarStatusRecorrente = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  const status = String(req.body?.status || '').toUpperCase();
  const conn: any = await pool.getConnection();
  try {
    if (!['ATIVA', 'PAUSADA', 'ENCERRADA'].includes(status)) throw new ErroPagar('Situação inválida.');
    await conn.beginTransaction();
    const [r]: any = await conn.execute(
      `UPDATE financeiro_contas_recorrentes SET status = ?, operador = ? WHERE id_recorrente = ? AND tenant_id = ?`, [status, operadorDe(req), id, tenant]
    );
    if (!r.affectedRows) throw new ErroPagar('Conta fixa não encontrada.', 404);
    if (status === 'ATIVA') await gerarTitulosRecorrentes(conn, tenant, id);
    else await tirarFuturosIntocados(conn, tenant, id);
    await conn.commit();
    return res.json({ success: true });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao mudar a situação da conta fixa.');
  } finally {
    conn.release();
  }
};
