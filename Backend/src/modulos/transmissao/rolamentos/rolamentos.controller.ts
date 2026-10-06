// Módulo Rolamentos (TRANSMISSAO_ROLAMENTOS): configuração (famílias/atributos), linha das marcas (1ª/2ª),
// medidas aprendidas e a análise das linhas da nota de entrada. O cadastro em si usa a entrada de NF do núcleo.
import { Request, Response } from 'express';
import pool from '../../../routes/Estoque/db.config';
import { DICIONARIO, lerDescricao, MarcaModulo, medidasDoCodigo, montarNome, montarSku, nomeFamiliaDoCodigo, TipoRolamento, TIPOS } from './rolamentos';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const erro = (res: Response, error: any, padrao: string, status = 500) => {
  if (status === 500) console.error(padrao, error);
  return res.status(status).json({ error: status === 500 ? padrao : String(error), details: error?.message });
};

export interface ConfigRolamentos {
  idCategoria?: number | null;
  subcategorias?: Partial<Record<TipoRolamento, number>>;  // Rolamentos › Rígidos de esferas, Inserção (UC)... (famílias por código ficam nelas)
  familias?: Partial<Record<TipoRolamento, number>>;
  atributos?: Partial<Record<'codigo' | 'vedacao' | 'folga' | 'linha' | 'diametroInterno' | 'diametroExterno' | 'largura', number>>;
  idMarcaSegundaLinha?: number | null;
  markup?: number;
  sufixos?: Record<string, string>;   // significado dos códigos de fabricante definidos pelo operador (ex.: CO7)
}

const carregarConfig = async (tenant: number): Promise<ConfigRolamentos> => {
  const [[c]]: any = await pool.execute(`SELECT configuracao FROM modulo_transmissao_rolamentos_config WHERE tenant_id = ?`, [tenant]);
  if (!c) return {};
  return typeof c.configuracao === 'string' ? JSON.parse(c.configuracao) : c.configuracao || {};
};

const carregarMarcas = async (tenant: number) => {
  const [rows]: any = await pool.execute(
    `SELECT m.id, m.nome, m.codigo, mm.linha, mm.apelidos
     FROM comercial_marcas m
     LEFT JOIN modulo_transmissao_rolamentos_marcas mm ON mm.id_marca = m.id AND mm.tenant_id = m.tenant_id
     WHERE m.tenant_id = ?
     ORDER BY m.nome`,
    [tenant]
  );
  return rows.map((r: any): MarcaModulo => ({
    id: Number(r.id), nome: r.nome, codigo: r.codigo || null, linha: r.linha ? (Number(r.linha) === 2 ? 2 : 1) : null,
    apelidos: String(r.apelidos || '').split(',').map((a: string) => a.trim()).filter(Boolean),
  }));
};

interface MedidaAprendida { idMedida: number; codigo: string; tipo: string | null; d: number | null; D: number | null; B: number | null }

const medidasAprendidas = async (tenant: number): Promise<MedidaAprendida[]> => {
  const [rows]: any = await pool.execute(
    `SELECT id_medida, codigo, tipo, diametro_interno, diametro_externo, largura FROM modulo_transmissao_rolamentos_medidas WHERE tenant_id = ? ORDER BY codigo`,
    [tenant]
  );
  return rows.map((r: any): MedidaAprendida => ({
    idMedida: Number(r.id_medida), codigo: r.codigo, tipo: r.tipo,
    d: r.diametro_interno === null ? null : Number(r.diametro_interno), D: r.diametro_externo === null ? null : Number(r.diametro_externo),
    B: r.largura === null ? null : Number(r.largura),
  }));
};

/** Itens do catálogo com esses SKUs customizados (para vincular em vez de cadastrar de novo). */
const itensPorSku = async (tenant: number, skus: string[]) => {
  const unicos = [...new Set(skus.map(s => s.toUpperCase()).filter(Boolean))];
  const mapa: Record<string, { idItem: number; sku: string; nome: string; tipoRecurso: string; unidadeBase: string | null }> = {};
  if (!unicos.length) return mapa;
  const [rows]: any = await pool.query(
    `SELECT ic.id_item, cpd.sku_customizado, COALESCE(NULLIF(cpd.nome_comercial, ''), ic.nome_item) AS nome, ic.tipo_recurso, um.sigla
     FROM comercial_produtos_dados cpd
     INNER JOIN itens_core ic ON ic.id_item = cpd.id_item AND ic.tenant_id = cpd.tenant_id
     LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
     WHERE cpd.tenant_id = ? AND UPPER(cpd.sku_customizado) IN (?)`,
    [tenant, unicos]
  );
  for (const r of rows) {
    mapa[String(r.sku_customizado).toUpperCase()] = {
      idItem: Number(r.id_item), sku: r.sku_customizado, nome: r.nome, tipoRecurso: r.tipo_recurso, unidadeBase: r.sigla || null,
    };
  }
  return mapa;
};

// GET /api/modulos/transmissao/rolamentos/config
export const obterConfig = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const configuracao = await carregarConfig(tenant);
    const idsFamilias = Object.values(configuracao.familias || {}).filter(Boolean) as number[];
    const familias: Record<number, { id: number; nome: string; status: string }> = {};
    if (idsFamilias.length) {
      const [rows]: any = await pool.query(`SELECT id, nome, status FROM comercial_familias WHERE tenant_id = ? AND id IN (?)`, [tenant, idsFamilias]);
      for (const f of rows) familias[Number(f.id)] = { id: Number(f.id), nome: f.nome, status: f.status };
    }
    const idsSub = Object.values(configuracao.subcategorias || {}).filter(Boolean) as number[];
    const subcategorias: Record<number, { id: number; nome: string; familias: number }> = {};
    if (idsSub.length) {
      const [rows]: any = await pool.query(
        `SELECT c.id, c.nome, (SELECT COUNT(*) FROM comercial_familias f WHERE f.categoria_id = c.id AND f.tenant_id = c.tenant_id) AS familias
         FROM comercial_categorias c WHERE c.tenant_id = ? AND c.id IN (?)`,
        [tenant, idsSub]
      );
      for (const c of rows) subcategorias[Number(c.id)] = { id: Number(c.id), nome: c.nome, familias: Number(c.familias) };
    }
    return res.json({
      configuracao, familias, subcategorias, marcas: await carregarMarcas(tenant), medidas: await medidasAprendidas(tenant),
      tipos: Object.entries(TIPOS).map(([codigo, t]) => ({ codigo, ...t })),
    });
  } catch (e) {
    return erro(res, e, 'Erro ao carregar a configuração de rolamentos.');
  }
};

// PUT /api/modulos/transmissao/rolamentos/config { configuracao }
export const salvarConfig = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const atual = await carregarConfig(tenant);
    const nova: ConfigRolamentos = { ...atual, ...(req.body?.configuracao || {}) };
    // Dicionário do operador: códigos em maiúsculas, sem significado vazio
    if (nova.sufixos) {
      nova.sufixos = Object.fromEntries(Object.entries(nova.sufixos)
        .map(([k, v]) => [String(k).trim().toUpperCase().slice(0, 20), String(v || '').trim().slice(0, 200)])
        .filter(([k, v]) => k && v));
    }
    if (nova.markup !== undefined && !(Number(nova.markup) > 0)) return erro(res, 'Markup deve ser maior que zero.', '', 400);
    await pool.execute(
      `INSERT INTO modulo_transmissao_rolamentos_config (tenant_id, configuracao) VALUES (?, ?) ON DUPLICATE KEY UPDATE configuracao = VALUES(configuracao)`,
      [tenant, JSON.stringify(nova)]
    );
    return res.json({ success: true, configuracao: nova });
  } catch (e) {
    return erro(res, e, 'Erro ao salvar a configuração de rolamentos.');
  }
};

// PUT /api/modulos/transmissao/rolamentos/marcas/:idMarca { linha: 1 | 2 | null, apelidos }
export const salvarMarca = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idMarca = Number(req.params.idMarca);
  const linha = req.body?.linha === null || req.body?.linha === undefined ? null : Number(req.body.linha);
  const apelidos = String(req.body?.apelidos ?? '').split(',').map(a => a.trim()).filter(Boolean).join(', ').slice(0, 255) || null;
  try {
    if (linha !== null && linha !== 1 && linha !== 2) return erro(res, 'Linha deve ser 1 ou 2.', '', 400);
    const [[m]]: any = await pool.execute(`SELECT id FROM comercial_marcas WHERE id = ? AND tenant_id = ?`, [idMarca, tenant]);
    if (!m) return erro(res, 'Marca não encontrada.', '', 404);
    if (linha === null && !apelidos) {
      await pool.execute(`DELETE FROM modulo_transmissao_rolamentos_marcas WHERE tenant_id = ? AND id_marca = ?`, [tenant, idMarca]);
    } else {
      await pool.execute(
        `INSERT INTO modulo_transmissao_rolamentos_marcas (tenant_id, id_marca, linha, apelidos) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE linha = VALUES(linha), apelidos = VALUES(apelidos)`,
        [tenant, idMarca, linha ?? 1, apelidos]
      );
    }
    return res.json({ success: true });
  } catch (e) {
    return erro(res, e, 'Erro ao salvar a marca.');
  }
};

// POST /api/modulos/transmissao/rolamentos/analisar { linhas: [{ chave, descricao }] }
export const analisarLinhas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const linhas: Array<{ chave: string; descricao: string }> = Array.isArray(req.body?.linhas) ? req.body.linhas : [];
  try {
    const [config, marcas, aprendidas] = await Promise.all([carregarConfig(tenant), carregarMarcas(tenant), medidasAprendidas(tenant)]);
    const porCodigo = new Map<string, MedidaAprendida>(aprendidas.map(m => [String(m.codigo).toUpperCase(), m]));
    const resultado = linhas.map(l => {
      const leitura = lerDescricao(String(l.descricao || ''), marcas, config.sufixos || {});
      const aprendida = leitura.codigo ? porCodigo.get(leitura.codigo.toUpperCase()) : undefined;
      const tabela = leitura.codigo ? medidasDoCodigo(leitura.tipo, leitura.codigo) : null;
      const medidas = aprendida && aprendida.d !== null ? { d: aprendida.d, D: aprendida.D ?? 0, B: aprendida.B ?? 0 } : tabela;
      const linha = leitura.marca?.linha ?? null;
      const sku = leitura.codigo && linha ? montarSku({ codigo: leitura.codigo, vedacao: leitura.vedacao, folga: leitura.folga, linha, marca: leitura.marca }) : null;
      return {
        chave: l.chave, ...leitura, linha, medidas,
        origemMedidas: aprendida && aprendida.d !== null ? 'APRENDIDA' : tabela ? 'TABELA' : null,
        sku,
        nome: leitura.codigo && leitura.tipo && linha ? montarNome({ codigo: leitura.codigo, vedacao: leitura.vedacao, folga: leitura.folga, linha, marca: leitura.marca, medidas }) : null,
      };
    });
    return res.json({ linhas: resultado, existentes: await itensPorSku(tenant, resultado.map(r => r.sku || '')), configuracao: config });
  } catch (e) {
    return erro(res, e, 'Erro ao analisar as linhas.');
  }
};

// GET /api/modulos/transmissao/rolamentos/dicionario — códigos de fabricante com significado já conhecido
export const dicionario = (_req: Request, res: Response) =>
  res.json(Object.entries(DICIONARIO).map(([codigo, d]) => ({ codigo, categoria: d.categoria, significado: d.significado })));

// POST /api/modulos/transmissao/rolamentos/skus { skus } — itens já cadastrados com esses SKUs
export const verificarSkus = async (req: Request, res: Response) => {
  try {
    return res.json({ existentes: await itensPorSku(tenantDe(req), Array.isArray(req.body?.skus) ? req.body.skus.map(String) : []) });
  } catch (e) {
    return erro(res, e, 'Erro ao verificar os SKUs.');
  }
};

const numeroOuNulo = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// POST /api/modulos/transmissao/rolamentos/medidas { lista: [{ codigo, tipo, d, D, B }] } — aprende/corrige medidas
export const salvarMedidas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const lista: any[] = Array.isArray(req.body?.lista) ? req.body.lista : [];
  try {
    let gravadas = 0;
    for (const m of lista) {
      const codigo = String(m?.codigo || '').trim().toUpperCase().slice(0, 30);
      const d = numeroOuNulo(m?.d); const D = numeroOuNulo(m?.D); const B = numeroOuNulo(m?.B);
      if (!codigo || d === null || D === null || B === null) continue;
      await pool.execute(
        `INSERT INTO modulo_transmissao_rolamentos_medidas (tenant_id, codigo, tipo, diametro_interno, diametro_externo, largura) VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE tipo = VALUES(tipo), diametro_interno = VALUES(diametro_interno), diametro_externo = VALUES(diametro_externo), largura = VALUES(largura)`,
        [tenant, codigo, m?.tipo ? String(m.tipo).slice(0, 30) : null, d, D, B]
      );
      gravadas++;
    }
    return res.json({ success: true, gravadas });
  } catch (e) {
    return erro(res, e, 'Erro ao salvar as medidas.');
  }
};

// DELETE /api/modulos/transmissao/rolamentos/medidas/:id
export const excluirMedida = async (req: Request, res: Response) => {
  try {
    await pool.execute(`DELETE FROM modulo_transmissao_rolamentos_medidas WHERE id_medida = ? AND tenant_id = ?`, [Number(req.params.id), tenantDe(req)]);
    return res.json({ success: true });
  } catch (e) {
    return erro(res, e, 'Erro ao excluir a medida.');
  }
};

// ---------------------------------------------------------------------------------------------
// Famílias por código (Rolamento 6205) dentro da subcategoria do tipo, e os itens do módulo
// ---------------------------------------------------------------------------------------------
const tipoDaSubcategoria = (config: ConfigRolamentos) =>
  new Map(Object.entries(config.subcategorias || {}).filter(([, id]) => id).map(([tipo, id]) => [Number(id), tipo as TipoRolamento]));
const tipoDaFamiliaAntiga = (config: ConfigRolamentos) =>
  new Map(Object.entries(config.familias || {}).filter(([, id]) => id).map(([tipo, id]) => [Number(id), tipo as TipoRolamento]));

// POST /api/modulos/transmissao/rolamentos/familias { pares: [{ tipo, codigo }] } — família de cada código (null = ainda não existe)
export const familiasDosCodigos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const pares: Array<{ tipo: TipoRolamento; codigo: string }> = Array.isArray(req.body?.pares) ? req.body.pares : [];
  try {
    const config = await carregarConfig(tenant);
    const subcats = Object.values(config.subcategorias || {}).filter(Boolean) as number[];
    const resultado: Record<string, { id: number; nome: string } | null> = {};
    if (subcats.length) {
      const [rows]: any = await pool.query(`SELECT id, nome, categoria_id FROM comercial_familias WHERE tenant_id = ? AND categoria_id IN (?)`, [tenant, subcats]);
      const porChave = new Map(rows.map((f: any) => [`${f.categoria_id}|${String(f.nome).trim().toUpperCase()}`, { id: Number(f.id), nome: f.nome }]));
      for (const p of pares) {
        const sub = config.subcategorias?.[p.tipo];
        resultado[`${p.tipo}|${String(p.codigo).toUpperCase()}`] = sub ? (porChave.get(`${sub}|${nomeFamiliaDoCodigo(p.codigo).toUpperCase()}`) as any) ?? null : null;
      }
    }
    return res.json({ familias: resultado });
  } catch (e) {
    return erro(res, e, 'Erro ao buscar as famílias dos códigos.');
  }
};

/** Itens das famílias de rolamento (por código e as amplas antigas) com código, vedação, folga e medidas (do item ou do DNA da família). */
const itensDoModulo = async (tenant: number, config: ConfigRolamentos) => {
  const a = config.atributos || {};
  const subcats = Object.values(config.subcategorias || {}).filter(Boolean) as number[];
  const antigas = Object.values(config.familias || {}).filter(Boolean) as number[];
  if (!a.codigo || (!subcats.length && !antigas.length)) return [];
  const [itens]: any = await pool.query(
    `SELECT cpd.id_item, cpd.sku_customizado, cpd.nome_comercial, cpd.id_marca, cpd.familia_id, m.nome AS marca, f.categoria_id
     FROM comercial_produtos_dados cpd
     INNER JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = cpd.tenant_id
     LEFT JOIN comercial_marcas m ON m.id = cpd.id_marca
     WHERE cpd.tenant_id = ? AND (f.categoria_id IN (?) OR f.id IN (?))`,
    [tenant, subcats.length ? subcats : [0], antigas.length ? antigas : [0]]
  );
  if (!itens.length) return [];
  const idsAtributos = [a.codigo, a.vedacao, a.folga, a.diametroInterno, a.diametroExterno, a.largura].filter(Boolean);
  const [valores]: any = await pool.query(
    `SELECT id_entidade, atributo_id, valor_texto, valor_decimal, valor_numero FROM atributos_comercial_valores
     WHERE tenant_id = ? AND tipo_entidade = 'produto' AND id_entidade IN (?) AND atributo_id IN (?)`,
    [tenant, itens.map((i: any) => i.id_item), idsAtributos]
  );
  const [dna]: any = await pool.query(
    `SELECT id_entidade, atributo_id, valor_padrao_grupo FROM atributos_core_entidades
     WHERE tenant_id = ? AND tipo_entidade = 'familia' AND id_entidade IN (?) AND atributo_id IN (?) AND valor_padrao_grupo IS NOT NULL`,
    [tenant, [...new Set(itens.map((i: any) => i.familia_id))], idsAtributos]
  );
  const doItem = new Map<string, unknown>();
  for (const v of valores) doItem.set(`${v.id_entidade}|${v.atributo_id}`, v.valor_texto ?? v.valor_decimal ?? v.valor_numero);
  const daFamilia = new Map<string, unknown>();
  for (const v of dna) daFamilia.set(`${v.id_entidade}|${v.atributo_id}`, v.valor_padrao_grupo);
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
  const subTipo = tipoDaSubcategoria(config);
  const antigaTipo = tipoDaFamiliaAntiga(config);

  return itens.map((i: any) => {
    const valor = (id?: number) => (id ? daFamilia.get(`${i.familia_id}|${id}`) ?? doItem.get(`${i.id_item}|${id}`) ?? null : null);
    const folga = String(valor(a.folga) || '').toUpperCase();
    return {
      idItem: Number(i.id_item), sku: i.sku_customizado as string, nome: i.nome_comercial as string | null, idFamilia: Number(i.familia_id),
      tipo: (subTipo.get(Number(i.categoria_id)) ?? antigaTipo.get(Number(i.familia_id)) ?? null) as TipoRolamento | null,
      familiaAntiga: antigaTipo.has(Number(i.familia_id)),
      codigo: String(valor(a.codigo) || '').trim().toUpperCase(),
      vedacao: String(valor(a.vedacao) || 'ABERTO').toUpperCase(),
      folga: folga && folga !== 'NORMAL' ? folga : null,
      medidas: { d: num(valor(a.diametroInterno)), D: num(valor(a.diametroExterno)), B: num(valor(a.largura)) },
      linha: (config.idMarcaSegundaLinha && Number(i.id_marca) === config.idMarcaSegundaLinha ? 2 : 1) as 1 | 2,
      marca: i.marca && String(i.marca).toLowerCase() !== 'sem marca' ? { nome: i.marca as string } : null,
    };
  });
};

// POST /api/modulos/transmissao/rolamentos/renomear { aplicar } — nome pelo padrão atual (ROLAMENTO 6205-2RS/C3 | 25 mm × 52 mm × 15 mm | SKF)
export const renomearItens = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const aplicar = Boolean(req.body?.aplicar);
  try {
    const config = await carregarConfig(tenant);
    if (!config.atributos?.codigo) return erro(res, 'Monte a estrutura de rolamentos primeiro.', '', 400);
    const itens = await itensDoModulo(tenant, config);
    const mudancas = itens.filter((i: any) => i.codigo).map((i: any) => ({
      idItem: i.idItem, sku: i.sku, nomeAtual: i.nome,
      nomeNovo: montarNome({ codigo: i.codigo, vedacao: i.vedacao, folga: i.folga, linha: i.linha, marca: i.marca, medidas: i.medidas }),
    })).filter((m: any) => m.nomeNovo !== m.nomeAtual);
    if (aplicar) {
      for (const m of mudancas) await pool.execute(`UPDATE comercial_produtos_dados SET nome_comercial = ? WHERE id_item = ? AND tenant_id = ?`, [m.nomeNovo, m.idItem, tenant]);
    }
    return res.json({ total: itens.length, mudancas, aplicadas: aplicar ? mudancas.length : 0 });
  } catch (e) {
    return erro(res, e, 'Erro ao renomear os itens.');
  }
};

// GET /api/modulos/transmissao/rolamentos/reorganizar — itens ainda nas famílias amplas, com o código de cada um
export const itensParaReorganizar = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const config = await carregarConfig(tenant);
    const itens = (await itensDoModulo(tenant, config)).filter((i: any) => i.familiaAntiga);
    return res.json({ itens: itens.map((i: any) => ({ idItem: i.idItem, sku: i.sku, nome: i.nome, tipo: i.tipo, codigo: i.codigo, medidas: i.medidas })) });
  } catch (e) {
    return erro(res, e, 'Erro ao listar os itens para reorganizar.');
  }
};

// POST /api/modulos/transmissao/rolamentos/reorganizar/mover { movimentos: [{ idItem, idFamilia }] } — leva cada item para a família do código
export const moverItens = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const movimentos: Array<{ idItem: number; idFamilia: number }> = Array.isArray(req.body?.movimentos) ? req.body.movimentos : [];
  const conn: any = await pool.getConnection();
  try {
    const config = await carregarConfig(tenant);
    const subcats = Object.values(config.subcategorias || {}).filter(Boolean) as number[];
    if (!subcats.length) return erro(res, 'Monte a estrutura (subcategorias) primeiro.', '', 400);
    const [validas]: any = await conn.query(`SELECT id FROM comercial_familias WHERE tenant_id = ? AND categoria_id IN (?)`, [tenant, subcats]);
    const permitidas = new Set(validas.map((f: any) => Number(f.id)));
    await conn.beginTransaction();
    let movidos = 0;
    for (const m of movimentos) {
      if (!permitidas.has(Number(m.idFamilia))) continue;
      const [r]: any = await conn.execute(
        `UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = NULL WHERE id_item = ? AND tenant_id = ?`,
        [Number(m.idFamilia), Number(m.idItem), tenant]
      );
      movidos += r.affectedRows;
    }
    await conn.commit();
    return res.json({ success: true, movidos });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return erro(res, e, 'Erro ao mover os itens.');
  } finally {
    conn.release();
  }
};
