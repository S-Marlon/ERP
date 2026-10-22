// Obras de poços › monitoramento remoto (etapa 7): cadastro dos aparelhos, a rota que recebe as leituras (o aparelho se
// identifica com X-Dispositivo e X-Chave; a chave é calculada da IOT_CHAVE_MESTRA do .env, nunca guardada), a importação
// por arquivo (poço sem internet), os alertas (abrem e fecham sozinhos, com o estado do quadro de comando), o relatório
// do mês, o painel, o simulador e a fila de comandos remotos (o aparelho recebe na resposta do envio e confirma no
// seguinte). Tabelas modulo_hidraulica_pocos_dispositivos, _leituras, _alertas e _comandos.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { ErroObra } from './obras';
import { responderErro } from './obras.controller';
import {
  chaveConfere, chaveDoDispositivo, contextoDasAnteriores, CORRENTE_PARADA_A, FATOR_SEM_SINAL, Leitura, LOTE_MAXIMO, lerArquivo, lerLote, Limites, reconciliar,
  relatorioDoMes, resumoPorDia, statusDoDispositivo, TipoAlerta, VALIDADE_COMANDO_MIN, validarComando, validarDispositivo,
} from './iot';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const sn = (v: unknown) => (v === null || v === undefined ? null : !!Number(v));
const mestra = () => process.env.IOT_CHAVE_MESTRA || '';

const formatarDispositivo = (d: any) => ({
  idDispositivo: Number(d.id_dispositivo), idPoco: Number(d.id_poco), poco: d.poco || null, cidade: d.cidade || null, cliente: d.cliente || null, telefone: d.telefone || null,
  nome: d.nome, identificador: d.identificador, conexao: d.conexao, alimentacao: d.alimentacao, intervaloMin: Number(d.intervalo_min),
  profundidadeSensorM: nulo(d.profundidade_sensor_m), nivelAlertaM: nulo(d.nivel_alerta_m), correnteMinA: nulo(d.corrente_min_a), correnteMaxA: nulo(d.corrente_max_a),
  vazaoMinLh: nulo(d.vazao_min_lh), tensaoMinV: nulo(d.tensao_min_v), tensaoMaxV: nulo(d.tensao_max_v), pressaoMinBar: nulo(d.pressao_min_bar),
  horasMaxLigada: nulo(d.horas_max_ligada), partidasMaxHora: nulo(d.partidas_max_hora), tarifaKwh: nulo(d.tarifa_kwh), aceitaComandos: !!d.aceita_comandos,
  situacao: d.situacao, observacao: d.observacao || null, ultimaLeituraEm: d.ultima_txt || null,
});
const SELECT_DISP = `SELECT d.*, DATE_FORMAT(d.ultima_leitura_em, '%Y-%m-%d %H:%i:%s') AS ultima_txt, po.identificacao AS poco, po.cidade, c.nome AS cliente, c.telefone
  FROM modulo_hidraulica_pocos_dispositivos d
  JOIN modulo_hidraulica_pocos_pocos po ON po.id_poco = d.id_poco
  LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = po.id_proprietario`;
const limitesDe = (d: any): Limites => ({
  alimentacao: d.alimentacao || 'MONOFASICO', nivelAlertaM: nulo(d.nivel_alerta_m), correnteMinA: nulo(d.corrente_min_a), correnteMaxA: nulo(d.corrente_max_a),
  vazaoMinLh: nulo(d.vazao_min_lh), tensaoMinV: nulo(d.tensao_min_v), tensaoMaxV: nulo(d.tensao_max_v), pressaoMinBar: nulo(d.pressao_min_bar),
  horasMaxLigada: nulo(d.horas_max_ligada), partidasMaxHora: nulo(d.partidas_max_hora),
});
const COLUNAS_LEITURA = `l.*, DATE_FORMAT(l.em, '%Y-%m-%d %H:%i:%s') AS em_txt`;
const formatarLeitura = (l: any): Leitura => ({
  em: l.em_txt, nivelM: nulo(l.nivel_m), vazaoLh: nulo(l.vazao_lh), pressaoBar: nulo(l.pressao_bar), correnteA: nulo(l.corrente_a), tensaoV: nulo(l.tensao_v),
  faseAV: nulo(l.fase_a_v), faseBV: nulo(l.fase_b_v), faseCV: nulo(l.fase_c_v), bombaLigada: sn(l.bomba_ligada), comandoLigado: sn(l.comando_ligado),
  termicoOk: sn(l.termico_ok), boiaPedindo: sn(l.boia_pedindo), modo: l.modo || null, horimetroH: nulo(l.horimetro_h), energiaKwh: nulo(l.energia_kwh),
  partidas: nulo(l.partidas), temperaturaC: nulo(l.temperatura_c), sinalDbm: nulo(l.sinal_dbm), bateriaV: nulo(l.bateria_v),
});
const b01 = (x: boolean | null) => (x === null ? null : x ? 1 : 0);

const carregarDispositivo = async (conn: any, tenant: number, id: number, trava = '') => {
  const [[d]]: any = await conn.execute(`${SELECT_DISP} WHERE d.id_dispositivo = ? AND d.tenant_id = ? ${trava}`, [id, tenant]);
  if (!d) throw new ErroObra('Aparelho não encontrado.', 404);
  return d;
};

/**
 * O contexto antes do lote: as leituras da última hora antes dele (partidas, "não parte" anterior) e, se a bomba vinha
 * ligada, desde quando (a primeira leitura ligada depois da última desligada).
 */
const contextoAntes = async (conn: any, d: any, primeira: string, lim: Limites) => {
  const [rows]: any = await conn.execute(
    `SELECT ${COLUNAS_LEITURA} FROM modulo_hidraulica_pocos_leituras l WHERE l.id_dispositivo = ? AND l.em >= ? - INTERVAL 60 MINUTE AND l.em < ? ORDER BY l.em`,
    [d.id_dispositivo, primeira, primeira]);
  const ctx = contextoDasAnteriores(rows.map(formatarLeitura), lim);
  if (ctx.ultimaLigada && ctx.ligadaDesde) {
    const [[off]]: any = await conn.execute(
      `SELECT DATE_FORMAT(MAX(em), '%Y-%m-%d %H:%i:%s') AS em FROM modulo_hidraulica_pocos_leituras
       WHERE id_dispositivo = ? AND em < ? AND (bomba_ligada = 0 OR (bomba_ligada IS NULL AND corrente_a <= ?))`, [d.id_dispositivo, ctx.ligadaDesde, CORRENTE_PARADA_A]);
    const [[on]]: any = await conn.execute(
      `SELECT DATE_FORMAT(MIN(em), '%Y-%m-%d %H:%i:%s') AS em FROM modulo_hidraulica_pocos_leituras WHERE id_dispositivo = ? AND em > ? AND em <= ?`,
      [d.id_dispositivo, off?.em || '1970-01-01', ctx.ligadaDesde]);
    if (on?.em) ctx.ligadaDesde = on.em;
  }
  return ctx;
};

/**
 * Grava o lote (a mesma hora do mesmo aparelho não duplica) e reconcilia os alertas com as leituras mais novas que a
 * última recebida (leitura antiga reenviada só é guardada). Atualiza a hora da última leitura.
 */
const processarLote = async (conn: any, d: any, body: any, maxDias = 60) => {
  const leituras = lerLote(body, new Date(), nulo(d.profundidade_sensor_m), maxDias);
  const linhas = leituras.map(l => [d.tenant_id, d.id_dispositivo, l.em, l.nivelM, l.vazaoLh, l.pressaoBar, l.correnteA, l.tensaoV, l.faseAV, l.faseBV, l.faseCV,
    b01(l.bombaLigada), b01(l.comandoLigado), b01(l.termicoOk), b01(l.boiaPedindo), l.modo, l.horimetroH, l.energiaKwh, l.partidas, l.temperaturaC, l.sinalDbm, l.bateriaV]);
  const [ins]: any = await conn.query(
    `INSERT IGNORE INTO modulo_hidraulica_pocos_leituras (tenant_id, id_dispositivo, em, nivel_m, vazao_lh, pressao_bar, corrente_a, tensao_v, fase_a_v, fase_b_v,
       fase_c_v, bomba_ligada, comando_ligado, termico_ok, boia_pedindo, modo, horimetro_h, energia_kwh, partidas, temperatura_c, sinal_dbm, bateria_v) VALUES ?`, [linhas]);
  const ultima: string | null = d.ultima_txt || null;
  const novas = leituras.filter(l => !ultima || l.em > ultima);
  let abertos = 0, fechados = 0;
  if (novas.length) {
    const lim = limitesDe(d);
    const ctx = await contextoAntes(conn, d, novas[0].em, lim);
    const [ab]: any = await conn.execute(`SELECT tipo FROM modulo_hidraulica_pocos_alertas WHERE id_dispositivo = ? AND fim IS NULL`, [d.id_dispositivo]);
    const r = reconciliar(ab.map((x: any) => x.tipo as TipoAlerta), novas, lim, ctx);
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

/** Confirmações do aparelho ({ confirmacoes: [{ id, ok, resposta }] }) e os comandos pendentes para ele levar. */
const trocarComandos = async (conn: any, d: any, body: any) => {
  for (const c of Array.isArray(body?.confirmacoes) ? body.confirmacoes.slice(0, 50) : []) {
    await conn.execute(
      `UPDATE modulo_hidraulica_pocos_comandos SET situacao = ?, respondido_em = NOW(), resposta = ? WHERE id_comando = ? AND id_dispositivo = ? AND situacao = 'ENVIADO'`,
      [c?.ok === false ? 'FALHOU' : 'EXECUTADO', String(c?.resposta ?? '').slice(0, 255) || null, Number(c?.id) || 0, d.id_dispositivo]);
  }
  await conn.execute(`UPDATE modulo_hidraulica_pocos_comandos SET situacao = 'EXPIRADO' WHERE id_dispositivo = ? AND situacao = 'PENDENTE' AND expira_em < NOW()`, [d.id_dispositivo]);
  if (!d.aceita_comandos) return [];
  const [pend]: any = await conn.execute(
    `SELECT id_comando, comando FROM modulo_hidraulica_pocos_comandos WHERE id_dispositivo = ? AND situacao = 'PENDENTE' ORDER BY id_comando`, [d.id_dispositivo]);
  if (pend.length) {
    await conn.execute(`UPDATE modulo_hidraulica_pocos_comandos SET situacao = 'ENVIADO', enviado_em = NOW() WHERE id_comando IN (${pend.map(() => '?').join(',')})`,
      pend.map((p: any) => p.id_comando));
  }
  return pend.map((p: any) => ({ id: Number(p.id_comando), comando: p.comando }));
};

/**
 * POST /iot/leituras — a rota do aparelho. Cabeçalhos X-Dispositivo (identificador) e X-Chave; corpo
 * { leituras: [...], confirmacoes: [...] }. A resposta leva os comandos pendentes ({ comandos: [{ id, comando }] }).
 * 401 = chave errada; 409 = aparelho inativo (o aparelho só deve guardar e tentar de novo nos erros 5xx ou sem rede).
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
    const temLeitura = Array.isArray(req.body?.leituras) ? req.body.leituras.length > 0 : !!req.body && !req.body.confirmacoes;
    const r = temLeitura ? await processarLote(conn, d, req.body) : { recebidas: 0, gravadas: 0, alertasAbertos: 0, alertasFechados: 0 };
    const comandos = await trocarComandos(conn, d, req.body);
    await conn.commit();
    return res.status(201).json({ ok: true, ...r, comandos, servidor: new Date().toISOString() });
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
    const d = await carregarDispositivo(conn, tenant, Number(req.params.id), 'FOR UPDATE');
    const { tenant_id: _t, ...corpo } = req.body || {};
    const r = await processarLote(conn, d, corpo);
    await conn.commit();
    return res.status(201).json(r);
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao simular a leitura.');
  } finally { conn.release(); }
};

/**
 * POST /iot/dispositivos/:id/importar { conteudo } — o arquivo do poço sem internet (JSON do envio, JSONL ou CSV com
 * cabeçalho), em blocos de 500, aceitando leituras de até 1 ano. Reimportar o mesmo arquivo não duplica.
 */
export const importarLeituras = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const todas = lerArquivo(String(req.body?.conteudo || ''));
    if (todas.length > 100000) throw new ErroObra('Arquivo grande demais (máximo 100 mil leituras por vez).');
    await conn.beginTransaction();
    const soma = { recebidas: 0, gravadas: 0, alertasAbertos: 0, alertasFechados: 0 };
    for (let i = 0; i < todas.length; i += LOTE_MAXIMO) {
      const d = await carregarDispositivo(conn, tenant, Number(req.params.id), 'FOR UPDATE');   // a cada bloco, com a última leitura atualizada
      const r = await processarLote(conn, d, { leituras: todas.slice(i, i + LOTE_MAXIMO) }, 365);
      soma.recebidas += r.recebidas; soma.gravadas += r.gravadas; soma.alertasAbertos += r.alertasAbertos; soma.alertasFechados += r.alertasFechados;
    }
    await conn.commit();
    return res.status(201).json(soma);
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao importar o arquivo.');
  } finally { conn.release(); }
};

/** Abre "sem sinal" para o aparelho ativo com internet que já enviou e passou de 3× o intervalo sem leitura (roda ao abrir o painel). */
const verificarSemSinal = async (tenant: number) => {
  const [rows]: any = await pool.execute(
    `SELECT d.id_dispositivo, d.intervalo_min, d.ultima_leitura_em FROM modulo_hidraulica_pocos_dispositivos d
     WHERE d.tenant_id = ? AND d.situacao = 'ATIVO' AND d.conexao <> 'OFFLINE' AND d.ultima_leitura_em IS NOT NULL
       AND d.ultima_leitura_em < NOW() - INTERVAL (d.intervalo_min * ${FATOR_SEM_SINAL}) MINUTE
       AND NOT EXISTS (SELECT 1 FROM modulo_hidraulica_pocos_alertas a WHERE a.id_dispositivo = d.id_dispositivo AND a.tipo = 'SEM_SINAL' AND a.fim IS NULL)`, [tenant]);
  for (const d of rows) {
    await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_alertas (tenant_id, id_dispositivo, tipo, mensagem, inicio) VALUES (?, ?, 'SEM_SINAL', ?, ? + INTERVAL ? MINUTE)`,
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

// GET /iot/painel — os aparelhos (situação, última leitura, consumo do dia, alertas abertos) e os alertas abertos
export const painelIot = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    await verificarSemSinal(tenant);
    const [disp]: any = await pool.execute(`${SELECT_DISP} WHERE d.tenant_id = ? ORDER BY d.situacao, po.identificacao`, [tenant]);
    const [ult]: any = await pool.execute(
      `SELECT ${COLUNAS_LEITURA} FROM modulo_hidraulica_pocos_leituras l
       JOIN modulo_hidraulica_pocos_dispositivos d ON d.id_dispositivo = l.id_dispositivo AND l.em = d.ultima_leitura_em WHERE d.tenant_id = ?`, [tenant]);
    const [alertas]: any = await pool.execute(`${SELECT_ALERTA} WHERE a.tenant_id = ? AND a.fim IS NULL ORDER BY a.inicio DESC`, [tenant]);
    const [hoje]: any = await pool.execute(`SELECT ${COLUNAS_LEITURA} FROM modulo_hidraulica_pocos_leituras l WHERE l.tenant_id = ? AND l.em >= CURDATE() ORDER BY l.em`, [tenant]);
    const agora = new Date();
    const lista = disp.map((d: any) => {
      const f = formatarDispositivo(d);
      const ultima = ult.find((l: any) => Number(l.id_dispositivo) === f.idDispositivo);
      const doDia = resumoPorDia(hoje.filter((l: any) => Number(l.id_dispositivo) === f.idDispositivo).map(formatarLeitura), f.intervaloMin)[0] || null;
      return {
        ...f, status: f.situacao === 'INATIVO' ? 'INATIVO' : statusDoDispositivo(f.ultimaLeituraEm, f.intervaloMin, agora, f.conexao),
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
      `SELECT ${COLUNAS_LEITURA} FROM modulo_hidraulica_pocos_leituras l WHERE l.id_dispositivo = ? AND l.em >= NOW() - INTERVAL ? HOUR ORDER BY l.em`, [d.id_dispositivo, horas]);
    const todas = rows.map(formatarLeitura);
    const passo = Math.max(1, Math.ceil(todas.length / 1500));
    return res.json({
      dispositivo: formatarDispositivo(d), horas, total: todas.length,
      leituras: todas.filter((_: Leitura, i: number) => i % passo === 0 || i === todas.length - 1),
      dias: resumoPorDia(todas, Number(d.intervalo_min)),
    });
  } catch (e) { return responderErro(res, e, 'Erro ao carregar as leituras.'); }
};

// GET /iot/dispositivos/:id/relatorio?mes=AAAA-MM — o relatório do mês (dias, totais, energia, custo, alertas)
export const relatorioMensal = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const d = await carregarDispositivo(pool, tenant, Number(req.params.id));
    const hoje = new Date();
    const mes = /^\d{4}-\d{2}$/.test(String(req.query.mes || '')) ? String(req.query.mes) : `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const [rows]: any = await pool.execute(
      `SELECT ${COLUNAS_LEITURA} FROM modulo_hidraulica_pocos_leituras l WHERE l.id_dispositivo = ? AND l.em >= ? AND l.em < ? + INTERVAL 1 MONTH ORDER BY l.em`,
      [d.id_dispositivo, `${mes}-01`, `${mes}-01`]);
    const [al]: any = await pool.execute(
      `${SELECT_ALERTA} WHERE a.id_dispositivo = ? AND a.inicio >= ? AND a.inicio < ? + INTERVAL 1 MONTH ORDER BY a.inicio`, [d.id_dispositivo, `${mes}-01`, `${mes}-01`]);
    const rel = relatorioDoMes(mes, rows.map(formatarLeitura), Number(d.intervalo_min), nulo(d.tarifa_kwh), al, hoje);
    return res.json({ ...rel, dispositivo: formatarDispositivo(d), alertas: al.map(formatarAlerta) });
  } catch (e) { return responderErro(res, e, 'Erro ao montar o relatório.'); }
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

// ------------------------------------------------------------------ comandos remotos
const formatarComando = (c: any) => ({
  idComando: Number(c.id_comando), comando: c.comando, situacao: c.situacao, motivo: c.motivo || null, operador: c.operador,
  criadoEm: c.criado_txt, expiraEm: c.expira_txt, enviadoEm: c.enviado_txt || null, respondidoEm: c.respondido_txt || null, resposta: c.resposta || null,
});

// GET /iot/dispositivos/:id/comandos — os últimos comandos do aparelho (vence os pendentes que passaram da validade)
export const comandosDoDispositivo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const d = await carregarDispositivo(pool, tenant, Number(req.params.id));
    await pool.execute(`UPDATE modulo_hidraulica_pocos_comandos SET situacao = 'EXPIRADO' WHERE id_dispositivo = ? AND situacao = 'PENDENTE' AND expira_em < NOW()`, [d.id_dispositivo]);
    const [rows]: any = await pool.execute(
      `SELECT c.*, DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i') AS criado_txt, DATE_FORMAT(c.expira_em, '%Y-%m-%d %H:%i') AS expira_txt,
              DATE_FORMAT(c.enviado_em, '%Y-%m-%d %H:%i') AS enviado_txt, DATE_FORMAT(c.respondido_em, '%Y-%m-%d %H:%i') AS respondido_txt
       FROM modulo_hidraulica_pocos_comandos c WHERE c.id_dispositivo = ? ORDER BY c.id_comando DESC LIMIT 50`, [d.id_dispositivo]);
    return res.json(rows.map(formatarComando));
  } catch (e) { return responderErro(res, e, 'Erro ao listar os comandos.'); }
};

// POST /iot/dispositivos/:id/comandos { comando, motivo } — vai na resposta do próximo envio do aparelho (vale 10 min)
export const enviarComando = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const d = await carregarDispositivo(pool, tenant, Number(req.params.id));
    const c = validarComando(req.body, !!d.aceita_comandos);
    const [[pend]]: any = await pool.execute(
      `SELECT id_comando FROM modulo_hidraulica_pocos_comandos WHERE id_dispositivo = ? AND situacao = 'PENDENTE' AND expira_em >= NOW() LIMIT 1`, [d.id_dispositivo]);
    if (pend) throw new ErroObra('Já há um comando esperando o aparelho buscar: cancele ou espere.', 409);
    const [ins]: any = await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_comandos (tenant_id, id_dispositivo, comando, motivo, expira_em, operador) VALUES (?, ?, ?, ?, NOW() + INTERVAL ? MINUTE, ?)`,
      [tenant, d.id_dispositivo, c.comando, c.motivo, VALIDADE_COMANDO_MIN, operadorDe(req)]);
    return res.status(201).json({ idComando: Number(ins.insertId) });
  } catch (e) { return responderErro(res, e, 'Erro ao enviar o comando.'); }
};

// POST /iot/comandos/:id/cancelar — só o que o aparelho ainda não buscou
export const cancelarComando = async (req: Request, res: Response) => {
  try {
    const [u]: any = await pool.execute(`UPDATE modulo_hidraulica_pocos_comandos SET situacao = 'CANCELADO' WHERE id_comando = ? AND tenant_id = ? AND situacao = 'PENDENTE'`,
      [Number(req.params.id), tenantDe(req)]);
    if (!u.affectedRows) throw new ErroObra('O comando já foi buscado pelo aparelho (ou não está pendente).', 409);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao cancelar o comando.'); }
};

// ------------------------------------------------------------------ cadastro
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
    const colunas = ['id_poco', 'nome', 'identificador', 'conexao', 'alimentacao', 'intervalo_min', 'profundidade_sensor_m', 'nivel_alerta_m', 'corrente_min_a',
      'corrente_max_a', 'vazao_min_lh', 'tensao_min_v', 'tensao_max_v', 'pressao_min_bar', 'horas_max_ligada', 'partidas_max_hora', 'tarifa_kwh', 'aceita_comandos',
      'situacao', 'observacao', 'operador'];
    const valores = [idPoco, d.nome, d.identificador, d.conexao, d.alimentacao, d.intervaloMin, d.profundidadeSensorM, d.nivelAlertaM, d.correnteMinA, d.correnteMaxA,
      d.vazaoMinLh, d.tensaoMinV, d.tensaoMaxV, d.pressaoMinBar, d.horasMaxLigada, d.partidasMaxHora, d.tarifaKwh, d.aceitaComandos, d.situacao, d.observacao, operadorDe(req)];
    if (id) {
      const [u]: any = await pool.execute(
        `UPDATE modulo_hidraulica_pocos_dispositivos SET ${colunas.map(c => `${c} = ?`).join(', ')} WHERE id_dispositivo = ? AND tenant_id = ?`, [...valores, id, tenant]);
      if (!u.affectedRows) throw new ErroObra('Aparelho não encontrado.', 404);
    } else {
      const [ins]: any = await pool.execute(
        `INSERT INTO modulo_hidraulica_pocos_dispositivos (${colunas.join(', ')}, tenant_id) VALUES (${colunas.map(() => '?').join(', ')}, ?)`, [...valores, tenant]);
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
