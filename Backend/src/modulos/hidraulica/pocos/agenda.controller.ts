// Obras de poços › agenda, equipe e sonda (etapa 5): cadastros de equipe e equipamentos do módulo e a agenda (com quem
// vai e o que vai). Ao gravar, devolve os avisos de conflito (pessoa/equipamento em dois lugares, equipamento parado),
// sem bloquear. Tabelas modulo_hidraulica_pocos_equipe, _equipamentos, _agenda, _agenda_equipe e _agenda_equipamentos.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { ErroObra } from './obras';
import { responderErro } from './obras.controller';
import { avisosDoCompromisso, CompromissoResumo, SITUACOES_AGENDA, validarCompromisso, validarEquipamento, validarMembro } from './agenda';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const dia = /^\d{4}-\d{2}-\d{2}$/;

// ------------------------------------------------------------------ equipe e equipamentos
const formatarMembro = (m: any) => ({
  idMembro: Number(m.id_membro), nome: m.nome, funcao: m.funcao, telefone: m.telefone || null, observacao: m.observacao || null, ativo: !!m.ativo,
});
const formatarEquipamento = (e: any) => ({
  idEquipamento: Number(e.id_equipamento), nome: e.nome, tipo: e.tipo, identificacao: e.identificacao || null, situacao: e.situacao, observacao: e.observacao || null,
});

// GET /equipe?todos=1
export const listarEquipe = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute(
      `SELECT * FROM modulo_hidraulica_pocos_equipe WHERE tenant_id = ? ${req.query.todos ? '' : 'AND ativo = 1'} ORDER BY ativo DESC, nome`, [tenantDe(req)]);
    return res.json(rows.map(formatarMembro));
  } catch (e) { return responderErro(res, e, 'Erro ao listar a equipe.'); }
};
const gravarMembro = async (req: Request, res: Response, id: number | null) => {
  const tenant = tenantDe(req);
  try {
    const m = validarMembro(req.body);
    const valores = [m.nome, m.funcao, m.telefone, m.observacao, m.ativo, operadorDe(req)];
    if (id) {
      const [r]: any = await pool.execute(
        `UPDATE modulo_hidraulica_pocos_equipe SET nome = ?, funcao = ?, telefone = ?, observacao = ?, ativo = ?, operador = ? WHERE id_membro = ? AND tenant_id = ?`, [...valores, id, tenant]);
      if (!r.affectedRows) throw new ErroObra('Pessoa não encontrada.', 404);
    } else {
      const [ins]: any = await pool.execute(
        `INSERT INTO modulo_hidraulica_pocos_equipe (nome, funcao, telefone, observacao, ativo, operador, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)`, [...valores, tenant]);
      id = Number(ins.insertId);
    }
    const [[row]]: any = await pool.execute(`SELECT * FROM modulo_hidraulica_pocos_equipe WHERE id_membro = ?`, [id]);
    return res.status(req.method === 'POST' ? 201 : 200).json(formatarMembro(row));
  } catch (e) { return responderErro(res, e, 'Erro ao salvar a pessoa da equipe.'); }
};
export const criarMembro = (req: Request, res: Response) => gravarMembro(req, res, null);
export const salvarMembro = (req: Request, res: Response) => gravarMembro(req, res, Number(req.params.id));

// GET /equipamentos?todos=1 (sem "todos", esconde os inativos)
export const listarEquipamentos = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute(
      `SELECT * FROM modulo_hidraulica_pocos_equipamentos WHERE tenant_id = ? ${req.query.todos ? '' : "AND situacao <> 'INATIVO'"}
       ORDER BY FIELD(situacao, 'ATIVO', 'MANUTENCAO', 'INATIVO'), tipo, nome`, [tenantDe(req)]);
    return res.json(rows.map(formatarEquipamento));
  } catch (e) { return responderErro(res, e, 'Erro ao listar os equipamentos.'); }
};
const gravarEquipamento = async (req: Request, res: Response, id: number | null) => {
  const tenant = tenantDe(req);
  try {
    const e = validarEquipamento(req.body);
    const valores = [e.nome, e.tipo, e.identificacao, e.situacao, e.observacao, operadorDe(req)];
    if (id) {
      const [r]: any = await pool.execute(
        `UPDATE modulo_hidraulica_pocos_equipamentos SET nome = ?, tipo = ?, identificacao = ?, situacao = ?, observacao = ?, operador = ? WHERE id_equipamento = ? AND tenant_id = ?`,
        [...valores, id, tenant]);
      if (!r.affectedRows) throw new ErroObra('Equipamento não encontrado.', 404);
    } else {
      const [ins]: any = await pool.execute(
        `INSERT INTO modulo_hidraulica_pocos_equipamentos (nome, tipo, identificacao, situacao, observacao, operador, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)`, [...valores, tenant]);
      id = Number(ins.insertId);
    }
    const [[row]]: any = await pool.execute(`SELECT * FROM modulo_hidraulica_pocos_equipamentos WHERE id_equipamento = ?`, [id]);
    return res.status(req.method === 'POST' ? 201 : 200).json(formatarEquipamento(row));
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o equipamento.'); }
};
export const criarEquipamento = (req: Request, res: Response) => gravarEquipamento(req, res, null);
export const salvarEquipamento = (req: Request, res: Response) => gravarEquipamento(req, res, Number(req.params.id));

// ------------------------------------------------------------------ agenda
/** Compromissos (com equipe e equipamentos) que se encontram com o período, ou de uma obra. */
const carregarCompromissos = async (conn: any, tenant: number, f: { de?: string; ate?: string; idObra?: number; ids?: number[] }) => {
  const where = ['a.tenant_id = ?'];
  const params: any[] = [tenant];
  if (f.de && f.ate) { where.push('a.data_inicio <= ? AND a.data_fim >= ?'); params.push(f.ate, f.de); }
  if (f.idObra) { where.push('a.id_obra = ?'); params.push(f.idObra); }
  if (f.ids) { if (!f.ids.length) return []; where.push(`a.id_agenda IN (${f.ids.map(() => '?').join(',')})`); params.push(...f.ids); }
  const [rows]: any = await conn.execute(
    `SELECT a.*, DATE_FORMAT(a.data_inicio, '%Y-%m-%d') AS inicio_txt, DATE_FORMAT(a.data_fim, '%Y-%m-%d') AS fim_txt, TIME_FORMAT(a.hora_inicio, '%H:%i') AS hora_txt,
            o.titulo AS obra_titulo, o.situacao AS obra_situacao, c.nome AS cliente, c.telefone AS cliente_telefone
     FROM modulo_hidraulica_pocos_agenda a
     LEFT JOIN modulo_hidraulica_pocos_obras o ON o.id_obra = a.id_obra
     LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = o.id_cliente
     WHERE ${where.join(' AND ')} ORDER BY a.data_inicio, a.hora_inicio IS NULL, a.hora_inicio, a.id_agenda LIMIT 2000`, params);
  if (!rows.length) return [];
  const lista = rows.map((r: any) => Number(r.id_agenda));
  const marcas = lista.map(() => '?').join(',');
  const [eq]: any = await conn.execute(
    `SELECT ae.id_agenda, m.id_membro, m.nome, m.funcao FROM modulo_hidraulica_pocos_agenda_equipe ae
     JOIN modulo_hidraulica_pocos_equipe m ON m.id_membro = ae.id_membro WHERE ae.id_agenda IN (${marcas}) ORDER BY m.nome`, lista);
  const [ex]: any = await conn.execute(
    `SELECT ae.id_agenda, e.id_equipamento, e.nome, e.tipo, e.situacao FROM modulo_hidraulica_pocos_agenda_equipamentos ae
     JOIN modulo_hidraulica_pocos_equipamentos e ON e.id_equipamento = ae.id_equipamento WHERE ae.id_agenda IN (${marcas}) ORDER BY e.nome`, lista);
  return rows.map((r: any) => ({
    idAgenda: Number(r.id_agenda), idObra: r.id_obra ? Number(r.id_obra) : null, obra: r.obra_titulo || null, obraSituacao: r.obra_situacao || null,
    cliente: r.cliente || null, clienteTelefone: r.cliente_telefone || null,
    tipo: r.tipo, titulo: r.titulo, local: r.local || null, dataInicio: r.inicio_txt, dataFim: r.fim_txt, horaInicio: r.hora_txt || null,
    situacao: r.situacao, observacao: r.observacao || null,
    equipe: eq.filter((x: any) => Number(x.id_agenda) === Number(r.id_agenda)).map((x: any) => ({ id: Number(x.id_membro), nome: x.nome, funcao: x.funcao })),
    equipamentos: ex.filter((x: any) => Number(x.id_agenda) === Number(r.id_agenda))
      .map((x: any) => ({ id: Number(x.id_equipamento), nome: x.nome, tipo: x.tipo, situacao: x.situacao })),
  }));
};

/** Os avisos de um compromisso olhando todos os outros que se sobrepõem a ele (mesmo fora do período da tela). */
const avisosDe = async (conn: any, tenant: number, c: CompromissoResumo) => {
  const outros = await carregarCompromissos(conn, tenant, { de: c.dataInicio, ate: c.dataFim });
  return avisosDoCompromisso(c, outros);
};

// GET /agenda?de=AAAA-MM-DD&ate=AAAA-MM-DD  ou  ?idObra=
export const listarAgenda = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const idObra = Number(req.query.idObra) || undefined;
    const de = String(req.query.de || ''), ate = String(req.query.ate || '');
    if (!idObra && (!dia.test(de) || !dia.test(ate))) throw new ErroObra('Informe o período (de e até).');
    const lista = await carregarCompromissos(pool, tenant, idObra ? { idObra } : { de, ate });
    return res.json(lista.map((c: CompromissoResumo) => ({ ...c, avisos: avisosDoCompromisso(c, lista) })));
  } catch (e) { return responderErro(res, e, 'Erro ao carregar a agenda.'); }
};

const gravarCompromisso = async (req: Request, res: Response, id: number | null) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const c = validarCompromisso(req.body);
    await conn.beginTransaction();
    if (c.idObra) {
      const [[o]]: any = await conn.execute(`SELECT id_obra FROM modulo_hidraulica_pocos_obras WHERE id_obra = ? AND tenant_id = ?`, [c.idObra, tenant]);
      if (!o) throw new ErroObra('Obra não encontrada.', 404);
    }
    const valores = [c.idObra, c.tipo, c.titulo, c.local, c.dataInicio, c.dataFim, c.horaInicio, c.situacao, c.observacao, operadorDe(req)];
    if (id) {
      const [r]: any = await conn.execute(
        `UPDATE modulo_hidraulica_pocos_agenda SET id_obra = ?, tipo = ?, titulo = ?, local = ?, data_inicio = ?, data_fim = ?, hora_inicio = ?, situacao = ?,
           observacao = ?, operador = ? WHERE id_agenda = ? AND tenant_id = ?`, [...valores, id, tenant]);
      if (!r.affectedRows) throw new ErroObra('Compromisso não encontrado.', 404);
      await conn.execute(`DELETE FROM modulo_hidraulica_pocos_agenda_equipe WHERE id_agenda = ?`, [id]);
      await conn.execute(`DELETE FROM modulo_hidraulica_pocos_agenda_equipamentos WHERE id_agenda = ?`, [id]);
    } else {
      const [ins]: any = await conn.execute(
        `INSERT INTO modulo_hidraulica_pocos_agenda (id_obra, tipo, titulo, local, data_inicio, data_fim, hora_inicio, situacao, observacao, operador, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [...valores, tenant]);
      id = Number(ins.insertId);
    }
    for (const m of c.equipe) {
      const [[ok]]: any = await conn.execute(`SELECT id_membro FROM modulo_hidraulica_pocos_equipe WHERE id_membro = ? AND tenant_id = ?`, [m, tenant]);
      if (!ok) throw new ErroObra('Pessoa da equipe não encontrada.', 404);
      await conn.execute(`INSERT INTO modulo_hidraulica_pocos_agenda_equipe (id_agenda, id_membro) VALUES (?, ?)`, [id, m]);
    }
    for (const e of c.equipamentos) {
      const [[ok]]: any = await conn.execute(`SELECT id_equipamento FROM modulo_hidraulica_pocos_equipamentos WHERE id_equipamento = ? AND tenant_id = ?`, [e, tenant]);
      if (!ok) throw new ErroObra('Equipamento não encontrado.', 404);
      await conn.execute(`INSERT INTO modulo_hidraulica_pocos_agenda_equipamentos (id_agenda, id_equipamento) VALUES (?, ?)`, [id, e]);
    }
    await conn.commit();
    const [salvo] = await carregarCompromissos(pool, tenant, { ids: [id] });
    return res.status(req.method === 'POST' ? 201 : 200).json({ ...salvo, avisos: await avisosDe(pool, tenant, salvo) });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao salvar o compromisso.');
  } finally { conn.release(); }
};
// POST /agenda / PUT /agenda/:id { idObra?, tipo, titulo, local, dataInicio, dataFim, horaInicio, situacao, observacao, equipe[], equipamentos[] }
export const criarCompromisso = (req: Request, res: Response) => gravarCompromisso(req, res, null);
export const salvarCompromisso = (req: Request, res: Response) => gravarCompromisso(req, res, Number(req.params.id));

// POST /agenda/:id/situacao { situacao } — realizado / cancelado / de volta para agendado
export const mudarCompromisso = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const situacao = String(req.body?.situacao || '').toUpperCase();
    if (!(SITUACOES_AGENDA as readonly string[]).includes(situacao)) throw new ErroObra(`Situação inválida: ${req.body?.situacao}.`);
    const [r]: any = await pool.execute(`UPDATE modulo_hidraulica_pocos_agenda SET situacao = ?, operador = ? WHERE id_agenda = ? AND tenant_id = ?`,
      [situacao, operadorDe(req), Number(req.params.id), tenant]);
    if (!r.affectedRows) throw new ErroObra('Compromisso não encontrado.', 404);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao mudar o compromisso.'); }
};

// DELETE /agenda/:id — apaga o compromisso lançado por engano (a escala vai junto)
export const removerCompromisso = async (req: Request, res: Response) => {
  try {
    const [r]: any = await pool.execute(`DELETE FROM modulo_hidraulica_pocos_agenda WHERE id_agenda = ? AND tenant_id = ?`, [Number(req.params.id), tenantDe(req)]);
    if (!r.affectedRows) throw new ErroObra('Compromisso não encontrado.', 404);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao apagar o compromisso.'); }
};
