// Estoque no modelo novo: saldos (estoque_saldos_itens), extrato (estoque_movimentos), ajuste e inventário.
import { Request, Response } from 'express';
import pool from '../Estoque/db.config';
import { carregarArvore } from '../Catalogo/Categorias/herancaCategorias';
import { calcularAjuste, ErroAjuste, ORIGENS_AJUSTE, OrigemAjuste, situacaoSaldo, TipoAjuste } from './ajusteEstoque';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);
const n = (v: unknown) => Number(v) || 0;

const ROTULO_ORIGEM: Record<string, string> = {
  ENTRADA_NFE: 'Entrada NF-e',
  VENDA_PDV: 'Venda PDV',
  CANCELAMENTO_VENDA: 'Cancelamento de venda',
  AJUSTE_MANUAL: 'Ajuste manual',
  INVENTARIO: 'Inventário',
};

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroAjuste) return res.status(error.status).json({ error: error.message });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

// Ids da categoria informada (nome ou id) e de todas as subcategorias
const idsCategoriaComFilhas = async (tenant: number, categoria: string): Promise<string[]> => {
  const arvore = await carregarArvore(pool as any, tenant);
  const ids = new Set(arvore
    .filter(c => String(c.id) === categoria || String(c.nome || '').toLowerCase() === categoria.toLowerCase())
    .map(c => String(c.id)));
  let cresceu = true;
  while (cresceu) {
    cresceu = false;
    for (const c of arvore) {
      if (c.pai !== null && ids.has(String(c.pai)) && !ids.has(String(c.id))) { ids.add(String(c.id)); cresceu = true; }
    }
  }
  return [...ids];
};

/**
 * GET /api/estoque/saldos
 * busca, categoria (nome/id, com subcategorias), situacao (NEGATIVO|ZERADO|ABAIXO_MINIMO|OK|COM_SALDO), page, limit
 * Itens estocáveis (tudo menos SERVICO). Mínimo: o da família (enquanto não houver mínimo por item).
 */
export const listarSaldos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const busca = String(req.query.busca || '').trim();
    const categoria = String(req.query.categoria || '').trim();
    const situacao = String(req.query.situacao || '').trim().toUpperCase();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));

    const where = [`ic.tenant_id = ?`, `ic.tipo_recurso <> 'SERVICO'`];
    const params: any[] = [tenant];
    if (busca) {
      const termo = `%${busca}%`;
      where.push(`(ic.sku LIKE ? OR cpd.sku_customizado LIKE ? OR ic.nome_item LIKE ? OR cpd.nome_comercial LIKE ? OR es.localizacao LIKE ?
                   OR EXISTS (SELECT 1 FROM comercial_unidades_venda g WHERE g.tenant_id = ic.tenant_id AND g.id_item = ic.id_item AND g.gtin = ?))`);
      params.push(termo, termo, termo, termo, termo, busca);
    }
    if (categoria && categoria !== 'Todas') {
      const ids = await idsCategoriaComFilhas(tenant, categoria);
      if (ids.length === 0) where.push('1 = 0');
      else { where.push(`COALESCE(f.categoria_id, cpd.categoria_id) IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
    }

    const [rows] = await pool.execute(
      `SELECT ic.id_item, ic.sku AS sku_core, ic.nome_item, ic.tipo_recurso, ic.status,
              cpd.sku_customizado, cpd.nome_comercial, cpd.custo_gerencial,
              um.sigla AS unidade, cat.nome AS categoria, f.nome AS familia, f.estoque_minimo AS minimo_familia,
              COALESCE(es.quantidade_atual, 0) AS quantidade, COALESCE(es.custo_medio, 0) AS custo_medio,
              es.ultimo_custo, es.updated_at, es.estoque_minimo, es.estoque_maximo, es.localizacao,
              (SELECT MAX(m.created_at) FROM estoque_movimentos m WHERE m.tenant_id = ic.tenant_id AND m.id_item = ic.id_item) AS ultimo_movimento
       FROM itens_core ic
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
       LEFT JOIN comercial_categorias cat ON cat.id = COALESCE(f.categoria_id, cpd.categoria_id) AND cat.tenant_id = ic.tenant_id
       LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
       LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id
       WHERE ${where.join(' AND ')}
       ORDER BY COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item)`,
      params
    );

    const todos = (rows as any[]).map(r => {
      const quantidade = n(r.quantidade);
      const custoMedio = n(r.custo_medio);
      const custo = custoMedio > 0 ? custoMedio : n(r.custo_gerencial);
      // Mínimo do item; sem ele, o da família
      const minimoItem = r.estoque_minimo !== null ? n(r.estoque_minimo) : null;
      const minimoFamilia = r.minimo_familia !== null ? n(r.minimo_familia) : null;
      const minimo = minimoItem ?? minimoFamilia;
      return {
        idItem: Number(r.id_item),
        sku: r.sku_customizado || r.sku_core,
        nome: r.nome_comercial || r.nome_item,
        tipoRecurso: r.tipo_recurso,
        status: r.status,
        unidade: r.unidade || '',
        categoria: r.categoria || '',
        familia: r.familia || '',
        quantidade,
        custoMedio,
        custoReferencia: n(r.custo_gerencial),
        ultimoCusto: r.ultimo_custo !== null ? n(r.ultimo_custo) : null,
        valorEstoque: Number((Math.max(quantidade, 0) * custo).toFixed(2)),
        minimo,
        minimoItem,
        minimoFamilia,
        maximo: r.estoque_maximo !== null ? n(r.estoque_maximo) : null,
        localizacao: r.localizacao || '',
        // Quanto falta para chegar ao máximo (sugestão de reposição) quando está abaixo do mínimo
        sugestaoReposicao: minimo !== null && quantidade < minimo
          ? Number((((r.estoque_maximo !== null ? n(r.estoque_maximo) : minimo) - quantidade)).toFixed(4))
          : 0,
        situacao: situacaoSaldo(quantidade, minimo),
        ultimoMovimento: r.ultimo_movimento,
      };
    });

    const resumo = {
      itens: todos.length,
      comSaldo: todos.filter(i => i.quantidade > 0).length,
      zerados: todos.filter(i => i.situacao === 'ZERADO').length,
      negativos: todos.filter(i => i.situacao === 'NEGATIVO').length,
      abaixoMinimo: todos.filter(i => i.situacao === 'ABAIXO_MINIMO').length,
      valorTotal: Number(todos.reduce((a, i) => a + i.valorEstoque, 0).toFixed(2)),
    };

    const filtrados = !situacao ? todos
      : situacao === 'COM_SALDO' ? todos.filter(i => i.quantidade > 0)
      : todos.filter(i => i.situacao === situacao);
    const total = filtrados.length;
    return res.json({
      data: filtrados.slice((page - 1) * limit, page * limit),
      resumo,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return responderErro(res, error, 'Erro ao listar os saldos de estoque.');
  }
};

/**
 * GET /api/estoque/movimentos
 * idItem, de, ate (AAAA-MM-DD), origem, tipo (ENTRADA|SAIDA), page, limit — extrato (mais recente primeiro)
 */
export const listarMovimentos = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const where = ['m.tenant_id = ?'];
    const params: any[] = [tenant];
    const idItem = Number(req.query.idItem);
    if (idItem > 0) { where.push('m.id_item = ?'); params.push(idItem); }
    const data = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
    const de = data(req.query.de);
    const ate = data(req.query.ate);
    if (de) { where.push('m.created_at >= ?'); params.push(`${de} 00:00:00`); }
    if (ate) { where.push('m.created_at <= ?'); params.push(`${ate} 23:59:59`); }
    const origem = String(req.query.origem || '').trim().toUpperCase();
    if (origem) { where.push('m.origem = ?'); params.push(origem); }
    const tipo = String(req.query.tipo || '').trim().toUpperCase();
    if (tipo === 'ENTRADA' || tipo === 'SAIDA') { where.push('m.tipo_movimento = ?'); params.push(tipo); }
    const busca = String(req.query.busca || '').trim();
    if (busca) {
      const termo = `%${busca}%`;
      where.push('(ic.sku LIKE ? OR cpd.sku_customizado LIKE ? OR ic.nome_item LIKE ? OR cpd.nome_comercial LIKE ? OR m.documento_origem LIKE ?)');
      params.push(termo, termo, termo, termo, termo);
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));

    const base = `FROM estoque_movimentos m
       INNER JOIN itens_core ic ON ic.id_item = m.id_item
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = m.id_item AND cpd.tenant_id = m.tenant_id
       LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
       WHERE ${where.join(' AND ')}`;
    const [[{ total }]]: any = await pool.execute(`SELECT COUNT(*) AS total ${base}`, params);
    const [rows] = await pool.query(
      `SELECT m.id_movimento, m.id_item, m.tipo_movimento, m.origem, m.id_origem, m.documento_origem,
              m.quantidade, m.quantidade_documento, m.unidade_documento, m.fator_conversao,
              m.custo_unitario, m.custo_total, m.saldo_anterior, m.saldo_posterior, m.observacao, m.created_at,
              COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku,
              COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome, um.sigla AS unidade
       ${base}
       ORDER BY m.created_at DESC, m.id_movimento DESC
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params
    );

    return res.json({
      data: (rows as any[]).map(r => ({
        idMovimento: Number(r.id_movimento),
        idItem: Number(r.id_item),
        sku: r.sku,
        nome: r.nome,
        unidade: r.unidade || '',
        tipo: r.tipo_movimento,
        origem: r.origem,
        origemRotulo: ROTULO_ORIGEM[r.origem] || r.origem,
        idOrigem: r.id_origem !== null ? Number(r.id_origem) : null,
        documento: r.documento_origem,
        quantidade: n(r.quantidade),
        quantidadeDocumento: r.quantidade_documento !== null ? n(r.quantidade_documento) : null,
        unidadeDocumento: r.unidade_documento,
        fatorConversao: n(r.fator_conversao) || 1,
        custoUnitario: n(r.custo_unitario),
        custoTotal: n(r.custo_total),
        saldoAnterior: n(r.saldo_anterior),
        saldoPosterior: n(r.saldo_posterior),
        observacao: r.observacao,
        criadoEm: r.created_at,
      })),
      pagination: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) },
    });
  } catch (error: any) {
    return responderErro(res, error, 'Erro ao listar as movimentações.');
  }
};

/**
 * PUT /api/estoque/itens/:idItem/parametros { estoqueMinimo?, estoqueMaximo?, localizacao? }
 * Atualização parcial: campo ausente mantém; vazio/null limpa (mínimo volta a ser o da família).
 */
export const salvarParametros = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idItem = Number(req.params.idItem);
  const body = req.body || {};
  try {
    const numeroOuNulo = (v: unknown, campo: string) => {
      if (v === null || v === '') return null;
      const x = Number(v);
      if (!Number.isFinite(x) || x < 0) throw new ErroAjuste(`${campo} inválido.`);
      return x;
    };
    const [[item]]: any = await pool.execute(
      `SELECT ic.id_item, ic.tipo_recurso, es.estoque_minimo, es.estoque_maximo, es.localizacao
       FROM itens_core ic
       LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id
       WHERE ic.id_item = ? AND ic.tenant_id = ?`,
      [idItem, tenant]
    );
    if (!item) throw new ErroAjuste('Item não encontrado.', 404);
    if (String(item.tipo_recurso).toUpperCase() === 'SERVICO') throw new ErroAjuste('Serviço não tem estoque.');

    const minimo = body.estoqueMinimo !== undefined ? numeroOuNulo(body.estoqueMinimo, 'Estoque mínimo') : (item.estoque_minimo !== null ? n(item.estoque_minimo) : null);
    const maximo = body.estoqueMaximo !== undefined ? numeroOuNulo(body.estoqueMaximo, 'Estoque máximo') : (item.estoque_maximo !== null ? n(item.estoque_maximo) : null);
    const localizacao = body.localizacao !== undefined ? (String(body.localizacao || '').trim().toUpperCase().slice(0, 60) || null) : item.localizacao;
    if (minimo !== null && maximo !== null && maximo < minimo) throw new ErroAjuste('O estoque máximo não pode ser menor que o mínimo.');

    await pool.execute(
      `INSERT INTO estoque_saldos_itens (tenant_id, id_item, quantidade_atual, custo_medio, estoque_minimo, estoque_maximo, localizacao)
       VALUES (?, ?, 0, 0, ?, ?, ?)
       ON DUPLICATE KEY UPDATE estoque_minimo = VALUES(estoque_minimo), estoque_maximo = VALUES(estoque_maximo), localizacao = VALUES(localizacao)`,
      [tenant, idItem, minimo !== null ? f4(minimo) : null, maximo !== null ? f4(maximo) : null, localizacao]
    );
    return res.json({ success: true, estoqueMinimo: minimo, estoqueMaximo: maximo, localizacao: localizacao || '' });
  } catch (error: any) {
    return responderErro(res, error, 'Erro ao salvar os parâmetros de estoque.');
  }
};

/**
 * POST /api/estoque/ajustes
 * { origem: AJUSTE_MANUAL | INVENTARIO, motivo, itens: [{ idItem, tipo: ENTRADA|SAIDA|CONTAGEM, quantidade, custoUnitario? }] }
 * Tudo numa transação; os movimentos do mesmo lançamento compartilham o id_origem (número do lote).
 */
export const lancarAjustes = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const origem = String(req.body?.origem || 'AJUSTE_MANUAL').toUpperCase() as OrigemAjuste;
  const motivo = String(req.body?.motivo || '').trim();
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];

  const connection = await pool.getConnection();
  try {
    if (!ORIGENS_AJUSTE.includes(origem)) throw new ErroAjuste('Origem de ajuste inválida.');
    if (!motivo) throw new ErroAjuste('Informe o motivo do ajuste.');
    if (itens.length === 0) throw new ErroAjuste('Nenhum item informado.');

    const pedidos: Array<{ idItem: number; tipo: TipoAjuste; quantidade: number; custoUnitario: number | null }> = itens.map((i: any) => ({
      idItem: Number(i.idItem),
      tipo: String(i.tipo || '').toUpperCase() as TipoAjuste,
      quantidade: Number(i.quantidade),
      custoUnitario: i.custoUnitario === undefined || i.custoUnitario === null || i.custoUnitario === '' ? null : Number(i.custoUnitario),
    }));
    for (const p of pedidos) {
      if (!Number.isInteger(p.idItem) || p.idItem <= 0) throw new ErroAjuste('Item inválido no ajuste.');
      if (!['ENTRADA', 'SAIDA', 'CONTAGEM'].includes(p.tipo)) throw new ErroAjuste(`Tipo de ajuste inválido no item ${p.idItem}.`);
    }
    const ids = [...new Set(pedidos.map(p => p.idItem))].sort((a, b) => a - b);
    if (ids.length !== pedidos.length) throw new ErroAjuste('O mesmo item aparece mais de uma vez no ajuste.');

    await connection.beginTransaction();

    const marcadores = ids.map(() => '?').join(',');
    const [itemRows] = await connection.execute(
      `SELECT ic.id_item, ic.tipo_recurso, cpd.custo_gerencial,
              COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome
       FROM itens_core ic
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
       WHERE ic.tenant_id = ? AND ic.id_item IN (${marcadores})`,
      [tenant, ...ids]
    );
    const itensBanco = new Map((itemRows as any[]).map(r => [Number(r.id_item), r]));
    const faltando = ids.filter(id => !itensBanco.has(id));
    if (faltando.length > 0) throw new ErroAjuste(`Item não encontrado: ${faltando.join(', ')}.`, 404);
    for (const item of itensBanco.values()) {
      if (String(item.tipo_recurso).toUpperCase() === 'SERVICO') throw new ErroAjuste(`"${item.nome}" é serviço e não tem estoque.`);
    }

    const [saldoRows] = await connection.execute(
      `SELECT id_item, quantidade_atual, custo_medio FROM estoque_saldos_itens
       WHERE tenant_id = ? AND id_item IN (${marcadores}) ORDER BY id_item FOR UPDATE`,
      [tenant, ...ids]
    );
    const saldos = new Map((saldoRows as any[]).map(r => [Number(r.id_item), { quantidade: n(r.quantidade_atual), custoMedio: n(r.custo_medio) }]));

    // Número do lançamento: agrupa os movimentos deste ajuste/inventário
    const lote = Date.now();
    const documento = `${origem === 'INVENTARIO' ? 'INVENTARIO' : 'AJUSTE'} ${lote}`;
    const resultados: any[] = [];

    for (const p of pedidos) {
      const item = itensBanco.get(p.idItem);
      const atual = saldos.get(p.idItem) || { quantidade: 0, custoMedio: 0 };
      const r = calcularAjuste(p.tipo, p.quantidade, { ...atual, custoReferencia: n(item.custo_gerencial) }, p.custoUnitario);
      if (!r.tipoMovimento) {
        resultados.push({ idItem: p.idItem, nome: item.nome, lancado: false, saldo: r.saldoPosterior });
        continue;
      }

      await connection.execute(
        `INSERT INTO estoque_movimentos
           (tenant_id, id_item, tipo_movimento, origem, id_origem, documento_origem, tipo_recurso,
            quantidade, fator_conversao, custo_unitario, custo_total, saldo_anterior, saldo_posterior, observacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
        [
          tenant, p.idItem, r.tipoMovimento, origem, lote, documento, item.tipo_recurso || 'PRODUTO',
          f4(r.quantidade), f4(r.custoUnitario), f4(r.custoUnitario * r.quantidade),
          f4(r.saldoAnterior), f4(r.saldoPosterior),
          `${p.tipo === 'CONTAGEM' ? `Contagem ${r.saldoPosterior}` : p.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}: ${motivo}`.slice(0, 255),
        ]
      );
      const entradaComCusto = r.tipoMovimento === 'ENTRADA' && p.custoUnitario !== null && p.custoUnitario > 0;
      await connection.execute(
        `INSERT INTO estoque_saldos_itens (tenant_id, id_item, quantidade_atual, custo_medio, ultimo_custo)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantidade_atual = VALUES(quantidade_atual), custo_medio = VALUES(custo_medio)
                                 ${entradaComCusto ? ', ultimo_custo = VALUES(ultimo_custo)' : ''}`,
        [tenant, p.idItem, f4(r.saldoPosterior), f4(r.custoMedioPosterior), entradaComCusto ? f4(r.custoUnitario) : null]
      );
      resultados.push({
        idItem: p.idItem, nome: item.nome, lancado: true, tipo: r.tipoMovimento,
        quantidade: r.quantidade, saldoAnterior: r.saldoAnterior, saldo: r.saldoPosterior,
      });
    }

    await connection.commit();
    return res.status(201).json({
      success: true,
      lote,
      documento,
      lancados: resultados.filter(r => r.lancado).length,
      semDiferenca: resultados.filter(r => !r.lancado).length,
      itens: resultados,
    });
  } catch (error: any) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao lançar o ajuste de estoque.');
  } finally {
    connection.release();
  }
};
