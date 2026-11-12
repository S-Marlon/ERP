// Obras de poços › conjunto motobomba do poço (atual e histórico de trocas) e fotos do poço (bomba, cabeça do poço,
// quadro, local). As regras ficam em conjuntos.ts; as gravações que a obra também usa, em conjuntosBanco.ts.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { apagarArquivoDaUrl, salvarArquivo } from '../../../infra/arquivos';
import { ErroObra } from './obras';
import { carregarPoco, responderErro } from './obras.controller';
import { idadeEmAnos, resumoConjunto, TIPOS_FOTO_POCO, validarConjunto } from './conjuntos';
import { COLUNAS_CONJUNTO, conjuntoDaLinha, inserirConjunto, retirarInstalado } from './conjuntosBanco';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const SELECT_CONJUNTO = `SELECT k.*, DATE_FORMAT(k.instalado_em, '%Y-%m-%d') AS instalado_txt, DATE_FORMAT(k.retirado_em, '%Y-%m-%d') AS retirado_txt,
    o.titulo AS obra_titulo FROM modulo_hidraulica_pocos_conjuntos k LEFT JOIN modulo_hidraulica_pocos_obras o ON o.id_obra = k.id_obra`;

const formatarConjunto = (r: any, hoje: string) => {
  const c: any = conjuntoDaLinha(r);
  c.instaladoEm = r.instalado_txt || null;
  c.retiradoEm = r.retirado_txt || null;
  return {
    idConjunto: Number(r.id_conjunto), idPoco: Number(r.id_poco), idObra: nulo(r.id_obra), obra: r.id_obra ? r.obra_titulo || `Obra nº ${r.id_obra}` : null,
    situacao: r.situacao as 'INSTALADO' | 'RETIRADO', ...c, resumo: resumoConjunto(c),
    // tempo de uso (até hoje ou até a retirada): ajuda a prever a próxima troca e o plano mensal
    anosDeUso: idadeEmAnos(c.instaladoEm, c.retiradoEm || hoje), operador: r.operador,
  };
};

const carregarConjunto = async (tenant: number, id: number) => {
  const [[r]]: any = await pool.execute(`${SELECT_CONJUNTO} WHERE k.id_conjunto = ? AND k.tenant_id = ?`, [id, tenant]);
  if (!r) throw new ErroObra('Conjunto não encontrado.', 404);
  return r;
};

// GET /pocos/:id/conjunto — conjunto instalado, histórico, fotos do poço e fotos das obras do poço
export const conjuntoDoPoco = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregarPoco(tenant, id);
    const hoje = hojeLocal();
    const [linhas]: any = await pool.execute(`${SELECT_CONJUNTO} WHERE k.id_poco = ? AND k.tenant_id = ?
      ORDER BY k.situacao = 'INSTALADO' DESC, k.instalado_em IS NULL, k.instalado_em DESC, k.id_conjunto DESC`, [id, tenant]);
    const conjuntos = linhas.map((r: any) => formatarConjunto(r, hoje));
    const [fotos]: any = await pool.execute(
      `SELECT f.*, DATE_FORMAT(f.tirada_em, '%Y-%m-%d') AS tirada_txt, DATE_FORMAT(f.created_at, '%Y-%m-%d') AS criada_txt
       FROM modulo_hidraulica_pocos_pocos_fotos f WHERE f.id_poco = ? AND f.tenant_id = ? ORDER BY COALESCE(f.tirada_em, DATE(f.created_at)) DESC, f.id_foto DESC`, [id, tenant]);
    const [daObra]: any = await pool.execute(
      `SELECT f.id_foto, f.id_obra, f.etapa, f.arquivo, f.legenda, DATE_FORMAT(f.created_at, '%Y-%m-%d') AS criada_txt, o.titulo
       FROM modulo_hidraulica_pocos_fotos f JOIN modulo_hidraulica_pocos_obras o ON o.id_obra = f.id_obra
       WHERE o.id_poco = ? AND o.tenant_id = ? ORDER BY f.created_at DESC LIMIT 60`, [id, tenant]);
    return res.json({
      atual: conjuntos.find((c: any) => c.situacao === 'INSTALADO') || null,
      historico: conjuntos.filter((c: any) => c.situacao === 'RETIRADO'),
      fotos: fotos.map((f: any) => ({
        idFoto: Number(f.id_foto), tipo: f.tipo, idConjunto: nulo(f.id_conjunto), url: `/uploads/${f.arquivo}`, legenda: f.legenda || null,
        tiradaEm: f.tirada_txt || null, criadaEm: f.criada_txt, operador: f.operador,
      })),
      fotosDasObras: daObra.map((f: any) => ({
        idFoto: Number(f.id_foto), idObra: Number(f.id_obra), obra: f.titulo || `Obra nº ${f.id_obra}`, etapa: f.etapa, url: `/uploads/${f.arquivo}`,
        legenda: f.legenda || null, criadaEm: f.criada_txt,
      })),
    });
  } catch (e) { return responderErro(res, e, 'Erro ao carregar o conjunto do poço.'); }
};

// POST /pocos/:id/conjuntos { ...conjunto, substituir? } — com retiradoEm entra direto no histórico
export const criarConjunto = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    await carregarPoco(tenant, id);
    const c = validarConjunto(req.body, hojeLocal());
    await conn.beginTransaction();
    if (!c.retiradoEm) {
      const [[atual]]: any = await conn.execute(
        `SELECT id_conjunto FROM modulo_hidraulica_pocos_conjuntos WHERE id_poco = ? AND tenant_id = ? AND situacao = 'INSTALADO' FOR UPDATE`, [id, tenant]);
      if (atual && !req.body?.substituir) throw new ErroObra('O poço já tem um conjunto instalado: use "Trocar conjunto" ou edite o atual.', 409);
      if (atual) await retirarInstalado(conn, tenant, id, c.instaladoEm || hojeLocal(), operadorDe(req));
    }
    const novo = await inserirConjunto(conn, tenant, id, nulo(req.body?.idObra), c, operadorDe(req));
    await conn.commit();
    return res.status(201).json(formatarConjunto(await carregarConjunto(tenant, novo), hojeLocal()));
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao registrar o conjunto.');
  } finally { conn.release(); }
};

// PUT /conjuntos/:id — corrige os dados; com data de retirada vai para o histórico
export const salvarConjunto = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const atual = await carregarConjunto(tenant, id);
    const c = validarConjunto(req.body, hojeLocal());
    const situacao = c.retiradoEm ? 'RETIRADO' : 'INSTALADO';
    if (situacao === 'INSTALADO' && atual.situacao === 'RETIRADO') {
      const [[outro]]: any = await pool.execute(
        `SELECT id_conjunto FROM modulo_hidraulica_pocos_conjuntos WHERE id_poco = ? AND situacao = 'INSTALADO' AND id_conjunto <> ?`, [atual.id_poco, id]);
      if (outro) throw new ErroObra('Já há outro conjunto instalado no poço: informe a data de retirada deste.', 409);
    }
    const chaves = Object.keys(COLUNAS_CONJUNTO) as (keyof typeof COLUNAS_CONJUNTO)[];
    await pool.execute(
      `UPDATE modulo_hidraulica_pocos_conjuntos SET situacao = ?, ${chaves.map(k => `${COLUNAS_CONJUNTO[k]} = ?`).join(', ')}, operador = ? WHERE id_conjunto = ?`,
      [situacao, ...chaves.map(k => (c as any)[k] ?? null), operadorDe(req), id]);
    return res.json(formatarConjunto(await carregarConjunto(tenant, id), hojeLocal()));
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o conjunto.'); }
};

// POST /conjuntos/:id/retirar { retiradoEm } — bomba tirada sem outra no lugar (ex.: foi para o conserto)
export const retirarConjunto = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const atual = await carregarConjunto(tenant, id);
    if (atual.situacao !== 'INSTALADO') throw new ErroObra('Este conjunto já foi retirado.', 409);
    const hoje = hojeLocal();
    const dia = String(req.body?.retiradoEm || hoje).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || dia > hoje) throw new ErroObra('Data de retirada inválida (não pode ser no futuro).');
    if (atual.instalado_txt && dia < atual.instalado_txt) throw new ErroObra('A retirada não pode ser antes da instalação.');
    await pool.execute(`UPDATE modulo_hidraulica_pocos_conjuntos SET situacao = 'RETIRADO', retirado_em = ?, operador = ? WHERE id_conjunto = ?`, [dia, operadorDe(req), id]);
    return res.json(formatarConjunto(await carregarConjunto(tenant, id), hoje));
  } catch (e) { return responderErro(res, e, 'Erro ao retirar o conjunto.'); }
};

// DELETE /conjuntos/:id — lançado por engano (as fotos ficam no poço, sem o vínculo)
export const apagarConjunto = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    await carregarConjunto(tenant, id);
    await conn.beginTransaction();
    await conn.execute(`UPDATE modulo_hidraulica_pocos_pocos_fotos SET id_conjunto = NULL WHERE id_conjunto = ?`, [id]);
    await conn.execute(`DELETE FROM modulo_hidraulica_pocos_conjuntos WHERE id_conjunto = ?`, [id]);
    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, e, 'Erro ao apagar o conjunto.');
  } finally { conn.release(); }
};

const lerFoto = (b: any) => {
  const tipo = String(b?.tipo || 'OUTRO').toUpperCase();
  if (!(TIPOS_FOTO_POCO as readonly string[]).includes(tipo)) throw new ErroObra('Tipo da foto: bomba, cabeça do poço, quadro, local ou outra.');
  const tiradaEm = String(b?.tiradaEm || '').slice(0, 10) || null;
  if (tiradaEm && (!/^\d{4}-\d{2}-\d{2}$/.test(tiradaEm) || tiradaEm > hojeLocal())) throw new ErroObra('Data da foto inválida (não pode ser no futuro).');
  return { tipo, legenda: String(b?.legenda || '').trim().slice(0, 150) || null, tiradaEm };
};

// POST /pocos/:id/fotos { tipo, conteudo, nome, legenda?, tiradaEm? } — bomba, cabeça e quadro ficam ligadas ao conjunto instalado
export const enviarFotoPoco = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregarPoco(tenant, id);
    const f = lerFoto(req.body);
    const arq = salvarArquivo(`pocos/pocos/${id}`, String(req.body?.nome || `foto-${f.tipo.toLowerCase()}`), String(req.body?.conteudo || ''));
    if (!arq.tipo.startsWith('image/')) { apagarArquivoDaUrl(`/uploads/${arq.relativo}`); throw new ErroObra('Envie uma imagem (JPG, PNG ou WEBP).'); }
    let idConjunto: number | null = null;
    if (['BOMBA', 'CABECA', 'QUADRO'].includes(f.tipo)) {
      const [[k]]: any = await pool.execute(`SELECT id_conjunto FROM modulo_hidraulica_pocos_conjuntos WHERE id_poco = ? AND situacao = 'INSTALADO' LIMIT 1`, [id]);
      idConjunto = k ? Number(k.id_conjunto) : null;
    }
    const [ins]: any = await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_pocos_fotos (tenant_id, id_poco, id_conjunto, tipo, arquivo, legenda, tirada_em, operador) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, id, idConjunto, f.tipo, arq.relativo, f.legenda, f.tiradaEm, operadorDe(req)]);
    return res.status(201).json({ idFoto: Number(ins.insertId), url: `/uploads/${arq.relativo}` });
  } catch (e) { return responderErro(res, e, 'Erro ao enviar a foto.'); }
};

// PUT /pocos-fotos/:id { tipo, legenda, tiradaEm }
export const salvarFotoPoco = async (req: Request, res: Response) => {
  try {
    const f = lerFoto(req.body);
    const [u]: any = await pool.execute(`UPDATE modulo_hidraulica_pocos_pocos_fotos SET tipo = ?, legenda = ?, tirada_em = ? WHERE id_foto = ? AND tenant_id = ?`,
      [f.tipo, f.legenda, f.tiradaEm, Number(req.params.id), tenantDe(req)]);
    if (!u.affectedRows) throw new ErroObra('Foto não encontrada.', 404);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao salvar a foto.'); }
};

// DELETE /pocos-fotos/:id (apaga o arquivo também)
export const apagarFotoPoco = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [[f]]: any = await pool.execute(`SELECT arquivo FROM modulo_hidraulica_pocos_pocos_fotos WHERE id_foto = ? AND tenant_id = ?`, [Number(req.params.id), tenant]);
    if (!f) throw new ErroObra('Foto não encontrada.', 404);
    await pool.execute(`DELETE FROM modulo_hidraulica_pocos_pocos_fotos WHERE id_foto = ?`, [Number(req.params.id)]);
    apagarArquivoDaUrl(`/uploads/${f.arquivo}`);
    return res.json({ ok: true });
  } catch (e) { return responderErro(res, e, 'Erro ao apagar a foto.'); }
};
