// Contas a pagar: boletos/duplicatas das notas de entrada (lançar, dispensar, desfazer) e a lista de títulos
// (pagar, reabrir, ajustar). Tabela financeiro_contas_pagar; situação da nota em importacoes_lotes.financeiro_*.
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { operadorDe } from '../../Venda/caixa/caixa.controller';
import { buscarFornecedorId } from '../../Compras/controllers/stagingLoteController';
import { cobrancaDoXml, dataValidaPagamento, ErroPagar, FORMAS_PAGAMENTO, validarParcelas } from './pagar';
import { situacaoCobrancaDoLote, titulosAtivosDoLote } from './cobrancaLote';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);

const NOME_FORNECEDOR = `COALESCE(NULLIF(pj.nome_fantasia, ''), NULLIF(pj.razao_social, ''), NULLIF(pf.nome, ''), CONCAT('Fornecedor ', c.id_pessoa))`;
const JOIN_FORNECEDOR = `LEFT JOIN pessoas_core c ON c.id_pessoa = t.id_fornecedor
       LEFT JOIN pessoas_pf pf ON pf.id_cliente = c.id_pessoa
       LEFT JOIN pessoas_pj pj ON pj.id_cliente = c.id_pessoa`;

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroPagar) return res.status(error.status).json({ error: error.message });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

const formatarTitulo = (t: any) => ({
  idTitulo: Number(t.id_titulo), idFornecedor: Number(t.id_fornecedor), fornecedor: t.fornecedor ?? null,
  idLote: t.id_lote ? Number(t.id_lote) : null, numeroNf: t.numero_nf ?? null,
  numeroDocumento: t.numero_documento, parcela: Number(t.parcela), totalParcelas: Number(t.total_parcelas), descricao: t.descricao,
  vencimento: String(t.vencimento_txt),
  valor: Number(t.valor), valorPago: Number(t.valor_pago), forma: t.forma_pagamento, codigoBarras: t.codigo_barras,
  status: t.status, pagoEm: t.pago_em_txt || null,
  vencido: t.status === 'ABERTO' && Boolean(Number(t.vencido)),
  operador: t.operador, criadoEm: t.created_at,
});

const SELECT_TITULO = `SELECT t.*, DATE_FORMAT(t.vencimento, '%Y-%m-%d') AS vencimento_txt, DATE_FORMAT(t.pago_em, '%Y-%m-%d') AS pago_em_txt,
              ${NOME_FORNECEDOR} AS fornecedor, l.numero_nf, t.vencimento < CURDATE() AS vencido
       FROM financeiro_contas_pagar t
       ${JOIN_FORNECEDOR}
       LEFT JOIN importacoes_lotes l ON l.id = t.id_lote`;

const carregarLote = async (conn: any, tenant: number, idLote: number, trava = false) => {
  const [[lote]]: any = await conn.execute(
    `SELECT id, numero_nf, serie, cnpj_fornecedor, razao_social_fornecedor, status, xml_conteudo, financeiro_situacao, financeiro_observacao
     FROM importacoes_lotes WHERE id = ? AND tenant_id = ? ${trava ? 'FOR UPDATE' : ''}`,
    [idLote, tenant]
  );
  if (!lote) throw new ErroPagar('Nota não encontrada.', 404);
  return lote;
};

// ---------- cobrança da nota de entrada ----------

// GET /api/financeiro/pagar/notas/:idLote/cobranca
export const cobrancaDaNota = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const lote = await carregarLote(pool, tenant, Number(req.params.idLote));
    const idFornecedor = await buscarFornecedorId(pool as any, lote.cnpj_fornecedor, tenant);
    const [titulos]: any = await pool.execute(`${SELECT_TITULO} WHERE t.tenant_id = ? AND t.id_lote = ? ORDER BY t.status = 'CANCELADO', t.parcela`, [tenant, lote.id]);
    return res.json({
      idLote: Number(lote.id), numeroNf: lote.numero_nf, statusLote: lote.status,
      fornecedor: { id: idFornecedor, nome: lote.razao_social_fornecedor, cnpj: lote.cnpj_fornecedor },
      cobranca: cobrancaDoXml(lote.xml_conteudo),
      situacao: await situacaoCobrancaDoLote(pool, tenant, lote),
      financeiroSituacao: lote.financeiro_situacao, financeiroObservacao: lote.financeiro_observacao,
      titulos: titulos.map(formatarTitulo),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar a cobrança da nota.');
  }
};

// POST /api/financeiro/pagar/notas/:idLote/cobranca/lancar { parcelas: [{ numero, vencimento, valor, codigoBarras, forma }] }
export const lancarCobranca = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const parcelas = validarParcelas(req.body?.parcelas);
    await conn.beginTransaction();
    const lote = await carregarLote(conn, tenant, Number(req.params.idLote), true);
    if ((await titulosAtivosDoLote(conn, tenant, Number(lote.id))).qtd > 0) {
      throw new ErroPagar('A cobrança desta nota já foi lançada: desfaça o lançamento para lançar de novo.', 409);
    }
    const idFornecedor = await buscarFornecedorId(conn, lote.cnpj_fornecedor, tenant);
    if (!idFornecedor) throw new ErroPagar('Cadastre o fornecedor da nota antes de lançar os boletos.', 422);

    const descricao = `NF ${lote.numero_nf || lote.id}${lote.razao_social_fornecedor ? ` - ${lote.razao_social_fornecedor}` : ''}`.slice(0, 150);
    for (const [i, p] of parcelas.entries()) {
      await conn.execute(
        `INSERT INTO financeiro_contas_pagar (tenant_id, id_fornecedor, id_lote, numero_documento, parcela, total_parcelas, descricao,
           vencimento, valor, forma_pagamento, codigo_barras, operador)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenant, idFornecedor, lote.id, p.numero || `${lote.numero_nf || lote.id}/${i + 1}`, i + 1, parcelas.length, descricao,
          p.vencimento, f4(p.valor), p.forma, p.codigoBarras, operadorDe(req)]
      );
    }
    await conn.execute(`UPDATE importacoes_lotes SET financeiro_situacao = 'LANCADO', financeiro_observacao = NULL WHERE id = ?`, [lote.id]);
    await conn.commit();
    return res.status(201).json({ success: true, parcelas: parcelas.length, total: Number(parcelas.reduce((a, p) => a + p.valor, 0).toFixed(2)) });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao lançar a cobrança.');
  } finally {
    conn.release();
  }
};

// POST /api/financeiro/pagar/notas/:idLote/cobranca/dispensar { motivo }
export const dispensarCobranca = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const motivo = String(req.body?.motivo || '').trim();
  try {
    if (motivo.length < 5) throw new ErroPagar('Informe o motivo da dispensa (ex.: nota paga à vista).');
    const lote = await carregarLote(pool, tenant, Number(req.params.idLote));
    if ((await titulosAtivosDoLote(pool, tenant, Number(lote.id))).qtd > 0) throw new ErroPagar('A cobrança já foi lançada: desfaça o lançamento antes.', 409);
    await pool.execute(`UPDATE importacoes_lotes SET financeiro_situacao = 'DISPENSADO', financeiro_observacao = ? WHERE id = ?`,
      [`${motivo.slice(0, 220)} (${operadorDe(req)})`, lote.id]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao dispensar a cobrança.');
  }
};

// POST /api/financeiro/pagar/notas/:idLote/cobranca/desfazer — cancela os títulos (se nenhum foi pago) ou tira a dispensa
export const desfazerCobranca = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const lote = await carregarLote(conn, tenant, Number(req.params.idLote), true);
    const [[pagos]]: any = await conn.execute(
      `SELECT COUNT(*) AS n FROM financeiro_contas_pagar WHERE tenant_id = ? AND id_lote = ? AND status <> 'CANCELADO' AND (status = 'PAGO' OR valor_pago > 0)`,
      [tenant, lote.id]
    );
    if (Number(pagos.n) > 0) throw new ErroPagar('Há parcela já paga nesta nota: reabra o pagamento no contas a pagar antes de desfazer.', 409);
    await conn.execute(`UPDATE financeiro_contas_pagar SET status = 'CANCELADO' WHERE tenant_id = ? AND id_lote = ? AND status = 'ABERTO'`, [tenant, lote.id]);
    await conn.execute(`UPDATE importacoes_lotes SET financeiro_situacao = NULL, financeiro_observacao = NULL WHERE id = ?`, [lote.id]);
    await conn.commit();
    return res.json({ success: true });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao desfazer a cobrança.');
  } finally {
    conn.release();
  }
};

// ---------- títulos ----------

// GET /api/financeiro/pagar?situacao=ABERTOS|VENCIDOS|PAGOS|TODOS&busca=
export const listarTitulos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const situacao = String(req.query.situacao || 'ABERTOS').toUpperCase();
    const busca = String(req.query.busca || '').trim();
    const where = ['t.tenant_id = ?'];
    const params: any[] = [tenant];
    if (situacao === 'ABERTOS') where.push(`t.status = 'ABERTO'`);
    else if (situacao === 'VENCIDOS') where.push(`t.status = 'ABERTO' AND t.vencimento < CURDATE()`);
    else if (situacao === 'PAGOS') where.push(`t.status = 'PAGO'`);
    else where.push(`t.status <> 'CANCELADO'`);
    if (busca) {
      where.push(`(${NOME_FORNECEDOR} LIKE ? OR t.numero_documento LIKE ? OR l.numero_nf LIKE ? OR t.descricao LIKE ?)`);
      params.push(...Array(4).fill(`%${busca}%`));
    }
    const [rows]: any = await pool.execute(
      `${SELECT_TITULO} WHERE ${where.join(' AND ')}
       ORDER BY ${situacao === 'PAGOS' ? 't.pago_em DESC, t.id_titulo DESC' : 't.vencimento, t.id_titulo'} LIMIT 500`,
      params
    );
    const [[r]]: any = await pool.execute(
      `SELECT COALESCE(SUM(CASE WHEN status = 'ABERTO' THEN valor - valor_pago END), 0) AS aberto,
              COALESCE(SUM(CASE WHEN status = 'ABERTO' AND vencimento < CURDATE() THEN valor - valor_pago END), 0) AS vencido,
              COALESCE(SUM(CASE WHEN status = 'ABERTO' AND vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN valor - valor_pago END), 0) AS proximos7,
              COALESCE(SUM(CASE WHEN status = 'PAGO' AND pago_em >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN valor_pago END), 0) AS pagoMes
       FROM financeiro_contas_pagar WHERE tenant_id = ?`,
      [tenant]
    );
    return res.json({
      titulos: rows.map(formatarTitulo),
      resumo: { aberto: Number(r.aberto), vencido: Number(r.vencido), proximos7: Number(r.proximos7), pagoMes: Number(r.pagoMes) },
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar as contas a pagar.');
  }
};

const carregarTitulo = async (tenant: number, idTitulo: number) => {
  const [[t]]: any = await pool.execute(
    `SELECT *, DATE_FORMAT(vencimento, '%Y-%m-%d') AS vencimento_txt FROM financeiro_contas_pagar WHERE id_titulo = ? AND tenant_id = ?`, [idTitulo, tenant]
  );
  if (!t) throw new ErroPagar('Título não encontrado.', 404);
  return t;
};

// POST /api/financeiro/pagar/:idTitulo/pagar { pagoEm, forma }
export const pagarTitulo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const t = await carregarTitulo(tenant, Number(req.params.idTitulo));
    if (t.status !== 'ABERTO') throw new ErroPagar(`Título ${String(t.status).toLowerCase()}.`, 409);
    const pagoEm = dataValidaPagamento(req.body?.pagoEm);
    if (!pagoEm) throw new ErroPagar('Data do pagamento inválida.');
    const forma = String(req.body?.forma || t.forma_pagamento).toUpperCase();
    if (!FORMAS_PAGAMENTO.includes(forma)) throw new ErroPagar('Forma de pagamento inválida.');
    await pool.execute(
      `UPDATE financeiro_contas_pagar SET status = 'PAGO', valor_pago = valor, pago_em = ?, forma_pagamento = ?, operador = ? WHERE id_titulo = ?`,
      [pagoEm, forma, operadorDe(req), t.id_titulo]
    );
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao registrar o pagamento.');
  }
};

// POST /api/financeiro/pagar/:idTitulo/reabrir — desfaz o pagamento registrado por engano
export const reabrirTitulo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const t = await carregarTitulo(tenant, Number(req.params.idTitulo));
    if (t.status !== 'PAGO') throw new ErroPagar('Só título pago pode ser reaberto.', 409);
    await pool.execute(`UPDATE financeiro_contas_pagar SET status = 'ABERTO', valor_pago = 0, pago_em = NULL, operador = ? WHERE id_titulo = ?`, [operadorDe(req), t.id_titulo]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao reabrir o título.');
  }
};

// PUT /api/financeiro/pagar/:idTitulo { vencimento, valor, codigoBarras, forma } — boleto chegou diferente da nota
export const ajustarTitulo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const t = await carregarTitulo(tenant, Number(req.params.idTitulo));
    if (t.status !== 'ABERTO') throw new ErroPagar('Só título em aberto pode ser ajustado.', 409);
    const [p] = validarParcelas([{
      numero: req.body?.numeroDocumento ?? t.numero_documento, vencimento: req.body?.vencimento ?? t.vencimento_txt,
      valor: req.body?.valor ?? t.valor, codigoBarras: req.body?.codigoBarras ?? t.codigo_barras, forma: req.body?.forma ?? t.forma_pagamento,
    }]);
    await pool.execute(
      `UPDATE financeiro_contas_pagar SET numero_documento = ?, vencimento = ?, valor = ?, codigo_barras = ?, forma_pagamento = ?, operador = ? WHERE id_titulo = ?`,
      [p.numero, p.vencimento, f4(p.valor), p.codigoBarras, p.forma, operadorDe(req), t.id_titulo]
    );
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao ajustar o título.');
  }
};
