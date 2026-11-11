// Obras de poços (etapa 1): obras (cliente de poço, serviços, situação, valores, relatório técnico em JSON) e a ficha
// de cada poço. Tabelas modulo_hidraulica_pocos_obras, _pocos e _clientes (cadastro do módulo, separado do geral).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { bloqueioDoSinal } from './cobranca';
import { acertarSinal, parcelaDoSinal } from './cobrancaBanco';
import {
  ErroObra, garantiaAte, lerServicos, podeIrPara, pocoDoRelatorio, proximasSituacoes, relatorioInicial, SituacaoObra, SITUACOES_OBRA, validarObra, validarPoco,
} from './obras';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const NOME_PESSOA = 'c.nome';
const JOIN_PESSOA = (col: string) => `LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = ${col}`;

export const responderErro = (res: Response, e: any, padrao: string) => {
  if (e instanceof ErroObra) return res.status(e.status).json({ error: e.message });
  console.error(padrao, e);
  return res.status(500).json({ error: padrao, details: e?.message });
};

const lerJson = (s: unknown) => { try { return s ? JSON.parse(String(s)) : {}; } catch { return {}; } };

// ------------------------------------------------------------------ poços
const formatarPoco = (r: any) => ({
  idPoco: Number(r.id_poco), identificacao: r.identificacao, idProprietario: nulo(r.id_proprietario), proprietario: r.proprietario || null,
  endereco: r.endereco || null, bairro: r.bairro || null, cidade: r.cidade || null, uf: r.uf || null, cep: r.cep || null,
  latitude: nulo(r.latitude), longitude: nulo(r.longitude), profundidadeM: nulo(r.profundidade_m), diametro: r.diametro || null,
  vazaoLh: nulo(r.vazao_lh), nivelEstaticoM: nulo(r.nivel_estatico_m), nivelDinamicoM: nulo(r.nivel_dinamico_m), tipoSolo: r.tipo_solo || null,
  dataPerfuracao: r.data_perfuracao_txt || null, perfuradoPor: r.perfurado_por, perfuradoPorNome: r.perfurado_por_nome || null,
  situacao: r.situacao, observacao: r.observacao || null, obras: Number(r.obras) || 0,
});
const SELECT_POCO = `SELECT p.*, DATE_FORMAT(p.data_perfuracao, '%Y-%m-%d') AS data_perfuracao_txt, ${NOME_PESSOA} AS proprietario,
         (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras o WHERE o.id_poco = p.id_poco) AS obras
       FROM modulo_hidraulica_pocos_pocos p ${JOIN_PESSOA('p.id_proprietario')}`;

const carregarPoco = async (tenant: number, id: number) => {
  const [[p]]: any = await pool.execute(`${SELECT_POCO} WHERE p.id_poco = ? AND p.tenant_id = ?`, [id, tenant]);
  if (!p) throw new ErroObra('Poço não encontrado.', 404);
  return p;
};

// GET /pocos?busca=&idProprietario=
export const listarPocos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const where = ['p.tenant_id = ?'];
    const params: any[] = [tenant];
    if (Number(req.query.idProprietario) > 0) { where.push('p.id_proprietario = ?'); params.push(Number(req.query.idProprietario)); }
    const busca = String(req.query.busca || '').trim();
    if (busca) { where.push(`(p.identificacao LIKE ? OR p.cidade LIKE ? OR p.endereco LIKE ? OR ${NOME_PESSOA} LIKE ?)`); params.push(...Array(4).fill(`%${busca}%`)); }
    const [rows]: any = await pool.execute(`${SELECT_POCO} WHERE ${where.join(' AND ')} ORDER BY p.identificacao LIMIT 500`, params);
    return res.json(rows.map(formatarPoco));
  } catch (e) { return responderErro(res, e, 'Erro ao listar os poços.'); }
};

const gravarPoco = async (conn: any, tenant: number, b: any, id: number | null, operador: string) => {
  const p = validarPoco(b);
  const valores = [p.identificacao, p.idProprietario, p.endereco, p.bairro, p.cidade, p.uf, p.cep, p.latitude, p.longitude, p.profundidadeM, p.diametro,
    p.vazaoLh, p.nivelEstaticoM, p.nivelDinamicoM, p.tipoSolo, p.dataPerfuracao, p.perfuradoPor, p.perfuradoPorNome, p.situacao, p.observacao, operador];
  if (id) {
    await conn.execute(
      `UPDATE modulo_hidraulica_pocos_pocos SET identificacao = ?, id_proprietario = ?, endereco = ?, bairro = ?, cidade = ?, uf = ?, cep = ?, latitude = ?, longitude = ?,
         profundidade_m = ?, diametro = ?, vazao_lh = ?, nivel_estatico_m = ?, nivel_dinamico_m = ?, tipo_solo = ?, data_perfuracao = ?, perfurado_por = ?,
         perfurado_por_nome = ?, situacao = ?, observacao = ?, operador = ? WHERE id_poco = ? AND tenant_id = ?`,
      [...valores, id, tenant]
    );
    return id;
  }
  const [ins]: any = await conn.execute(
    `INSERT INTO modulo_hidraulica_pocos_pocos (identificacao, id_proprietario, endereco, bairro, cidade, uf, cep, latitude, longitude, profundidade_m, diametro,
       vazao_lh, nivel_estatico_m, nivel_dinamico_m, tipo_solo, data_perfuracao, perfurado_por, perfurado_por_nome, situacao, observacao, operador, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...valores, tenant]
  );
  return Number(ins.insertId);
};

// POST /pocos
export const criarPoco = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = await gravarPoco(pool, tenant, req.body, null, operadorDe(req));
    return res.status(201).json(formatarPoco(await carregarPoco(tenant, id)));
  } catch (e) { return responderErro(res, e, 'Erro ao cadastrar o poço.'); }
};

// PUT /pocos/:id
export const salvarPoco = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregarPoco(tenant, id);
    await gravarPoco(pool, tenant, req.body, id, operadorDe(req));
    return res.json(formatarPoco(await carregarPoco(tenant, id)));
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o poço.'); }
};

// ------------------------------------------------------------------ obras
const formatarObra = (r: any, comRelatorio = false) => {
  const termino = r.data_termino_txt || null;
  const garantia = nulo(r.garantia_meses);
  return {
    idObra: Number(r.id_obra), idCliente: Number(r.id_cliente), cliente: r.cliente, telefone: r.telefone || null,
    idPoco: nulo(r.id_poco), poco: r.poco_identificacao || null, cidade: r.poco_cidade || null,
    latitude: nulo(r.poco_latitude), longitude: nulo(r.poco_longitude),
    titulo: r.titulo || null, servicos: lerServicos(r.servicos), situacao: r.situacao as SituacaoObra, proximas: proximasSituacoes(r.situacao),
    dataPrevisao: r.data_previsao_txt || null, dataInicio: r.data_inicio_txt || null, dataTermino: termino,
    garantiaMeses: garantia, garantiaAte: garantiaAte(termino, garantia), metrosPrevistos: nulo(r.metros_previstos),
    valorContratado: nulo(r.valor_contratado), valorParcelado: nulo(r.valor_parcelado), valorMetroExcedente: nulo(r.valor_metro_excedente), observacao: r.observacao || null,
    valorSinal: nulo(r.valor_sinal), sinalQuando: r.sinal_quando || 'ANTES',
    escopo: r.escopo || null, prazoExecucaoDias: nulo(r.prazo_execucao_dias), formaPagamento: r.forma_pagamento || null,
    validadeOrcamentoDias: nulo(r.validade_orcamento_dias),
    criadaEm: r.criada_txt,
    ...(comRelatorio ? { relatorio: lerJson(r.dados_relatorio) } : {}),
  };
};
const SELECT_OBRA = `SELECT o.*, ${NOME_PESSOA} AS cliente, c.telefone,
         po.identificacao AS poco_identificacao, po.cidade AS poco_cidade, po.latitude AS poco_latitude, po.longitude AS poco_longitude,
         DATE_FORMAT(o.data_previsao, '%Y-%m-%d') AS data_previsao_txt, DATE_FORMAT(o.data_inicio, '%Y-%m-%d') AS data_inicio_txt,
         DATE_FORMAT(o.data_termino, '%Y-%m-%d') AS data_termino_txt, DATE_FORMAT(o.created_at, '%Y-%m-%d') AS criada_txt
       FROM modulo_hidraulica_pocos_obras o ${JOIN_PESSOA('o.id_cliente')}
       LEFT JOIN modulo_hidraulica_pocos_pocos po ON po.id_poco = o.id_poco`;

const carregarObra = async (tenant: number, id: number) => {
  const [[o]]: any = await pool.execute(`${SELECT_OBRA} WHERE o.id_obra = ? AND o.tenant_id = ?`, [id, tenant]);
  if (!o) throw new ErroObra('Obra não encontrada.', 404);
  return o;
};

// GET /obras?situacao=&busca=&idCliente=&idPoco=
export const listarObras = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const where = ['o.tenant_id = ?'];
    const params: any[] = [tenant];
    const situacao = String(req.query.situacao || '').toUpperCase();
    if ((SITUACOES_OBRA as readonly string[]).includes(situacao)) { where.push('o.situacao = ?'); params.push(situacao); }
    for (const [chave, coluna] of [['idCliente', 'o.id_cliente'], ['idPoco', 'o.id_poco']]) {
      if (Number(req.query[chave]) > 0) { where.push(`${coluna} = ?`); params.push(Number(req.query[chave])); }
    }
    const busca = String(req.query.busca || '').trim();
    if (busca) { where.push(`(o.titulo LIKE ? OR po.identificacao LIKE ? OR po.cidade LIKE ? OR ${NOME_PESSOA} LIKE ? OR o.id_obra = ?)`); params.push(...Array(4).fill(`%${busca}%`), Number(busca) || 0); }
    const [rows]: any = await pool.execute(`${SELECT_OBRA} WHERE ${where.join(' AND ')} ORDER BY FIELD(o.situacao, 'EM_EXECUCAO', 'AGUARDANDO_SINAL', 'ORCAMENTO', 'CONCLUIDA', 'CANCELADA'), o.id_obra DESC LIMIT 500`, params);
    return res.json(rows.map((r: any) => formatarObra(r)));
  } catch (e) { return responderErro(res, e, 'Erro ao listar as obras.'); }
};

// GET /obras/:id (com o relatório)
export const detalheObra = async (req: Request, res: Response) => {
  try { return res.json(formatarObra(await carregarObra(tenantDe(req), Number(req.params.id)), true)); }
  catch (e) { return responderErro(res, e, 'Erro ao abrir a obra.'); }
};

/** Cliente de poço (nome, documento, telefone) para preencher o relatório da obra nova. */
const dadosDoCliente = async (conn: any, tenant: number, idCliente: number) => {
  const [[c]]: any = await conn.execute(
    `SELECT nome, documento, telefone FROM modulo_hidraulica_pocos_clientes WHERE id_cliente = ? AND tenant_id = ?`, [idCliente, tenant]
  );
  if (!c) throw new ErroObra('Cliente não encontrado no cadastro de clientes de poço.', 404);
  return c;
};

/** POST /obras { idCliente, idPoco? | novoPoco?, servicos, titulo, dataPrevisao, garantiaMeses, metrosPrevistos, valorContratado, valorMetroExcedente } */
export const criarObra = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const o = validarObra(req.body);
    await conn.beginTransaction();
    const cliente = await dadosDoCliente(conn, tenant, o.idCliente);
    let idPoco = o.idPoco;
    if (!idPoco && req.body?.novoPoco) idPoco = await gravarPoco(conn, tenant, { idProprietario: o.idCliente, ...req.body.novoPoco }, null, operadorDe(req));
    let poco: any = null;
    if (idPoco) {
      const [[p]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_pocos WHERE id_poco = ? AND tenant_id = ?`, [idPoco, tenant]);
      if (!p) throw new ErroObra('Poço não encontrado.', 404);
      poco = { endereco: p.endereco, bairro: p.bairro, cidade: p.cidade, uf: p.uf, cep: p.cep, latitude: nulo(p.latitude), longitude: nulo(p.longitude),
        profundidadeM: nulo(p.profundidade_m), vazaoLh: nulo(p.vazao_lh) };
    }
    const relatorio = relatorioInicial(cliente, poco, o);
    const [ins]: any = await conn.execute(
      `INSERT INTO modulo_hidraulica_pocos_obras (tenant_id, id_cliente, id_poco, titulo, servicos, situacao, data_previsao, garantia_meses, metros_previstos,
         valor_contratado, valor_parcelado, valor_metro_excedente, valor_sinal, sinal_quando, dados_relatorio, observacao, escopo, prazo_execucao_dias, forma_pagamento,
         validade_orcamento_dias, operador)
       VALUES (?, ?, ?, ?, ?, 'ORCAMENTO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, o.idCliente, idPoco, o.titulo, o.servicos.join(','), o.dataPrevisao, o.garantiaMeses, o.metrosPrevistos, o.valorContratado, o.valorParcelado,
        o.valorMetroExcedente, o.valorSinal, o.sinalQuando, JSON.stringify(relatorio), o.observacao, o.escopo, o.prazoExecucaoDias, o.formaPagamento,
        o.validadeOrcamentoDias, operadorDe(req)]
    );
    await acertarSinal(conn, tenant, Number(ins.insertId), o.valorSinal, operadorDe(req));
    await conn.commit();
    return res.status(201).json(formatarObra(await carregarObra(tenant, Number(ins.insertId)), true));
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao criar a obra.');
  } finally { conn.release(); }
};

// PUT /obras/:id (dados da obra; a situação muda por /situacao e o relatório por /relatorio). A parcela do sinal
// acompanha o valor do sinal (não deixa ficar abaixo do que já foi recebido).
export const salvarObra = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    await carregarObra(tenant, id);
    const o = validarObra(req.body);
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE modulo_hidraulica_pocos_obras SET id_cliente = ?, id_poco = ?, titulo = ?, servicos = ?, data_previsao = ?, garantia_meses = ?, metros_previstos = ?,
         valor_contratado = ?, valor_parcelado = ?, valor_metro_excedente = ?, valor_sinal = ?, sinal_quando = ?, observacao = ?, escopo = ?, prazo_execucao_dias = ?,
         forma_pagamento = ?, validade_orcamento_dias = ?, operador = ? WHERE id_obra = ? AND tenant_id = ?`,
      [o.idCliente, o.idPoco, o.titulo, o.servicos.join(','), o.dataPrevisao, o.garantiaMeses, o.metrosPrevistos, o.valorContratado, o.valorParcelado,
        o.valorMetroExcedente, o.valorSinal, o.sinalQuando, o.observacao, o.escopo, o.prazoExecucaoDias, o.formaPagamento, o.validadeOrcamentoDias,
        operadorDe(req), id, tenant]
    );
    await acertarSinal(conn, tenant, id, o.valorSinal, operadorDe(req));
    await conn.commit();
    return res.json(formatarObra(await carregarObra(tenant, id), true));
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao salvar a obra.');
  } finally { conn.release(); }
};

// PUT /obras/:id/relatorio { dados } — o relatório técnico (gravado sozinho enquanto o operador preenche)
export const salvarRelatorio = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const dados = req.body?.dados;
    if (!dados || typeof dados !== 'object') throw new ErroObra('Relatório vazio.');
    const json = JSON.stringify(dados);
    if (json.length > 2_000_000) throw new ErroObra('Relatório grande demais.');
    const [r]: any = await pool.execute(`UPDATE modulo_hidraulica_pocos_obras SET dados_relatorio = ? WHERE id_obra = ? AND tenant_id = ?`, [json, Number(req.params.id), tenant]);
    if (!r.affectedRows) throw new ErroObra('Obra não encontrada.', 404);
    return res.json({ salvoEm: new Date().toISOString() });
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o relatório.'); }
};

/**
 * POST /obras/:id/situacao { situacao } — muda a situação pelas passagens permitidas. Em execução marca o início;
 * concluída marca o fim e, na perfuração, passa o que o relatório mediu para a ficha do poço (criando o poço se faltar).
 */
export const mudarSituacao = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const para = String(req.body?.situacao || '').toUpperCase() as SituacaoObra;
    await conn.beginTransaction();
    const [[o]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_obras WHERE id_obra = ? AND tenant_id = ? FOR UPDATE`, [id, tenant]);
    if (!o) throw new ErroObra('Obra não encontrada.', 404);
    if (!podeIrPara(o.situacao, para)) throw new ErroObra(`A obra não pode ir de "${o.situacao}" para "${para}".`, 409);
    if (para === 'EM_EXECUCAO') {
      const bloqueio = bloqueioDoSinal(nulo(o.valor_sinal), o.sinal_quando, await parcelaDoSinal(conn, id));
      if (bloqueio) throw new ErroObra(bloqueio, 409);
    }
    await conn.execute(
      `UPDATE modulo_hidraulica_pocos_obras SET situacao = ?, operador = ?,
         data_inicio = CASE WHEN ? = 'EM_EXECUCAO' AND data_inicio IS NULL THEN CURDATE() ELSE data_inicio END,
         data_termino = CASE WHEN ? = 'CONCLUIDA' AND data_termino IS NULL THEN CURDATE() ELSE data_termino END
       WHERE id_obra = ?`,
      [para, operadorDe(req), para, para, id]
    );
    let pocoAtualizado = false;
    if (para === 'CONCLUIDA' && lerServicos(o.servicos).includes('PERFURACAO')) {
      const medido = pocoDoRelatorio(lerJson(o.dados_relatorio));
      let idPoco = nulo(o.id_poco);
      if (!idPoco) {
        const rel = lerJson(o.dados_relatorio);
        idPoco = await gravarPoco(conn, tenant, {
          identificacao: o.titulo || `Poço de ${rel.cliente || 'cliente'} (obra ${id})`, idProprietario: o.id_cliente,
          endereco: rel.endereco, bairro: rel.bairro, cidade: rel.cidade, uf: rel.uf, cep: rel.cep, gps: rel.localizacao, perfuradoPor: 'NOS',
        }, null, operadorDe(req));
        await conn.execute(`UPDATE modulo_hidraulica_pocos_obras SET id_poco = ? WHERE id_obra = ?`, [idPoco, id]);
      }
      const colunas: Record<string, string> = {
        profundidadeM: 'profundidade_m', vazaoLh: 'vazao_lh', nivelEstaticoM: 'nivel_estatico_m', nivelDinamicoM: 'nivel_dinamico_m',
        tipoSolo: 'tipo_solo', diametro: 'diametro', dataPerfuracao: 'data_perfuracao', latitude: 'latitude', longitude: 'longitude',
      };
      const campos = Object.keys(medido);
      if (campos.length) {
        await conn.execute(
          `UPDATE modulo_hidraulica_pocos_pocos SET ${campos.map(c => `${colunas[c]} = ?`).join(', ')}, perfurado_por = 'NOS' WHERE id_poco = ? AND tenant_id = ?`,
          [...campos.map(c => (medido as any)[c]), idPoco, tenant]
        );
        pocoAtualizado = true;
      }
    }
    await conn.commit();
    return res.json({ ...formatarObra(await carregarObra(tenant, id)), pocoAtualizado });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao mudar a situação da obra.');
  } finally { conn.release(); }
};
