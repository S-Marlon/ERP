// Obras de poços › custos da obra: GET/PUT /custos-obra (formações e parâmetros) e PUT /obras/:id/estimativa-custo
// (a estimativa do orçamento gravada na obra). Regras em custosObra.ts; o cálculo, no front (custoObra.ts).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { ErroObra } from './obras';
import { responderErro } from './obras.controller';
import { FORMACOES, PARAMETROS_PADRAO, validarFormacoes, validarParametros } from './custosObra';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const n = (v: unknown) => Number(v) || 0;

const carregarCustos = async (tenant: number) => {
  const [[rows], [[par]]]: any = await Promise.all([
    pool.execute(`SELECT formacao, custo_metro, rendimento_m_h FROM modulo_hidraulica_pocos_custos_perfuracao WHERE tenant_id = ?`, [tenant]),
    pool.execute(`SELECT * FROM modulo_hidraulica_pocos_custos_obra WHERE tenant_id = ?`, [tenant]),
  ]);
  const porFormacao = new Map<string, any>(rows.map((r: any) => [r.formacao, r]));
  return {
    // todas as formações aparecem (as sem cadastro com zero, para preencher)
    formacoes: FORMACOES.map(f => ({ formacao: f, custoMetro: n(porFormacao.get(f)?.custo_metro), rendimentoMH: n(porFormacao.get(f)?.rendimento_m_h) })),
    parametros: par ? {
      horasMobilizacao: n(par.horas_mobilizacao), horasRevestimento100m: n(par.horas_revestimento_100m), horasLimpeza: n(par.horas_limpeza),
      horasInstalacaoBomba: n(par.horas_instalacao_bomba), horasPorDia: n(par.horas_por_dia) || 8, custoDia: n(par.custo_dia),
    } : PARAMETROS_PADRAO,
    configurado: rows.some((r: any) => n(r.custo_metro) > 0) && !!par,
  };
};

/** GET /custos-obra */
export const verCustosObra = async (req: Request, res: Response) => {
  try { return res.json(await carregarCustos(tenantDe(req))); } catch (e) { return responderErro(res, e, 'Erro ao carregar os custos da obra.'); }
};

/** PUT /custos-obra { formacoes: [{ formacao, custoMetro, rendimentoMH }], parametros } */
export const salvarCustosObra = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const formacoes = validarFormacoes(req.body?.formacoes);
    const p = validarParametros(req.body?.parametros || {});
    const op = operadorDe(req);
    await conn.beginTransaction();
    for (const f of formacoes) {
      await conn.execute(
        `INSERT INTO modulo_hidraulica_pocos_custos_perfuracao (tenant_id, formacao, custo_metro, rendimento_m_h, operador) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE custo_metro = VALUES(custo_metro), rendimento_m_h = VALUES(rendimento_m_h), operador = VALUES(operador)`,
        [tenant, f.formacao, f.custoMetro, f.rendimentoMH, op]);
    }
    await conn.execute(
      `INSERT INTO modulo_hidraulica_pocos_custos_obra (tenant_id, horas_mobilizacao, horas_revestimento_100m, horas_limpeza, horas_instalacao_bomba, horas_por_dia, custo_dia, operador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE horas_mobilizacao = VALUES(horas_mobilizacao), horas_revestimento_100m = VALUES(horas_revestimento_100m),
         horas_limpeza = VALUES(horas_limpeza), horas_instalacao_bomba = VALUES(horas_instalacao_bomba), horas_por_dia = VALUES(horas_por_dia),
         custo_dia = VALUES(custo_dia), operador = VALUES(operador)`,
      [tenant, p.horasMobilizacao, p.horasRevestimento100m, p.horasLimpeza, p.horasInstalacaoBomba, p.horasPorDia, p.custoDia, op]);
    await conn.commit();
    return res.json(await carregarCustos(tenant));
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao salvar os custos da obra.');
  } finally { conn.release(); }
};

/** PUT /obras/:id/estimativa-custo { dados } — a estimativa do orçamento (entrada e resultado), para comparar com o real. */
export const salvarEstimativaCusto = async (req: Request, res: Response) => {
  try {
    const dados = req.body?.dados;
    if (!dados || typeof dados !== 'object') throw new ErroObra('Estimativa vazia.');
    const json = JSON.stringify({ ...dados, salvoEm: new Date().toISOString().slice(0, 16).replace('T', ' '), operador: operadorDe(req) });
    if (json.length > 200000) throw new ErroObra('Estimativa grande demais.');
    const [r]: any = await pool.execute(`UPDATE modulo_hidraulica_pocos_obras SET estimativa_custo = ? WHERE id_obra = ? AND tenant_id = ?`,
      [json, Number(req.params.id), tenantDe(req)]);
    if (!r.affectedRows) throw new ErroObra('Obra não encontrada.', 404);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao salvar a estimativa de custo.'); }
};
