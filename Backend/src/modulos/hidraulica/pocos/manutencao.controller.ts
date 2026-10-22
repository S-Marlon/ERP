// Obras de poços › histórico e manutenção do poço (etapa 6): a linha do tempo e as medições de cada poço, o plano de
// manutenção periódica e a lista de manutenções vencidas/a vencer e garantias vencendo (para oferecer o serviço).
// Tabelas modulo_hidraulica_pocos_historico e _planos_manutencao (as obras vêm de modulo_hidraulica_pocos_obras).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { ErroObra, garantiaAte, lerServicos } from './obras';
import { responderErro } from './obras.controller';
import { garantiaVencendo, linhaDoTempo, situacaoDoPlano, ultimaPorServico, validarPlano, validarRegistro } from './manutencao';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const SELECT_OBRAS = `SELECT o.id_obra, o.id_poco, o.id_cliente, o.titulo, o.situacao, o.servicos, o.garantia_meses, DATE_FORMAT(o.created_at, '%Y-%m-%d') AS criada,
    DATE_FORMAT(o.data_inicio, '%Y-%m-%d') AS inicio, DATE_FORMAT(o.data_termino, '%Y-%m-%d') AS termino
  FROM modulo_hidraulica_pocos_obras o`;
const formatarObra = (o: any) => ({
  idObra: Number(o.id_obra), idPoco: nulo(o.id_poco), idCliente: Number(o.id_cliente), titulo: o.titulo || `Obra ${o.id_obra}`, situacao: o.situacao,
  servicos: lerServicos(o.servicos), criadaEm: o.criada, dataInicio: o.inicio || null, dataTermino: o.termino || null,
  garantiaAte: garantiaAte(o.termino || null, nulo(o.garantia_meses)),
});
const formatarRegistro = (r: any) => ({
  idRegistro: Number(r.id_registro), data: r.data_txt, tipo: r.tipo, descricao: r.descricao || null,
  nivelEstaticoM: nulo(r.nivel_estatico_m), nivelDinamicoM: nulo(r.nivel_dinamico_m), vazaoLh: nulo(r.vazao_lh), operador: r.operador,
});
const formatarPlano = (p: any, ultimaObra: string | null, hoje: string) => ({
  idPlano: Number(p.id_plano), idPoco: Number(p.id_poco), servico: p.servico, descricao: p.descricao || null, aCadaMeses: Number(p.a_cada_meses),
  ultimaInformada: p.ultima_txt || null, ativo: !!p.ativo,
  ...situacaoDoPlano({ aCadaMeses: Number(p.a_cada_meses), ultimaInformada: p.ultima_txt || null }, ultimaObra, hoje),
});
const SELECT_PLANO = `SELECT p.*, DATE_FORMAT(p.ultima_informada, '%Y-%m-%d') AS ultima_txt FROM modulo_hidraulica_pocos_planos_manutencao p`;

const carregarPoco = async (tenant: number, id: number) => {
  const [[p]]: any = await pool.execute(
    `SELECT id_poco, identificacao, nivel_estatico_m, nivel_dinamico_m, vazao_lh, DATE_FORMAT(data_perfuracao, '%Y-%m-%d') AS perfuracao
     FROM modulo_hidraulica_pocos_pocos WHERE id_poco = ? AND tenant_id = ?`, [id, tenant]);
  if (!p) throw new ErroObra('Poço não encontrado.', 404);
  return p;
};

// GET /pocos/:id/historico — linha do tempo, medições (com a da perfuração, da ficha) e planos de manutenção
export const historicoDoPoco = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const poco = await carregarPoco(tenant, id);
    const hoje = hojeIso();
    const [obrasRows]: any = await pool.execute(`${SELECT_OBRAS} WHERE o.id_poco = ? AND o.tenant_id = ? ORDER BY o.id_obra`, [id, tenant]);
    const [regRows]: any = await pool.execute(
      `SELECT h.*, DATE_FORMAT(h.data, '%Y-%m-%d') AS data_txt FROM modulo_hidraulica_pocos_historico h WHERE h.id_poco = ? AND h.tenant_id = ? ORDER BY h.data, h.id_registro`,
      [id, tenant]);
    const [planoRows]: any = await pool.execute(`${SELECT_PLANO} WHERE p.id_poco = ? AND p.tenant_id = ? ORDER BY p.ativo DESC, p.id_plano`, [id, tenant]);
    const obras: ReturnType<typeof formatarObra>[] = obrasRows.map(formatarObra);
    const registros = regRows.map(formatarRegistro);
    const ultimas = ultimaPorServico(obras);
    const medicoes = registros.filter((r: any) => r.nivelEstaticoM !== null || r.nivelDinamicoM !== null || r.vazaoLh !== null)
      .map((r: any) => ({ data: r.data, origem: 'MEDICAO', nivelEstaticoM: r.nivelEstaticoM, nivelDinamicoM: r.nivelDinamicoM, vazaoLh: r.vazaoLh }));
    if (poco.perfuracao && (poco.nivel_estatico_m !== null || poco.nivel_dinamico_m !== null || poco.vazao_lh !== null)) {
      medicoes.unshift({ data: poco.perfuracao, origem: 'PERFURACAO', nivelEstaticoM: nulo(poco.nivel_estatico_m), nivelDinamicoM: nulo(poco.nivel_dinamico_m), vazaoLh: nulo(poco.vazao_lh) });
    }
    return res.json({
      linhaDoTempo: linhaDoTempo(obras, registros), registros, medicoes,
      planos: planoRows.map((p: any) => formatarPlano(p, ultimas[p.servico] || null, hoje)),
    });
  } catch (e) { return responderErro(res, e, 'Erro ao carregar o histórico do poço.'); }
};

// POST /pocos/:id/historico { tipo, data, descricao, nivelEstaticoM, nivelDinamicoM, vazaoLh }
export const criarRegistro = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregarPoco(tenant, id);
    const r = validarRegistro(req.body, hojeIso());
    const [ins]: any = await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_historico (tenant_id, id_poco, data, tipo, descricao, nivel_estatico_m, nivel_dinamico_m, vazao_lh, operador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [tenant, id, r.data, r.tipo, r.descricao, r.nivelEstaticoM, r.nivelDinamicoM, r.vazaoLh, operadorDe(req)]);
    return res.status(201).json({ idRegistro: Number(ins.insertId) });
  } catch (e) { return responderErro(res, e, 'Erro ao registrar.'); }
};

// PUT /historico/:id
export const salvarRegistro = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const r = validarRegistro(req.body, hojeIso());
    const [u]: any = await pool.execute(
      `UPDATE modulo_hidraulica_pocos_historico SET data = ?, tipo = ?, descricao = ?, nivel_estatico_m = ?, nivel_dinamico_m = ?, vazao_lh = ?, operador = ?
       WHERE id_registro = ? AND tenant_id = ?`, [r.data, r.tipo, r.descricao, r.nivelEstaticoM, r.nivelDinamicoM, r.vazaoLh, operadorDe(req), Number(req.params.id), tenant]);
    if (!u.affectedRows) throw new ErroObra('Registro não encontrado.', 404);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o registro.'); }
};

// DELETE /historico/:id
export const removerRegistro = async (req: Request, res: Response) => {
  try {
    const [u]: any = await pool.execute(`DELETE FROM modulo_hidraulica_pocos_historico WHERE id_registro = ? AND tenant_id = ?`, [Number(req.params.id), tenantDe(req)]);
    if (!u.affectedRows) throw new ErroObra('Registro não encontrado.', 404);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao apagar o registro.'); }
};

// POST /pocos/:id/planos { servico, descricao, aCadaMeses, ultimaInformada }  ·  PUT /planos/:id (+ ativo)
export const criarPlano = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregarPoco(tenant, id);
    const p = validarPlano(req.body);
    const [ins]: any = await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_planos_manutencao (tenant_id, id_poco, servico, descricao, a_cada_meses, ultima_informada, ativo, operador) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, id, p.servico, p.descricao, p.aCadaMeses, p.ultimaInformada, p.ativo, operadorDe(req)]);
    return res.status(201).json({ idPlano: Number(ins.insertId) });
  } catch (e) { return responderErro(res, e, 'Erro ao criar o plano.'); }
};
export const salvarPlano = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const p = validarPlano(req.body);
    const [u]: any = await pool.execute(
      `UPDATE modulo_hidraulica_pocos_planos_manutencao SET servico = ?, descricao = ?, a_cada_meses = ?, ultima_informada = ?, ativo = ?, operador = ?
       WHERE id_plano = ? AND tenant_id = ?`, [p.servico, p.descricao, p.aCadaMeses, p.ultimaInformada, p.ativo, operadorDe(req), Number(req.params.id), tenant]);
    if (!u.affectedRows) throw new ErroObra('Plano não encontrado.', 404);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o plano.'); }
};

/**
 * GET /manutencoes?todas=1 — os planos ativos com a próxima data (sem "todas", só vencidos e a vencer em 30 dias) e as
 * garantias vencendo nos próximos 30 dias, com o poço e o cliente para oferecer o serviço.
 */
export const listaManutencoes = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const hoje = hojeIso();
    const [planoRows]: any = await pool.execute(
      `SELECT p.*, DATE_FORMAT(p.ultima_informada, '%Y-%m-%d') AS ultima_txt, po.identificacao AS poco, po.cidade, po.id_proprietario,
              c.nome AS cliente, c.telefone
       FROM modulo_hidraulica_pocos_planos_manutencao p
       JOIN modulo_hidraulica_pocos_pocos po ON po.id_poco = p.id_poco
       LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = po.id_proprietario
       WHERE p.tenant_id = ? AND p.ativo = 1`, [tenant]);
    const [obrasRows]: any = await pool.execute(`${SELECT_OBRAS} WHERE o.tenant_id = ? AND o.situacao IN ('CONCLUIDA', 'ORCAMENTO', 'AGUARDANDO_SINAL', 'EM_EXECUCAO')`, [tenant]);
    const obras: ReturnType<typeof formatarObra>[] = obrasRows.map(formatarObra);
    const porPoco = new Map<number, ReturnType<typeof formatarObra>[]>();
    for (const o of obras) if (o.idPoco) porPoco.set(o.idPoco, [...(porPoco.get(o.idPoco) || []), o]);
    const planos = planoRows.map((p: any) => {
      const doPoco = porPoco.get(Number(p.id_poco)) || [];
      const ultimas = ultimaPorServico(doPoco);
      const aberta = doPoco.find(o => o.situacao !== 'CONCLUIDA' && o.servicos.includes(p.servico));   // já tem obra aberta para esse serviço
      return {
        ...formatarPlano(p, ultimas[p.servico] || null, hoje), poco: p.poco, cidade: p.cidade || null, idCliente: nulo(p.id_proprietario),
        cliente: p.cliente || null, telefone: p.telefone || null, obraAberta: aberta ? { idObra: aberta.idObra, situacao: aberta.situacao } : null,
      };
    }).filter((p: any) => req.query.todas || p.situacao === 'VENCIDA' || p.situacao === 'A_VENCER')
      .sort((a: any, b: any) => String(a.proxima || '9999').localeCompare(String(b.proxima || '9999')));
    const [cli]: any = await pool.execute(
      `SELECT o.id_obra, c.nome, c.telefone, po.identificacao AS poco FROM modulo_hidraulica_pocos_obras o
       LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = o.id_cliente
       LEFT JOIN modulo_hidraulica_pocos_pocos po ON po.id_poco = o.id_poco WHERE o.tenant_id = ? AND o.situacao = 'CONCLUIDA'`, [tenant]);
    const extra = new Map<number, any>(cli.map((x: any) => [Number(x.id_obra), x]));
    const garantias = obras.filter(o => o.situacao === 'CONCLUIDA' && garantiaVencendo(o.garantiaAte, hoje))
      .map(o => ({ ...o, cliente: extra.get(o.idObra)?.nome || null, telefone: extra.get(o.idObra)?.telefone || null, poco: extra.get(o.idObra)?.poco || null }))
      .sort((a, b) => String(a.garantiaAte).localeCompare(String(b.garantiaAte)));
    return res.json({ planos, garantias });
  } catch (e) { return responderErro(res, e, 'Erro ao listar as manutenções.'); }
};
