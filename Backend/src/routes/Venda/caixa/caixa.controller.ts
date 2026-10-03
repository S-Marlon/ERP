// Caixa do PDV: abertura, sangria/suprimento, resumo em tempo real e fechamento com conferência.
// Tabelas: vendas_caixas, vendas_caixas_movimentos, vendas_caixas_fechamentos; vendas_pedidos.id_caixa.
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { calcularResumoCaixa, conferirFechamento, ErroCaixa, validarMovimentoManual } from './caixa';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);

// Sem login: nome livre (Configurações › Meu Perfil), padrão ADM
export const operadorDe = (req: Request): string => String(req.body?.operador || req.query.operador || '').trim().slice(0, 60) || 'ADM';

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroCaixa) return res.status(error.status).json({ error: error.message });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

/** Caixa aberto da empresa (ou null). `trava`: FOR UPDATE (fechamento/movimento) ou SHARE (venda/cancelamento). */
export const carregarCaixaAberto = async (conn: Conn, tenant: number, trava: '' | 'FOR UPDATE' | 'LOCK IN SHARE MODE' = '') => {
  const [[caixa]]: any = await conn.execute(
    `SELECT * FROM vendas_caixas WHERE tenant_id = ? AND status = 'ABERTO' LIMIT 1 ${trava}`, [tenant]
  );
  return caixa || null;
};

const formatarCaixa = (c: any) => ({
  idCaixa: Number(c.id_caixa),
  status: c.status,
  operador: c.operador,
  valorAbertura: Number(c.valor_abertura),
  abertoEm: c.aberto_em,
  fechadoEm: c.fechado_em,
  operadorFechamento: c.operador_fechamento,
  observacaoFechamento: c.observacao_fechamento,
});

/** Resumo de um caixa: esperado por forma, movimentos e números das vendas. */
export const montarResumo = async (conn: Conn, tenant: number, caixa: any) => {
  const idCaixa = Number(caixa.id_caixa);
  const [pagamentos]: any = await conn.execute(
    `SELECT p.forma, p.valor, p.troco
     FROM vendas_pedidos_pagamentos p
     INNER JOIN vendas_pedidos v ON v.id_venda = p.id_venda
     WHERE v.tenant_id = ? AND v.id_caixa = ? AND v.status = 'CONCLUIDA'`,
    [tenant, idCaixa]
  );
  const [movimentos]: any = await conn.execute(
    `SELECT id_movimento, tipo, forma, valor, id_origem, motivo, operador, created_at
     FROM vendas_caixas_movimentos WHERE tenant_id = ? AND id_caixa = ? ORDER BY id_movimento`,
    [tenant, idCaixa]
  );
  const [[vendas]]: any = await conn.execute(
    `SELECT SUM(status = 'CONCLUIDA') AS concluidas, SUM(status = 'CANCELADA') AS canceladas,
            COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' THEN total_liquido END), 0) AS total,
            COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' THEN total_custo END), 0) AS custo,
            COALESCE(SUM(CASE WHEN status = 'CONCLUIDA' THEN total_taxas END), 0) AS taxas
     FROM vendas_pedidos WHERE tenant_id = ? AND id_caixa = ?`,
    [tenant, idCaixa]
  );
  const resumo = calcularResumoCaixa(
    Number(caixa.valor_abertura),
    pagamentos.map((p: any) => ({ forma: p.forma, valor: Number(p.valor), troco: Number(p.troco) })),
    movimentos.map((m: any) => ({ tipo: m.tipo, forma: m.forma, valor: Number(m.valor) }))
  );
  return {
    ...resumo,
    vendas: {
      concluidas: Number(vendas?.concluidas) || 0,
      canceladas: Number(vendas?.canceladas) || 0,
      total: Number(vendas?.total) || 0,
      custo: Number(vendas?.custo) || 0,
      taxas: Number(vendas?.taxas) || 0,
    },
    movimentos: movimentos.map((m: any) => ({
      idMovimento: Number(m.id_movimento), tipo: m.tipo, forma: m.forma, valor: Number(m.valor),
      idOrigem: m.id_origem ? Number(m.id_origem) : null, motivo: m.motivo, operador: m.operador, criadoEm: m.created_at,
    })),
  };
};

/** GET /api/vendas/caixa/atual — caixa aberto e o resumo (caixa: null se fechado) */
export const caixaAtual = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const caixa = await carregarCaixaAberto(pool as any, tenant);
    if (!caixa) return res.json({ caixa: null });
    return res.json({ caixa: formatarCaixa(caixa), resumo: await montarResumo(pool as any, tenant, caixa) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar o caixa.');
  }
};

/** POST /api/vendas/caixa/abrir { valorAbertura, operador } */
export const abrirCaixa = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const valor = Number(req.body?.valorAbertura ?? 0);
  if (!Number.isFinite(valor) || valor < 0) return res.status(400).json({ error: 'Troco inicial inválido.' });
  try {
    const [r]: any = await pool.execute(
      `INSERT INTO vendas_caixas (tenant_id, operador, status, valor_abertura) VALUES (?, ?, 'ABERTO', ?)`,
      [tenant, operadorDe(req), f4(valor)]
    );
    const caixa = await carregarCaixaAberto(pool as any, tenant);
    return res.status(201).json({ idCaixa: Number(r.insertId), caixa: formatarCaixa(caixa), resumo: await montarResumo(pool as any, tenant, caixa) });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe um caixa aberto. Feche-o antes de abrir outro.' });
    return responderErro(res, error, 'Erro ao abrir o caixa.');
  }
};

/** POST /api/vendas/caixa/movimentos { tipo: SANGRIA | SUPRIMENTO, valor, motivo, operador } */
export const lancarMovimento = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const caixa = await carregarCaixaAberto(connection, tenant, 'FOR UPDATE');
    if (!caixa) throw new ErroCaixa('Não há caixa aberto.', 409);
    const resumo = await montarResumo(connection, tenant, caixa);
    const motivo = String(req.body?.motivo || '').trim().slice(0, 255);
    const mov = validarMovimentoManual(req.body?.tipo, Number(req.body?.valor), resumo.dinheiroEsperado, motivo);
    await connection.execute(
      `INSERT INTO vendas_caixas_movimentos (tenant_id, id_caixa, tipo, forma, valor, motivo, operador)
       VALUES (?, ?, ?, 'DINHEIRO', ?, ?, ?)`,
      [tenant, caixa.id_caixa, mov.tipo, f4(mov.valor), motivo || null, operadorDe(req)]
    );
    await connection.commit();
    return res.status(201).json({ caixa: formatarCaixa(caixa), resumo: await montarResumo(pool as any, tenant, caixa) });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao lançar o movimento do caixa.');
  } finally {
    connection.release();
  }
};

/** POST /api/vendas/caixa/fechar { contagem: { DINHEIRO: 120, PIX: 50, ... }, observacao, operador } */
export const fecharCaixa = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const caixa = await carregarCaixaAberto(connection, tenant, 'FOR UPDATE');
    if (!caixa) throw new ErroCaixa('Não há caixa aberto.', 409);
    const resumo = await montarResumo(connection, tenant, caixa);
    const { conferencia, diferencaTotal } = conferirFechamento(resumo.linhas, req.body?.contagem || {});

    for (const l of conferencia) {
      await connection.execute(
        `INSERT INTO vendas_caixas_fechamentos (id_caixa, forma, tenant_id, valor_esperado, valor_informado) VALUES (?, ?, ?, ?, ?)`,
        [caixa.id_caixa, l.forma, tenant, f4(l.esperado), f4(l.informado)]
      );
    }
    await connection.execute(
      `UPDATE vendas_caixas SET status = 'FECHADO', fechado_em = NOW(), operador_fechamento = ?, observacao_fechamento = ?
       WHERE id_caixa = ? AND tenant_id = ?`,
      [operadorDe(req), String(req.body?.observacao || '').trim().slice(0, 255) || null, caixa.id_caixa, tenant]
    );
    await connection.commit();
    return res.json({ idCaixa: Number(caixa.id_caixa), conferencia, diferencaTotal, resumo });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao fechar o caixa.');
  } finally {
    connection.release();
  }
};

/** GET /api/vendas/caixas?de=AAAA-MM-DD&ate=AAAA-MM-DD — histórico (padrão: últimos 30 dias) */
export const listarCaixas = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const data = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
    const [caixas]: any = await pool.execute(
      `SELECT * FROM vendas_caixas
       WHERE tenant_id = ? AND DATE(aberto_em) >= COALESCE(?, CURDATE() - INTERVAL 30 DAY) AND DATE(aberto_em) <= COALESCE(?, CURDATE())
       ORDER BY id_caixa DESC LIMIT 100`,
      [tenant, data(req.query.de), data(req.query.ate)]
    );
    const [fech]: any = caixas.length === 0 ? [[]] : await pool.execute(
      `SELECT id_caixa, SUM(valor_informado - valor_esperado) AS diferenca FROM vendas_caixas_fechamentos
       WHERE tenant_id = ? AND id_caixa IN (${caixas.map(() => '?').join(',')}) GROUP BY id_caixa`,
      [tenant, ...caixas.map((c: any) => c.id_caixa)]
    );
    const [tot]: any = caixas.length === 0 ? [[]] : await pool.execute(
      `SELECT id_caixa, COUNT(*) AS qtd, COALESCE(SUM(total_liquido), 0) AS total FROM vendas_pedidos
       WHERE tenant_id = ? AND status = 'CONCLUIDA' AND id_caixa IN (${caixas.map(() => '?').join(',')}) GROUP BY id_caixa`,
      [tenant, ...caixas.map((c: any) => c.id_caixa)]
    );
    const diferencas = new Map<number, number>(fech.map((f: any) => [Number(f.id_caixa), Number(f.diferenca)]));
    const totais = new Map<number, { qtd: number; total: number }>(tot.map((t: any) => [Number(t.id_caixa), { qtd: Number(t.qtd), total: Number(t.total) }]));
    return res.json(caixas.map((c: any) => ({
      ...formatarCaixa(c),
      qtdVendas: totais.get(Number(c.id_caixa))?.qtd || 0,
      totalVendas: totais.get(Number(c.id_caixa))?.total || 0,
      diferenca: c.status === 'FECHADO' ? diferencas.get(Number(c.id_caixa)) ?? 0 : null,
    })));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar os caixas.');
  }
};

/** GET /api/vendas/caixas/:idCaixa — resumo, movimentos e conferência do fechamento */
export const detalheCaixa = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const [[caixa]]: any = await pool.execute(`SELECT * FROM vendas_caixas WHERE id_caixa = ? AND tenant_id = ?`, [Number(req.params.idCaixa), tenant]);
    if (!caixa) return res.status(404).json({ error: 'Caixa não encontrado.' });
    const [fech]: any = await pool.execute(
      `SELECT forma, valor_esperado, valor_informado FROM vendas_caixas_fechamentos WHERE id_caixa = ? AND tenant_id = ? ORDER BY forma`,
      [caixa.id_caixa, tenant]
    );
    return res.json({
      caixa: formatarCaixa(caixa),
      resumo: await montarResumo(pool as any, tenant, caixa),
      fechamento: fech.map((f: any) => ({
        forma: f.forma, esperado: Number(f.valor_esperado), informado: Number(f.valor_informado),
        diferenca: Number((Number(f.valor_informado) - Number(f.valor_esperado)).toFixed(2)),
      })),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar o caixa.');
  }
};
