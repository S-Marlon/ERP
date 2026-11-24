// Obras de poços › custos da obra: GET/PUT /custos-obra (formações e parâmetros), PUT /obras/:id/estimativa-custo
// (a estimativa do orçamento gravada na obra) e os custos reais além dos materiais (GET/POST /obras/:id/custos,
// PUT/DELETE /obras-custos/:idCusto). Regras em custosObra.ts e custosReais.ts; o cálculo, no front (custoObra.ts).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { ErroObra } from './obras';
import { responderErro } from './obras.controller';
import { FORMACOES, PARAMETROS_PADRAO, validarFormacoes, validarParametros } from './custosObra';
import { validarCustoReal } from './custosReais';

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
      horasVisitaTecnica: n(par.horas_visita_tecnica), custoKmCaminhao: n(par.custo_km_caminhao), custoFixoTransporte: n(par.custo_fixo_transporte),
      viagensMaquina: par.viagens_maquina === null || par.viagens_maquina === undefined ? 1 : n(par.viagens_maquina),
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
      `INSERT INTO modulo_hidraulica_pocos_custos_obra (tenant_id, horas_mobilizacao, horas_revestimento_100m, horas_limpeza, horas_instalacao_bomba, horas_por_dia, custo_dia,
         horas_visita_tecnica, custo_km_caminhao, custo_fixo_transporte, viagens_maquina, operador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE horas_mobilizacao = VALUES(horas_mobilizacao), horas_revestimento_100m = VALUES(horas_revestimento_100m),
         horas_limpeza = VALUES(horas_limpeza), horas_instalacao_bomba = VALUES(horas_instalacao_bomba), horas_por_dia = VALUES(horas_por_dia),
         custo_dia = VALUES(custo_dia), horas_visita_tecnica = VALUES(horas_visita_tecnica), custo_km_caminhao = VALUES(custo_km_caminhao),
         custo_fixo_transporte = VALUES(custo_fixo_transporte), viagens_maquina = VALUES(viagens_maquina), operador = VALUES(operador)`,
      [tenant, p.horasMobilizacao, p.horasRevestimento100m, p.horasLimpeza, p.horasInstalacaoBomba, p.horasPorDia, p.custoDia,
        p.horasVisitaTecnica, p.custoKmCaminhao, p.custoFixoTransporte, p.viagensMaquina, op]);
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

// ------------------------------------------------------------------ custos reais (depois da obra)
const formatarCustoReal = (r: any) => ({
  idCusto: Number(r.id_custo), data: r.data_txt, tipo: r.tipo, descricao: r.descricao || null,
  quantidade: r.quantidade === null ? null : n(r.quantidade), valorUnitario: r.valor_unitario === null ? null : n(r.valor_unitario),
  valor: n(r.valor), operador: r.operador,
});

/** GET /obras/:id/custos — lançamentos, materiais (separando a bomba), total cobrado, a estimativa e os custos da empresa. */
export const verCustosReais = async (req: Request, res: Response) => {
  const tenant = tenantDe(req), id = Number(req.params.id);
  try {
    const [[o]]: any = await pool.execute(
      `SELECT o.valor_contratado, o.estimativa_custo, o.situacao, DATE_FORMAT(o.data_inicio, '%Y-%m-%d') AS inicio,
              (SELECT COALESCE(SUM(a.valor), 0) FROM modulo_hidraulica_pocos_adicionais a WHERE a.id_obra = o.id_obra AND a.situacao = 'APROVADO') AS adicionais
       FROM modulo_hidraulica_pocos_obras o WHERE o.id_obra = ? AND o.tenant_id = ?`, [id, tenant]);
    if (!o) throw new ErroObra('Obra não encontrada.', 404);
    const [[lanc], [[mat]], [[emp]]]: any = await Promise.all([
      pool.execute(`SELECT c.*, DATE_FORMAT(c.data, '%Y-%m-%d') AS data_txt FROM modulo_hidraulica_pocos_obras_custos c
                    WHERE c.id_obra = ? AND c.tenant_id = ? ORDER BY c.data, c.id_custo`, [id, tenant]),
      pool.execute(`SELECT COALESCE(SUM(CASE WHEN m.categoria = 'BOMBA' THEN 0 ELSE ROUND(COALESCE(l.qtd_usada, l.qtd_prevista) * l.custo_unitario, 2) END), 0) AS materiais,
                           COALESCE(SUM(CASE WHEN m.categoria = 'BOMBA' THEN ROUND(COALESCE(l.qtd_usada, l.qtd_prevista) * l.custo_unitario, 2) ELSE 0 END), 0) AS bomba,
                           COUNT(*) AS linhas, COALESCE(SUM(l.qtd_usada IS NULL), 0) AS sem_conferir
                    FROM modulo_hidraulica_pocos_obras_materiais l LEFT JOIN modulo_hidraulica_pocos_materiais m ON m.id_material = l.id_material
                    WHERE l.id_obra = ?`, [id]),
      pool.execute(`SELECT custo_hora_equipe, pessoas_troca, custo_km, impostos_pct, taxa_cobranca_pct, inadimplencia_pct, margem_minima_pct
                    FROM modulo_hidraulica_pocos_plano_mensal_custos WHERE tenant_id = ?`, [tenant]),
    ]);
    let estimativa: any = null;
    try { estimativa = o.estimativa_custo ? JSON.parse(o.estimativa_custo) : null; } catch { estimativa = null; }
    return res.json({
      lancamentos: lanc.map(formatarCustoReal),
      materiais: { materiais: n(mat.materiais), bomba: n(mat.bomba), linhas: n(mat.linhas), semConferir: n(mat.sem_conferir) },
      total: Math.round((n(o.valor_contratado) + n(o.adicionais)) * 100) / 100,
      situacao: o.situacao, inicio: o.inicio || null,
      estimativa,
      empresa: {
        // a hora do plano mensal é por pessoa; na obra, a hora é a da equipe (pessoas da troca)
        custoHoraEquipe: Math.round(n(emp?.custo_hora_equipe) * (n(emp?.pessoas_troca) || 1) * 100) / 100, custoKm: n(emp?.custo_km), margemMinimaPct: n(emp?.margem_minima_pct),
        deducoesPct: n(emp?.impostos_pct) + n(emp?.taxa_cobranca_pct) + n(emp?.inadimplencia_pct),
      },
    });
  } catch (e) { return responderErro(res, e, 'Erro ao carregar os custos da obra.'); }
};

/** POST /obras/:id/custos */
export const criarCustoReal = async (req: Request, res: Response) => {
  const tenant = tenantDe(req), id = Number(req.params.id);
  try {
    const c = validarCustoReal(req.body);
    const [[o]]: any = await pool.execute(`SELECT id_obra FROM modulo_hidraulica_pocos_obras WHERE id_obra = ? AND tenant_id = ?`, [id, tenant]);
    if (!o) throw new ErroObra('Obra não encontrada.', 404);
    const [ins]: any = await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_obras_custos (tenant_id, id_obra, data, tipo, descricao, quantidade, valor_unitario, valor, operador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [tenant, id, c.data, c.tipo, c.descricao, c.quantidade, c.valorUnitario, c.valor, operadorDe(req)]);
    return res.status(201).json({ idCusto: Number(ins.insertId), ...c });
  } catch (e) { return responderErro(res, e, 'Erro ao lançar o custo.'); }
};

/** PUT /obras-custos/:idCusto */
export const salvarCustoReal = async (req: Request, res: Response) => {
  try {
    const c = validarCustoReal(req.body);
    const [r]: any = await pool.execute(
      `UPDATE modulo_hidraulica_pocos_obras_custos SET data = ?, tipo = ?, descricao = ?, quantidade = ?, valor_unitario = ?, valor = ?, operador = ?
       WHERE id_custo = ? AND tenant_id = ?`,
      [c.data, c.tipo, c.descricao, c.quantidade, c.valorUnitario, c.valor, operadorDe(req), Number(req.params.idCusto), tenantDe(req)]);
    if (!r.affectedRows) throw new ErroObra('Lançamento não encontrado.', 404);
    return res.json({ idCusto: Number(req.params.idCusto), ...c });
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o custo.'); }
};

/** DELETE /obras-custos/:idCusto */
export const apagarCustoReal = async (req: Request, res: Response) => {
  try {
    const [r]: any = await pool.execute(`DELETE FROM modulo_hidraulica_pocos_obras_custos WHERE id_custo = ? AND tenant_id = ?`,
      [Number(req.params.idCusto), tenantDe(req)]);
    if (!r.affectedRows) throw new ErroObra('Lançamento não encontrado.', 404);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao apagar o custo.'); }
};
