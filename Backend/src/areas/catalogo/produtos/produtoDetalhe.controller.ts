import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { avaliarPublicacaoItens } from './publicacaoProdutos';
import { carregarOpcoes, gravarValorAtributo } from '../atributos/valoresAtributo';
import { carregarAtributosDaCategoria } from '../categorias/herancaCategorias';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const tenantDe = (req: Request): number =>
  Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

/**
 * GET /catalogo/produtos/:id_item/detalhe
 * Ficha completa do item: identidade (core), comercial, logística, fiscal, estoque, GTINs e fornecedores
 */
export const getProdutoDetalhe = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idItem = Number(req.params.id_item);

  try {
    const [[item]]: any = await pool.execute(
      `SELECT ic.id_item, ic.sku AS sku_core, ic.nome_item AS nome_core, ic.tipo_recurso, ic.status,
              ic.descricao_variacao, ic.peso_liquido, ic.peso_bruto, ic.id_unidade,
              um.sigla AS unidade_sigla, um.descricao AS unidade_descricao,
              cpd.sku_customizado, cpd.nome_comercial, cpd.descricao_comercial, cpd.categoria_id, cpd.familia_id,
              cpd.id_marca, cpd.custo_gerencial, cpd.preco_venda, cpd.margem_lucro, cpd.exibir_no_pdv, cpd.pode_vender_sem_estoque,
              cat.nome AS categoria_nome, fam.nome AS familia_nome, mar.nome AS marca_nome,
              log.altura_cm, log.largura_cm, log.comprimento_cm, log.volume_m3,
              fis.ncm, fis.cest, fis.origem_mercadoria, fis.cfop_padrao,
              es.quantidade_atual, es.custo_medio, es.ultimo_custo
       FROM itens_core ic
       LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       LEFT JOIN comercial_categorias cat ON cat.id = cpd.categoria_id AND cat.tenant_id = cpd.tenant_id
       LEFT JOIN comercial_familias fam ON fam.id = cpd.familia_id AND fam.tenant_id = cpd.tenant_id
       LEFT JOIN comercial_marcas mar ON mar.id = cpd.id_marca AND mar.tenant_id = cpd.tenant_id
       LEFT JOIN itens_dados_logisticos log ON log.id_item = ic.id_item
       LEFT JOIN itens_dados_fiscais fis ON fis.id_item = ic.id_item
       LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'
       WHERE ic.id_item = ? AND ic.tenant_id = ?`,
      [idItem, tenant]
    );
    if (!item) return res.status(404).json({ success: false, error: 'Item não encontrado.' });

    const [movimentos]: any = await pool.execute(
      `SELECT id_movimento, tipo_movimento, origem, id_origem, documento_origem, quantidade, quantidade_documento,
              unidade_documento, fator_conversao, custo_unitario, saldo_anterior, saldo_posterior, observacao, created_at
       FROM estoque_movimentos WHERE tenant_id = ? AND id_item = ?
       ORDER BY created_at DESC, id_movimento DESC LIMIT 20`,
      [tenant, idItem]
    );

    const [gtins]: any = await pool.execute(
      `SELECT um.sigla, cuv.gtin, cuv.nome_exibicao
       FROM comercial_unidades_venda cuv
       INNER JOIN itens_unidades_medida um ON um.id_unidade = cuv.id_unidade
       WHERE cuv.tenant_id = ? AND cuv.id_item = ? AND cuv.gtin IS NOT NULL`,
      [tenant, idItem]
    );

    const [fornecedores]: any = await pool.execute(
      `SELECT cfp.id_fornecedor, cfp.codigo_produto_fornecedor, cfp.unidade_compra, cfp.fator_compra,
              cfp.preco_ultima_compra, cfp.padrao,
              COALESCE(NULLIF(pj.nome_fantasia, ''), pj.razao_social) AS nome, pj.cnpj
       FROM comercial_fornecedores_produtos cfp
       LEFT JOIN pessoas_pj pj ON pj.id_cliente = cfp.id_fornecedor
       WHERE cfp.tenant_id = ? AND cfp.id_item = ?
       ORDER BY cfp.padrao DESC, nome`,
      [tenant, idItem]
    );

    const [anexos]: any = await pool.execute(
      `SELECT id_anexo, tipo_anexo, nome_arquivo, url_anexo, ordem, created_at
       FROM itens_anexos WHERE tenant_id = ? AND id_item = ?
       ORDER BY (tipo_anexo = 'IMAGEM_PRINCIPAL') DESC, ordem, id_anexo`,
      [tenant, idItem]
    );

    const publicacao = (await avaliarPublicacaoItens(pool as any, tenant, [idItem])).get(idItem) || { publicavel: true, motivos: [] };

    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    return res.json({
      publicacao,
      anexos: anexos.map((a: any) => ({ ...a, id_anexo: Number(a.id_anexo) })),
      success: true,
      item: {
        ...item,
        id_item: Number(item.id_item),
        peso_liquido: num(item.peso_liquido),
        peso_bruto: num(item.peso_bruto),
        altura_cm: num(item.altura_cm),
        largura_cm: num(item.largura_cm),
        comprimento_cm: num(item.comprimento_cm),
        volume_m3: num(item.volume_m3),
        custo_gerencial: num(item.custo_gerencial),
        preco_venda: num(item.preco_venda),
        margem_lucro: num(item.margem_lucro),
        quantidade_atual: Number(item.quantidade_atual) || 0,
        custo_medio: num(item.custo_medio),
        ultimo_custo: num(item.ultimo_custo),
        exibir_no_pdv: item.exibir_no_pdv === null ? true : Boolean(item.exibir_no_pdv),
        pode_vender_sem_estoque: Boolean(item.pode_vender_sem_estoque),
      },
      movimentos: movimentos.map((m: any) => ({
        ...m,
        quantidade: Number(m.quantidade),
        quantidade_documento: num(m.quantidade_documento),
        fator_conversao: Number(m.fator_conversao),
        custo_unitario: Number(m.custo_unitario),
        saldo_anterior: Number(m.saldo_anterior),
        saldo_posterior: Number(m.saldo_posterior),
      })),
      gtins,
      fornecedores: fornecedores.map((f: any) => ({
        ...f,
        fator_compra: Number(f.fator_compra),
        preco_ultima_compra: num(f.preco_ultima_compra),
        padrao: Boolean(f.padrao),
      })),
    });
  } catch (error: any) {
    console.error('Erro ao carregar detalhe do produto:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------------------------------------------------------------------
// Atualização parcial: só os campos PRESENTES no body são alterados.
// Campo ausente = mantém; campo com null = limpa (ex: familia_id: null desagrupa).
// ---------------------------------------------------------------------------

const CAMPOS_CORE: Record<string, string> = {
  nome_item: 'nome_item',
  sku_core: 'sku',
  status: 'status',
  descricao_variacao: 'descricao_variacao',
  peso_liquido: 'peso_liquido',
  peso_bruto: 'peso_bruto',
};

const CAMPOS_COMERCIAL = [
  'sku_customizado', 'nome_comercial', 'descricao_comercial', 'categoria_id', 'familia_id', 'id_marca',
  'custo_gerencial', 'preco_venda', 'margem_lucro', 'exibir_no_pdv', 'pode_vender_sem_estoque',
];

const CAMPOS_LOGISTICA = ['altura_cm', 'largura_cm', 'comprimento_cm'];
const CAMPOS_FISCAL = ['ncm', 'cest', 'origem_mercadoria', 'cfop_padrao'];

const CAMPOS_TEXTO = new Set(['nome_item', 'sku_core', 'status', 'descricao_variacao', 'sku_customizado', 'nome_comercial',
  'descricao_comercial', 'ncm', 'cest', 'cfop_padrao']);
const CAMPOS_BOOLEANOS = new Set(['exibir_no_pdv', 'pode_vender_sem_estoque']);

const normalizar = (campo: string, valor: unknown): unknown => {
  if (valor === null || valor === undefined) return null;
  if (CAMPOS_BOOLEANOS.has(campo)) return valor ? 1 : 0;
  if (CAMPOS_TEXTO.has(campo)) {
    const texto = String(valor).trim();
    return texto === '' ? null : texto;
  }
  if (valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

const presentes = (payload: Record<string, unknown>, campos: string[]) =>
  campos.filter(c => Object.prototype.hasOwnProperty.call(payload, c));

// Garante a linha da tabela satélite (PK id_item) e atualiza só os campos enviados
const atualizarSatelite = async (conn: Conn, tabela: string, idItem: number, tenant: number, payload: Record<string, unknown>, campos: string[]) => {
  const enviados = presentes(payload, campos);
  if (enviados.length === 0) return;
  await conn.execute(`INSERT IGNORE INTO ${tabela} (id_item, tenant_id) VALUES (?, ?)`, [idItem, tenant]);
  await conn.execute(
    `UPDATE ${tabela} SET ${enviados.map(c => `${c} = ?`).join(', ')} WHERE id_item = ? AND tenant_id = ?`,
    [...enviados.map(c => normalizar(c, payload[c])), idItem, tenant]
  );
};

/**
 * PUT /catalogo/produtos/:id_item — atualização parcial do item
 */
export const updateProdutoParcial = async (req: Request, res: Response) => {
  const idItem = Number(req.params.id_item ?? req.params.idItem);
  const tenant = tenantDe(req);
  const payload: Record<string, unknown> = { ...(req.body || {}) };
  delete payload.tenant_id;

  if (!Number.isFinite(idItem) || idItem <= 0) {
    return res.status(400).json({ error: 'ID do item não informado para atualização.' });
  }
  // Compatibilidade: 'variacao' era aceito como alias de descricao_variacao
  if (payload.variacao !== undefined && payload.descricao_variacao === undefined) {
    payload.descricao_variacao = payload.variacao;
  }
  if (payload.status !== undefined && payload.status !== null) {
    payload.status = String(payload.status).toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO';
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'nome_item') && !normalizar('nome_item', payload.nome_item)) {
    return res.status(400).json({ error: 'O nome interno do item não pode ficar vazio.' });
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'sku_core') && !normalizar('sku_core', payload.sku_core)) {
    return res.status(400).json({ error: 'O SKU principal não pode ficar vazio.' });
  }

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existe] = await connection.execute(
      `SELECT id_item FROM itens_core WHERE id_item = ? AND tenant_id = ? FOR UPDATE`,
      [idItem, tenant]
    );
    if (!existe[0]) {
      await connection.rollback();
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    // SKU customizado é único por tenant (também garantido pelo índice uk_comercial_prod_tenant_sku_custom)
    const skuCustomizado = normalizar('sku_customizado', payload.sku_customizado);
    if (skuCustomizado) {
      const [emUso] = await connection.execute(
        `SELECT id_item FROM comercial_produtos_dados WHERE tenant_id = ? AND sku_customizado = ? AND id_item <> ? LIMIT 1`,
        [tenant, skuCustomizado, idItem]
      );
      if (emUso.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: `O SKU ${skuCustomizado} já está em uso pelo item #${emUso[0].id_item}.` });
      }
    }

    const core = presentes(payload, Object.keys(CAMPOS_CORE));
    if (core.length > 0) {
      await connection.execute(
        `UPDATE itens_core SET ${core.map(c => `${CAMPOS_CORE[c]} = ?`).join(', ')} WHERE id_item = ? AND tenant_id = ?`,
        [...core.map(c => normalizar(c, payload[c])), idItem, tenant]
      );
    }

    await atualizarSatelite(connection, 'comercial_produtos_dados', idItem, tenant, payload, CAMPOS_COMERCIAL);
    await atualizarSatelite(connection, 'itens_dados_logisticos', idItem, tenant, payload, CAMPOS_LOGISTICA);
    await atualizarSatelite(connection, 'itens_dados_fiscais', idItem, tenant, payload, CAMPOS_FISCAL);

    // Fornecedor padrão: marca um dos fornecedores já vinculados ao item (null = nenhum)
    if (Object.prototype.hasOwnProperty.call(payload, 'fornecedor_padrao_id')) {
      const idFornecedor = payload.fornecedor_padrao_id === null ? null : Number(payload.fornecedor_padrao_id);
      await connection.execute(
        `UPDATE comercial_fornecedores_produtos SET padrao = (id_fornecedor <=> ?) WHERE tenant_id = ? AND id_item = ?`,
        [idFornecedor, tenant, idItem]
      );
    }

    await connection.commit();
    return res.json({ success: true, message: 'Produto atualizado com sucesso.', id_item: idItem });
  } catch (error: any) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe outro item com este SKU.' });
    }
    console.error('Erro ao atualizar produto:', error);
    return res.status(500).json({ error: 'Erro ao atualizar produto.', details: error.message });
  } finally {
    connection.release();
  }
};

// ---------------------------------------------------------------------------
// Anexos do item (itens_anexos): por enquanto só o LINK (URL) do arquivo hospedado.
// Quando houver um serviço de upload, ele gera a URL e grava aqui do mesmo jeito.
// ---------------------------------------------------------------------------

export const TIPOS_ANEXO = ['IMAGEM_PRINCIPAL', 'FOTO_GALERIA', 'MANUAL_TECNICO', 'CERTIFICADO', 'FISPQ'];
const TIPOS_IMAGEM = ['IMAGEM_PRINCIPAL', 'FOTO_GALERIA'];

// Garante uma única imagem principal: sem principal, promove a primeira foto da galeria
const normalizarImagemPrincipal = async (conn: Conn, tenant: number, idItem: number) => {
  const [principais] = await conn.execute(
    `SELECT id_anexo FROM itens_anexos WHERE tenant_id = ? AND id_item = ? AND tipo_anexo = 'IMAGEM_PRINCIPAL' ORDER BY ordem, id_anexo`,
    [tenant, idItem]
  );
  if (principais.length > 1) {
    const extras = principais.slice(1).map((p: any) => p.id_anexo);
    await conn.execute(
      `UPDATE itens_anexos SET tipo_anexo = 'FOTO_GALERIA' WHERE id_anexo IN (${extras.map(() => '?').join(',')})`,
      extras
    );
  }
  if (principais.length === 0) {
    await conn.execute(
      `UPDATE itens_anexos SET tipo_anexo = 'IMAGEM_PRINCIPAL'
       WHERE tenant_id = ? AND id_item = ? AND tipo_anexo = 'FOTO_GALERIA'
       ORDER BY ordem, id_anexo LIMIT 1`,
      [tenant, idItem]
    );
  }
};

/**
 * POST /catalogo/produtos/:id_item/anexos  { url, tipo, nome? }
 */
export const adicionarAnexo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idItem = Number(req.params.id_item);
  const url = String(req.body?.url || '').trim();
  const tipo = String(req.body?.tipo || 'FOTO_GALERIA').toUpperCase();

  if (!/^https?:\/\/\S+$/i.test(url)) {
    return res.status(400).json({ success: false, error: 'Informe um link válido (começando com http:// ou https://).' });
  }
  if (url.length > 500) {
    return res.status(400).json({ success: false, error: 'O link pode ter no máximo 500 caracteres.' });
  }
  if (!TIPOS_ANEXO.includes(tipo)) {
    return res.status(400).json({ success: false, error: 'Tipo de anexo inválido.' });
  }
  const nome = String(req.body?.nome || '').trim() || decodeURIComponent(url.split('?')[0].split('/').pop() || 'arquivo').slice(0, 255);

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existe] = await connection.execute(`SELECT id_item FROM itens_core WHERE id_item = ? AND tenant_id = ? FOR UPDATE`, [idItem, tenant]);
    if (!existe[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Item não encontrado.' });
    }

    // Nova principal rebaixa a anterior para a galeria
    if (tipo === 'IMAGEM_PRINCIPAL') {
      await connection.execute(
        `UPDATE itens_anexos SET tipo_anexo = 'FOTO_GALERIA' WHERE tenant_id = ? AND id_item = ? AND tipo_anexo = 'IMAGEM_PRINCIPAL'`,
        [tenant, idItem]
      );
    }
    const [[ordem]] = await connection.execute(
      `SELECT COALESCE(MAX(ordem), -1) + 1 AS proxima FROM itens_anexos WHERE tenant_id = ? AND id_item = ?`,
      [tenant, idItem]
    );
    await connection.execute(
      `INSERT INTO itens_anexos (tenant_id, id_item, tipo_anexo, nome_arquivo, url_anexo, ordem) VALUES (?, ?, ?, ?, ?, ?)`,
      [tenant, idItem, tipo, nome, url, Number(ordem.proxima)]
    );
    if (TIPOS_IMAGEM.includes(tipo)) await normalizarImagemPrincipal(connection, tenant, idItem);

    await connection.commit();
    return res.json({ success: true, message: 'Anexo adicionado.' });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao adicionar anexo:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * DELETE /catalogo/produtos/:id_item/anexos/:id_anexo
 */
export const removerAnexo = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idItem = Number(req.params.id_item);
  const idAnexo = Number(req.params.id_anexo);

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [resultado] = await connection.execute(
      `DELETE FROM itens_anexos WHERE id_anexo = ? AND id_item = ? AND tenant_id = ?`,
      [idAnexo, idItem, tenant]
    );
    if (!resultado.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Anexo não encontrado.' });
    }
    await normalizarImagemPrincipal(connection, tenant, idItem);
    await connection.commit();
    return res.json({ success: true, message: 'Anexo removido.' });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao remover anexo:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * PUT /catalogo/produtos/:id_item/anexos/:id_anexo/principal
 */
export const definirImagemPrincipal = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idItem = Number(req.params.id_item);
  const idAnexo = Number(req.params.id_anexo);

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[anexo]] = await connection.execute(
      `SELECT tipo_anexo FROM itens_anexos WHERE id_anexo = ? AND id_item = ? AND tenant_id = ? FOR UPDATE`,
      [idAnexo, idItem, tenant]
    );
    if (!anexo || !TIPOS_IMAGEM.includes(anexo.tipo_anexo)) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Só uma imagem pode ser a principal.' });
    }
    await connection.execute(
      `UPDATE itens_anexos SET tipo_anexo = IF(id_anexo = ?, 'IMAGEM_PRINCIPAL', 'FOTO_GALERIA')
       WHERE tenant_id = ? AND id_item = ? AND tipo_anexo IN ('IMAGEM_PRINCIPAL', 'FOTO_GALERIA')`,
      [idAnexo, tenant, idItem]
    );
    await connection.commit();
    return res.json({ success: true, message: 'Imagem principal definida.' });
  } catch (error: any) {
    await connection.rollback();
    console.error('Erro ao definir imagem principal:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

// ---------------------------------------------------------------------------
// Ficha técnica do item: atributos efetivos (categoria + família) com os valores do item
// ---------------------------------------------------------------------------

const valorExibicao = (r: any): string | null => {
  if (r.opcao_valor !== null && r.opcao_valor !== undefined) return String(r.opcao_valor);
  if (r.valor_texto !== null && r.valor_texto !== undefined && String(r.valor_texto).trim() !== '') return String(r.valor_texto);
  if (r.valor_numero !== null && r.valor_numero !== undefined) return String(r.valor_numero);
  if (r.valor_decimal !== null && r.valor_decimal !== undefined) return String(Number(r.valor_decimal));
  if (r.valor_boolean !== null && r.valor_boolean !== undefined) return Number(r.valor_boolean) === 1 ? 'Sim' : 'Não';
  if (r.valor_data) return new Date(r.valor_data).toISOString().slice(0, 10);
  return null;
};

// Vínculos de atributos que valem para um item: herdados da cadeia de categorias (raiz -> categoria)
// e os da família, que sobrescrevem
const carregarVinculosEfetivos = async (conn: Conn, tenant: number, familiaId: number | null, categoriaId: number | null) => {
  const [vinculos] = await conn.execute(
    `SELECT core.tipo_entidade, core.atributo_id, core.escopo_comercial, core.obrigatorio, core.valor_padrao_grupo,
            core.ordem, a.nome, a.codigo, a.tipo
     FROM atributos_core_entidades core
     INNER JOIN atributos_comercial a ON a.id = core.atributo_id AND a.tenant_id = core.tenant_id
     WHERE core.tenant_id = ? AND core.ativo = 1 AND core.tipo_entidade = 'familia' AND core.id_entidade = ?
     ORDER BY core.ordem, a.nome`,
    [tenant, familiaId ?? -1]
  );
  const herdados = await carregarAtributosDaCategoria(conn, tenant, categoriaId);
  const efetivos = new Map<string, any>();
  for (const r of herdados) {
    efetivos.set(String(r.id), {
      tipo_entidade: 'categoria', atributo_id: r.id, escopo_comercial: r.classificacao, obrigatorio: r.obrigatorio,
      valor_padrao_grupo: r.valorPadraoGrupo, ordem: r.ordemSku, nome: r.nome, codigo: r.codigo, tipo: r.tipoDado,
      origem: 'categoria',
    });
  }
  for (const v of vinculos) efetivos.set(String(v.atributo_id), { ...v, origem: 'familia' });
  return efetivos;
};

const montarAtributosEfetivos = async (
  conn: Conn, tenant: number, efetivos: Map<string, any>, valorPorAtributo: Map<string, string | null> = new Map()
) => {
  const opcoes = await carregarOpcoes(conn, tenant, [...efetivos.keys()]);
  return [...efetivos.values()].map(v => {
    const papel = v.escopo_comercial || 'ficha';
    const valorFixo = papel === 'dna' && v.valor_padrao_grupo ? String(v.valor_padrao_grupo) : null;
    return {
      atributoId: Number(v.atributo_id),
      nome: v.nome,
      codigo: v.codigo,
      tipo: v.tipo,
      papel,
      obrigatorio: Boolean(Number(v.obrigatorio)),
      origem: v.origem,
      // DNA com valor fixo vale para todos os itens da família e não é editado no item
      valorFixo,
      valor: valorFixo ?? valorPorAtributo.get(String(v.atributo_id)) ?? null,
      opcoes: (opcoes.get(String(v.atributo_id)) || []).map(o => o.valor),
    };
  });
};

// Família (com a categoria dela) ou só categoria; a família manda na categoria (regra do PIM)
const resolverClassificacao = async (conn: Conn, tenant: number, familiaId: unknown, categoriaId: unknown) => {
  const idFamilia = Number(familiaId) > 0 ? Number(familiaId) : null;
  if (idFamilia) {
    const [[f]] = await conn.execute(
      `SELECT f.id, f.nome, f.status, f.categoria_id, c.nome AS categoria_nome
       FROM comercial_familias f
       LEFT JOIN comercial_categorias c ON c.id = f.categoria_id
       WHERE f.id = ? AND f.tenant_id = ?`,
      [idFamilia, tenant]
    );
    if (f) {
      return {
        familia: { id: Number(f.id), nome: f.nome, status: f.status },
        categoria: f.categoria_id ? { id: Number(f.categoria_id), nome: f.categoria_nome } : null,
      };
    }
  }
  const idCategoria = Number(categoriaId) > 0 ? Number(categoriaId) : null;
  if (idCategoria) {
    const [[c]] = await conn.execute(`SELECT id, nome FROM comercial_categorias WHERE id = ? AND tenant_id = ?`, [idCategoria, tenant]);
    if (c) return { familia: null, categoria: { id: Number(c.id), nome: c.nome } };
  }
  return { familia: null, categoria: null };
};

/**
 * GET /catalogo/atributos-para-item?familia_id=&categoria_id=
 * Atributos que um item novo terá ao entrar na família (ou só na categoria): usado na entrada de NF
 * para o operador preencher os valores já no cadastro, se quiser.
 */
export const getAtributosParaItem = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    const classificacao = await resolverClassificacao(pool as any, tenant, req.query.familia_id, req.query.categoria_id);
    const efetivos = await carregarVinculosEfetivos(pool as any, tenant, classificacao.familia?.id ?? null, classificacao.categoria?.id ?? null);
    const atributos = await montarAtributosEfetivos(pool as any, tenant, efetivos);
    return res.json({ success: true, ...classificacao, atributos });
  } catch (error: any) {
    console.error('Erro ao carregar atributos para o item:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Item novo (entrada de NF): grava os valores de atributos informados no mapeamento.
 * Só os atributos que valem para a família/categoria do item; DNA com valor fixo e valores vazios são ignorados.
 * Valor inválido para o tipo lança erro legível (`Atributo "X": ...`).
 */
export const gravarAtributosItemNovo = async (
  conn: Conn, tenant: number, idItem: number, familiaId: number | null, categoriaId: number | null, valores: unknown
) => {
  if (!valores || typeof valores !== 'object') return 0;
  const efetivos = await carregarVinculosEfetivos(conn, tenant, familiaId, categoriaId);
  const opcoes = await carregarOpcoes(conn, tenant, [...efetivos.keys()]);
  let gravados = 0;
  for (const [id, valor] of Object.entries(valores as Record<string, unknown>)) {
    const v = efetivos.get(String(id));
    if (!v) continue;
    if ((v.escopo_comercial || 'ficha') === 'dna' && v.valor_padrao_grupo) continue;
    if (valor === null || valor === undefined || String(valor).trim() === '') continue;
    await gravarValorAtributo(conn, tenant, 'produto', idItem,
      { id: v.atributo_id, nome: v.nome, tipo: v.tipo }, valor, opcoes.get(String(v.atributo_id)) || []);
    gravados++;
  }
  return gravados;
};

const carregarFichaTecnica = async (conn: Conn, tenant: number, idItem: number) => {
  const [[item]] = await conn.execute(
    `SELECT ic.id_item, cpd.familia_id, f.nome AS familia_nome, f.status AS familia_status,
            COALESCE(f.categoria_id, cpd.categoria_id) AS categoria_id, cat.nome AS categoria_nome
     FROM itens_core ic
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
     LEFT JOIN comercial_categorias cat ON cat.id = COALESCE(f.categoria_id, cpd.categoria_id)
     WHERE ic.id_item = ? AND ic.tenant_id = ?`,
    [idItem, tenant]
  );
  if (!item) return null;

  const efetivos = await carregarVinculosEfetivos(conn, tenant, item.familia_id, item.categoria_id);

  const [valores] = await conn.execute(
    `SELECT v.atributo_id, v.valor_texto, v.valor_numero, v.valor_decimal, v.valor_data, v.valor_boolean,
            o.valor AS opcao_valor, a.nome, a.codigo, a.tipo
     FROM atributos_comercial_valores v
     INNER JOIN atributos_comercial a ON a.id = v.atributo_id AND a.tenant_id = v.tenant_id
     LEFT JOIN atributos_comercial_opcoes o ON o.id = v.opcao_id
     WHERE v.tenant_id = ? AND v.tipo_entidade = 'produto' AND v.id_entidade = ?`,
    [tenant, idItem]
  );
  const valorPorAtributo = new Map<string, string | null>();
  for (const v of valores) valorPorAtributo.set(String(v.atributo_id), valorExibicao(v));

  const atributos = await montarAtributosEfetivos(conn, tenant, efetivos, valorPorAtributo);

  // Valores de atributos que não pertencem mais à família/categoria: preservados como ficha estática
  const estaticos = valores
    .filter((v: any) => !efetivos.has(String(v.atributo_id)))
    .map((v: any) => ({ atributoId: Number(v.atributo_id), nome: v.nome, codigo: v.codigo, tipo: v.tipo, valor: valorExibicao(v) }));

  return {
    familia: item.familia_id ? { id: Number(item.familia_id), nome: item.familia_nome, status: item.familia_status } : null,
    categoria: item.categoria_id ? { id: Number(item.categoria_id), nome: item.categoria_nome } : null,
    atributos,
    estaticos,
  };
};

/**
 * GET /catalogo/produtos/:id_item/ficha-tecnica
 */
export const getFichaTecnica = async (req: Request, res: Response) => {
  try {
    const ficha = await carregarFichaTecnica(pool as any, tenantDe(req), Number(req.params.id_item));
    if (!ficha) return res.status(404).json({ success: false, error: 'Item não encontrado.' });
    return res.json({ success: true, ...ficha });
  } catch (error: any) {
    console.error('Erro ao carregar ficha técnica:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * PUT /catalogo/produtos/:id_item/ficha-tecnica  { valores: { [atributoId]: valor | null } }
 * null/vazio remove o valor; o resto é gravado na coluna do tipo do atributo.
 */
export const salvarFichaTecnica = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idItem = Number(req.params.id_item);
  const valores: Record<string, unknown> = req.body?.valores && typeof req.body.valores === 'object' ? req.body.valores : {};
  const ids = Object.keys(valores).map(Number).filter(n => Number.isFinite(n) && n > 0);
  if (ids.length === 0) return res.status(400).json({ success: false, error: 'Nenhum valor informado.' });

  const connection: any = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existe] = await connection.execute(`SELECT id_item FROM itens_core WHERE id_item = ? AND tenant_id = ? FOR UPDATE`, [idItem, tenant]);
    if (!existe[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Item não encontrado.' });
    }

    const [atributos] = await connection.execute(
      `SELECT id, nome, tipo FROM atributos_comercial WHERE tenant_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
      [tenant, ...ids]
    );
    const porId = new Map<string, any>(atributos.map((a: any) => [String(a.id), a]));
    const opcoes = await carregarOpcoes(connection, tenant, ids);

    for (const id of ids) {
      const atributo = porId.get(String(id));
      if (!atributo) throw new Error(`Atributo #${id} não existe.`);
      const valor = valores[String(id)];
      if (valor === null || valor === undefined || String(valor).trim() === '') {
        await connection.execute(
          `DELETE FROM atributos_comercial_valores WHERE tenant_id = ? AND tipo_entidade = 'produto' AND id_entidade = ? AND atributo_id = ?`,
          [tenant, idItem, id]
        );
      } else {
        await gravarValorAtributo(connection, tenant, 'produto', idItem, atributo, valor, opcoes.get(String(id)) || []);
      }
    }

    await connection.commit();
    const ficha = await carregarFichaTecnica(pool as any, tenant, idItem);
    return res.json({ success: true, message: 'Ficha técnica salva.', ...ficha });
  } catch (error: any) {
    await connection.rollback();
    const negocio = String(error.message || '').startsWith('Atributo');
    if (!negocio) console.error('Erro ao salvar ficha técnica:', error);
    return res.status(negocio ? 400 : 500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};
