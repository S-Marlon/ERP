// Obras de poços › plano mensal: custos e variáveis da empresa, planos oferecidos (níveis) e o simulador de preço por
// cliente/poço. As regras ficam em planoMensal.ts; a Central usa carregarPlanoMensal para a prévia da carteira.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { ErroObra, lerServicos } from './obras';
import { responderErro } from './obras.controller';
import { CUSTOS_PADRAO, CustosPlano, NivelPlano, PocoDoPlano, precoDoPlano, validarCustos, validarNivel } from './planoMensal';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const n = (v: unknown) => Number(v) || 0;
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const COLUNAS: Record<keyof CustosPlano, string> = {
  custoHoraEquipe: 'custo_hora_equipe', horasVisita: 'horas_visita', horasPor100m: 'horas_por_100m', kmMedio: 'km_medio', custoKm: 'custo_km',
  materialVisita: 'material_visita', custoLimpeza: 'custo_limpeza', custoMonitoramentoMes: 'custo_monitoramento_mes', aparelhoValor: 'aparelho_valor',
  aparelhoMeses: 'aparelho_meses', bombaPrecoPorCv: 'bomba_preco_por_cv', bombaVidaAnos: 'bomba_vida_anos', precoVisitaAvulsa: 'preco_visita_avulsa',
  impostosPct: 'impostos_pct', taxaCobrancaPct: 'taxa_cobranca_pct', inadimplenciaPct: 'inadimplencia_pct', margemPct: 'margem_pct',
  margemMinimaPct: 'margem_minima_pct', arredondarPara: 'arredondar_para',
};

export interface NivelSalvo extends NivelPlano { idNivel: number }

const formatarNivel = (r: any): NivelSalvo => ({
  idNivel: Number(r.id_nivel), nome: r.nome, descricao: r.descricao || null, visitasAno: n(r.visitas_ano), limpezaACadaMeses: nulo(r.limpeza_a_cada_meses),
  chamadosAno: n(r.chamados_ano), descontoPecasPct: n(r.desconto_pecas_pct), monitoramento: !!r.monitoramento, reservaBombaPct: n(r.reserva_bomba_pct),
  fidelidadeMeses: n(r.fidelidade_meses), ordem: n(r.ordem), ativo: !!r.ativo,
});

/** Custos gravados da loja (ou os padrão), os planos e a média do que a empresa cobra numa visita de manutenção. */
export const carregarPlanoMensal = async (conn: Conn, tenant: number, soAtivos = true) => {
  const [[c]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_plano_mensal_custos WHERE tenant_id = ?`, [tenant]);
  const custos: CustosPlano = { ...CUSTOS_PADRAO };
  if (c) for (const [k, col] of Object.entries(COLUNAS)) (custos as any)[k] = k === 'precoVisitaAvulsa' ? nulo(c[col]) : n(c[col]);
  const [niveis]: any = await conn.execute(
    `SELECT * FROM modulo_hidraulica_pocos_plano_mensal_niveis WHERE tenant_id = ?${soAtivos ? ' AND ativo = 1' : ''} ORDER BY ordem, id_nivel`, [tenant]);
  // visita avulsa de referência: média das obras concluídas só de limpeza/manutenção
  const [visitas]: any = await conn.execute(
    `SELECT servicos, valor_contratado FROM modulo_hidraulica_pocos_obras WHERE tenant_id = ? AND situacao = 'CONCLUIDA' AND valor_contratado > 0`, [tenant]);
  const so = visitas.filter((o: any) => { const s = lerServicos(o.servicos); return s.length > 0 && s.every(x => x === 'LIMPEZA' || x === 'MANUTENCAO'); });
  const mediaVisitaEmpresa = so.length ? Math.round(so.reduce((s: number, o: any) => s + n(o.valor_contratado), 0) / so.length * 100) / 100 : null;
  return { custos, salvo: !!c, niveis: niveis.map(formatarNivel) as NivelSalvo[], mediaVisitaEmpresa };
};

/** O que pesa no preço de cada cliente: quantos poços ativos, o mais fundo e a bomba instalada mais forte. */
export const pocosParaPlano = async (conn: Conn, tenant: number) => {
  const [rows]: any = await conn.execute(
    `SELECT c.id_cliente, c.nome, COUNT(p.id_poco) AS pocos, MAX(p.profundidade_m) AS prof,
            MAX((SELECT MAX(k.potencia_cv) FROM modulo_hidraulica_pocos_conjuntos k WHERE k.id_poco = p.id_poco AND k.situacao = 'INSTALADO')) AS cv
     FROM modulo_hidraulica_pocos_clientes c JOIN modulo_hidraulica_pocos_pocos p ON p.id_proprietario = c.id_cliente AND p.situacao = 'ATIVO'
     WHERE c.tenant_id = ? AND c.ativo = 1 GROUP BY c.id_cliente, c.nome ORDER BY c.nome`, [tenant]);
  return rows.map((r: any) => ({
    idCliente: Number(r.id_cliente), nome: r.nome, pocos: n(r.pocos), profundidadeM: r.prof === null ? null : n(r.prof), potenciaCv: r.cv === null ? null : n(r.cv),
  }));
};

const simulacao = (custos: CustosPlano, niveis: (NivelPlano & { idNivel?: number })[], poco: PocoDoPlano, media: number | null) =>
  niveis.map(nv => ({ idNivel: nv.idNivel ?? null, nome: nv.nome, preco: precoDoPlano(custos, nv, poco, media) }));

const lerPoco = (b: any): PocoDoPlano => ({
  profundidadeM: b?.profundidadeM === null || b?.profundidadeM === undefined || b.profundidadeM === '' ? null : Math.max(0, Number(b.profundidadeM) || 0),
  potenciaCv: b?.potenciaCv === null || b?.potenciaCv === undefined || b.potenciaCv === '' ? null : Math.max(0, Number(b.potenciaCv) || 0),
  pocos: Math.min(50, Math.max(1, Math.round(Number(b?.pocos) || 1))),
});

// GET /plano-mensal — custos, planos (todos, com os desativados), referência da visita avulsa e os clientes com poço
export const verPlanoMensal = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const p = await carregarPlanoMensal(pool, tenant, false);
    return res.json({ ...p, clientes: await pocosParaPlano(pool, tenant) });
  } catch (e) { return responderErro(res, e, 'Erro ao carregar o plano mensal.'); }
};

// PUT /plano-mensal/custos
export const salvarCustos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const c = validarCustos(req.body);
    const chaves = Object.keys(COLUNAS) as (keyof CustosPlano)[];
    await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_plano_mensal_custos (tenant_id, ${chaves.map(k => COLUNAS[k]).join(', ')}, operador)
       VALUES (?, ${chaves.map(() => '?').join(', ')}, ?)
       ON DUPLICATE KEY UPDATE ${chaves.map(k => `${COLUNAS[k]} = VALUES(${COLUNAS[k]})`).join(', ')}, operador = VALUES(operador)`,
      [tenant, ...chaves.map(k => c[k]), operadorDe(req)]);
    return res.json((await carregarPlanoMensal(pool, tenant, false)).custos);
  } catch (e) { return responderErro(res, e, 'Erro ao salvar os custos.'); }
};

const gravarNivel = async (tenant: number, b: any, id: number | null, operador: string) => {
  const nv = validarNivel(b);
  const valores = [nv.nome, nv.descricao, nv.visitasAno, nv.limpezaACadaMeses, nv.chamadosAno, nv.descontoPecasPct, nv.monitoramento ? 1 : 0, nv.reservaBombaPct,
    nv.fidelidadeMeses, nv.ordem, nv.ativo ? 1 : 0, operador];
  if (id) {
    const [u]: any = await pool.execute(
      `UPDATE modulo_hidraulica_pocos_plano_mensal_niveis SET nome = ?, descricao = ?, visitas_ano = ?, limpeza_a_cada_meses = ?, chamados_ano = ?,
         desconto_pecas_pct = ?, monitoramento = ?, reserva_bomba_pct = ?, fidelidade_meses = ?, ordem = ?, ativo = ?, operador = ?
       WHERE id_nivel = ? AND tenant_id = ?`, [...valores, id, tenant]);
    if (!u.affectedRows) throw new ErroObra('Plano não encontrado.', 404);
    return id;
  }
  const [ins]: any = await pool.execute(
    `INSERT INTO modulo_hidraulica_pocos_plano_mensal_niveis (nome, descricao, visitas_ano, limpeza_a_cada_meses, chamados_ano, desconto_pecas_pct,
       monitoramento, reserva_bomba_pct, fidelidade_meses, ordem, ativo, operador, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [...valores, tenant]);
  return Number(ins.insertId);
};

// POST /plano-mensal/niveis · PUT /plano-mensal/niveis/:id
export const salvarNivel = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = await gravarNivel(tenant, req.body, req.params.id ? Number(req.params.id) : null, operadorDe(req));
    const [[r]]: any = await pool.execute(`SELECT * FROM modulo_hidraulica_pocos_plano_mensal_niveis WHERE id_nivel = ?`, [id]);
    return res.status(req.params.id ? 200 : 201).json(formatarNivel(r));
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o plano.'); }
};

// DELETE /plano-mensal/niveis/:id
export const apagarNivel = async (req: Request, res: Response) => {
  try {
    const [d]: any = await pool.execute(`DELETE FROM modulo_hidraulica_pocos_plano_mensal_niveis WHERE id_nivel = ? AND tenant_id = ?`, [Number(req.params.id), tenantDe(req)]);
    if (!d.affectedRows) throw new ErroObra('Plano não encontrado.', 404);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao apagar o plano.'); }
};

// POST /plano-mensal/simular { custos?, niveis?, poco } — custos e planos ainda não salvos (o que está na tela) ou os gravados
export const simular = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const salvo = await carregarPlanoMensal(pool, tenant);
    const custos = req.body?.custos ? validarCustos(req.body.custos) : salvo.custos;
    const niveis = Array.isArray(req.body?.niveis)
      ? req.body.niveis.map((x: any) => ({ ...validarNivel(x), idNivel: nulo(x?.idNivel) ?? undefined })).filter((x: NivelPlano) => x.ativo)
      : salvo.niveis;
    return res.json({ planos: simulacao(custos, niveis, lerPoco(req.body?.poco), salvo.mediaVisitaEmpresa), mediaVisitaEmpresa: salvo.mediaVisitaEmpresa });
  } catch (e) { return responderErro(res, e, 'Erro ao simular o plano.'); }
};
