// Fundos de reposição (Financeiro › Fundos de reposição): quanto deveria estar guardado, fora do capital de giro, para
// recomprar os itens caros. Entradas = custo das vendas das categorias do fundo (× percentual) menos devoluções; saídas =
// compras pela NF (entrada aprovada e correções); mais os ajustes manuais. Regras em reservasReposicao.ts.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { areaDaCategoria } from '../../estoque/inventario/inventarioRotativo';
import { ErroReserva, extratoComSaldo, MovimentoFundo, resumoDoFundo, validarAjuste, validarFundo } from './reservasReposicao';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const operadorDe = (req: Request) => String(req.body?.operador || req.query.operador || '').trim().slice(0, 60) || 'ADM';
const n = (v: unknown) => Number(v) || 0;
const f4 = (v: number) => Number(v || 0).toFixed(4);
const limpo = (s: unknown) => String(s ?? '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroReserva) return res.status(error.status).json({ error: error.message });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

/** Fundos, categorias e os movimentos (vendas, devoluções, compras, ajustes) de cada fundo, já com saldo. */
const calcularFundos = async (tenant: number) => {
  const [[fundos], [mapa], [cats], [itens], [ajustes]]: any = await Promise.all([
    pool.execute(`SELECT id_reserva, nome, percentual_custo, saldo_inicial, DATE_FORMAT(data_inicio, '%Y-%m-%d') AS inicio, ativo FROM financeiro_reservas_reposicao WHERE tenant_id = ? ORDER BY nome`, [tenant]),
    pool.execute(`SELECT categoria_id, id_reserva FROM financeiro_reservas_reposicao_categorias WHERE tenant_id = ?`, [tenant]),
    pool.execute(`SELECT id, nome, categoria_pai_id FROM comercial_categorias WHERE tenant_id = ? ORDER BY nome`, [tenant]),
    pool.execute(
      `SELECT ic.id_item, COALESCE(f.categoria_id, cpd.categoria_id) AS categoria_id, COALESCE(es.quantidade_atual, 0) * COALESCE(NULLIF(es.custo_medio, 0), cpd.custo_gerencial, 0) AS valor_estoque
       FROM itens_core ic
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       LEFT JOIN comercial_familias f ON f.id = cpd.familia_id
       LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'
       WHERE ic.tenant_id = ?`, [tenant]),
    pool.execute(`SELECT id_ajuste, id_reserva, DATE_FORMAT(data, '%Y-%m-%d') AS data, valor, motivo, operador FROM financeiro_reservas_reposicao_ajustes WHERE tenant_id = ?`, [tenant]),
  ]);
  const pais = new Map<number, number | null>(cats.map((c: any) => [Number(c.id), c.categoria_pai_id !== null ? Number(c.categoria_pai_id) : null]));
  const mapaCat = new Map<number, number>(mapa.map((m: any) => [Number(m.categoria_id), Number(m.id_reserva)]));
  const fundoDoItem = new Map<number, number>();
  const estoqueDoFundo = new Map<number, number>();
  for (const i of itens) {
    const f = areaDaCategoria(i.categoria_id !== null ? Number(i.categoria_id) : null, pais, mapaCat);
    if (f === null) continue;
    fundoDoItem.set(Number(i.id_item), f);
    estoqueDoFundo.set(f, (estoqueDoFundo.get(f) || 0) + Math.max(0, n(i.valor_estoque)));
  }
  const movimentos = new Map<number, MovimentoFundo[]>(fundos.map((f: any) => [Number(f.id_reserva), []]));
  const inicio = fundos.length ? fundos.map((f: any) => f.inicio).sort()[0] : null;

  if (inicio && fundoDoItem.size) {
    const [[vendas], [devolucoes], [compras]]: any = await Promise.all([
      pool.execute(
        `SELECT i.id_item, DATE_FORMAT(COALESCE(v.entregue_em, v.created_at), '%Y-%m-%d') AS dia, SUM(i.custo_total) AS custo, COUNT(DISTINCT i.id_venda) AS vendas
         FROM vendas_pedidos_itens i INNER JOIN vendas_pedidos v ON v.id_venda = i.id_venda
         WHERE v.tenant_id = ? AND v.status = 'CONCLUIDA' AND COALESCE(v.entregue_em, v.created_at) >= ? GROUP BY i.id_item, dia`, [tenant, inicio]),
      pool.execute(
        `SELECT d.id_item, DATE_FORMAT(dv.created_at, '%Y-%m-%d') AS dia, SUM(d.quantidade_base * d.custo_unitario_base) AS custo
         FROM vendas_devolucoes_itens d INNER JOIN vendas_devolucoes dv ON dv.id_devolucao = d.id_devolucao
         WHERE dv.tenant_id = ? AND dv.created_at >= ? GROUP BY d.id_item, dia`, [tenant, inicio]),
      pool.execute(
        `SELECT m.id_item, m.id_origem AS lote, DATE_FORMAT(m.created_at, '%Y-%m-%d') AS dia, l.numero_nf,
                COALESCE(NULLIF(l.nome_fantasia_fornecedor, ''), l.razao_social_fornecedor) AS fornecedor,
                SUM(CASE WHEN m.origem = 'CORRECAO_NFE_ESTORNO' THEN -m.custo_total ELSE m.custo_total END) AS custo
         FROM estoque_movimentos m LEFT JOIN importacoes_lotes l ON l.id = m.id_origem
         WHERE m.tenant_id = ? AND m.origem IN ('ENTRADA_NFE', 'CORRECAO_NFE_ENTRADA', 'CORRECAO_NFE_ESTORNO') AND m.created_at >= ?
         GROUP BY m.id_item, m.id_origem, dia, l.numero_nf, fornecedor`, [tenant, inicio]),
    ]);
    const porFundo = new Map(fundos.map((f: any) => [Number(f.id_reserva), f]));
    // agrega por fundo + dia (vendas/devoluções) e por fundo + nota (compras)
    const agregar = (linhas: any[], tipo: 'VENDA' | 'DEVOLUCAO') => {
      const acc = new Map<string, { fundo: number; dia: string; custo: number; vendas: number }>();
      for (const l of linhas) {
        const f = fundoDoItem.get(Number(l.id_item));
        if (f === undefined) continue;
        const fundo: any = porFundo.get(f);
        if (!fundo || l.dia < fundo.inicio) continue;
        const k = `${f}|${l.dia}`;
        const a = acc.get(k) || { fundo: f, dia: l.dia, custo: 0, vendas: 0 };
        a.custo += n(l.custo); a.vendas += Number(l.vendas || 0);
        acc.set(k, a);
      }
      for (const a of acc.values()) {
        const pct = n((porFundo.get(a.fundo) as any).percentual_custo) || 1;
        movimentos.get(a.fundo)!.push(tipo === 'VENDA'
          ? { data: a.dia, tipo, descricao: `Vendas do dia (${a.vendas} ${a.vendas === 1 ? 'venda' : 'vendas'}) · custo ${brl(a.custo)}${pct !== 1 ? ` × ${Math.round(pct * 100)}%` : ''}`, valor: a.custo * pct }
          : { data: a.dia, tipo, descricao: `Devoluções do dia · custo ${brl(a.custo)}`, valor: -a.custo * pct });
      }
    };
    agregar(vendas, 'VENDA');
    agregar(devolucoes, 'DEVOLUCAO');
    const notas = new Map<string, { fundo: number; dia: string; nf: string | null; fornecedor: string | null; custo: number; itens: number }>();
    for (const c of compras) {
      const f = fundoDoItem.get(Number(c.id_item));
      if (f === undefined) continue;
      const fundo: any = porFundo.get(f);
      if (!fundo || c.dia < fundo.inicio) continue;
      const k = `${f}|${c.lote}|${c.dia}`;
      const a = notas.get(k) || { fundo: f, dia: c.dia, nf: c.numero_nf, fornecedor: c.fornecedor, custo: 0, itens: 0 };
      a.custo += n(c.custo); a.itens++;
      notas.set(k, a);
    }
    for (const a of notas.values()) {
      if (Math.abs(a.custo) < 0.005) continue;
      movimentos.get(a.fundo)!.push({ data: a.dia, tipo: 'COMPRA', descricao: `Compra NF ${a.nf || '—'}${a.fornecedor ? ` · ${a.fornecedor}` : ''} (${a.itens} ${a.itens === 1 ? 'item' : 'itens'})`, valor: -a.custo, referencia: a.nf });
    }
  }
  for (const a of ajustes) {
    movimentos.get(Number(a.id_reserva))?.push({ data: a.data, tipo: 'AJUSTE', descricao: `${a.motivo} · ${a.operador}`, valor: n(a.valor), idAjuste: Number(a.id_ajuste) });
  }
  for (const f of fundos) {
    if (n(f.saldo_inicial) !== 0) movimentos.get(Number(f.id_reserva))!.push({ data: f.inicio, tipo: 'INICIAL', descricao: 'Saldo inicial (já separado)', valor: n(f.saldo_inicial) });
  }

  const mes = mesAtual();
  return {
    categorias: cats.map((c: any) => ({ id: Number(c.id), nome: limpo(c.nome), pai: c.categoria_pai_id !== null ? Number(c.categoria_pai_id) : null })),
    fundos: fundos.map((f: any) => {
      const id = Number(f.id_reserva);
      const extrato = extratoComSaldo(movimentos.get(id) || []);
      return {
        id, nome: f.nome, percentualCusto: n(f.percentual_custo), saldoInicial: n(f.saldo_inicial), dataInicio: f.inicio, ativo: Boolean(Number(f.ativo)),
        categorias: mapa.filter((m: any) => Number(m.id_reserva) === id).map((m: any) => Number(m.categoria_id)),
        resumo: resumoDoFundo(extrato, estoqueDoFundo.get(id) || 0, mes), extrato,
      };
    }),
  };
};

/** GET /api/financeiro/reservas — fundos com resumo (sem o extrato) e o total separado. */
export const listarFundos = async (req: Request, res: Response) => {
  try {
    const { fundos, categorias } = await calcularFundos(tenantDe(req));
    const ativos = fundos.filter((f: any) => f.ativo);
    return res.json({
      fundos: fundos.map(({ extrato, ...f }: any) => ({ ...f, ultimos: extrato.slice(-3).reverse() })),
      categorias,
      totalSeparado: Math.round(ativos.reduce((a: number, f: any) => a + f.resumo.saldo, 0) * 100) / 100,
      totalEstoque: Math.round(ativos.reduce((a: number, f: any) => a + f.resumo.estoque, 0) * 100) / 100,
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar os fundos de reposição.');
  }
};

/** GET /api/financeiro/reservas/:id/extrato — todos os movimentos (mais recente primeiro) com o saldo. */
export const extratoFundo = async (req: Request, res: Response) => {
  try {
    const { fundos } = await calcularFundos(tenantDe(req));
    const f: any = fundos.find((x: any) => x.id === Number(req.params.id));
    if (!f) throw new ErroReserva('Fundo não encontrado.', 404);
    return res.json({ ...f, extrato: [...f.extrato].reverse() });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar o extrato.');
  }
};

const gravarCategorias = async (conn: any, tenant: number, id: number, categorias: unknown) => {
  if (!Array.isArray(categorias)) return;
  const ids = [...new Set(categorias.map(Number).filter(x => Number.isInteger(x) && x > 0))];
  await conn.execute(`DELETE FROM financeiro_reservas_reposicao_categorias WHERE tenant_id = ? AND id_reserva = ?`, [tenant, id]);
  for (const c of ids) {
    await conn.execute(
      `INSERT INTO financeiro_reservas_reposicao_categorias (tenant_id, categoria_id, id_reserva) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id_reserva = VALUES(id_reserva)`,
      [tenant, c, id]);
  }
};

/** POST /api/financeiro/reservas { nome, percentualCusto, saldoInicial, dataInicio, categorias } */
export const criarFundo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const f = validarFundo(req.body);
    await conn.beginTransaction();
    const [r]: any = await conn.execute(
      `INSERT INTO financeiro_reservas_reposicao (tenant_id, nome, percentual_custo, saldo_inicial, data_inicio, ativo, operador) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tenant, f.nome, f.percentualCusto.toFixed(4), f4(f.saldoInicial), f.dataInicio, f.ativo, operadorDe(req)]);
    await gravarCategorias(conn, tenant, Number(r.insertId), req.body?.categorias);
    await conn.commit();
    return res.status(201).json({ success: true, id: Number(r.insertId) });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao criar o fundo.');
  } finally {
    conn.release();
  }
};

/** PUT /api/financeiro/reservas/:id */
export const atualizarFundo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const f = validarFundo(req.body);
    const id = Number(req.params.id);
    await conn.beginTransaction();
    const [r]: any = await conn.execute(
      `UPDATE financeiro_reservas_reposicao SET nome = ?, percentual_custo = ?, saldo_inicial = ?, data_inicio = ?, ativo = ? WHERE id_reserva = ? AND tenant_id = ?`,
      [f.nome, f.percentualCusto.toFixed(4), f4(f.saldoInicial), f.dataInicio, f.ativo, id, tenant]);
    if (!r.affectedRows) throw new ErroReserva('Fundo não encontrado.', 404);
    await gravarCategorias(conn, tenant, id, req.body?.categorias);
    await conn.commit();
    return res.json({ success: true });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao salvar o fundo.');
  } finally {
    conn.release();
  }
};

/** DELETE /api/financeiro/reservas/:id — apaga o fundo, as categorias e os ajustes dele (vendas e compras não mudam). */
export const excluirFundo = async (req: Request, res: Response) => {
  try {
    await pool.execute(`DELETE FROM financeiro_reservas_reposicao WHERE id_reserva = ? AND tenant_id = ?`, [Number(req.params.id), tenantDe(req)]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao excluir o fundo.');
  }
};

/** POST /api/financeiro/reservas/:id/ajustes { data, valor, motivo } */
export const lancarAjuste = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const a = validarAjuste(req.body);
    const id = Number(req.params.id);
    const [[f]]: any = await pool.execute(`SELECT id_reserva FROM financeiro_reservas_reposicao WHERE id_reserva = ? AND tenant_id = ?`, [id, tenant]);
    if (!f) throw new ErroReserva('Fundo não encontrado.', 404);
    await pool.execute(`INSERT INTO financeiro_reservas_reposicao_ajustes (tenant_id, id_reserva, data, valor, motivo, operador) VALUES (?, ?, ?, ?, ?, ?)`,
      [tenant, id, a.data, f4(a.valor), a.motivo, operadorDe(req)]);
    return res.status(201).json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao lançar o ajuste.');
  }
};

/** DELETE /api/financeiro/reservas/:id/ajustes/:idAjuste */
export const excluirAjuste = async (req: Request, res: Response) => {
  try {
    await pool.execute(`DELETE FROM financeiro_reservas_reposicao_ajustes WHERE id_ajuste = ? AND id_reserva = ? AND tenant_id = ?`,
      [Number(req.params.idAjuste), Number(req.params.id), tenantDe(req)]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao excluir o ajuste.');
  }
};
