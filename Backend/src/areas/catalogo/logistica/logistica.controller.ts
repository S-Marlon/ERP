// Logística em lote: peso e medidas dos itens e a embalagem recomendada (por família ou só no item), com o mesmo
// filtro das outras telas em lote. A embalagem é um item de consumo (CON-000123) com custo, peso e medidas próprios.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { condicoesDoFiltro, FiltroItens } from '../filtroItens';
import { obterOuCriarUnidade } from '../precos/configVendas.controller';
import { skuSequencial } from '../../compras/staging/penteFino';
import { ErroLogistica, FaltaLogistica, faltasLogistica, RegraEmbalagem, regrasEfetivas, validarLogistica, validarRegras } from './logistica';
import { carregarEmbalagens } from './embalagensBanco';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const lista = (n: number) => Array(n).fill('?').join(',');
const MAX_ITENS = 500;
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const erro = (res: Response, e: any, padrao: string) => {
  if (e instanceof ErroLogistica) return res.status(e.status).json({ error: e.message });
  console.error(padrao, e);
  return res.status(500).json({ error: padrao, details: e?.message });
};

const medidasDe = (r: any) => {
  const [a, l, c] = [Number(r.altura_cm), Number(r.largura_cm), Number(r.comprimento_cm)];
  return a > 0 && l > 0 && c > 0 ? { altura: a, largura: l, comprimento: c } : null;
};

// GET /api/catalogo/logistica/embalagens
export const listarEmbalagens = async (req: Request, res: Response) => {
  try { return res.json(await carregarEmbalagens(pool, tenantDe(req))); }
  catch (e) { return erro(res, e, 'Erro ao listar as embalagens.'); }
};

// POST /api/catalogo/logistica/embalagens { nome, pesoKg, altura, largura, comprimento, custo } — embalagem nova (item de consumo)
export const criarEmbalagem = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const nome = String(req.body?.nome || '').replace(/\s+/g, ' ').trim().slice(0, 255);
    if (nome.length < 3) throw new ErroLogistica('Informe o nome da embalagem (ex.: Caixa de papelão nº 1).');
    const { pesoKg, medidas } = validarLogistica(req.body);
    if (!medidas) throw new ErroLogistica('Informe as medidas da embalagem (é o que o frete usa).');
    const custo = Number(String(req.body?.custo ?? '').replace(',', '.')) || 0;
    await conn.beginTransaction();
    const idUnidade = await obterOuCriarUnidade(conn, tenant, 'UN', 'Unidade');
    const [ins]: any = await conn.execute(
      `INSERT INTO itens_core (tenant_id, sku, nome_item, tipo_recurso, status, id_unidade, descricao_variacao, peso_bruto)
       VALUES (?, ?, ?, 'CONSUMO', 'ATIVO', ?, 'Principal', ?)`,
      [tenant, `TMP-EMB-${Date.now()}`, nome, idUnidade, pesoKg]
    );
    const id = Number(ins.insertId);
    await conn.execute(`UPDATE itens_core SET sku = ? WHERE id_item = ?`, [skuSequencial('CON', id), id]);
    await conn.execute(
      `INSERT INTO comercial_produtos_dados (tenant_id, id_item, nome_comercial, custo_gerencial, exibir_no_pdv) VALUES (?, ?, ?, ?, 0)`,
      [tenant, id, nome, custo.toFixed(4)]
    );
    await conn.execute(
      `INSERT INTO itens_dados_logisticos (id_item, tenant_id, altura_cm, largura_cm, comprimento_cm) VALUES (?, ?, ?, ?, ?)`,
      [id, tenant, medidas.altura, medidas.largura, medidas.comprimento]
    );
    await conn.commit();
    return res.status(201).json({ idEmbalagem: id, sku: skuSequencial('CON', id) });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return erro(res, e, 'Erro ao criar a embalagem.');
  } finally { conn.release(); }
};

/** POST /api/catalogo/logistica/itens { filtro, falta? } — itens do filtro com peso, medidas, fotos e embalagem. */
export const itensLogistica = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const filtro: FiltroItens = req.body?.filtro || {};
    const falta = req.body?.falta ? String(req.body.falta).toUpperCase() as FaltaLogistica : null;
    const c = await condicoesDoFiltro(pool, tenant, filtro);
    if (c.vazio) throw new ErroLogistica('Escolha uma categoria, família, marca, tag ou digite uma busca.');
    const [itens]: any = await pool.execute(
      `SELECT ic.id_item, COALESCE(cpd.sku_customizado, ic.sku) AS sku, COALESCE(cpd.nome_comercial, ic.nome_item) AS nome,
              cpd.familia_id, f.nome AS familia, COALESCE(mi.nome, mf.nome) AS marca, COALESCE(ic.peso_bruto, ic.peso_liquido) AS peso,
              lg.altura_cm, lg.largura_cm, lg.comprimento_cm, NULLIF(TRIM(f.imagem), '') IS NOT NULL AS foto_familia,
              (SELECT COUNT(*) FROM itens_anexos x WHERE x.tenant_id = ic.tenant_id AND x.id_item = ic.id_item AND x.tipo_anexo IN ('IMAGEM_PRINCIPAL', 'FOTO_GALERIA')) AS fotos
       FROM itens_core ic
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
       LEFT JOIN comercial_marcas mi ON mi.id = cpd.id_marca
       LEFT JOIN comercial_marcas mf ON mf.id = f.id_marca
       LEFT JOIN itens_dados_logisticos lg ON lg.id_item = ic.id_item
       WHERE ic.tenant_id = ? AND UPPER(COALESCE(ic.status, 'ATIVO')) <> 'INATIVO' AND UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) = 'PRODUTO'
         AND ${c.where.join(' AND ')}
       ORDER BY f.nome, nome LIMIT ${MAX_ITENS + 1}`,
      [tenant, ...c.params]
    );
    if (itens.length > MAX_ITENS) throw new ErroLogistica(`O filtro trouxe mais de ${MAX_ITENS} itens: restrinja (família, categoria ou busca).`);
    const ids = itens.map((i: any) => Number(i.id_item));
    const fams = [...new Set<number>(itens.map((i: any) => Number(i.familia_id)).filter((n: number) => n > 0))];
    const [doItem]: any = ids.length ? await pool.execute(`SELECT id_item, quantidade_ate, id_embalagem FROM comercial_embalagens_itens WHERE id_item IN (${lista(ids.length)})`, ids) : [[]];
    const [daFamilia]: any = fams.length ? await pool.execute(`SELECT id_familia, quantidade_ate, id_embalagem FROM comercial_embalagens_familias WHERE id_familia IN (${lista(fams.length)})`, fams) : [[]];
    const idsEmb = [...new Set<number>([...doItem, ...daFamilia].map((r: any) => Number(r.id_embalagem)))];
    const embalagens = new Map<number, any>((await carregarEmbalagens(pool, tenant, idsEmb)).map((e: any) => [e.idEmbalagem, e]));
    const regra = (r: any): RegraEmbalagem => ({ quantidadeAte: Number(r.quantidade_ate), idEmbalagem: Number(r.id_embalagem) });

    const saida = itens.map((i: any) => {
      const efetivas = regrasEfetivas(
        doItem.filter((r: any) => Number(r.id_item) === Number(i.id_item)).map(regra),
        daFamilia.filter((r: any) => Number(r.id_familia) === Number(i.familia_id)).map(regra),
      );
      const pesoKg = nulo(i.peso) || null;
      const medidas = medidasDe(i);
      const fotos = Number(i.fotos) || 0;
      return {
        idItem: Number(i.id_item), sku: i.sku, nome: i.nome, idFamilia: i.familia_id ? Number(i.familia_id) : null, familia: i.familia || null,
        marca: i.marca || null, pesoKg, medidas, fotos, fotoFamilia: !!Number(i.foto_familia),
        embalagens: { origem: efetivas.origem, regras: efetivas.regras.map(r => ({ ...r, embalagem: embalagens.get(r.idEmbalagem) || null })) },
        faltas: faltasLogistica({ pesoKg, medidas, temEmbalagem: efetivas.regras.length > 0, fotos: fotos || (Number(i.foto_familia) ? 1 : 0) }),
      };
    });
    return res.json(falta ? saida.filter((i: any) => i.faltas.includes(falta)) : saida);
  } catch (e) { return erro(res, e, 'Erro ao listar os itens.'); }
};

/** PUT /api/catalogo/logistica/itens { itens: [{ idItem, pesoKg, altura, largura, comprimento }] } — vazio limpa. */
export const salvarLogistica = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const pedidos = Array.isArray(req.body?.itens) ? req.body.itens : [];
    if (!pedidos.length) throw new ErroLogistica('Nenhum item para salvar.');
    if (pedidos.length > MAX_ITENS) throw new ErroLogistica(`No máximo ${MAX_ITENS} itens por vez.`);
    const validados = pedidos.map((p: any) => {
      try { return { idItem: Number(p.idItem), ...validarLogistica(p) }; }
      catch (e: any) { throw new ErroLogistica(`Item ${p.sku || p.idItem}: ${e.message}`); }
    });
    await conn.beginTransaction();
    let salvos = 0;
    for (const v of validados) {
      const [r]: any = await conn.execute(`UPDATE itens_core SET peso_bruto = ? WHERE id_item = ? AND tenant_id = ?`, [v.pesoKg, v.idItem, tenant]);
      if (!r.affectedRows) continue;
      await conn.execute(
        `INSERT INTO itens_dados_logisticos (id_item, tenant_id, altura_cm, largura_cm, comprimento_cm) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE altura_cm = VALUES(altura_cm), largura_cm = VALUES(largura_cm), comprimento_cm = VALUES(comprimento_cm)`,
        [v.idItem, tenant, v.medidas?.altura ?? null, v.medidas?.largura ?? null, v.medidas?.comprimento ?? null]
      );
      salvos++;
    }
    await conn.commit();
    return res.json({ salvos });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return erro(res, e, 'Erro ao salvar peso e medidas.');
  } finally { conn.release(); }
};

/**
 * PUT /api/catalogo/logistica/embalagens/regras { idsFamilias?, idsItens?, regras: [{ quantidadeAte, idEmbalagem }] }
 * Troca as regras de cada família/item pelas informadas (lista vazia = tira; o item volta a usar as da família).
 */
export const salvarRegrasEmbalagem = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    const regras = validarRegras(req.body?.regras);
    const familias = [...new Set<number>((req.body?.idsFamilias || []).map(Number).filter((n: number) => n > 0))];
    const itens = [...new Set<number>((req.body?.idsItens || []).map(Number).filter((n: number) => n > 0))];
    if (!familias.length && !itens.length) throw new ErroLogistica('Escolha as famílias ou os itens.');
    if (regras.length) {
      const embs = await carregarEmbalagens(pool, tenant, [...new Set(regras.map(r => r.idEmbalagem))]);
      if (embs.length !== new Set(regras.map(r => r.idEmbalagem)).size) throw new ErroLogistica('Embalagem não encontrada.');
    }
    await conn.beginTransaction();
    const [famOk]: any = familias.length ? await conn.execute(`SELECT id FROM comercial_familias WHERE tenant_id = ? AND id IN (${lista(familias.length)})`, [tenant, ...familias]) : [[]];
    for (const f of famOk) {
      await conn.execute(`DELETE FROM comercial_embalagens_familias WHERE id_familia = ?`, [f.id]);
      for (const r of regras) {
        await conn.execute(`INSERT INTO comercial_embalagens_familias (id_familia, quantidade_ate, id_embalagem, tenant_id) VALUES (?, ?, ?, ?)`, [f.id, r.quantidadeAte, r.idEmbalagem, tenant]);
      }
    }
    const [itemOk]: any = itens.length ? await conn.execute(`SELECT id_item FROM itens_core WHERE tenant_id = ? AND id_item IN (${lista(itens.length)})`, [tenant, ...itens]) : [[]];
    for (const i of itemOk) {
      await conn.execute(`DELETE FROM comercial_embalagens_itens WHERE id_item = ?`, [i.id_item]);
      for (const r of regras) {
        await conn.execute(`INSERT INTO comercial_embalagens_itens (id_item, quantidade_ate, id_embalagem, tenant_id) VALUES (?, ?, ?, ?)`, [i.id_item, r.quantidadeAte, r.idEmbalagem, tenant]);
      }
    }
    await conn.commit();
    return res.json({ familias: famOk.length, itens: itemOk.length });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return erro(res, e, 'Erro ao salvar as embalagens.');
  } finally { conn.release(); }
};
