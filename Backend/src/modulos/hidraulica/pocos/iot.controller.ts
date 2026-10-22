// Obras de poços › monitoramento remoto (etapa 7): cadastro dos aparelhos, a rota que recebe as leituras (o aparelho se
// identifica com X-Dispositivo e X-Chave; a chave é calculada da IOT_CHAVE_MESTRA do .env, nunca guardada), os alertas
// (abrem e fecham sozinhos), o painel e o simulador. Tabelas modulo_hidraulica_pocos_dispositivos, _leituras e _alertas.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { ErroObra } from './obras';
import { responderErro } from './obras.controller';
import {
  chaveConfere, chaveDoDispositivo, FATOR_SEM_SINAL, Leitura, lerLote, Limites, reconciliar, resumoPorDia, statusDoDispositivo, TipoAlerta, validarDispositivo,
} from './iot';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const mestra = () => process.env.IOT_CHAVE_MESTRA || '';

const formatarDispositivo = (d: any) => ({
  idDispositivo: Number(d.id_dispositivo), idPoco: Number(d.id_poco), poco: d.poco || null, cidade: d.cidade || null, cliente: d.cliente || null, telefone: d.telefone || null,
  nome: d.nome, identificador: d.identificador, conexao: d.conexao, intervaloMin: Number(d.intervalo_min), profundidadeSensorM: nulo(d.profundidade_sensor_m),
  nivelAlertaM: nulo(d.nivel_alerta_m), correnteMinA: nulo(d.corrente_min_a), correnteMaxA: nulo(d.corrente_max_a), vazaoMinLh: nulo(d.vazao_min_lh),
  tensaoMinV: nulo(d.tensao_min_v), tensaoMaxV: nulo(d.tensao_max_v), situacao: d.situacao, observacao: d.observacao || null, ultimaLeituraEm: d.ultima_txt || null,
});
const SELECT_DISP = `SELECT d.*, DATE_FORMAT(d.ultima_leitura_em, '%Y-%m-%d %H:%i:%s') AS ultima_txt, po.identificacao AS poco, po.cidade, c.nome AS cliente, c.telefone
  FROM modulo_hidraulica_pocos_dispositivos d
  JOIN modulo_hidraulica_pocos_pocos po ON po.id_poco = d.id_poco
  LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = po.id_proprietario`;
const limitesDe = (d: any): Limites => ({
  nivelAlertaM: nulo(d.nivel_alerta_m), correnteMinA: nulo(d.corrente_min_a), correnteMaxA: nulo(d.corrente_max_a),
  vazaoMinLh: nulo(d.vazao_min_lh), tensaoMinV: nulo(d.tensao_min_v), tensaoMaxV: nulo(d.tensao_max_v),
});
const formatarLeitura = (l: any): Leitura => ({
  em: l.em_txt, nivelM: nulo(l.nivel_m), vazaoLh: nulo(l.vazao_lh), correnteA: nulo(l.corrente_a), tensaoV: nulo(l.tensao_v),
  bombaLigada: l.bomba_ligada === null ? null : !!l.bomba_ligada, horimetroH: nulo(l.horimetro_h), temperaturaC: nulo(l.temperatura_c),
  sinalDbm: nulo(l.sinal_dbm), bateriaV: nulo(l.bateria_v),
});

const carregarDispositivo = async (conn: any, tenant: number, id: number) => {
  const [[d]]: any = await conn.execute(`${SELECT_DISP} WHERE d.id_dispositivo = ? AND d.tenant_id = ?`, [id, tenant]);
  if (!d) throw new ErroObra('Aparelho não encontrado.', 404);
  return d;
};

/**
 * Grava o lote (a mesma hora do mesmo aparelho não duplica) e reconcilia os alertas com as leituras mais novas que a
 * última recebida (leitura antiga reenviada só é guardada). Atualiza a hora da última leitura.
 */
const processarLote = async (conn: any, d: any, body: any) => {
  const leituras = lerLote(body, new Date(), nulo(d.profundidade_sensor_m));
  const linhas = leituras.map(l => [d.tenant_id, d.id_dispositivo, l.em, l.nivelM, l.vazaoLh, l.correnteA, l.tensaoV,
    l.bombaLigada === null ? null : l.bombaLigada ? 1 : 0, l.horimetroH, l.temperaturaC, l.sinalDbm, l.bateriaV]);
  const [ins]: any = await conn.query(
    `INSERT IGNORE INTO modulo_hidraulica_pocos_leituras (tenant_id, id_dispositivo, em, nivel_m, vazao_lh, corrente_a, tensao_v, bomba_ligada, horimetro_h,
       temperatura_c, sinal_dbm, bateria_v) VALUES ?`, [linhas]);
  const ultima: string | null = d.ultima_txt || null;
  const novas = leituras.filter(l => !ultima || l.em > ultima);
  let abertos = 0, fechados = 0;
  if (novas.length) {
    const [ab]: any = await conn.execute(`SELECT tipo FROM modulo_hidraulica_pocos_alertas WHERE id_dispositivo = ? AND fim IS NULL`, [d.id_dispositivo]);
    const r = reconciliar(ab.map((x: any) => x.tipo as TipoAlerta), novas, limitesDe(d));
    for (const a of r.abrir) {
      await conn.execute(
        `INSERT INTO modulo_hidraulica_pocos_alertas (tenant_id, id_dispositivo, tipo, mensagem, valor, inicio, fim) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [d.tenant_id, d.id_dispositivo, a.tipo, a.mensagem.slice(0, 255), a.valor, a.inicio, a.fim || null]);
      abertos++;
    }
    for (const f of r.fechar) {
      const [u]: any = await conn.execute(`UPDATE modulo_hidraulica_pocos_alertas SET fim = ? WHERE id_dispositivo = ? AND tipo = ? AND fim IS NULL`, [f.fim, d.id_dispositivo, f.tipo]);
      fechados += u.affectedRows;
    }
    await conn.execute(
      `UPDATE modulo_hidraulica_pocos_dispositivos SET ultima_leitura_em = GREATEST(COALESCE(ultima_leitura_em, '1970-01-01'), ?) WHERE id_dispositivo = ?`,
      [novas[novas.length - 1].em, d.id_dispositivo]);
  }
  return { recebidas: leituras.length, gravadas: Number(ins.affectedRows), alertasAbertos: abertos, alertasFechados: fechados };
};

/**
 * POST /iot/leituras — a rota do aparelho. Cabeçalhos X-Dispositivo (identificador) e X-Chave; corpo
 * { leituras: [{ em, nivel_m | coluna_m, vazao_lh, corrente_a, tensao_v, bomba, horimetro_h, temp_c, sinal_dbm, bateria_v }] }.
 * Responde 401 com chave errada e 409 com aparelho inativo (o aparelho deve guardar e tentar depois só nos erros 5xx).
 */
export const receberLeituras = async (req: Request, res: Response) => {
  const conn: any = await pool.getConnection();
  try {
    const identificador = String(req.headers['x-dispositivo'] || req.body?.dispositivo || '').trim().toUpperCase();
    const chave = String(req.headers['x-chave'] || req.body?.chave || '');
    if (!identificador) throw new ErroObra('Informe o aparelho (cabeçalho X-Dispositivo).', 401);
    if (!chaveConfere(mestra(), identificador, chave)) throw new ErroObra('Chave do aparelho não confere.', 401);
    await conn.beginTransaction();
    const [[d]]: any = await conn.execute(
      `SELECT d.*, DATE_FORMAT(d.ultima_leitura_em, '%Y-%m-%d %H:%i:%s') AS ultima_txt FROM modulo_hidraulica_pocos_dispositivos d WHERE d.identificador = ? FOR UPDATE`, [identificador]);
    if (!d) throw new ErroObra('Aparelho não cadastrado.', 404);
    if (d.situacao !== 'ATIVO') throw new ErroObra('Aparelho inativo no cadastro.', 409);
    const r = await processarLote(conn, d, req.body);
    await conn.commit();
    return res.status(201).json({ ok: true, ...r, servidor: new Date().toISOString() });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao receber as leituras.');
  } finally { conn.release(); }
};

// POST /iot/dispositivos/:id/simular { ...leitura } ou { leituras: [...] } — teste pela tela, sem o aparelho
export const simularLeitura = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const d = await carregarDispositivo(conn, tenant, Number(req.params.id));
    const { tenant_id: _t, ...corpo } = req.body || {};
    const r = await processarLote(conn, d, corpo);
    await conn.commit();
    return res.status(201).json(r);
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao simular a leitura.');
  } finally { conn.release(); }
};

/** Abre "sem sinal" para o aparelho ativo que já enviou e passou de 3× o intervalo sem leitura (roda ao abrir o painel). */
const verificarSemSinal = async (tenant: number) => {
  const [rows]: any = await pool.execute(
    `SELECT d.id_dispositivo, d.intervalo_min, d.ultima_leitura_em FROM modulo_hidraulica_pocos_dispositivos d
     WHERE d.tenant_id = ? AND d.situacao = 'ATIVO' AND d.ultima_leitura_em IS NOT NULL
       AND d.ultima_leitura_em < NOW() - INTERVAL (d.intervalo_min * ${FATOR_SEM_SINAL}) MINUTE
       AND NOT EXISTS (SELECT 1 FROM modulo_hidraulica_pocos_alertas a WHERE a.id_dispositivo = d.id_dispositivo AND a.tipo = 'SEM_SINAL' AND a.fim IS NULL)`, [tenant]);
  for (const d of rows) {
    await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_alertas (tenant_id, id_dispositivo, tipo, mensagem, inicio)
       VALUES (?, ?, 'SEM_SINAL', ?, ? + INTERVAL ? MINUTE)`,
      [tenant, d.id_dispositivo, `Sem leitura há mais de ${Number(d.intervalo_min) * FATOR_SEM_SINAL} minutos.`, d.ultima_leitura_em, Number(d.intervalo_min) * FATOR_SEM_SINAL]);
  }
};

const formatarAlerta = (a: any) => ({
  idAlerta: Number(a.id_alerta), idDispositivo: Number(a.id_dispositivo), dispositivo: a.dispositivo || null, idPoco: nulo(a.id_poco), poco: a.poco || null,
  cliente: a.cliente || null, telefone: a.telefone || null, tipo: a.tipo, mensagem: a.mensagem, valor: nulo(a.valor),
  inicio: a.inicio_txt, fim: a.fim_txt || null, vistoEm: a.visto_txt || null, vistoPor: a.visto_por || null,
});
const SELECT_ALERTA = `SELECT a.*, DATE_FORMAT(a.inicio, '%Y-%m-%d %H:%i') AS inicio_txt, DATE_FORMAT(a.fim, '%Y-%m-%d %H:%i') AS fim_txt,
    DATE_FORMAT(a.visto_em, '%Y-%m-%d %H:%i') AS visto_txt, d.nome AS dispositivo, d.id_poco, po.identificacao AS poco, c.nome AS cliente, c.telefone
  FROM modulo_hidraulica_pocos_alertas a
  JOIN modulo_hidraulica_pocos_dispositivos d ON d.id_dispositivo = a.id_dispositivo
  JOIN modulo_hidraulica_pocos_pocos po ON po.id_poco = d.id_poco
  LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = po.id_proprietario`;

// GET /iot/painel — os aparelhos (situação, última leitura, alertas abertos) e os alertas abertos
export const painelIot = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    await verificarSemSinal(tenant);
    const [disp]: any = await pool.execute(`${SELECT_DISP} WHERE d.tenant_id = ? ORDER BY d.situacao, po.identificacao`, [tenant]);
    const [ult]: any = await pool.execute(
      `SELECT l.*, DATE_FORMAT(l.em, '%Y-%m-%d %H:%i:%s') AS em_txt FROM modulo_hidraulica_pocos_leituras l
       JOIN modulo_hidraulica_pocos_dispositivos d ON d.id_dispositivo = l.id_dispositivo AND l.em = d.ultima_leitura_em WHERE d.tenant_id = ?`, [tenant]);
    const [alertas]: any = await pool.execute(`${SELECT_ALERTA} WHERE a.tenant_id = ? AND a.fim IS NULL ORDER BY a.inicio DESC`, [tenant]);
    const [hoje]: any = await pool.execute(
      `SELECT l.id_dispositivo, l.*, DATE_FORMAT(l.em, '%Y-%m-%d %H:%i:%s') AS em_txt FROM modulo_hidraulica_pocos_leituras l
       WHERE l.tenant_id = ? AND l.em >= CURDATE() ORDER BY l.em`, [tenant]);
    const agora = new Date();
    const lista = disp.map((d: any) => {
      const f = formatarDispositivo(d);
      const ultima = ult.find((l: any) => Number(l.id_dispositivo) === f.idDispositivo);
      const doDia = resumoPorDia(hoje.filter((l: any) => Number(l.id_dispositivo) === f.idDispositivo).map(formatarLeitura), f.intervaloMin)[0] || null;
      return {
        ...f, status: f.situacao === 'INATIVO' ? 'INATIVO' : statusDoDispositivo(f.ultimaLeituraEm, f.intervaloMin, agora),
        ultima: ultima ? formatarLeitura(ultima) : null, hoje: doDia,
        alertasAbertos: alertas.filter((a: any) => Number(a.id_dispositivo) === f.idDispositivo).length,
      };
    });
    return res.json({ dispositivos: lista, alertas: alertas.map(formatarAlerta), chaveConfigurada: mestra().length >= 16 });
  } catch (e) { return responderErro(res, e, 'Erro ao montar o painel do monitoramento.'); }
};

// GET /iot/dispositivos/:id/leituras?horas=24 — leituras do período (reduzidas a ~1500 pontos) e o resumo por dia
export const leiturasDoDispositivo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const d = await carregarDispositivo(pool, tenant, Number(req.params.id));
    const horas = Math.min(Math.max(Math.floor(Number(req.query.horas) || 24), 1), 24 * 90);
    const [rows]: any = await pool.execute(
      `SELECT l.*, DATE_FORMAT(l.em, '%Y-%m-%d %H:%i:%s') AS em_txt FROM modulo_hidraulica_pocos_leituras l
       WHERE l.id_dispositivo = ? AND l.em >= NOW() - INTERVAL ? HOUR ORDER BY l.em`, [d.id_dispositivo, horas]);
    const todas = rows.map(formatarLeitura);
    const passo = Math.max(1, Math.ceil(todas.length / 1500));
    return res.json({
      dispositivo: formatarDispositivo(d), horas, total: todas.length,
      leituras: todas.filter((_: Leitura, i: number) => i % passo === 0 || i === todas.length - 1),
      dias: resumoPorDia(todas, Number(d.intervalo_min)),
    });
  } catch (e) { return responderErro(res, e, 'Erro ao carregar as leituras.'); }
};

// GET /iot/alertas?dias=30 — abertos e os dos últimos dias
export const listarAlertas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const dias = Math.min(Math.max(Math.floor(Number(req.query.dias) || 30), 1), 365);
    const [rows]: any = await pool.execute(
      `${SELECT_ALERTA} WHERE a.tenant_id = ? AND (a.fim IS NULL OR a.inicio >= NOW() - INTERVAL ? DAY) ORDER BY a.fim IS NULL DESC, a.inicio DESC LIMIT 1000`, [tenant, dias]);
    return res.json(rows.map(formatarAlerta));
  } catch (e) { return responderErro(res, e, 'Erro ao listar os alertas.'); }
};

// POST /iot/alertas/:id/visto
export const marcarVisto = async (req: Request, res: Response) => {
  try {
    const [u]: any = await pool.execute(`UPDATE modulo_hidraulica_pocos_alertas SET visto_em = NOW(), visto_por = ? WHERE id_alerta = ? AND tenant_id = ? AND visto_em IS NULL`,
      [operadorDe(req), Number(req.params.id), tenantDe(req)]);
    return res.json({ ok: u.affectedRows > 0 });
  } catch (e) { return responderErro(res, e, 'Erro ao marcar o alerta.'); }
};

// GET /iot/dispositivos
export const listarDispositivos = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute(`${SELECT_DISP} WHERE d.tenant_id = ? ORDER BY d.situacao, po.identificacao`, [tenantDe(req)]);
    return res.json(rows.map(formatarDispositivo));
  } catch (e) { return responderErro(res, e, 'Erro ao listar os aparelhos.'); }
};

const gravarDispositivo = async (req: Request, res: Response, id: number | null) => {
  const tenant = tenantDe(req);
  try {
    const d = validarDispositivo(req.body);
    const idPoco = Number(req.body?.idPoco);
    const [[poco]]: any = await pool.execute(`SELECT id_poco FROM modulo_hidraulica_pocos_pocos WHERE id_poco = ? AND tenant_id = ?`, [idPoco, tenant]);
    if (!poco) throw new ErroObra('Escolha o poço do aparelho.');
    const [[mesmo]]: any = await pool.execute(`SELECT id_dispositivo FROM modulo_hidraulica_pocos_dispositivos WHERE identificador = ? AND id_dispositivo <> ?`, [d.identificador, id || 0]);
    if (mesmo) throw new ErroObra(`Já existe um aparelho com o identificador ${d.identificador}.`, 409);
    const valores = [idPoco, d.nome, d.identificador, d.conexao, d.intervaloMin, d.profundidadeSensorM, d.nivelAlertaM, d.correnteMinA, d.correnteMaxA, d.vazaoMinLh,
      d.tensaoMinV, d.tensaoMaxV, d.situacao, d.observacao, operadorDe(req)];
    if (id) {
      const [u]: any = await pool.execute(
        `UPDATE modulo_hidraulica_pocos_dispositivos SET id_poco = ?, nome = ?, identificador = ?, conexao = ?, intervalo_min = ?, profundidade_sensor_m = ?, nivel_alerta_m = ?,
           corrente_min_a = ?, corrente_max_a = ?, vazao_min_lh = ?, tensao_min_v = ?, tensao_max_v = ?, situacao = ?, observacao = ?, operador = ?
         WHERE id_dispositivo = ? AND tenant_id = ?`, [...valores, id, tenant]);
      if (!u.affectedRows) throw new ErroObra('Aparelho não encontrado.', 404);
    } else {
      const [ins]: any = await pool.execute(
        `INSERT INTO modulo_hidraulica_pocos_dispositivos (id_poco, nome, identificador, conexao, intervalo_min, profundidade_sensor_m, nivel_alerta_m, corrente_min_a,
           corrente_max_a, vazao_min_lh, tensao_min_v, tensao_max_v, situacao, observacao, operador, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...valores, tenant]);
      id = Number(ins.insertId);
    }
    return res.status(req.method === 'POST' ? 201 : 200).json(formatarDispositivo(await carregarDispositivo(pool, tenant, id)));
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o aparelho.'); }
};
export const criarDispositivo = (req: Request, res: Response) => gravarDispositivo(req, res, null);
export const salvarDispositivo = (req: Request, res: Response) => gravarDispositivo(req, res, Number(req.params.id));

// GET /iot/dispositivos/:id/chave — a chave para gravar no firmware (calculada; não fica no banco)
export const chaveDoAparelho = async (req: Request, res: Response) => {
  try {
    const d = await carregarDispositivo(pool, tenantDe(req), Number(req.params.id));
    return res.json({ identificador: d.identificador, chave: chaveDoDispositivo(mestra(), d.identificador) });
  } catch (e) { return responderErro(res, e, 'Erro ao gerar a chave.'); }
};
