// PDV no modelo novo: itens_core + comercial_produtos_dados + estoque_saldos_itens + unidades/faixas de venda.
// Devolve o mesmo formato de produto que a tela do PDV já consome (id, sku, name, salePrice, currentStock...).
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { avaliarPublicacaoItens } from '../../Catalogo/Produtos/publicacaoProdutos';
import { carregarArvore } from '../../Catalogo/Categorias/herancaCategorias';
import { FaixaPdv, faixaParaQuantidade, resolverPrecoPdv, UnidadeVendaPdv } from './precoPdv';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || 1);

const numero = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const SELECT_ITENS = `
  SELECT ic.id_item, ic.sku AS sku_core, ic.nome_item, ic.status, ic.tipo_recurso, ic.id_unidade AS id_unidade_base,
         um.sigla AS sigla_base,
         cpd.sku_customizado, cpd.nome_comercial, cpd.preco_venda, cpd.custo_gerencial,
         COALESCE(cpd.pode_vender_sem_estoque, 0) AS pode_vender_sem_estoque,
         COALESCE(f.categoria_id, cpd.categoria_id) AS categoria_id, cat.nome AS categoria_nome,
         mar.nome AS marca_nome,
         COALESCE(es.quantidade_atual, 0) AS estoque_base, COALESCE(es.custo_medio, 0) AS custo_medio, es.localizacao,
         (SELECT a.url_anexo FROM itens_anexos a
           WHERE a.id_item = ic.id_item AND a.tenant_id = ic.tenant_id AND a.tipo_anexo = 'IMAGEM_PRINCIPAL'
           ORDER BY a.ordem LIMIT 1) AS imagem_url
  FROM itens_core ic
  LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
  LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
  LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
  LEFT JOIN comercial_categorias cat ON cat.id = COALESCE(f.categoria_id, cpd.categoria_id) AND cat.tenant_id = ic.tenant_id
  LEFT JOIN comercial_marcas mar ON mar.id = cpd.id_marca AND mar.tenant_id = ic.tenant_id
  LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'`;

// Unidades de venda (e fator para a base) e faixas de preço dos itens
export const carregarPrecos = async (conn: Conn, tenant: number, itens: any[]) => {
  const unidadesPorItem = new Map<number, UnidadeVendaPdv[]>();
  const faixasPorItem = new Map<number, FaixaPdv[]>();
  if (itens.length === 0) return { unidadesPorItem, faixasPorItem };
  const ids = itens.map(i => Number(i.id_item));
  const marcadores = ids.map(() => '?').join(',');

  const [unidades] = await conn.execute(
    `SELECT cuv.id_item, cuv.id_unidade, um.sigla, cuv.padrao_pdv, cuv.permite_venda, cuv.gtin, cuv.nome_exibicao,
            (cuv.id_unidade = ic.id_unidade) AS is_base,
            CASE WHEN cuv.id_unidade = ic.id_unidade THEN 1 ELSE conv.fator_conversao END AS fator
     FROM comercial_unidades_venda cuv
     INNER JOIN itens_core ic ON ic.id_item = cuv.id_item
     INNER JOIN itens_unidades_medida um ON um.id_unidade = cuv.id_unidade
     LEFT JOIN itens_unidades_conversao conv
            ON conv.id_item = cuv.id_item AND conv.id_unidade_derivada = cuv.id_unidade AND conv.tenant_id = cuv.tenant_id
     WHERE cuv.tenant_id = ? AND cuv.id_item IN (${marcadores})`,
    [tenant, ...ids]
  );
  for (const u of unidades as any[]) {
    const id = Number(u.id_item);
    if (!unidadesPorItem.has(id)) unidadesPorItem.set(id, []);
    unidadesPorItem.get(id)!.push({
      idUnidade: Number(u.id_unidade),
      sigla: u.sigla,
      fator: Number(u.fator) > 0 ? Number(u.fator) : 1,
      isBase: Boolean(Number(u.is_base)),
      padraoPdv: Boolean(Number(u.padrao_pdv)),
      permiteVenda: Boolean(Number(u.permite_venda)),
      gtin: u.gtin || null,
      nomeExibicao: u.nome_exibicao || null,
    });
  }
  // Item sem configuração comercial vende na unidade base
  for (const item of itens) {
    const id = Number(item.id_item);
    if (!unidadesPorItem.has(id) && item.id_unidade_base) {
      unidadesPorItem.set(id, [{
        idUnidade: Number(item.id_unidade_base), sigla: item.sigla_base || 'UN', fator: 1, isBase: true,
        padraoPdv: true, permiteVenda: true, gtin: null, nomeExibicao: null,
      }]);
    }
  }

  const [faixas] = await conn.execute(
    `SELECT id_item, id_unidade, tipo_faixa, ordem, quantidade_minima, quantidade_maxima, preco_unitario
     FROM comercial_precos_faixas WHERE tenant_id = ? AND id_item IN (${marcadores}) ORDER BY ordem`,
    [tenant, ...ids]
  );
  for (const f of faixas as any[]) {
    const id = Number(f.id_item);
    if (!faixasPorItem.has(id)) faixasPorItem.set(id, []);
    faixasPorItem.get(id)!.push({
      idUnidade: Number(f.id_unidade),
      tipoFaixa: String(f.tipo_faixa),
      ordem: Number(f.ordem),
      quantidadeMinima: Number(f.quantidade_minima),
      quantidadeMaxima: f.quantidade_maxima === null ? null : Number(f.quantidade_maxima),
      precoUnitario: Number(f.preco_unitario),
    });
  }
  return { unidadesPorItem, faixasPorItem };
};

// Monta o produto no formato da tela do PDV
const montarProduto = (
  item: any,
  unidades: UnidadeVendaPdv[],
  faixas: FaixaPdv[],
  publicacao: { publicavel: boolean; motivos: string[] } | undefined,
  idUnidadePreferida?: number | null
) => {
  const preco = resolverPrecoPdv(unidades, faixas, item.preco_venda !== null ? Number(item.preco_venda) : null, idUnidadePreferida);
  const fator = preco.unidade?.fator || 1;
  const estoqueBase = Number(item.estoque_base) || 0;
  const custoBase = Number(item.custo_medio) > 0 ? Number(item.custo_medio) : Number(item.custo_gerencial) || 0;
  const gtin = preco.unidade?.gtin || unidades.find(u => u.gtin)?.gtin || '';
  const ativo = String(item.status || 'ATIVO').toUpperCase() === 'ATIVO';

  return {
    id: Number(item.id_item),
    sku: item.sku_customizado || item.sku_core,
    barcode: gtin,
    name: item.nome_comercial || item.nome_item,
    status: ativo ? 'Ativo' : 'Inativo',
    category: item.categoria_nome || '',
    categoryId: item.categoria_id ? Number(item.categoria_id) : null,
    brand: item.marca_nome || '',
    // Quantidades e preço na unidade de venda sugerida
    unitOfMeasure: preco.unidade?.sigla || item.sigla_base || '',
    salePrice: preco.preco,
    costPrice: Number((custoBase * fator).toFixed(4)),
    currentStock: Number((estoqueBase / fator).toFixed(4)),
    minStock: 0,
    isStockLow: estoqueBase <= 0,
    pictureUrl: item.imagem_url || null,
    location: item.localizacao || '',
    // Modelo novo
    idUnidadeVenda: preco.unidade?.idUnidade ?? null,
    fatorConversao: fator,
    estoqueBase,
    unidadeBase: item.sigla_base || '',
    origemPreco: preco.origem,
    temAtacado: preco.temAtacado,
    // Menor preço de atacado da unidade sugerida (ex.: 10+ por R$ 9,29)
    atacado: (() => {
      const f = faixas
        .filter(x => x.idUnidade === preco.unidade?.idUnidade && x.tipoFaixa === 'ATACADO' && x.precoUnitario > 0)
        .sort((a, b) => a.precoUnitario - b.precoUnitario)[0];
      return f ? { quantidadeMinima: f.quantidadeMinima, preco: f.precoUnitario } : null;
    })(),
    podeVenderSemEstoque: Boolean(Number(item.pode_vender_sem_estoque)),
    publicavel: publicacao?.publicavel ?? true,
    motivosPublicacao: publicacao?.motivos ?? [],
  };
};

/**
 * GET /api/vendas/pdv/itens
 * query, category (nome ou id; inclui subcategorias), brand, status, minStock, onlyInStock, minPrice, maxPrice,
 * sort (name_asc | price_asc | price_desc | stock_desc), page, limit,
 * incluirNaoPublicaveis=true (provisório: mostra também os itens que não passam na publicação)
 */
export const listarItensPdv = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const busca = String(req.query.query || '').trim();
    const categoria = String(req.query.category || '').trim();
    const marca = String(req.query.brand || '').trim();
    const status = String(req.query.status || '').trim();
    const minStock = numero(req.query.minStock);
    const onlyInStock = req.query.onlyInStock === 'true';
    const minPrice = numero(req.query.minPrice);
    const maxPrice = numero(req.query.maxPrice);
    const sort = String(req.query.sort || 'name_asc');
    const incluirNaoPublicaveis = req.query.incluirNaoPublicaveis === 'true';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 20));

    const where: string[] = [`ic.tenant_id = ?`, `ic.tipo_recurso = 'PRODUTO'`];
    const params: any[] = [tenant];

    if (busca) {
      const termo = `%${busca}%`;
      where.push(`(ic.sku LIKE ? OR cpd.sku_customizado LIKE ? OR ic.nome_item LIKE ? OR cpd.nome_comercial LIKE ?
                   OR EXISTS (SELECT 1 FROM comercial_unidades_venda g
                              WHERE g.tenant_id = ic.tenant_id AND g.id_item = ic.id_item AND g.gtin = ?))`);
      params.push(termo, termo, termo, termo, busca);
    }

    if (categoria && categoria !== 'Todas') {
      const arvore = await carregarArvore(pool as any, tenant);
      const raizes = arvore.filter(c => String(c.id) === categoria || String(c.nome || '').toLowerCase() === categoria.toLowerCase());
      const ids = new Set(raizes.map(c => String(c.id)));
      let cresceu = true;
      while (cresceu) {
        cresceu = false;
        for (const c of arvore) {
          if (c.pai !== null && ids.has(String(c.pai)) && !ids.has(String(c.id))) { ids.add(String(c.id)); cresceu = true; }
        }
      }
      if (ids.size === 0) return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } });
      where.push(`COALESCE(f.categoria_id, cpd.categoria_id) IN (${[...ids].map(() => '?').join(',')})`);
      params.push(...ids);
    }

    if (marca && marca !== 'Todos') { where.push('mar.nome = ?'); params.push(marca); }
    if (status === 'Ativo') where.push(`ic.status = 'ATIVO'`);
    if (status === 'Inativo') where.push(`ic.status <> 'ATIVO'`);
    if (onlyInStock) where.push('COALESCE(es.quantidade_atual, 0) > 0');
    if (minStock !== undefined && minStock > 0) { where.push('COALESCE(es.quantidade_atual, 0) >= ?'); params.push(minStock); }

    const [rows] = await pool.execute(`${SELECT_ITENS} WHERE ${where.join(' AND ')}`, params);
    const itens = rows as any[];

    const ids = itens.map(i => Number(i.id_item));
    const [publicacao, precos] = await Promise.all([
      ids.length > 0 ? avaliarPublicacaoItens(pool as any, tenant, ids) : Promise.resolve(new Map()),
      carregarPrecos(pool as any, tenant, itens),
    ]);

    let produtos = itens.map(item => {
      const id = Number(item.id_item);
      const unidades = precos.unidadesPorItem.get(id) || [];
      // Bipou o GTIN de uma embalagem: o item vem nessa unidade
      const unidadeDoGtin = busca ? unidades.find(u => u.gtin === busca)?.idUnidade : undefined;
      return montarProduto(item, unidades, precos.faixasPorItem.get(id) || [], publicacao.get(id), unidadeDoGtin);
    });

    if (!incluirNaoPublicaveis) produtos = produtos.filter(p => p.publicavel);
    if (minPrice !== undefined && minPrice > 0) produtos = produtos.filter(p => p.salePrice >= minPrice);
    if (maxPrice !== undefined && maxPrice > 0) produtos = produtos.filter(p => p.salePrice <= maxPrice);

    const exato = (p: any) => (busca && (p.barcode === busca || String(p.sku).toLowerCase() === busca.toLowerCase()) ? 0 : 1);
    const comparar: Record<string, (a: any, b: any) => number> = {
      price_asc: (a, b) => a.salePrice - b.salePrice,
      price_desc: (a, b) => b.salePrice - a.salePrice,
      stock_desc: (a, b) => b.estoqueBase - a.estoqueBase,
      name_asc: (a, b) => a.name.localeCompare(b.name),
    };
    produtos.sort((a, b) => exato(a) - exato(b) || (comparar[sort] || comparar.name_asc)(a, b));

    const total = produtos.length;
    const totalPages = Math.ceil(total / limit);
    return res.json({
      data: produtos.slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    });
  } catch (error: any) {
    console.error('Erro ao listar itens do PDV:', error);
    return res.status(500).json({ error: 'Erro ao listar itens do PDV', details: error.message });
  }
};

/**
 * GET /api/vendas/pdv/itens/:idItem — dados atualizados para o carrinho, com todas as unidades e faixas
 */
export const detalheItemPdv = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const idItem = Number(req.params.idItem);
    const [rows] = await pool.execute(`${SELECT_ITENS} WHERE ic.tenant_id = ? AND ic.id_item = ?`, [tenant, idItem]);
    const item = (rows as any[])[0];
    if (!item) return res.status(404).json({ error: 'Item não encontrado.' });

    const [publicacao, precos] = await Promise.all([
      avaliarPublicacaoItens(pool as any, tenant, [idItem]),
      carregarPrecos(pool as any, tenant, [item]),
    ]);
    const unidades = precos.unidadesPorItem.get(idItem) || [];
    const faixas = precos.faixasPorItem.get(idItem) || [];
    const idUnidade = numero(req.query.idUnidade);
    const produto = montarProduto(item, unidades, faixas, publicacao.get(idItem), idUnidade);
    const precoCadastro = item.preco_venda !== null ? Number(item.preco_venda) : 0;

    return res.json({
      data: {
        ...produto,
        unidades: unidades.filter(u => u.permiteVenda).map(u => {
          const faixa = faixaParaQuantidade(faixas, u.idUnidade, 1);
          return {
            ...u,
            preco: faixa ? faixa.precoUnitario : Number((precoCadastro * u.fator).toFixed(4)),
            estoque: Number(((Number(item.estoque_base) || 0) / u.fator).toFixed(4)),
            faixas: faixas.filter(f => f.idUnidade === u.idUnidade),
          };
        }),
      },
    });
  } catch (error: any) {
    console.error('Erro ao carregar item do PDV:', error);
    return res.status(500).json({ error: 'Erro ao carregar item do PDV', details: error.message });
  }
};

/**
 * GET /api/vendas/pdv/etiquetas?ids=1,2,3 — dados de etiqueta (preço da unidade padrão do PDV, GTIN,
 * menor preço de atacado dessa unidade e localização), no mesmo formato de produto do PDV.
 */
export const itensParaEtiqueta = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const ids = [...new Set(String(req.query.ids || '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 500);
    if (ids.length === 0) return res.json({ data: [] });
    const [rows] = await pool.execute(
      `${SELECT_ITENS} WHERE ic.tenant_id = ? AND ic.id_item IN (${ids.map(() => '?').join(',')})`,
      [tenant, ...ids]
    );
    const itens = rows as any[];
    const precos = await carregarPrecos(pool as any, tenant, itens);
    return res.json({
      data: itens.map(item => {
        const id = Number(item.id_item);
        const faixas = precos.faixasPorItem.get(id) || [];
        return montarProduto(item, precos.unidadesPorItem.get(id) || [], faixas, undefined);
      }),
    });
  } catch (error: any) {
    console.error('Erro ao carregar dados de etiqueta:', error);
    return res.status(500).json({ error: 'Erro ao carregar dados de etiqueta', details: error.message });
  }
};

/**
 * GET /api/vendas/pdv/clientes?busca= — clientes (papel CLIENTE/CONSUMIDOR) por nome, razão social, fantasia, CPF ou CNPJ.
 * Documento comparado só pelos dígitos (o cadastro tem CNPJ com e sem máscara).
 */
export const buscarClientesPdv = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const busca = String(req.query.busca || '').trim();
    const digitos = busca.replace(/\D/g, '');
    const params: any[] = [tenant];
    let filtro = '';
    if (busca) {
      const termo = `%${busca}%`;
      filtro = `AND (pf.nome LIKE ? OR pj.razao_social LIKE ? OR pj.nome_fantasia LIKE ?
                ${digitos.length >= 3 ? `OR REPLACE(REPLACE(REPLACE(COALESCE(pf.cpf, pj.cnpj, ''), '.', ''), '-', ''), '/', '') LIKE ?` : ''})`;
      params.push(termo, termo, termo);
      if (digitos.length >= 3) params.push(`%${digitos}%`);
    }
    const [rows] = await pool.execute(
      `SELECT DISTINCT c.id_pessoa, c.tipo_pessoa, pf.nome, pf.cpf, pj.razao_social, pj.nome_fantasia, pj.cnpj
       FROM pessoas_core c
       INNER JOIN pessoas_papeis_atribuido pa ON pa.id_cliente = c.id_pessoa
       INNER JOIN pessoas_papeis_definicao pd ON pd.id_cliente_papel = pa.id_cliente_papel AND pd.codigo IN ('CLIENTE', 'CONSUMIDOR')
       LEFT JOIN pessoas_pf pf ON pf.id_cliente = c.id_pessoa
       LEFT JOIN pessoas_pj pj ON pj.id_cliente = c.id_pessoa
       WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND c.status = 'ATIVO' ${filtro}
       ORDER BY COALESCE(pf.nome, pj.nome_fantasia, pj.razao_social)
       LIMIT 20`,
      params
    );
    return res.json((rows as any[]).map(r => ({
      id: Number(r.id_pessoa),
      tipo: r.tipo_pessoa,
      nome: r.tipo_pessoa === 'PJ' ? (r.nome_fantasia || r.razao_social || '') : (r.nome || ''),
      razaoSocial: r.razao_social || null,
      documento: r.tipo_pessoa === 'PJ' ? (r.cnpj || '') : (r.cpf || ''),
    })));
  } catch (error: any) {
    console.error('Erro ao buscar clientes do PDV:', error);
    return res.status(500).json({ error: 'Erro ao buscar clientes', details: error.message });
  }
};

// GET /api/vendas/pdv/categorias — nomes das categorias ativas (a busca por nome inclui as subcategorias)
export const categoriasPdv = async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT nome FROM comercial_categorias WHERE tenant_id = ? AND ativa = 1 ORDER BY nome`,
      [tenantDe(req)]
    );
    return res.json(['Todas', ...(rows as any[]).map(r => r.nome)]);
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao buscar categorias', details: error.message });
  }
};

// GET /api/vendas/pdv/marcas — marcas com itens
export const marcasPdv = async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT mar.nome FROM comercial_marcas mar
       INNER JOIN comercial_produtos_dados cpd ON cpd.id_marca = mar.id AND cpd.tenant_id = mar.tenant_id
       WHERE mar.tenant_id = ? ORDER BY mar.nome`,
      [tenantDe(req)]
    );
    return res.json(['Todos', ...(rows as any[]).map(r => r.nome)]);
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao buscar marcas', details: error.message });
  }
};
