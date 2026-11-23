// Obras de poços › materiais (etapa 4): o cadastro de materiais do módulo e os materiais de cada obra (previsto, usado,
// custo congelado na linha), copiar de outra obra e cobrar à parte (vira adicional pendente de aprovação).
// Tabelas modulo_hidraulica_pocos_materiais e _obras_materiais (não usa o catálogo nem o estoque da loja).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { ErroObra } from './obras';
import { responderErro } from './obras.controller';
import { validarAdicional } from './cobranca';
import { adicionalDoMaterial, resumoMateriais, totalLinha, validarLinha, validarMaterial } from './materiais';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const formatarMaterial = (m: any) => ({
  idMaterial: Number(m.id_material), nome: m.nome, categoria: m.categoria, unidade: m.unidade, custo: Number(m.custo),
  precoVenda: nulo(m.preco_venda), observacao: m.observacao || null, ativo: !!m.ativo, usos: Number(m.usos) || 0,
  diametro: m.diametro || null, comprimentoM: nulo(m.comprimento_m), marca: m.marca || null, classe: m.classe || null, cor: m.cor || null,
});

// GET /materiais?busca=&todos=1 (sem "todos", só os ativos)
export const listarMateriais = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const where = ['m.tenant_id = ?'];
    const params: any[] = [tenant];
    if (!req.query.todos) where.push('m.ativo = 1');
    const busca = String(req.query.busca || '').trim();
    if (busca) { where.push('m.nome LIKE ?'); params.push(`%${busca}%`); }
    const [rows]: any = await pool.execute(
      `SELECT m.*, (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras_materiais l WHERE l.id_material = m.id_material) AS usos
       FROM modulo_hidraulica_pocos_materiais m WHERE ${where.join(' AND ')} ORDER BY m.categoria, m.nome LIMIT 1000`, params);
    return res.json(rows.map(formatarMaterial));
  } catch (e) { return responderErro(res, e, 'Erro ao listar os materiais.'); }
};

const gravarMaterial = async (req: Request, res: Response, id: number | null) => {
  const tenant = tenantDe(req);
  try {
    const m = validarMaterial(req.body);
    const [[mesmo]]: any = await pool.execute(
      `SELECT id_material FROM modulo_hidraulica_pocos_materiais WHERE tenant_id = ? AND nome = ? AND id_material <> ?`, [tenant, m.nome, id || 0]);
    if (mesmo) throw new ErroObra(`Já existe um material chamado "${m.nome}".`, 409);
    const valores = [m.nome, m.categoria, m.unidade, m.custo, m.precoVenda, m.observacao, m.ativo, m.diametro, m.comprimentoM, m.marca, m.classe, m.cor, operadorDe(req)];
    if (id) {
      const [r]: any = await pool.execute(
        `UPDATE modulo_hidraulica_pocos_materiais SET nome = ?, categoria = ?, unidade = ?, custo = ?, preco_venda = ?, observacao = ?, ativo = ?,
           diametro = ?, comprimento_m = ?, marca = ?, classe = ?, cor = ?, operador = ?
         WHERE id_material = ? AND tenant_id = ?`, [...valores, id, tenant]);
      if (!r.affectedRows) throw new ErroObra('Material não encontrado.', 404);
    } else {
      const [ins]: any = await pool.execute(
        `INSERT INTO modulo_hidraulica_pocos_materiais (nome, categoria, unidade, custo, preco_venda, observacao, ativo, diametro, comprimento_m, marca, classe, cor, operador, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...valores, tenant]);
      id = Number(ins.insertId);
    }
    const [[row]]: any = await pool.execute(`SELECT m.*, 0 AS usos FROM modulo_hidraulica_pocos_materiais m WHERE m.id_material = ?`, [id]);
    return res.status(req.method === 'POST' ? 201 : 200).json(formatarMaterial(row));
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o material.'); }
};
export const criarMaterial = (req: Request, res: Response) => gravarMaterial(req, res, null);
export const salvarMaterial = (req: Request, res: Response) => gravarMaterial(req, res, Number(req.params.id));

// ------------------------------------------------------------------ materiais da obra
const carregarObra = async (conn: any, tenant: number, id: number) => {
  const [[o]]: any = await conn.execute(`SELECT id_obra, situacao FROM modulo_hidraulica_pocos_obras WHERE id_obra = ? AND tenant_id = ?`, [id, tenant]);
  if (!o) throw new ErroObra('Obra não encontrada.', 404);
  return o;
};
const naoCancelada = (o: any) => { if (o.situacao === 'CANCELADA') throw new ErroObra('A obra está cancelada.', 409); };

const formatarLinha = (l: any) => {
  const qtdUsada = nulo(l.qtd_usada);
  const custo = Number(l.custo_unitario);
  return {
    idLinha: Number(l.id_linha), idObra: Number(l.id_obra), idMaterial: nulo(l.id_material), descricao: l.descricao, unidade: l.unidade,
    categoria: l.categoria || null, qtdPrevista: Number(l.qtd_prevista), qtdUsada, custoUnitario: custo,
    totalPrevisto: totalLinha(Number(l.qtd_prevista), custo), totalReal: totalLinha(qtdUsada, custo), precoVenda: nulo(l.preco_venda),
    idAdicional: nulo(l.id_adicional), adicionalSituacao: l.adicional_situacao || null, adicionalValor: nulo(l.adicional_valor), observacao: l.observacao || null,
  };
};
const SELECT_LINHA = `SELECT l.*, m.categoria, m.preco_venda, a.situacao AS adicional_situacao, a.valor AS adicional_valor
  FROM modulo_hidraulica_pocos_obras_materiais l
  LEFT JOIN modulo_hidraulica_pocos_materiais m ON m.id_material = l.id_material
  LEFT JOIN modulo_hidraulica_pocos_adicionais a ON a.id_adicional = l.id_adicional`;

// GET /obras/:id/materiais — as linhas e o previsto × real
export const materiaisDaObra = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregarObra(pool, tenant, id);
    const [rows]: any = await pool.execute(`${SELECT_LINHA} WHERE l.id_obra = ? ORDER BY l.id_linha`, [id]);
    const linhas = rows.map(formatarLinha);
    return res.json({ linhas, resumo: resumoMateriais(linhas) });
  } catch (e) { return responderErro(res, e, 'Erro ao carregar os materiais da obra.'); }
};

/** Completa a linha com o cadastro: nome e unidade do material e o custo atual (se o operador não informou outro). */
const completarLinha = async (conn: any, tenant: number, b: any) => {
  const l = validarLinha(b);
  if (!l.idMaterial) return { ...l, descricao: l.descricao as string, unidade: l.unidade || 'un', custoUnitario: l.custoUnitario ?? 0 };
  const [[m]]: any = await conn.execute(`SELECT * FROM modulo_hidraulica_pocos_materiais WHERE id_material = ? AND tenant_id = ?`, [l.idMaterial, tenant]);
  if (!m) throw new ErroObra('Material não encontrado.', 404);
  return { ...l, descricao: l.descricao || m.nome, unidade: l.unidade || m.unidade, custoUnitario: l.custoUnitario ?? Number(m.custo) };
};

// POST /obras/:id/materiais { idMaterial | descricao, unidade?, qtdPrevista, qtdUsada?, custoUnitario?, observacao? }
export const adicionarMaterial = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    naoCancelada(await carregarObra(pool, tenant, id));
    const l = await completarLinha(pool, tenant, req.body);
    const [ins]: any = await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_obras_materiais (tenant_id, id_obra, id_material, descricao, unidade, qtd_prevista, qtd_usada, custo_unitario, observacao, operador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, id, l.idMaterial, l.descricao, l.unidade, l.qtdPrevista, l.qtdUsada, l.custoUnitario, l.observacao, operadorDe(req)]);
    return res.status(201).json({ idLinha: Number(ins.insertId) });
  } catch (e) { return responderErro(res, e, 'Erro ao lançar o material.'); }
};

const carregarLinha = async (conn: any, tenant: number, id: number) => {
  const [[l]]: any = await conn.execute(`${SELECT_LINHA} WHERE l.id_linha = ? AND l.tenant_id = ?`, [id, tenant]);
  if (!l) throw new ErroObra('Material da obra não encontrado.', 404);
  return l;
};

// PUT /obra-materiais/:id — muda quantidades, custo ou descrição (o material escolhido não muda: tire e lance outro)
export const salvarLinhaMaterial = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const atual = await carregarLinha(pool, tenant, Number(req.params.id));
    naoCancelada(await carregarObra(pool, tenant, Number(atual.id_obra)));
    const l = validarLinha({ ...req.body, idMaterial: atual.id_material, descricao: req.body?.descricao ?? atual.descricao });
    await pool.execute(
      `UPDATE modulo_hidraulica_pocos_obras_materiais SET descricao = ?, unidade = ?, qtd_prevista = ?, qtd_usada = ?, custo_unitario = ?, observacao = ?, operador = ?
       WHERE id_linha = ?`,
      [l.descricao || atual.descricao, l.unidade || atual.unidade, l.qtdPrevista, l.qtdUsada, l.custoUnitario ?? Number(atual.custo_unitario), l.observacao,
        operadorDe(req), atual.id_linha]);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o material da obra.'); }
};

// DELETE /obra-materiais/:id — não tira material já cobrado do cliente (cancele o adicional antes)
export const removerLinhaMaterial = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const l = await carregarLinha(pool, tenant, Number(req.params.id));
    if (l.id_adicional && ['PENDENTE', 'APROVADO'].includes(l.adicional_situacao)) {
      throw new ErroObra('Este material foi cobrado do cliente (adicional): cancele ou recuse o adicional antes de tirar.', 409);
    }
    await pool.execute(`DELETE FROM modulo_hidraulica_pocos_obras_materiais WHERE id_linha = ?`, [l.id_linha]);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao tirar o material.'); }
};

// POST /obras/:id/materiais/copiar { deObra } — traz as linhas de outra obra (quantidade prevista e custo atual do cadastro)
export const copiarMateriais = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const de = Number(req.body?.deObra);
    if (!(de > 0) || de === id) throw new ErroObra('Escolha outra obra para copiar.');
    await conn.beginTransaction();
    naoCancelada(await carregarObra(conn, tenant, id));
    await carregarObra(conn, tenant, de);
    const [ins]: any = await conn.execute(
      `INSERT INTO modulo_hidraulica_pocos_obras_materiais (tenant_id, id_obra, id_material, descricao, unidade, qtd_prevista, custo_unitario, operador)
       SELECT l.tenant_id, ?, l.id_material, COALESCE(m.nome, l.descricao), l.unidade, l.qtd_prevista, COALESCE(m.custo, l.custo_unitario), ?
       FROM modulo_hidraulica_pocos_obras_materiais l LEFT JOIN modulo_hidraulica_pocos_materiais m ON m.id_material = l.id_material
       WHERE l.id_obra = ? AND l.tenant_id = ? ORDER BY l.id_linha`,
      [id, operadorDe(req), de, tenant]);
    await conn.commit();
    return res.status(201).json({ copiados: Number(ins.affectedRows) });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao copiar os materiais.');
  } finally { conn.release(); }
};

// POST /obra-materiais/:id/cobrar { valorUnitario? } — vira adicional pendente (o cliente aprova na cobrança)
export const cobrarMaterial = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const l = await carregarLinha(conn, tenant, Number(req.params.id));
    naoCancelada(await carregarObra(conn, tenant, Number(l.id_obra)));
    if (l.id_adicional && ['PENDENTE', 'APROVADO'].includes(l.adicional_situacao)) throw new ErroObra('Este material já foi cobrado do cliente.', 409);
    const preco = req.body?.valorUnitario !== undefined && req.body?.valorUnitario !== null && req.body?.valorUnitario !== ''
      ? Number(req.body.valorUnitario) : nulo(l.preco_venda);
    const a = validarAdicional(adicionalDoMaterial({ descricao: l.descricao, unidade: l.unidade, qtdPrevista: Number(l.qtd_prevista), qtdUsada: nulo(l.qtd_usada) }, preco));
    const [ins]: any = await conn.execute(
      `INSERT INTO modulo_hidraulica_pocos_adicionais (tenant_id, id_obra, tipo, descricao, quantidade, valor_unitario, valor, operador) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, l.id_obra, a.tipo, a.descricao, a.quantidade, a.valorUnitario, a.valor, operadorDe(req)]);
    await conn.execute(`UPDATE modulo_hidraulica_pocos_obras_materiais SET id_adicional = ? WHERE id_linha = ?`, [Number(ins.insertId), l.id_linha]);
    await conn.commit();
    return res.status(201).json({ idAdicional: Number(ins.insertId), valor: a.valor });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao cobrar o material.');
  } finally { conn.release(); }
};
