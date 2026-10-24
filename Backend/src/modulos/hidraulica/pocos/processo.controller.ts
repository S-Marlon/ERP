// Obras de poços › processo (atendimento, orçamento, obra, entrega e pós-venda): leads com prazo de resposta, a
// configuração (dados da empresa, logo, mensagens, prazos), o checklist e as fotos de cada obra, as pendências, os
// indicadores e os dados do orçamento/laudo/adesivo para imprimir. Tabelas modulo_hidraulica_pocos_leads, _processo,
// _fotos e _config (as fotos ficam em Backend/uploads/pocos). O WhatsApp é aberto por link (wa.me), sem envio automático.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { apagarArquivoDaUrl, ErroArquivo, salvarArquivo } from '../../../infra/arquivos';
import { ErroObra, garantiaAte, lerServicos, pocoDoRelatorio, relatorioInicial, validarCliente } from './obras';
import { responderErro } from './obras.controller';
import {
  CONFIG_PADRAO, ConfigProcesso, checklistDaObra, ETAPAS_FOTO, ETAPAS_REGISTRO, estadoDoPrazo, EtapaFoto, EventoProcesso, indicadores, linkWhatsapp,
  MSG_AVALIACAO_PADRAO, MSG_REVISAO_PADRAO, preencherMensagem, resumoDoChecklist, SituacaoLead, situacaoDoLead, somarMinutosUteis, validarConfig, validarLead,
} from './processo';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const agoraLocal = () => {
  const d = new Date(); const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const erro = (res: Response, e: unknown, padrao: string) =>
  (e instanceof ErroArquivo ? res.status(400).json({ error: e.message }) : responderErro(res, e, padrao));

// ------------------------------------------------------------------ configuração
const carregarConfig = async (tenant: number) => {
  const [[c]]: any = await pool.execute(
    `SELECT c.*, TIME_FORMAT(hora_abre, '%H:%i') AS abre, TIME_FORMAT(hora_fecha, '%H:%i') AS fecha, TIME_FORMAT(sabado_fecha, '%H:%i') AS sabado
     FROM modulo_hidraulica_pocos_config c WHERE tenant_id = ?`, [tenant]);
  return {
    empresaNome: c?.empresa_nome || null, empresaDocumento: c?.empresa_documento || null, empresaTelefone: c?.empresa_telefone || null,
    empresaWhatsapp: c?.empresa_whatsapp || null, empresaEmail: c?.empresa_email || null, empresaEndereco: c?.empresa_endereco || null,
    logo: c?.logo ? `/uploads/${c.logo}` : null, textoGarantia: c?.texto_garantia || null, formaPagamentoPadrao: c?.forma_pagamento_padrao || null,
    validadeOrcamentoDias: c ? Number(c.validade_orcamento_dias) : 15, linkAvaliacao: c?.link_avaliacao || null,
    msgAvaliacao: c?.msg_avaliacao || MSG_AVALIACAO_PADRAO, msgRevisao: c?.msg_revisao || MSG_REVISAO_PADRAO,
    respostaLeadMin: c ? Number(c.resposta_lead_min) : CONFIG_PADRAO.respostaLeadMin, orcamentoHoras: c ? Number(c.orcamento_horas) : CONFIG_PADRAO.orcamentoHoras,
    avaliacaoDias: c ? Number(c.avaliacao_dias) : CONFIG_PADRAO.avaliacaoDias, revisaoMeses: c ? Number(c.revisao_meses) : CONFIG_PADRAO.revisaoMeses,
    horaAbre: c?.abre || '08:00', horaFecha: c?.fecha || '18:00', sabadoFecha: c ? c.sabado || null : '12:00', configurado: !!c,
  };
};
type Config = Awaited<ReturnType<typeof carregarConfig>>;
const regras = (c: Config): ConfigProcesso => ({
  respostaLeadMin: c.respostaLeadMin, orcamentoHoras: c.orcamentoHoras, avaliacaoDias: c.avaliacaoDias, revisaoMeses: c.revisaoMeses,
  horario: { abre: c.horaAbre, fecha: c.horaFecha, sabadoFecha: c.sabadoFecha },
});

// GET /processo/config
export const verConfig = async (req: Request, res: Response) => {
  try { return res.json(await carregarConfig(tenantDe(req))); } catch (e) { return erro(res, e, 'Erro ao ler a configuração.'); }
};

// PUT /processo/config { ...campos, logoNovo?: data URL, tirarLogo?: true }
export const salvarConfig = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const c = validarConfig(req.body);
    const [[atual]]: any = await pool.execute(`SELECT logo FROM modulo_hidraulica_pocos_config WHERE tenant_id = ?`, [tenant]);
    let logo: string | null = atual?.logo || null;
    if (req.body?.logoNovo) {
      const novo = salvarArquivo('pocos/empresa', 'logo', String(req.body.logoNovo));
      if (!novo.tipo.startsWith('image/')) throw new ErroObra('O logo tem de ser uma imagem (PNG ou JPG).');
      if (logo) apagarArquivoDaUrl(`/uploads/${logo}`);
      logo = novo.relativo;
    } else if (req.body?.tirarLogo && logo) { apagarArquivoDaUrl(`/uploads/${logo}`); logo = null; }
    const campos: [string, unknown][] = [
      ['empresa_nome', c.empresaNome], ['empresa_documento', c.empresaDocumento], ['empresa_telefone', c.empresaTelefone], ['empresa_whatsapp', c.empresaWhatsapp],
      ['empresa_email', c.empresaEmail], ['empresa_endereco', c.empresaEndereco], ['logo', logo], ['texto_garantia', c.textoGarantia],
      ['forma_pagamento_padrao', c.formaPagamentoPadrao], ['validade_orcamento_dias', c.validadeOrcamentoDias], ['link_avaliacao', c.linkAvaliacao],
      ['msg_avaliacao', c.msgAvaliacao], ['msg_revisao', c.msgRevisao], ['resposta_lead_min', c.respostaLeadMin], ['orcamento_horas', c.orcamentoHoras],
      ['avaliacao_dias', c.avaliacaoDias], ['revisao_meses', c.revisaoMeses], ['hora_abre', c.horaAbre], ['hora_fecha', c.horaFecha], ['sabado_fecha', c.sabadoFecha],
      ['operador', operadorDe(req)],
    ];
    await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_config (tenant_id, ${campos.map(x => x[0]).join(', ')}) VALUES (?, ${campos.map(() => '?').join(', ')})
       ON DUPLICATE KEY UPDATE ${campos.map(x => `${x[0]} = VALUES(${x[0]})`).join(', ')}`, [tenant, ...campos.map(x => x[1])]);
    return res.json(await carregarConfig(tenant));
  } catch (e) { return erro(res, e, 'Erro ao salvar a configuração.'); }
};

// ------------------------------------------------------------------ leads
const SELECT_LEAD = `SELECT l.*, DATE_FORMAT(l.recebido_em, '%Y-%m-%d %H:%i:%s') AS recebido_txt, DATE_FORMAT(l.respondido_em, '%Y-%m-%d %H:%i:%s') AS respondido_txt,
    o.situacao AS obra_situacao, o.titulo AS obra_titulo, o.valor_contratado, c.nome AS cliente_nome,
    EXISTS (SELECT 1 FROM modulo_hidraulica_pocos_processo p WHERE p.id_obra = l.id_obra AND p.etapa = 'ORCAMENTO_ENVIADO') AS orcamento_enviado
  FROM modulo_hidraulica_pocos_leads l
  LEFT JOIN modulo_hidraulica_pocos_obras o ON o.id_obra = l.id_obra
  LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = l.id_cliente`;
const formatarLead = (l: any, cfg: Config, agora: string) => {
  const prazo = somarMinutosUteis(l.recebido_txt, cfg.respostaLeadMin, regras(cfg).horario);
  return {
    idLead: Number(l.id_lead), nome: l.nome, telefone: l.telefone || null, origem: l.origem, indicadoPor: l.indicado_por || null, cidade: l.cidade || null,
    necessidade: l.necessidade || null, recebidoEm: l.recebido_txt, respondidoEm: l.respondido_txt || null, prazoResposta: prazo,
    estadoResposta: estadoDoPrazo(prazo, l.respondido_txt || null, agora), situacaoGravada: l.situacao,
    situacao: situacaoDoLead(l.situacao as SituacaoLead, l.obra_situacao || null, !!Number(l.orcamento_enviado)), motivoPerda: l.motivo_perda || null,
    idCliente: nulo(l.id_cliente), cliente: l.cliente_nome || null, idObra: nulo(l.id_obra), obra: l.obra_titulo || null, obraSituacao: l.obra_situacao || null,
    valorContratado: nulo(l.valor_contratado), observacao: l.observacao || null, operador: l.operador,
    whatsapp: linkWhatsapp(l.telefone, `Olá, ${l.nome}! Aqui é da ${cfg.empresaNome || 'empresa de poços'}. Recebemos o seu contato`),
  };
};

// GET /leads?situacao=&busca=&todos=1 (sem "todos": os em aberto e os dos últimos 60 dias)
export const listarLeads = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const cfg = await carregarConfig(tenant);
    const where = ['l.tenant_id = ?'];
    const params: any[] = [tenant];
    if (!req.query.todos) where.push(`(l.situacao NOT IN ('CONVERTIDO', 'PERDIDO') OR l.recebido_em >= NOW() - INTERVAL 60 DAY)`);
    const busca = String(req.query.busca || '').trim();
    if (busca) {
      where.push('(l.nome LIKE ? OR l.telefone LIKE ? OR l.cidade LIKE ? OR l.necessidade LIKE ?)');
      params.push(`%${busca}%`, `%${busca.replace(/\D/g, '') || busca}%`, `%${busca}%`, `%${busca}%`);
    }
    const [rows]: any = await pool.execute(`${SELECT_LEAD} WHERE ${where.join(' AND ')} ORDER BY l.respondido_em IS NOT NULL, l.recebido_em DESC LIMIT 500`, params);
    const agora = agoraLocal();
    const lista = rows.map((l: any) => formatarLead(l, cfg, agora));
    const situacao = String(req.query.situacao || '').toUpperCase();
    return res.json(situacao ? lista.filter((l: any) => l.situacao === situacao) : lista);
  } catch (e) { return erro(res, e, 'Erro ao listar os leads.'); }
};

const carregarLead = async (conn: any, tenant: number, id: number) => {
  const [[l]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_leads WHERE id_lead = ? AND tenant_id = ?`, [id, tenant]);
  if (!l) throw new ErroObra('Lead não encontrado.', 404);
  return l;
};
const devolverLead = async (res: Response, tenant: number, id: number, status = 200) => {
  const [[l]]: any = await pool.execute(`${SELECT_LEAD} WHERE l.id_lead = ?`, [id]);
  return res.status(status).json(formatarLead(l, await carregarConfig(tenant), agoraLocal()));
};

// POST /leads · PUT /leads/:id
export const criarLead = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const l = validarLead(req.body, agoraLocal());
    const [ins]: any = await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_leads (tenant_id, nome, telefone, origem, indicado_por, cidade, necessidade, recebido_em, observacao, operador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, l.nome, l.telefone, l.origem, l.indicadoPor, l.cidade, l.necessidade, l.recebidoEm, l.observacao, operadorDe(req)]);
    return devolverLead(res, tenant, Number(ins.insertId), 201);
  } catch (e) { return erro(res, e, 'Erro ao registrar o lead.'); }
};
export const salvarLead = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregarLead(pool, tenant, id);
    const l = validarLead(req.body, agoraLocal());
    await pool.execute(
      `UPDATE modulo_hidraulica_pocos_leads SET nome = ?, telefone = ?, origem = ?, indicado_por = ?, cidade = ?, necessidade = ?, recebido_em = ?, observacao = ?, operador = ?
       WHERE id_lead = ?`, [l.nome, l.telefone, l.origem, l.indicadoPor, l.cidade, l.necessidade, l.recebidoEm, l.observacao, operadorDe(req), id]);
    return devolverLead(res, tenant, id);
  } catch (e) { return erro(res, e, 'Erro ao salvar o lead.'); }
};

// POST /leads/:id/respondido — marca a hora da resposta (novo vira "em contato")
export const marcarRespondido = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const l = await carregarLead(pool, tenant, id);
    if (l.respondido_em) throw new ErroObra('Este lead já está marcado como respondido.', 409);
    await pool.execute(`UPDATE modulo_hidraulica_pocos_leads SET respondido_em = NOW(), situacao = IF(situacao = 'NOVO', 'EM_CONTATO', situacao), operador = ? WHERE id_lead = ?`,
      [operadorDe(req), id]);
    return devolverLead(res, tenant, id);
  } catch (e) { return erro(res, e, 'Erro ao marcar a resposta.'); }
};

// POST /leads/:id/situacao { situacao, motivo } — em contato, visita agendada, perdido (com motivo) ou de volta a novo
export const mudarLead = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregarLead(pool, tenant, id);
    const situacao = String(req.body?.situacao || '').toUpperCase();
    if (!['NOVO', 'EM_CONTATO', 'VISITA_AGENDADA', 'PERDIDO'].includes(situacao)) throw new ErroObra('Situação inválida (orçamento enviado e convertido vêm da obra).');
    const motivo = String(req.body?.motivo || '').trim().slice(0, 150) || null;
    if (situacao === 'PERDIDO' && !motivo) throw new ErroObra('Diga o motivo da perda (preço, prazo, fechou com outro...).');
    await pool.execute(`UPDATE modulo_hidraulica_pocos_leads SET situacao = ?, motivo_perda = ?, operador = ? WHERE id_lead = ?`,
      [situacao, situacao === 'PERDIDO' ? motivo : null, operadorDe(req), id]);
    return devolverLead(res, tenant, id);
  } catch (e) { return erro(res, e, 'Erro ao mudar o lead.'); }
};

/**
 * POST /leads/:id/obra { idCliente?, servicos, titulo? } — do lead nasce a obra (orçamento): usa o cliente escolhido,
 * ou o cliente de poço com o mesmo telefone, ou cadastra um novo com o nome/telefone/cidade do lead.
 */
export const obraDoLead = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    await conn.beginTransaction();
    const l = await carregarLead(conn, tenant, id);
    if (l.id_obra) throw new ErroObra(`Este lead já tem a obra ${l.id_obra}.`, 409);
    const servicos = lerServicos(req.body?.servicos);
    if (!servicos.length) throw new ErroObra('Escolha ao menos um serviço.');
    let idCliente = Number(req.body?.idCliente) || Number(l.id_cliente) || 0;
    if (!idCliente && l.telefone) {
      const [[mesmo]]: any = await conn.execute(`SELECT id_cliente FROM modulo_hidraulica_pocos_clientes WHERE tenant_id = ? AND telefone = ? AND ativo = 1 LIMIT 1`, [tenant, l.telefone]);
      idCliente = mesmo ? Number(mesmo.id_cliente) : 0;
    }
    if (!idCliente) {
      const c = validarCliente({ nome: l.nome, telefone: l.telefone, cidade: l.cidade });
      const [ins]: any = await conn.execute(
        `INSERT INTO modulo_hidraulica_pocos_clientes (tenant_id, nome, telefone, cidade, observacao, operador) VALUES (?, ?, ?, ?, ?, ?)`,
        [tenant, c.nome, c.telefone, c.cidade, `Veio de lead (${l.origem.toLowerCase()})`, operadorDe(req)]);
      idCliente = Number(ins.insertId);
    }
    const [[cli]]: any = await conn.execute(`SELECT nome, documento, telefone FROM modulo_hidraulica_pocos_clientes WHERE id_cliente = ? AND tenant_id = ?`, [idCliente, tenant]);
    if (!cli) throw new ErroObra('Cliente não encontrado.', 404);
    const titulo = String(req.body?.titulo || '').trim().slice(0, 150) || `${l.necessidade || 'Orçamento'} - ${l.nome}`.slice(0, 150);
    const [obra]: any = await conn.execute(
      `INSERT INTO modulo_hidraulica_pocos_obras (tenant_id, id_cliente, titulo, servicos, situacao, dados_relatorio, observacao, operador)
       VALUES (?, ?, ?, ?, 'ORCAMENTO', ?, ?, ?)`,
      [tenant, idCliente, titulo, servicos.join(','), JSON.stringify(relatorioInicial(cli, null, {})), `Lead ${id} · origem ${l.origem.toLowerCase()}`, operadorDe(req)]);
    await conn.execute(
      `UPDATE modulo_hidraulica_pocos_leads SET id_cliente = ?, id_obra = ?, situacao = IF(situacao IN ('NOVO', 'EM_CONTATO'), 'VISITA_AGENDADA', situacao),
         respondido_em = COALESCE(respondido_em, NOW()), operador = ? WHERE id_lead = ?`, [idCliente, Number(obra.insertId), operadorDe(req), id]);
    await conn.commit();
    return res.status(201).json({ idObra: Number(obra.insertId), idCliente });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return erro(res, e, 'Erro ao criar a obra do lead.');
  } finally { conn.release(); }
};

// ------------------------------------------------------------------ processo da obra
const carregarObra = async (tenant: number, id: number) => {
  const [[o]]: any = await pool.execute(
    `SELECT o.*, DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i:%s') AS criada_txt, DATE_FORMAT(o.data_inicio, '%Y-%m-%d') AS inicio_txt,
            DATE_FORMAT(o.data_termino, '%Y-%m-%d') AS termino_txt, c.nome AS cliente, c.telefone, po.identificacao AS poco
     FROM modulo_hidraulica_pocos_obras o LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = o.id_cliente
     LEFT JOIN modulo_hidraulica_pocos_pocos po ON po.id_poco = o.id_poco WHERE o.id_obra = ? AND o.tenant_id = ?`, [id, tenant]);
  if (!o) throw new ErroObra('Obra não encontrada.', 404);
  return o;
};
const eventosDe = async (ids: number[]) => {
  if (!ids.length) return new Map<number, EventoProcesso[]>();
  const [rows]: any = await pool.execute(
    `SELECT id_obra, etapa, situacao, DATE_FORMAT(feito_em, '%Y-%m-%d %H:%i:%s') AS feito_txt, observacao FROM modulo_hidraulica_pocos_processo
     WHERE id_obra IN (${ids.map(() => '?').join(',')})`, ids);
  const m = new Map<number, EventoProcesso[]>();
  for (const r of rows) m.set(Number(r.id_obra), [...(m.get(Number(r.id_obra)) || []), { etapa: r.etapa, situacao: r.situacao, feitoEm: r.feito_txt, observacao: r.observacao }]);
  return m;
};
const fotosPorEtapa = async (ids: number[]) => {
  if (!ids.length) return new Map<number, Partial<Record<EtapaFoto, number>>>();
  const [rows]: any = await pool.execute(
    `SELECT id_obra, etapa, COUNT(*) AS n FROM modulo_hidraulica_pocos_fotos WHERE id_obra IN (${ids.map(() => '?').join(',')}) GROUP BY id_obra, etapa`, ids);
  const m = new Map<number, Partial<Record<EtapaFoto, number>>>();
  for (const r of rows) m.set(Number(r.id_obra), { ...(m.get(Number(r.id_obra)) || {}), [r.etapa]: Number(r.n) });
  return m;
};
const paraProcesso = (o: any) => ({ situacao: o.situacao, criadaEm: o.criada_txt, dataInicio: o.inicio_txt || null, dataTermino: o.termino_txt || null, servicos: lerServicos(o.servicos) });
const mensagens = (o: any, cfg: Config) => {
  const v = { cliente: (o.cliente || '').split(' ')[0], empresa: cfg.empresaNome || 'nossa empresa', link: cfg.linkAvaliacao || '', poco: o.poco || o.titulo || '', obra: o.id_obra };
  return {
    whatsappAvaliacao: linkWhatsapp(o.telefone, preencherMensagem(cfg.msgAvaliacao, v)),
    whatsappRevisao: linkWhatsapp(o.telefone, preencherMensagem(cfg.msgRevisao, v)),
    whatsapp: linkWhatsapp(o.telefone),
  };
};
const formatarFoto = (f: any) => ({
  idFoto: Number(f.id_foto), idObra: Number(f.id_obra), etapa: f.etapa, url: `/uploads/${f.arquivo}`, legenda: f.legenda || null, podeDivulgar: !!f.pode_divulgar,
  criadaEm: f.criada_txt, operador: f.operador,
});

// GET /obras/:id/processo — o checklist, as fotos e os links de WhatsApp da obra
export const processoDaObra = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const [o, cfg] = await Promise.all([carregarObra(tenant, id), carregarConfig(tenant)]);
    const [ev, ft] = await Promise.all([eventosDe([id]), fotosPorEtapa([id])]);
    const checklist = checklistDaObra(paraProcesso(o), ev.get(id) || [], ft.get(id) || {}, regras(cfg), agoraLocal());
    const [fotos]: any = await pool.execute(
      `SELECT f.*, DATE_FORMAT(f.created_at, '%Y-%m-%d %H:%i') AS criada_txt FROM modulo_hidraulica_pocos_fotos f WHERE f.id_obra = ? ORDER BY FIELD(f.etapa, 'ANTES', 'DURANTE', 'DEPOIS'), f.id_foto`, [id]);
    const [[lead]]: any = await pool.execute(`SELECT id_lead, origem FROM modulo_hidraulica_pocos_leads WHERE id_obra = ? LIMIT 1`, [id]);
    return res.json({ checklist, resumo: resumoDoChecklist(checklist), fotos: fotos.map(formatarFoto), ...mensagens(o, cfg),
      lead: lead ? { idLead: Number(lead.id_lead), origem: lead.origem } : null });
  } catch (e) { return erro(res, e, 'Erro ao carregar o processo da obra.'); }
};

// POST /obras/:id/processo/:etapa { situacao: FEITO | NAO_SE_APLICA, feitoEm?, observacao? } · DELETE para desfazer
export const marcarEtapa = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregarObra(tenant, id);
    const etapa = String(req.params.etapa || '').toUpperCase();
    if (!(ETAPAS_REGISTRO as readonly string[]).includes(etapa)) throw new ErroObra(`Etapa inválida: ${req.params.etapa}.`);
    const situacao = String(req.body?.situacao || 'FEITO').toUpperCase() === 'NAO_SE_APLICA' ? 'NAO_SE_APLICA' : 'FEITO';
    const agora = agoraLocal();
    const feitoEm = req.body?.feitoEm ? String(req.body.feitoEm).replace('T', ' ').slice(0, 19).padEnd(19, ':00').slice(0, 19) : agora;
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(feitoEm) || feitoEm > agora) throw new ErroObra('Data inválida (não pode ser no futuro).');
    await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_processo (tenant_id, id_obra, etapa, situacao, feito_em, observacao, operador) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE situacao = VALUES(situacao), feito_em = VALUES(feito_em), observacao = VALUES(observacao), operador = VALUES(operador)`,
      [tenant, id, etapa, situacao, feitoEm, String(req.body?.observacao || '').trim().slice(0, 255) || null, operadorDe(req)]);
    return res.json({ ok: true });
  } catch (e) { return erro(res, e, 'Erro ao registrar a etapa.'); }
};
export const desfazerEtapa = async (req: Request, res: Response) => {
  try {
    await pool.execute(`DELETE FROM modulo_hidraulica_pocos_processo WHERE id_obra = ? AND etapa = ? AND tenant_id = ?`,
      [Number(req.params.id), String(req.params.etapa || '').toUpperCase(), tenantDe(req)]);
    return res.json({ ok: true });
  } catch (e) { return erro(res, e, 'Erro ao desfazer a etapa.'); }
};

// ------------------------------------------------------------------ fotos
// POST /obras/:id/fotos { etapa, conteudo (data URL), nome, legenda, podeDivulgar }
export const enviarFoto = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregarObra(tenant, id);
    const etapa = String(req.body?.etapa || '').toUpperCase();
    if (!(ETAPAS_FOTO as readonly string[]).includes(etapa)) throw new ErroObra('Etapa da foto: antes, durante ou depois.');
    const arq = salvarArquivo(`pocos/obras/${id}`, String(req.body?.nome || `foto-${etapa.toLowerCase()}`), String(req.body?.conteudo || ''));
    if (!arq.tipo.startsWith('image/')) { apagarArquivoDaUrl(`/uploads/${arq.relativo}`); throw new ErroObra('Envie uma imagem (JPG, PNG ou WEBP).'); }
    const [ins]: any = await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_fotos (tenant_id, id_obra, etapa, arquivo, legenda, pode_divulgar, operador) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tenant, id, etapa, arq.relativo, String(req.body?.legenda || '').trim().slice(0, 150) || null, req.body?.podeDivulgar ? 1 : 0, operadorDe(req)]);
    return res.status(201).json({ idFoto: Number(ins.insertId), url: `/uploads/${arq.relativo}` });
  } catch (e) { return erro(res, e, 'Erro ao enviar a foto.'); }
};

// PUT /fotos/:id { etapa, legenda, podeDivulgar }
export const salvarFoto = async (req: Request, res: Response) => {
  try {
    const etapa = String(req.body?.etapa || '').toUpperCase();
    if (!(ETAPAS_FOTO as readonly string[]).includes(etapa)) throw new ErroObra('Etapa da foto: antes, durante ou depois.');
    const [u]: any = await pool.execute(`UPDATE modulo_hidraulica_pocos_fotos SET etapa = ?, legenda = ?, pode_divulgar = ? WHERE id_foto = ? AND tenant_id = ?`,
      [etapa, String(req.body?.legenda || '').trim().slice(0, 150) || null, req.body?.podeDivulgar ? 1 : 0, Number(req.params.id), tenantDe(req)]);
    if (!u.affectedRows) throw new ErroObra('Foto não encontrada.', 404);
    return res.json({ ok: true });
  } catch (e) { return erro(res, e, 'Erro ao salvar a foto.'); }
};

// DELETE /fotos/:id (apaga o arquivo também)
export const apagarFoto = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [[f]]: any = await pool.execute(`SELECT arquivo FROM modulo_hidraulica_pocos_fotos WHERE id_foto = ? AND tenant_id = ?`, [Number(req.params.id), tenant]);
    if (!f) throw new ErroObra('Foto não encontrada.', 404);
    await pool.execute(`DELETE FROM modulo_hidraulica_pocos_fotos WHERE id_foto = ?`, [Number(req.params.id)]);
    apagarArquivoDaUrl(`/uploads/${f.arquivo}`);
    return res.json({ ok: true });
  } catch (e) { return erro(res, e, 'Erro ao apagar a foto.'); }
};

// GET /processo/galeria — só as fotos que o cliente deixou divulgar (material de propaganda)
export const galeria = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute(
      `SELECT f.*, DATE_FORMAT(f.created_at, '%Y-%m-%d %H:%i') AS criada_txt, o.titulo, po.cidade, c.nome AS cliente
       FROM modulo_hidraulica_pocos_fotos f JOIN modulo_hidraulica_pocos_obras o ON o.id_obra = f.id_obra
       LEFT JOIN modulo_hidraulica_pocos_pocos po ON po.id_poco = o.id_poco LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = o.id_cliente
       WHERE f.tenant_id = ? AND f.pode_divulgar = 1 ORDER BY f.id_foto DESC LIMIT 500`, [tenantDe(req)]);
    return res.json(rows.map((f: any) => ({ ...formatarFoto(f), obra: f.titulo || `Obra ${f.id_obra}`, cidade: f.cidade || null, cliente: f.cliente || null })));
  } catch (e) { return erro(res, e, 'Erro ao montar a galeria.'); }
};

// ------------------------------------------------------------------ pendências e indicadores
/** As obras que ainda têm processo a cumprir: não canceladas, e concluídas até 1 mês depois da revisão. */
const obrasEmProcesso = async (tenant: number, cfg: Config) => {
  const [rows]: any = await pool.execute(
    `SELECT o.*, DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i:%s') AS criada_txt, DATE_FORMAT(o.data_inicio, '%Y-%m-%d') AS inicio_txt,
            DATE_FORMAT(o.data_termino, '%Y-%m-%d') AS termino_txt, c.nome AS cliente, c.telefone, po.identificacao AS poco
     FROM modulo_hidraulica_pocos_obras o LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = o.id_cliente
     LEFT JOIN modulo_hidraulica_pocos_pocos po ON po.id_poco = o.id_poco
     WHERE o.tenant_id = ? AND o.situacao <> 'CANCELADA' AND (o.data_termino IS NULL OR o.data_termino >= CURDATE() - INTERVAL ? MONTH)
     ORDER BY o.id_obra DESC LIMIT 2000`, [tenant, cfg.revisaoMeses + 1]);
  return rows;
};

// GET /processo/pendencias — leads sem resposta e o que está pendente ou atrasado em cada obra
export const pendencias = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const cfg = await carregarConfig(tenant);
    const agora = agoraLocal();
    const [leadsRows]: any = await pool.execute(`${SELECT_LEAD} WHERE l.tenant_id = ? AND l.respondido_em IS NULL AND l.situacao <> 'PERDIDO' ORDER BY l.recebido_em`, [tenant]);
    const obras = await obrasEmProcesso(tenant, cfg);
    const ids = obras.map((o: any) => Number(o.id_obra));
    const [ev, ft] = await Promise.all([eventosDe(ids), fotosPorEtapa(ids)]);
    const itens: any[] = [];
    for (const o of obras) {
      const lista = checklistDaObra(paraProcesso(o), ev.get(Number(o.id_obra)) || [], ft.get(Number(o.id_obra)) || {}, regras(cfg), agora);
      const msgs = mensagens(o, cfg);
      for (const i of lista.filter(x => x.estado === 'PENDENTE' || x.estado === 'ATRASADO')) {
        itens.push({ idObra: Number(o.id_obra), obra: o.titulo || `Obra ${o.id_obra}`, cliente: o.cliente || null, telefone: o.telefone || null,
          situacaoObra: o.situacao, ...i,
          whatsapp: i.etapa === 'AVALIACAO_PEDIDA' ? msgs.whatsappAvaliacao : i.etapa === 'REVISAO_LEMBRADA' ? msgs.whatsappRevisao : msgs.whatsapp });
      }
    }
    itens.sort((a, b) => (a.estado === b.estado ? String(a.prazo || '9').localeCompare(String(b.prazo || '9')) : a.estado === 'ATRASADO' ? -1 : 1));
    return res.json({ leads: leadsRows.map((l: any) => formatarLead(l, cfg, agora)), itens });
  } catch (e) { return erro(res, e, 'Erro ao montar as pendências.'); }
};

// GET /processo/indicadores?de=&ate= (padrão: últimos 90 dias)
export const verIndicadores = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const cfg = await carregarConfig(tenant);
    const agora = agoraLocal();
    const dia = /^\d{4}-\d{2}-\d{2}$/;
    const ate = dia.test(String(req.query.ate || '')) ? String(req.query.ate) : agora.slice(0, 10);
    const de = dia.test(String(req.query.de || '')) ? String(req.query.de) : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); })();
    const [leadsRows]: any = await pool.execute(`${SELECT_LEAD} WHERE l.tenant_id = ? AND l.recebido_em >= ? AND l.recebido_em < ? + INTERVAL 1 DAY`, [tenant, de, ate]);
    const leads = leadsRows.map((l: any) => formatarLead(l, cfg, agora)).map((l: any) => ({
      origem: l.origem, recebidoEm: l.recebidoEm, respondidoEm: l.respondidoEm, prazo: l.prazoResposta, situacao: l.situacao, valorFechado: l.valorContratado,
    }));
    const [orc]: any = await pool.execute(
      `SELECT p.id_obra, DATE_FORMAT(p.feito_em, '%Y-%m-%d %H:%i:%s') AS enviado, DATE_FORMAT(v.feito_em, '%Y-%m-%d %H:%i:%s') AS visita,
              DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i:%s') AS criada
       FROM modulo_hidraulica_pocos_processo p JOIN modulo_hidraulica_pocos_obras o ON o.id_obra = p.id_obra
       LEFT JOIN modulo_hidraulica_pocos_processo v ON v.id_obra = p.id_obra AND v.etapa = 'VISITA' AND v.situacao = 'FEITO'
       WHERE p.tenant_id = ? AND p.etapa = 'ORCAMENTO_ENVIADO' AND p.situacao = 'FEITO' AND p.feito_em >= ? AND p.feito_em < ? + INTERVAL 1 DAY`, [tenant, de, ate]);
    const orcamentos = orc.map((x: any) => {
      const base = new Date((x.visita || x.criada).replace(' ', 'T'));
      base.setHours(base.getHours() + cfg.orcamentoHoras);
      return { noPrazo: new Date(x.enviado.replace(' ', 'T')) <= base };
    });
    const [conc]: any = await pool.execute(
      `SELECT o.id_obra,
              (SELECT COUNT(DISTINCT f.etapa) FROM modulo_hidraulica_pocos_fotos f WHERE f.id_obra = o.id_obra) AS etapas_foto,
              EXISTS (SELECT 1 FROM modulo_hidraulica_pocos_processo p WHERE p.id_obra = o.id_obra AND p.etapa = 'AVALIACAO_PEDIDA' AND p.situacao = 'FEITO') AS pedida,
              EXISTS (SELECT 1 FROM modulo_hidraulica_pocos_processo p WHERE p.id_obra = o.id_obra AND p.etapa = 'AVALIACAO_RECEBIDA' AND p.situacao = 'FEITO') AS recebida
       FROM modulo_hidraulica_pocos_obras o WHERE o.tenant_id = ? AND o.situacao = 'CONCLUIDA' AND o.data_termino BETWEEN ? AND ?`, [tenant, de, ate]);
    const concluidas = conc.map((x: any) => ({ fotosCompletas: Number(x.etapas_foto) >= 3, avaliacaoPedida: !!Number(x.pedida), avaliacaoRecebida: !!Number(x.recebida) }));
    return res.json({ de, ate, ...indicadores(leads, agora, orcamentos, concluidas) });
  } catch (e) { return erro(res, e, 'Erro ao calcular os indicadores.'); }
};

// ------------------------------------------------------------------ documentos (orçamento, laudo, adesivo)
// GET /obras/:id/documento — tudo o que o orçamento em PDF, o laudo e o adesivo precisam (o front monta a página)
export const dadosDoDocumento = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const [o, cfg] = await Promise.all([carregarObra(tenant, id), carregarConfig(tenant)]);
    const [[cli]]: any = await pool.execute(`SELECT * FROM modulo_hidraulica_pocos_clientes WHERE id_cliente = ?`, [o.id_cliente]);
    const [[poco]]: any = o.id_poco
      ? await pool.execute(`SELECT p.*, DATE_FORMAT(p.data_perfuracao, '%Y-%m-%d') AS perfuracao_txt FROM modulo_hidraulica_pocos_pocos p WHERE p.id_poco = ?`, [o.id_poco])
      : [[null]];
    const [adic]: any = await pool.execute(`SELECT descricao, valor FROM modulo_hidraulica_pocos_adicionais WHERE id_obra = ? AND situacao = 'APROVADO'`, [id]);
    let relatorio: any = {};
    try { relatorio = o.dados_relatorio ? JSON.parse(o.dados_relatorio) : {}; } catch { relatorio = {}; }
    const medido = pocoDoRelatorio(relatorio);
    return res.json({
      empresa: cfg,
      obra: {
        idObra: Number(o.id_obra), titulo: o.titulo || null, servicos: lerServicos(o.servicos), situacao: o.situacao, criadaEm: o.criada_txt,
        dataInicio: o.inicio_txt || null, dataTermino: o.termino_txt || null, metrosPrevistos: nulo(o.metros_previstos), valorContratado: nulo(o.valor_contratado),
        valorMetroExcedente: nulo(o.valor_metro_excedente), valorSinal: nulo(o.valor_sinal), sinalQuando: o.sinal_quando, garantiaMeses: nulo(o.garantia_meses),
        garantiaAte: garantiaAte(o.termino_txt || null, nulo(o.garantia_meses)), escopo: o.escopo || null, prazoExecucaoDias: nulo(o.prazo_execucao_dias),
        formaPagamento: o.forma_pagamento || cfg.formaPagamentoPadrao, validadeOrcamentoDias: nulo(o.validade_orcamento_dias) ?? cfg.validadeOrcamentoDias,
        adicionais: adic.map((a: any) => ({ descricao: a.descricao, valor: Number(a.valor) })),
      },
      cliente: cli ? { nome: cli.nome, documento: cli.documento || null, telefone: cli.telefone || null, endereco: cli.endereco || null, cidade: cli.cidade || null, uf: cli.uf || null } : null,
      poco: poco ? {
        idPoco: Number(poco.id_poco), identificacao: poco.identificacao, endereco: poco.endereco || null, cidade: poco.cidade || null, uf: poco.uf || null,
        latitude: nulo(poco.latitude), longitude: nulo(poco.longitude), profundidadeM: nulo(poco.profundidade_m), diametro: poco.diametro || null,
        vazaoLh: nulo(poco.vazao_lh), nivelEstaticoM: nulo(poco.nivel_estatico_m), nivelDinamicoM: nulo(poco.nivel_dinamico_m), tipoSolo: poco.tipo_solo || null,
        dataPerfuracao: poco.perfuracao_txt || null,
      } : null,
      medido: {
        profundidadeM: medido.profundidadeM ?? null, vazaoLh: medido.vazaoLh ?? null, nivelEstaticoM: medido.nivelEstaticoM ?? null,
        nivelDinamicoM: medido.nivelDinamicoM ?? null, diametro: medido.diametro ?? null, tipoSolo: medido.tipoSolo ?? null,
        bomba: [relatorio.bombaMarca, relatorio.bombaProfundidade ? `instalada a ${String(relatorio.bombaProfundidade).replace('.', ',')} m` : null]
          .filter(Boolean).join(', ') || null,
      },
    });
  } catch (e) { return erro(res, e, 'Erro ao montar o documento.'); }
};
