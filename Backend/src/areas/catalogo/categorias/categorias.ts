import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { carregarArvore, carregarAtributosDaCategoria, criaCiclo, gerarSlug, slugUnico } from './herancaCategorias';

type DbConnection = Awaited<ReturnType<typeof pool.getConnection>>;

const ESCOPOS = ['dna', 'grade', 'ficha'];

const tenantDe = (req: Request) => Number(req.query.tenant_id || req.body?.tenant_id || req.headers['x-tenant-id'] || 1);

const erroDuplicado = (error: any) => error?.code === 'ER_DUP_ENTRY';

// Slug único no tenant, ignorando a própria categoria
const slugDisponivel = async (conn: DbConnection, tenantId: number, nome: string, ignorarId?: string | number) => {
  const base = gerarSlug(nome);
  const [rows] = await conn.execute(
    `SELECT slug FROM comercial_categorias WHERE tenant_id = ? AND (slug = ? OR slug LIKE ?) AND id <> ?`,
    [tenantId, base, `${base}-%`, ignorarId ?? -1]
  );
  return slugUnico(base, new Set((rows as any[]).map(r => String(r.slug))));
};

/**
 * Grava os vínculos próprios da categoria (um a um, sem apagar e recriar tudo).
 * - papel (escopo_comercial) define gera_variacao/herdar, igual às famílias;
 * - bloqueado = "não usar neste ramo" (tira um atributo herdado daqui para baixo);
 * - vínculos que saíram da lista são removidos (valores dos itens não ficam nesta tabela).
 */
const sincronizarVinculos = async (conn: DbConnection, tenantId: number, categoriaId: string | number, vinculos: any[]) => {
  const ids: number[] = [];
  for (const attr of vinculos) {
    const id = Number(attr.atributo_id ?? attr.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw Object.assign(new Error(`Atributo inválido na lista ("${attr.nome || attr.atributo_id || attr.id}"). Cadastre-o no dicionário antes de vincular.`), { status: 400 });
    }
    if (!ids.includes(id)) ids.push(id);
  }

  if (ids.length > 0) {
    const [existentes] = await conn.execute(
      `SELECT id FROM atributos_comercial WHERE tenant_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
      [tenantId, ...ids]
    );
    const validos = new Set((existentes as any[]).map(r => Number(r.id)));
    const faltando = ids.filter(id => !validos.has(id));
    if (faltando.length > 0) {
      throw Object.assign(new Error(`Atributo(s) não encontrado(s) no dicionário: ${faltando.join(', ')}.`), { status: 400 });
    }
  }

  // Remove os que saíram
  await conn.execute(
    `DELETE FROM atributos_core_entidades
     WHERE tenant_id = ? AND tipo_entidade = 'categoria' AND id_entidade = ?
       ${ids.length > 0 ? `AND atributo_id NOT IN (${ids.map(() => '?').join(',')})` : ''}`,
    [tenantId, categoriaId, ...ids]
  );

  const vistos = new Set<number>();
  for (const [indice, attr] of vinculos.entries()) {
    const id = Number(attr.atributo_id ?? attr.id);
    if (vistos.has(id)) continue;
    vistos.add(id);
    const escopo = ESCOPOS.includes(attr.escopo_comercial) ? attr.escopo_comercial : 'ficha';
    await conn.execute(
      `INSERT INTO atributos_core_entidades
         (tenant_id, tipo_entidade, id_entidade, atributo_id, unidade_id, formato_sufixo, escopo_comercial,
          obrigatorio, pesquisavel, herdar, gera_variacao, ordem, bloqueado, retransmitir, sobrescreve, exemplos, ativo)
       VALUES (?, 'categoria', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         unidade_id = VALUES(unidade_id), formato_sufixo = VALUES(formato_sufixo),
         escopo_comercial = VALUES(escopo_comercial), obrigatorio = VALUES(obrigatorio),
         pesquisavel = VALUES(pesquisavel), herdar = VALUES(herdar), gera_variacao = VALUES(gera_variacao),
         ordem = VALUES(ordem), bloqueado = VALUES(bloqueado), retransmitir = 1,
         sobrescreve = VALUES(sobrescreve), exemplos = VALUES(exemplos), ativo = 1`,
      [
        tenantId,
        categoriaId,
        id,
        attr.unidade_id ? Number(attr.unidade_id) : null,
        String(attr.formato_sufixo || '').trim() || null,
        escopo,
        attr.obrigatorio ? 1 : 0,
        attr.pesquisavel === undefined || attr.pesquisavel ? 1 : 0,
        escopo === 'dna' ? 1 : 0,
        escopo === 'grade' ? 1 : 0,
        Number.isFinite(Number(attr.ordem)) ? Number(attr.ordem) : indice,
        attr.bloqueado ? 1 : 0,
        attr.sobrescreve ? 1 : 0,
        String(attr.exemplos || '').slice(0, 255),
      ]
    );
  }
};

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error?.status) return res.status(error.status).json({ error: error.message });
  if (erroDuplicado(error)) return res.status(409).json({ error: 'Já existe uma categoria com este nome no mesmo nível.' });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao });
};

/**
 * 🔌 [READ] Categorias com os vínculos próprios (papel, sufixo, unidade, ajustes e bloqueios) e o uso real
 */
export const getCategoriasSelect = async (req: Request, res: Response) => {
  const tenantId = tenantDe(req);

  try {
    const [catRows] = await pool.execute(
      `SELECT c.id, c.tenant_id, c.categoria_pai_id, c.nome, c.slug, c.ativa, c.ordem,
              c.descricao, c.margem_sugerida, c.modo_exibicao, c.etiqueta_gondola,
              (SELECT COUNT(*) FROM comercial_familias f WHERE f.categoria_id = c.id AND f.tenant_id = c.tenant_id) AS qtd_familias,
              (SELECT COUNT(*) FROM comercial_produtos_dados p WHERE p.categoria_id = c.id AND p.tenant_id = c.tenant_id) AS qtd_produtos
       FROM comercial_categorias c
       WHERE c.tenant_id = ?
       ORDER BY c.ordem ASC, c.nome ASC`,
      [tenantId]
    );
    const categorias = catRows as any[];
    if (categorias.length === 0) return res.json([]);

    const [attrRows] = await pool.execute(
      `SELECT ae.id_entidade, a.id, a.nome, a.tipo, ae.escopo_comercial, ae.obrigatorio, ae.pesquisavel, ae.herdar,
              ae.ordem, ae.bloqueado, ae.retransmitir, ae.sobrescreve, ae.exemplos,
              ae.formato_sufixo, ae.unidade_id, u.simbolo AS unidade_simbolo
       FROM atributos_core_entidades ae
       INNER JOIN atributos_comercial a ON a.id = ae.atributo_id AND a.tenant_id = ae.tenant_id
       LEFT JOIN atributos_comercial_unidades u ON u.id = COALESCE(ae.unidade_id, a.unidade_id)
       WHERE ae.tenant_id = ? AND ae.tipo_entidade = 'categoria' AND ae.ativo = 1
       ORDER BY ae.ordem ASC, a.nome ASC`,
      [tenantId]
    );
    const atributos = attrRows as any[];

    const resultado = categorias.map(cat => ({
      ...cat,
      id: String(cat.id),
      categoria_pai_id: cat.categoria_pai_id ? String(cat.categoria_pai_id) : null,
      ativa: Boolean(cat.ativa),
      margem_sugerida: cat.margem_sugerida !== null ? Number(cat.margem_sugerida) : null,
      // Etiqueta de gôndola: null = herda (na raiz, automático pelo histórico); true = sempre; false = nunca
      etiqueta_gondola: cat.etiqueta_gondola === null || cat.etiqueta_gondola === undefined ? null : Boolean(Number(cat.etiqueta_gondola)),
      qtd_familias: Number(cat.qtd_familias || 0),
      qtd_produtos: Number(cat.qtd_produtos || 0),
      atributosHeranca: atributos
        .filter(attr => String(attr.id_entidade) === String(cat.id))
        .map(attr => ({
          id: String(attr.id),
          nome: attr.nome,
          tipoDado: attr.tipo,
          sufixo: attr.formato_sufixo || attr.unidade_simbolo || undefined,
          formatoSufixo: attr.formato_sufixo || '',
          unidadeSimbolo: attr.unidade_simbolo || '',
          unidade_id: attr.unidade_id ? String(attr.unidade_id) : null,
          escopoComercial: attr.escopo_comercial || 'ficha',
          obrigatorio: Boolean(attr.obrigatorio),
          pesquisavel: Boolean(attr.pesquisavel),
          herdar: Boolean(attr.herdar),
          ordem: Number(attr.ordem),
          bloqueado: Boolean(attr.bloqueado),
          retransmitir: Boolean(attr.retransmitir),
          sobrescreve: Boolean(attr.sobrescreve),
          exemplos: attr.exemplos || '',
        })),
    }));

    return res.json(resultado);
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar categorias' });
  }
};

/**
 * 🟢 [CREATE] Categoria + vínculos de atributos
 */
export const createCategoria = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const { nome, categoria_pai_id, margem_sugerida, modo_exibicao, descricao, atributos_vinculados, etiqueta_gondola } = req.body;
    const tenantId = tenantDe(req);
    const vNome = String(nome || '').trim() || 'Nova Categoria';
    const vPai = categoria_pai_id ? Number(categoria_pai_id) : null;

    await connection.beginTransaction();

    if (vPai !== null) {
      const [pai] = await connection.execute(
        `SELECT id FROM comercial_categorias WHERE id = ? AND tenant_id = ?`, [vPai, tenantId]
      );
      if ((pai as any[]).length === 0) throw Object.assign(new Error('Categoria pai não encontrada.'), { status: 400 });
    }

    const slug = await slugDisponivel(connection, tenantId, vNome);
    const [result] = await connection.execute(
      `INSERT INTO comercial_categorias
         (tenant_id, categoria_pai_id, nome, slug, ativa, margem_sugerida, modo_exibicao, descricao, ordem, etiqueta_gondola)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, 0, ?)`,
      [tenantId, vPai, vNome, slug, margem_sugerida ?? null, modo_exibicao || 'grade', descricao || '',
        etiqueta_gondola === null || etiqueta_gondola === undefined ? null : (etiqueta_gondola ? 1 : 0)]
    );
    const novaCategoriaId = (result as any).insertId;

    if (Array.isArray(atributos_vinculados)) {
      await sincronizarVinculos(connection, tenantId, novaCategoriaId, atributos_vinculados);
    }

    await connection.commit();
    return res.status(201).json({ success: true, id: String(novaCategoriaId), slug });
  } catch (error) {
    await connection.rollback();
    return responderErro(res, error, 'Erro ao criar categoria');
  } finally {
    connection.release();
  }
};

/**
 * 🟡 [UPDATE] Parcial: campo ausente mantém o valor. Bloqueia ciclo na árvore e renova o slug ao renomear.
 */
export const updateCategoria = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const { idCategoria } = req.params;
    const tenantId = tenantDe(req);
    const { atributos_vinculados, ...body } = req.body;

    await connection.beginTransaction();

    const [atualRows] = await connection.execute(
      `SELECT id, nome FROM comercial_categorias WHERE id = ? AND tenant_id = ?`, [idCategoria, tenantId]
    );
    const atual = (atualRows as any[])[0];
    if (!atual) throw Object.assign(new Error('Categoria não encontrada.'), { status: 404 });

    const fields: string[] = [];
    const params: any[] = [];

    if (body.nome !== undefined) {
      const nome = String(body.nome || '').trim();
      if (!nome) throw Object.assign(new Error('O nome da categoria é obrigatório.'), { status: 400 });
      fields.push('nome = ?');
      params.push(nome);
      if (nome !== atual.nome) {
        fields.push('slug = ?');
        params.push(await slugDisponivel(connection, tenantId, nome, idCategoria));
      }
    }

    if (body.categoria_pai_id !== undefined) {
      const novoPai = body.categoria_pai_id ? String(body.categoria_pai_id) : null;
      const arvore = await carregarArvore(connection as any, tenantId);
      if (novoPai !== null && !arvore.some(c => String(c.id) === novoPai)) {
        throw Object.assign(new Error('Categoria pai não encontrada.'), { status: 400 });
      }
      if (criaCiclo(arvore, idCategoria, novoPai)) {
        throw Object.assign(new Error('Não é possível mover a categoria para dentro dela mesma ou de uma subcategoria dela.'), { status: 400 });
      }
      fields.push('categoria_pai_id = ?');
      params.push(novoPai !== null ? Number(novoPai) : null);
    }

    if (body.ativa !== undefined) { fields.push('ativa = ?'); params.push(body.ativa ? 1 : 0); }
    if (body.margem_sugerida !== undefined) { fields.push('margem_sugerida = ?'); params.push(body.margem_sugerida ?? null); }
    if (body.modo_exibicao !== undefined) { fields.push('modo_exibicao = ?'); params.push(body.modo_exibicao || 'grade'); }
    if (body.descricao !== undefined) { fields.push('descricao = ?'); params.push(body.descricao ?? ''); }
    if (body.etiqueta_gondola !== undefined) {
      fields.push('etiqueta_gondola = ?');
      params.push(body.etiqueta_gondola === null ? null : (body.etiqueta_gondola ? 1 : 0));
    }

    if (fields.length > 0) {
      await connection.execute(
        `UPDATE comercial_categorias SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
        [...params, idCategoria, tenantId]
      );
    }

    if (Array.isArray(atributos_vinculados)) {
      await sincronizarVinculos(connection, tenantId, idCategoria, atributos_vinculados);
    }

    await connection.commit();
    return res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    return responderErro(res, error, 'Erro ao atualizar categoria');
  } finally {
    connection.release();
  }
};

/**
 * 🗑️ [DELETE] Só categoria sem subcategorias, famílias e produtos. Os vínculos de atributos saem junto.
 */
export const deleteCategoria = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const { idCategoria } = req.params;
    const tenantId = tenantDe(req);

    const [[uso]]: any = await connection.execute(
      `SELECT
         (SELECT COUNT(*) FROM comercial_categorias WHERE categoria_pai_id = ? AND tenant_id = ?) AS subcategorias,
         (SELECT COUNT(*) FROM comercial_familias WHERE categoria_id = ? AND tenant_id = ?) AS familias,
         (SELECT COUNT(*) FROM comercial_produtos_dados WHERE categoria_id = ? AND tenant_id = ?) AS produtos`,
      [idCategoria, tenantId, idCategoria, tenantId, idCategoria, tenantId]
    );
    const bloqueios = [
      Number(uso.subcategorias) > 0 ? `${uso.subcategorias} subcategoria(s)` : '',
      Number(uso.familias) > 0 ? `${uso.familias} família(s)` : '',
      Number(uso.produtos) > 0 ? `${uso.produtos} produto(s)` : '',
    ].filter(Boolean);
    if (bloqueios.length > 0) {
      return res.status(409).json({
        error: `A categoria ainda tem ${bloqueios.join(', ')}. Mova-os para outra categoria antes de excluir.`,
        uso: { subcategorias: Number(uso.subcategorias), familias: Number(uso.familias), produtos: Number(uso.produtos) },
      });
    }

    await connection.beginTransaction();
    await connection.execute(
      `DELETE FROM atributos_core_entidades WHERE tenant_id = ? AND tipo_entidade = 'categoria' AND id_entidade = ?`,
      [tenantId, idCategoria]
    );
    const [del] = await connection.execute(
      `DELETE FROM comercial_categorias WHERE id = ? AND tenant_id = ?`, [idCategoria, tenantId]
    );
    if ((del as any).affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Categoria não encontrada.' });
    }
    await connection.commit();
    return res.json({ success: true });
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao excluir categoria');
  } finally {
    connection.release();
  }
};

/**
 * 🔀 [PATCH] Order
 */
export const updateCategoriesOrder = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const { tenant_id, ordenacao } = req.body;

    if (!Array.isArray(ordenacao)) {
      return res.status(400).json({ error: 'Formato inválido' });
    }

    await connection.beginTransaction();

    for (const item of ordenacao) {
      await connection.execute(
        `UPDATE comercial_categorias SET ordem = ? WHERE id = ? AND tenant_id = ?`,
        [item.ordem, item.id, tenant_id || 1]
      );
    }

    await connection.commit();
    return res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao reordenar:', error);
    return res.status(500).json({ error: 'Erro interno ao reordenar' });
  } finally {
    connection.release();
  }
};

/**
 * 🧠 [ATRIBUTOS POR CATEGORIA] Atributos efetivos: herdados da cadeia (raiz -> categoria) + próprios,
 * já com ajustes e bloqueios aplicados. É o que uma família desta categoria recebe.
 */
export const getAtributosByCategoria = async (req: Request, res: Response) => {
  try {
    const { idCategoria } = req.params;
    const tenantId = tenantDe(req);
    const efetivos = await carregarAtributosDaCategoria(pool as any, tenantId, idCategoria);

    return res.json(efetivos.map(attr => ({
      id: String(attr.id),
      nome: attr.nome,
      codigo: attr.codigo || '',
      tipo: attr.tipoDado,
      tipoDado: attr.tipoDado,
      classificacao: attr.classificacao || 'ficha',
      unidadeId: attr.unidade_id ? String(attr.unidade_id) : null,
      sufixo: attr.formato_sufixo || attr.unidade_simbolo || null,
      obrigatorio: Boolean(Number(attr.obrigatorio)),
      pesquisavel: Boolean(Number(attr.pesquisavel)),
      geraVariacao: Boolean(Number(attr.geraVariacao)),
      compoeSku: Boolean(Number(attr.compoeSku)),
      separadorSufixo: attr.separadorSufixo || 'nenhum',
      exemplos: attr.exemplos || '',
      ordem: Number(attr.ordemSku || 0),
      origemCategoriaId: attr.origemCategoriaId,
      origemCategoriaNome: attr.origemCategoriaNome,
    })));
  } catch (error: any) {
    console.error('Erro ao buscar atributos:', error);
    return res.status(500).json({ error: 'Erro ao buscar atributos', detail: error.message });
  }
};

/**
 * GET /catalogo/cadastros/categorias/:idCategoria/uso
 * O que está nesta categoria: famílias (com quantos itens têm), itens ligados direto (sem família)
 * e quantos itens chegam pelas famílias. Base da lateral "Uso da categoria".
 */
export const getUsoCategoria = async (req: Request, res: Response) => {
  try {
    const tenantId = Number(req.query.tenant_id || 1);
    const idCategoria = Number(req.params.idCategoria);
    const [familias]: any = await pool.execute(
      `SELECT f.id, f.nome, f.status,
              (SELECT COUNT(*) FROM comercial_produtos_dados p WHERE p.familia_id = f.id AND p.tenant_id = f.tenant_id) AS qtd_itens
       FROM comercial_familias f
       WHERE f.tenant_id = ? AND f.categoria_id = ?
       ORDER BY f.nome`,
      [tenantId, idCategoria]
    );
    const [itens]: any = await pool.execute(
      `SELECT ic.id_item, COALESCE(NULLIF(TRIM(p.sku_customizado), ''), ic.sku) AS sku,
              COALESCE(NULLIF(TRIM(p.nome_comercial), ''), ic.nome_item) AS nome, ic.status
       FROM comercial_produtos_dados p
       INNER JOIN itens_core ic ON ic.id_item = p.id_item AND ic.tenant_id = p.tenant_id
       WHERE p.tenant_id = ? AND p.categoria_id = ? AND p.familia_id IS NULL
       ORDER BY nome
       LIMIT 200`,
      [tenantId, idCategoria]
    );
    return res.json({
      familias: familias.map((f: any) => ({ id: Number(f.id), nome: f.nome, status: f.status, qtdItens: Number(f.qtd_itens) || 0 })),
      itensDiretos: itens.map((i: any) => ({ idItem: Number(i.id_item), sku: i.sku, nome: i.nome, status: i.status })),
      itensPelasFamilias: familias.reduce((a: number, f: any) => a + (Number(f.qtd_itens) || 0), 0),
    });
  } catch (error: any) {
    console.error('Erro ao carregar o uso da categoria:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /catalogo/cadastros/categorias/:idCategoria/itens  { ids: number[], acao: 'adicionar' | 'remover' }
 * Liga (ou tira) itens direto na categoria. Item que está numa família é ignorado:
 * a categoria dele vem da família (regra do PIM) — para mudar, mude a família.
 */
export const vincularItensCategoria = async (req: Request, res: Response) => {
  const tenantId = Number(req.query.tenant_id || req.body?.tenant_id || 1);
  const idCategoria = Number(req.params.idCategoria);
  const acao = req.body?.acao === 'remover' ? 'remover' : 'adicionar';
  const ids: number[] = [...new Set<number>((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter((n: number) => n > 0))];
  if (ids.length === 0) return res.status(400).json({ error: 'Nenhum item informado.' });

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[cat]]: any = await connection.execute(`SELECT id FROM comercial_categorias WHERE id = ? AND tenant_id = ?`, [idCategoria, tenantId]);
    if (!cat) { await connection.rollback(); return res.status(404).json({ error: 'Categoria não encontrada.' }); }

    const [linhas]: any = await connection.execute(
      `SELECT ic.id_item, COALESCE(NULLIF(TRIM(p.sku_customizado), ''), ic.sku) AS sku, p.familia_id, f.nome AS familia
       FROM itens_core ic
       LEFT JOIN comercial_produtos_dados p ON p.id_item = ic.id_item AND p.tenant_id = ic.tenant_id
       LEFT JOIN comercial_familias f ON f.id = p.familia_id
       WHERE ic.tenant_id = ? AND ic.id_item IN (${ids.map(() => '?').join(',')})`,
      [tenantId, ...ids]
    );
    const ignorados = linhas.filter((l: any) => l.familia_id).map((l: any) => ({ idItem: Number(l.id_item), sku: l.sku, familia: l.familia }));
    const livres = linhas.filter((l: any) => !l.familia_id).map((l: any) => Number(l.id_item));

    for (const idItem of livres) {
      if (acao === 'adicionar') {
        await connection.execute(
          `INSERT INTO comercial_produtos_dados (tenant_id, id_item, categoria_id) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE categoria_id = VALUES(categoria_id)`,
          [tenantId, idItem, idCategoria]
        );
      } else {
        await connection.execute(
          `UPDATE comercial_produtos_dados SET categoria_id = NULL WHERE tenant_id = ? AND id_item = ? AND categoria_id = ?`,
          [tenantId, idItem, idCategoria]
        );
      }
    }
    await connection.commit();
    return res.json({ success: true, alterados: livres.length, ignorados });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao vincular itens à categoria:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};
