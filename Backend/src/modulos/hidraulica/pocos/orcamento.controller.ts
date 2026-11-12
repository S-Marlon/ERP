// Obras de poços › orçamento rápido (itens linha a linha), duplicar orçamento e termos aditivos.
// O orçamento rápido cria (ou usa) o cliente, o poço se vier o local, a obra em ORCAMENTO com os itens e as condições,
// a parcela do sinal e liga o contato (lead) de onde veio. O total dos itens vira o valor contratado da obra.
// Tabelas modulo_hidraulica_pocos_orcamento_itens e _aditivos (os adicionais guardam o aditivo em que entraram).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { ErroObra, lerGps, relatorioInicial, validarCliente, validarObra } from './obras';
import { nomeLivreDoPoco, responderErro } from './obras.controller';
import { acertarSinal } from './cobrancaBanco';
import { CAMPOS } from './clientes.controller';
import { ItemOrcamento, novoAditivo, resumoDosItens, validarItens } from './orcamento';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const formatarItem = (i: any) => ({
  idItem: Number(i.id_item), grupo: i.grupo, descricao: i.descricao, quantidade: Number(i.quantidade), unidade: i.unidade,
  valorUnitario: Number(i.valor_unitario), valorTotal: Number(i.valor_total), opcional: !!i.opcional, incluso: !!i.incluso,
});
const carregarItens = async (conn: any, idObra: number) => {
  const [rows]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_orcamento_itens WHERE id_obra = ? ORDER BY ordem, id_item`, [idObra]);
  return rows.map(formatarItem);
};

/** Troca os itens da obra e acerta o valor contratado, os metros previstos e o valor do metro excedente pelos itens. */
const gravarItens = async (conn: any, tenant: number, idObra: number, itens: ItemOrcamento[], operador: string) => {
  await conn.execute(`DELETE FROM modulo_hidraulica_pocos_orcamento_itens WHERE id_obra = ?`, [idObra]);
  for (const [i, it] of itens.entries()) {
    await conn.execute(
      `INSERT INTO modulo_hidraulica_pocos_orcamento_itens (tenant_id, id_obra, ordem, grupo, descricao, quantidade, unidade, valor_unitario, valor_total, opcional, incluso, operador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, idObra, i, it.grupo, it.descricao, it.quantidade, it.unidade, it.valorUnitario, it.valorTotal, it.opcional ? 1 : 0, it.incluso ? 1 : 0, operador]);
  }
  if (!itens.length) return null;
  const r = resumoDosItens(itens);
  await conn.execute(
    `UPDATE modulo_hidraulica_pocos_obras SET valor_contratado = ?, metros_previstos = COALESCE(?, metros_previstos),
       valor_metro_excedente = COALESCE(?, valor_metro_excedente), operador = ? WHERE id_obra = ?`,
    [r.total, r.metrosPrevistos, r.valorMetroExcedente, operador, idObra]);
  return r;
};

// GET /obras/:id/itens
export const itensDaObra = async (req: Request, res: Response) => {
  try {
    const [[o]]: any = await pool.execute(`SELECT id_obra FROM modulo_hidraulica_pocos_obras WHERE id_obra = ? AND tenant_id = ?`, [Number(req.params.id), tenantDe(req)]);
    if (!o) throw new ErroObra('Obra não encontrada.', 404);
    const itens = await carregarItens(pool, Number(req.params.id));
    return res.json({ itens, resumo: resumoDosItens(itens) });
  } catch (e) { return responderErro(res, e, 'Erro ao carregar os itens.'); }
};

// PUT /obras/:id/itens { itens } — troca os itens (o total vira o valor contratado)
export const salvarItens = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const itens = validarItens(req.body?.itens);
    await conn.beginTransaction();
    const [[o]]: any = await conn.execute(`SELECT situacao FROM modulo_hidraulica_pocos_obras WHERE id_obra = ? AND tenant_id = ? FOR UPDATE`, [id, tenant]);
    if (!o) throw new ErroObra('Obra não encontrada.', 404);
    if (o.situacao === 'CANCELADA') throw new ErroObra('A obra está cancelada.', 409);
    if (o.situacao === 'CONCLUIDA') throw new ErroObra('Obra concluída: o que mudou de preço entra como adicional (e termo aditivo).', 409);
    const resumo = await gravarItens(conn, tenant, id, itens, operadorDe(req));
    await conn.commit();
    return res.json({ itens: await carregarItens(pool, id), resumo });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao salvar os itens.');
  } finally { conn.release(); }
};

/**
 * POST /orcamentos — orçamento rápido. Corpo: { idCliente? | novoCliente { nome, telefone, cidade }, idLead?, idPoco? |
 * local { identificacao?, endereco, cidade, uf, gps }, servicos, titulo, itens, escopo, valorSinal, sinalQuando, formaPagamento,
 * prazoExecucaoDias, validadeOrcamentoDias, garantiaMeses, dataPrevisao, observacao }.
 */
export const criarOrcamento = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const b = req.body || {};
    const itens = validarItens(b.itens || []);
    const operador = operadorDe(req);
    await conn.beginTransaction();
    // cliente: o escolhido, o do lead, o com o mesmo telefone, ou um novo
    let idCliente = Number(b.idCliente) || 0;
    const lead = Number(b.idLead) ? (await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_leads WHERE id_lead = ? AND tenant_id = ? FOR UPDATE`, [Number(b.idLead), tenant]))[0][0] : null;
    if (b.idLead && !lead) throw new ErroObra('Contato (lead) não encontrado.', 404);
    if (lead?.id_obra) throw new ErroObra(`Este contato já tem a obra ${lead.id_obra}.`, 409);
    if (!idCliente && lead?.id_cliente) idCliente = Number(lead.id_cliente);
    if (!idCliente) {
      const novo = validarCliente(b.novoCliente || (lead ? { nome: lead.nome, telefone: lead.telefone, cidade: lead.cidade } : {}));
      if (novo.telefone) {
        const [[mesmo]]: any = await conn.execute(`SELECT id_cliente FROM modulo_hidraulica_pocos_clientes WHERE tenant_id = ? AND telefone = ? AND ativo = 1 LIMIT 1`, [tenant, novo.telefone]);
        if (mesmo) idCliente = Number(mesmo.id_cliente);
      }
      if (!idCliente) {
        if (!novo.observacao && lead) novo.observacao = `Veio de contato (${String(lead.origem).toLowerCase()})`;
        const [ins]: any = await conn.execute(
          `INSERT INTO modulo_hidraulica_pocos_clientes (tenant_id, ${CAMPOS.map(x => x[0]).join(', ')}, operador) VALUES (?, ${CAMPOS.map(() => '?').join(', ')}, ?)`,
          [tenant, ...CAMPOS.map(x => novo[x[1]]), operador]);
        idCliente = Number(ins.insertId);
      }
    }
    const [[cli]]: any = await conn.execute(`SELECT nome, documento, telefone, cidade FROM modulo_hidraulica_pocos_clientes WHERE id_cliente = ? AND tenant_id = ?`, [idCliente, tenant]);
    if (!cli) throw new ErroObra('Cliente não encontrado.', 404);
    // poço: o escolhido ou um novo com o local informado
    let idPoco = Number(b.idPoco) || null;
    if (!idPoco && b.local && (b.local.endereco || b.local.cidade || b.local.gps)) {
      const gps = b.local.gps ? lerGps(b.local.gps) : null;
      if (b.local.gps && !gps) throw new ErroObra('Localização (GPS) inválida: use "-23.550520, -46.633308".');
      const [ins]: any = await conn.execute(
        `INSERT INTO modulo_hidraulica_pocos_pocos (tenant_id, identificacao, id_proprietario, endereco, cidade, uf, latitude, longitude, perfurado_por, operador)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NOS', ?)`,
        [tenant, String(b.local.identificacao || await nomeLivreDoPoco(conn, tenant, idCliente)).slice(0, 100), idCliente, String(b.local.endereco || '').slice(0, 150) || null,
          String(b.local.cidade || cli.cidade || '').slice(0, 60) || null, String(b.local.uf || '').toUpperCase().slice(0, 2) || null, gps?.latitude ?? null, gps?.longitude ?? null, operador]);
      idPoco = Number(ins.insertId);
    }
    const resumo = itens.length ? resumoDosItens(itens) : null;
    const o = validarObra({ ...b, idCliente, idPoco, valorContratado: resumo ? resumo.total : b.valorContratado,
      metrosPrevistos: resumo?.metrosPrevistos ?? b.metrosPrevistos, valorMetroExcedente: resumo?.valorMetroExcedente ?? b.valorMetroExcedente });
    let poco: any = null;
    if (idPoco) {
      const [[p]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_pocos WHERE id_poco = ? AND tenant_id = ?`, [idPoco, tenant]);
      if (!p) throw new ErroObra('Poço não encontrado.', 404);
      poco = { endereco: p.endereco, bairro: p.bairro, cidade: p.cidade, uf: p.uf, cep: p.cep, latitude: nulo(p.latitude), longitude: nulo(p.longitude),
        profundidadeM: nulo(p.profundidade_m), vazaoLh: nulo(p.vazao_lh) };
    }
    const [obra]: any = await conn.execute(
      `INSERT INTO modulo_hidraulica_pocos_obras (tenant_id, id_cliente, id_poco, titulo, servicos, situacao, data_previsao, garantia_meses, metros_previstos,
         valor_contratado, valor_parcelado, valor_metro_excedente, valor_sinal, sinal_quando, dados_relatorio, observacao, escopo, prazo_execucao_dias, forma_pagamento,
         validade_orcamento_dias, operador)
       VALUES (?, ?, ?, ?, ?, 'ORCAMENTO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, idCliente, idPoco, o.titulo, o.servicos.join(','), o.dataPrevisao, o.garantiaMeses, o.metrosPrevistos, o.valorContratado, o.valorParcelado, o.valorMetroExcedente,
        o.valorSinal, o.sinalQuando, JSON.stringify(relatorioInicial(cli, poco, o)), o.observacao || (lead ? `Contato ${lead.id_lead} · ${String(lead.origem).toLowerCase()}` : null),
        o.escopo, o.prazoExecucaoDias, o.formaPagamento, o.validadeOrcamentoDias, operador]);
    const idObra = Number(obra.insertId);
    if (itens.length) await gravarItens(conn, tenant, idObra, itens, operador);
    await acertarSinal(conn, tenant, idObra, o.valorSinal, operador);
    if (lead) {
      await conn.execute(
        `UPDATE modulo_hidraulica_pocos_leads SET id_cliente = ?, id_obra = ?, situacao = IF(situacao IN ('NOVO', 'EM_CONTATO'), 'VISITA_AGENDADA', situacao),
           respondido_em = COALESCE(respondido_em, NOW()), operador = ? WHERE id_lead = ?`, [idCliente, idObra, operador, lead.id_lead]);
    }
    await conn.commit();
    return res.status(201).json({ idObra, idCliente, idPoco, total: o.valorContratado });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao criar o orçamento.');
  } finally { conn.release(); }
};

// POST /obras/:id/duplicar — novo orçamento igual (cliente, poço, serviços, itens e condições), sem cobrança nem processo
export const duplicarOrcamento = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    await conn.beginTransaction();
    const [[o]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_obras WHERE id_obra = ? AND tenant_id = ?`, [id, tenant]);
    if (!o) throw new ErroObra('Obra não encontrada.', 404);
    const idClienteNovo = Number(req.body?.idCliente) || Number(o.id_cliente);
    const mesmoCliente = idClienteNovo === Number(o.id_cliente);
    const [[cli]]: any = await conn.execute(`SELECT nome, documento, telefone FROM modulo_hidraulica_pocos_clientes WHERE id_cliente = ? AND tenant_id = ?`, [idClienteNovo, tenant]);
    if (!cli) throw new ErroObra('Cliente não encontrado.', 404);
    const operador = operadorDe(req);
    const [ins]: any = await conn.execute(
      `INSERT INTO modulo_hidraulica_pocos_obras (tenant_id, id_cliente, id_poco, titulo, servicos, situacao, garantia_meses, metros_previstos, valor_contratado,
         valor_parcelado, valor_metro_excedente, valor_sinal, sinal_quando, dados_relatorio, escopo, prazo_execucao_dias, forma_pagamento, validade_orcamento_dias, observacao, operador)
       VALUES (?, ?, ?, ?, ?, 'ORCAMENTO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, idClienteNovo, mesmoCliente ? o.id_poco : null, o.titulo ? `${o.titulo} (cópia)`.slice(0, 150) : null, o.servicos, o.garantia_meses,
        o.metros_previstos, o.valor_contratado, o.valor_parcelado, o.valor_metro_excedente, o.valor_sinal, o.sinal_quando,
        JSON.stringify(relatorioInicial(cli, null, { metrosPrevistos: nulo(o.metros_previstos), valorContratado: nulo(o.valor_contratado) })),
        o.escopo, o.prazo_execucao_dias, o.forma_pagamento, o.validade_orcamento_dias, `Cópia do orçamento ${id}`, operador]);
    const novo = Number(ins.insertId);
    await conn.execute(
      `INSERT INTO modulo_hidraulica_pocos_orcamento_itens (tenant_id, id_obra, ordem, grupo, descricao, quantidade, unidade, valor_unitario, valor_total, opcional, incluso, operador)
       SELECT tenant_id, ?, ordem, grupo, descricao, quantidade, unidade, valor_unitario, valor_total, opcional, incluso, ? FROM modulo_hidraulica_pocos_orcamento_itens WHERE id_obra = ?`,
      [novo, operador, id]);
    await acertarSinal(conn, tenant, novo, nulo(o.valor_sinal), operador);
    await conn.commit();
    return res.status(201).json({ idObra: novo });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao duplicar o orçamento.');
  } finally { conn.release(); }
};

// ------------------------------------------------------------------ termos aditivos
const listaAditivos = async (conn: any, idObra: number) => {
  const [ad]: any = await conn.execute(
    `SELECT a.*, DATE_FORMAT(a.emitido_em, '%Y-%m-%d %H:%i') AS emitido_txt, DATE_FORMAT(a.assinado_em, '%Y-%m-%d') AS assinado_txt
     FROM modulo_hidraulica_pocos_aditivos a WHERE a.id_obra = ? ORDER BY a.numero`, [idObra]);
  const [adic]: any = await conn.execute(
    `SELECT id_adicional, id_aditivo, tipo, descricao, quantidade, valor_unitario, valor, situacao, aprovacao_meio, DATE_FORMAT(aprovado_em, '%Y-%m-%d') AS aprovado_txt
     FROM modulo_hidraulica_pocos_adicionais WHERE id_obra = ? ORDER BY id_adicional`, [idObra]);
  const fmt = (x: any) => ({ idAdicional: Number(x.id_adicional), tipo: x.tipo, descricao: x.descricao, quantidade: Number(x.quantidade), valorUnitario: Number(x.valor_unitario),
    valor: Number(x.valor), situacao: x.situacao, aprovacaoMeio: x.aprovacao_meio || null, aprovadoEm: x.aprovado_txt || null, idAditivo: nulo(x.id_aditivo) });
  return {
    aditivos: ad.map((a: any) => ({ idAditivo: Number(a.id_aditivo), numero: Number(a.numero), valor: Number(a.valor), observacao: a.observacao || null,
      emitidoEm: a.emitido_txt, assinadoEm: a.assinado_txt || null, operador: a.operador,
      adicionais: adic.filter((x: any) => Number(x.id_aditivo) === Number(a.id_aditivo)).map(fmt) })),
    semAditivo: adic.filter((x: any) => x.situacao === 'APROVADO' && !x.id_aditivo).map(fmt),
  };
};

// GET /obras/:id/aditivos — os aditivos da obra e os adicionais aprovados que ainda não entraram em nenhum
export const aditivosDaObra = async (req: Request, res: Response) => {
  try {
    const [[o]]: any = await pool.execute(`SELECT id_obra FROM modulo_hidraulica_pocos_obras WHERE id_obra = ? AND tenant_id = ?`, [Number(req.params.id), tenantDe(req)]);
    if (!o) throw new ErroObra('Obra não encontrada.', 404);
    return res.json(await listaAditivos(pool, Number(req.params.id)));
  } catch (e) { return responderErro(res, e, 'Erro ao listar os aditivos.'); }
};

// POST /obras/:id/aditivos { idsAdicionais?, observacao? } — emite o próximo aditivo com os adicionais aprovados escolhidos
export const emitirAditivo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    await conn.beginTransaction();
    const [[o]]: any = await conn.execute(`SELECT situacao FROM modulo_hidraulica_pocos_obras WHERE id_obra = ? AND tenant_id = ? FOR UPDATE`, [id, tenant]);
    if (!o) throw new ErroObra('Obra não encontrada.', 404);
    if (o.situacao === 'CANCELADA') throw new ErroObra('A obra está cancelada.', 409);
    const [adic]: any = await conn.execute(`SELECT id_adicional, situacao, valor, id_aditivo FROM modulo_hidraulica_pocos_adicionais WHERE id_obra = ?`, [id]);
    const [nums]: any = await conn.execute(`SELECT numero FROM modulo_hidraulica_pocos_aditivos WHERE id_obra = ?`, [id]);
    const escolhidos = Array.isArray(req.body?.idsAdicionais) ? req.body.idsAdicionais.map(Number).filter((x: number) => x > 0) : null;
    const a = novoAditivo(adic.map((x: any) => ({ idAdicional: Number(x.id_adicional), situacao: x.situacao, valor: Number(x.valor), idAditivo: nulo(x.id_aditivo) })),
      escolhidos, nums.map((x: any) => Number(x.numero)));
    const [ins]: any = await conn.execute(
      `INSERT INTO modulo_hidraulica_pocos_aditivos (tenant_id, id_obra, numero, valor, observacao, emitido_em, operador) VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
      [tenant, id, a.numero, a.valor, String(req.body?.observacao || '').trim().slice(0, 255) || null, operadorDe(req)]);
    await conn.execute(`UPDATE modulo_hidraulica_pocos_adicionais SET id_aditivo = ? WHERE id_adicional IN (${a.ids.map(() => '?').join(',')})`, [Number(ins.insertId), ...a.ids]);
    await conn.commit();
    return res.status(201).json({ idAditivo: Number(ins.insertId), numero: a.numero, valor: a.valor });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao emitir o aditivo.');
  } finally { conn.release(); }
};

// POST /aditivos/:id/assinado { assinadoEm? } (vazio = hoje; null desmarca)
export const marcarAditivoAssinado = async (req: Request, res: Response) => {
  try {
    const desmarcar = req.body?.assinadoEm === null;
    const data = desmarcar ? null : String(req.body?.assinadoEm || '').slice(0, 10) || null;
    if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroObra('Data inválida.');
    const [u]: any = await pool.execute(`UPDATE modulo_hidraulica_pocos_aditivos SET assinado_em = ${desmarcar ? 'NULL' : data ? '?' : 'NOW()'} WHERE id_aditivo = ? AND tenant_id = ?`,
      [...(data && !desmarcar ? [data] : []), Number(req.params.id), tenantDe(req)]);
    if (!u.affectedRows) throw new ErroObra('Aditivo não encontrado.', 404);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao marcar o aditivo.'); }
};

// DELETE /aditivos/:id — só o último e não assinado (os adicionais voltam a ficar livres)
export const apagarAditivo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[a]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_aditivos WHERE id_aditivo = ? AND tenant_id = ? FOR UPDATE`, [Number(req.params.id), tenant]);
    if (!a) throw new ErroObra('Aditivo não encontrado.', 404);
    if (a.assinado_em) throw new ErroObra('Aditivo assinado não pode ser apagado.', 409);
    const [[ult]]: any = await conn.execute(`SELECT MAX(numero) AS n FROM modulo_hidraulica_pocos_aditivos WHERE id_obra = ?`, [a.id_obra]);
    if (Number(ult.n) !== Number(a.numero)) throw new ErroObra('Só dá para apagar o último aditivo da obra.', 409);
    await conn.execute(`UPDATE modulo_hidraulica_pocos_adicionais SET id_aditivo = NULL WHERE id_aditivo = ?`, [a.id_aditivo]);
    await conn.execute(`DELETE FROM modulo_hidraulica_pocos_aditivos WHERE id_aditivo = ?`, [a.id_aditivo]);
    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao apagar o aditivo.');
  } finally { conn.release(); }
};
