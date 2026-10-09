// Kits de venda: cadastro (item do catálogo + itens_composicoes 'KIT'), custo, estoque possível e relatório
// de kits mais vendidos e do consumo dos componentes (base para compras).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { obterOuCriarUnidade } from '../precos/configVendas.controller';
import { skuNoFormatoReservado, skuSequencial } from '../../compras/staging/penteFino';
import { carregarPrecos } from '../../vendas/pdv/pdv.controller';
import { calcularLinha } from '../../vendas/pdv/vendaPdv';
import {
  ComponenteKit, componenteLimitante, custoDoKit, diasDeCobertura, ErroKit, estoqueDoKit, margemDoKit,
  normalizarComponentes, skuSugeridoKit, TIPO_KIT,
} from './kits';
import { carregarComposicoes, carregarDadosComponentes, DadosComponenteBanco, idsDosKits, ORIGEM_VENDA_PDV } from './kitsBanco';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);
const diasDe = (req: Request) => Math.min(730, Math.max(1, Number(req.query.dias) || 90));

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroKit) return res.status(error.status).json({ error: error.message });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

const paraComponente = (c: ComponenteKit, d?: DadosComponenteBanco) => ({
  idItem: c.idItem,
  quantidade: c.quantidade,
  nome: d?.nome || `Item ${c.idItem}`,
  sku: d?.sku || '',
  unidade: d?.sigla || '',
  saldo: d?.saldo ?? 0,
  custoUnitario: d?.custo ?? 0,
  custoTotal: Math.round((d?.custo || 0) * c.quantidade * 10000) / 10000,
  servico: Boolean(d?.servico),
  inativo: d ? d.status !== 'ATIVO' : true,
});

/** Monta a resposta completa dos kits pedidos (componentes, custo, estoque possível, preço do PDV, vendas). */
const montarKits = async (conn: Conn, tenant: number, ids: number[], dias: number) => {
  if (ids.length === 0) return [];
  const composicoes = await carregarComposicoes(conn, tenant, ids);
  const dados = await carregarDadosComponentes(conn, tenant, [...composicoes.values()].flat().map(c => c.idItem));
  const [rows] = await conn.execute(
    `SELECT ic.id_item, ic.status, ic.sku AS sku_core, ic.nome_item, ic.id_unidade AS id_unidade_base,
            cpd.sku_customizado, cpd.nome_comercial, cpd.preco_venda, cpd.custo_gerencial,
            COALESCE(f.categoria_id, cpd.categoria_id) AS categoria_id, cat.nome AS categoria_nome
     FROM itens_core ic
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
     LEFT JOIN comercial_categorias cat ON cat.id = COALESCE(f.categoria_id, cpd.categoria_id) AND cat.tenant_id = ic.tenant_id
     WHERE ic.tenant_id = ? AND ic.id_item IN (${ids.map(() => '?').join(',')})`,
    [tenant, ...ids]
  );
  const precos = await carregarPrecos(conn as any, tenant, rows as any[]);
  const [vendas] = await conn.execute(
    `SELECT vi.id_item, SUM(vi.quantidade_base) AS qtd, SUM(vi.total_item) AS total, SUM(vi.custo_total) AS custo_vendido, COUNT(DISTINCT vi.id_venda) AS vendas,
            DATE_FORMAT(MAX(v.created_at), '%Y-%m-%d %H:%i') AS ultima
     FROM vendas_pedidos_itens vi
     INNER JOIN vendas_pedidos v ON v.id_venda = vi.id_venda
     WHERE vi.tenant_id = ? AND v.status = 'CONCLUIDA' AND v.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND vi.id_item IN (${ids.map(() => '?').join(',')})
     GROUP BY vi.id_item`,
    [tenant, dias, ...ids]
  );
  const vendasPorKit = new Map((vendas as any[]).map(v => [Number(v.id_item), v]));

  return (rows as any[]).map(r => {
    const id = Number(r.id_item);
    const comp = composicoes.get(id) || [];
    const custo = custoDoKit(comp, dados);
    const faixas = precos.faixasPorItem.get(id) || [];
    const precoCadastro = r.preco_venda !== null ? Number(r.preco_venda) : 0;
    let precoPdv = precoCadastro;
    try {
      precoPdv = calcularLinha({ idItem: id, quantidade: 1, idUnidade: null, precoUnitario: null },
        { unidades: precos.unidadesPorItem.get(id) || [], faixas, precoCadastro }).precoTabela;
    } catch { /* sem unidade de venda: fica o preço do cadastro */ }
    const v = vendasPorKit.get(id);
    const limitante = componenteLimitante(comp, dados);
    return {
      idItem: id,
      sku: r.sku_customizado || r.sku_core,
      nome: r.nome_comercial || r.nome_item,
      status: String(r.status || '').toUpperCase(),
      categoriaId: r.categoria_id ? Number(r.categoria_id) : null,
      categoria: r.categoria_nome || '',
      precoCadastro,
      precoPdv,
      temFaixas: faixas.some(x => x.precoUnitario > 0),
      custo,
      custoGravado: Number(r.custo_gerencial) || 0,
      ...margemDoKit(precoPdv, custo),
      estoquePossivel: estoqueDoKit(comp, dados),
      limitante: limitante ? (dados.get(limitante)?.nome || null) : null,
      componentes: comp.map(c => paraComponente(c, dados.get(c.idItem))),
      vendidos: Number(v?.qtd) || 0,
      faturamento: Number(v?.total) || 0,
      custoVendido: Number(v?.custo_vendido) || 0,
      vendas: Number(v?.vendas) || 0,
      ultimaVenda: v?.ultima || null,
    };
  }).sort((a, b) => b.vendidos - a.vendidos || a.nome.localeCompare(b.nome));
};

/** GET /api/catalogo/kits?dias=90 */
export const listarKits = async (req: Request, res: Response) => {
  try {
    const tenant = tenantDe(req);
    return res.json(await montarKits(pool as any, tenant, await idsDosKits(pool as any, tenant), diasDe(req)));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar os kits.');
  }
};

/** GET /api/catalogo/kits/:idItem */
export const detalheKit = async (req: Request, res: Response) => {
  try {
    const [kit] = await montarKits(pool as any, tenantDe(req), [Number(req.params.idItem)], diasDe(req));
    if (!kit || kit.componentes.length === 0) throw new ErroKit('Kit não encontrado.', 404);
    return res.json(kit);
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar o kit.');
  }
};

/** Confere os componentes no banco: existem, estão ativos, são de venda e nenhum é kit. */
const validarComponentes = async (conn: Conn, tenant: number, entrada: any[], idKit: number | null) => {
  const ids = (Array.isArray(entrada) ? entrada : []).map(c => Number(c?.idItem)).filter(id => id > 0);
  const kits = await carregarComposicoes(conn, tenant, ids);
  const componentes = normalizarComponentes(entrada, idKit, id => kits.has(id));
  const dados = await carregarDadosComponentes(conn, tenant, componentes.map(c => c.idItem));
  for (const c of componentes) {
    const d = dados.get(c.idItem);
    if (!d) throw new ErroKit(`Item ${c.idItem} não encontrado.`, 404);
    if (!['PRODUTO', 'SERVICO'].includes(d.tipoRecurso)) throw new ErroKit(`"${d.nome}" não é produto nem serviço de venda.`);
  }
  return { componentes, dados };
};

const conferirSku = async (conn: Conn, tenant: number, sku: string, idItem: number | null) => {
  if (sku.length > 60) throw new ErroKit('SKU muito longo (máx. 60).');
  if (skuNoFormatoReservado(sku)) throw new ErroKit('Esse formato de SKU é reservado às sequências do sistema (IT-/CON-/ATV-000123).');
  const [[dup]]: any = await conn.execute(
    `SELECT id_item FROM comercial_produtos_dados WHERE tenant_id = ? AND UPPER(sku_customizado) = ? AND id_item <> ? LIMIT 1`,
    [tenant, sku.toUpperCase(), idItem || 0]
  );
  if (dup) throw new ErroKit(`O SKU ${sku} já é de outro item (${dup.id_item}).`, 409);
};

const gravarComposicao = async (conn: Conn, tenant: number, idKit: number, componentes: ComponenteKit[]) => {
  await conn.execute(`DELETE FROM itens_composicoes WHERE tenant_id = ? AND id_item_pai = ? AND tipo_relacao = '${TIPO_KIT}'`, [tenant, idKit]);
  for (const c of componentes) {
    await conn.execute(
      `INSERT INTO itens_composicoes (tenant_id, id_item_pai, id_item_filho, quantidade, tipo_relacao) VALUES (?, ?, ?, ?, '${TIPO_KIT}')`,
      [tenant, idKit, c.idItem, f4(c.quantidade)]
    );
  }
};

const textoOuNulo = (v: unknown, max: number) => {
  const t = String(v ?? '').trim();
  return t ? t.slice(0, max) : null;
};

/**
 * POST /api/catalogo/kits
 * { nome, sku?, precoVenda?, categoriaId?, componentes: [{ idItem, quantidade }], idItemExistente? }
 * Sem idItemExistente cria o item do kit (unidade KIT); com ele, transforma um item já cadastrado (sem saldo) em kit.
 */
export const criarKit = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const conn = connection as any as Conn;
    const idExistente = Number(req.body?.idItemExistente) || null;
    const { componentes, dados } = await validarComponentes(conn, tenant, req.body?.componentes, idExistente);
    const custo = custoDoKit(componentes, dados);
    const preco = req.body?.precoVenda === undefined || req.body?.precoVenda === null || req.body?.precoVenda === '' ? null : Number(req.body.precoVenda);
    if (preco !== null && (!Number.isFinite(preco) || preco < 0)) throw new ErroKit('Preço de venda inválido.');
    const categoriaId = Number(req.body?.categoriaId) || null;
    let sku = textoOuNulo(req.body?.sku, 60)?.toUpperCase() || null;

    let idKit: number;
    if (idExistente) {
      const [[item]]: any = await conn.execute(
        `SELECT ic.id_item, ic.tipo_recurso, COALESCE(es.quantidade_atual, 0) AS saldo
         FROM itens_core ic
         LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'
         WHERE ic.id_item = ? AND ic.tenant_id = ?`,
        [idExistente, tenant]
      );
      if (!item) throw new ErroKit('Item não encontrado.', 404);
      if (String(item.tipo_recurso).toUpperCase() !== 'PRODUTO') throw new ErroKit('Só um produto de venda pode virar kit.');
      if (Number(item.saldo) > 0) throw new ErroKit('Esse item tem saldo em estoque: o kit não tem estoque próprio. Zere o saldo (ajuste) antes de transformar em kit.', 409);
      const jaKit = await carregarComposicoes(conn, tenant, [idExistente]);
      if (jaKit.has(idExistente)) throw new ErroKit('Esse item já é um kit.', 409);
      idKit = idExistente;
      if (sku) await conferirSku(conn, tenant, sku, idKit);
      await conn.execute(
        `INSERT INTO comercial_produtos_dados (tenant_id, id_item, sku_customizado, nome_comercial, custo_gerencial, preco_venda, categoria_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE sku_customizado = COALESCE(VALUES(sku_customizado), sku_customizado),
           nome_comercial = COALESCE(VALUES(nome_comercial), nome_comercial), custo_gerencial = VALUES(custo_gerencial),
           preco_venda = COALESCE(VALUES(preco_venda), preco_venda), categoria_id = COALESCE(VALUES(categoria_id), categoria_id)`,
        [tenant, idKit, sku, textoOuNulo(req.body?.nome, 255), f4(custo), preco === null ? null : f4(preco), categoriaId]
      );
    } else {
      const nome = textoOuNulo(req.body?.nome, 255);
      if (!nome) throw new ErroKit('Dê um nome ao kit.');
      if (sku) await conferirSku(conn, tenant, sku, null);
      const idUnidade = await obterOuCriarUnidade(conn as any, tenant, 'KIT', 'Kit');
      const [novo]: any = await conn.execute(
        `INSERT INTO itens_core (tenant_id, sku, nome_item, tipo_recurso, status, id_unidade, descricao_variacao)
         VALUES (?, ?, ?, 'PRODUTO', 'ATIVO', ?, 'Principal')`,
        [tenant, `TMP-KIT-${Date.now()}`, nome, idUnidade]
      );
      idKit = Number(novo.insertId);
      await conn.execute(`UPDATE itens_core SET sku = ? WHERE id_item = ?`, [skuSequencial('IT', idKit), idKit]);
      if (!sku) {
        sku = skuSugeridoKit(idKit);
        await conferirSku(conn, tenant, sku, idKit);
      }
      await conn.execute(
        `INSERT INTO comercial_produtos_dados (tenant_id, id_item, sku_customizado, nome_comercial, categoria_id, custo_gerencial, preco_venda)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tenant, idKit, sku, nome, categoriaId, f4(custo), f4(preco ?? 0)]
      );
    }
    await gravarComposicao(conn, tenant, idKit, componentes);
    await connection.commit();
    const [kit] = await montarKits(pool as any, tenant, [idKit], 90);
    return res.status(201).json(kit);
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao criar o kit.');
  } finally {
    connection.release();
  }
};

/** PUT /api/catalogo/kits/:idItem { nome?, sku?, precoVenda?, categoriaId?, componentes? } */
export const atualizarKit = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idKit = Number(req.params.idItem);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const conn = connection as any as Conn;
    const atual = await carregarComposicoes(conn, tenant, [idKit]);
    if (!atual.has(idKit)) throw new ErroKit('Kit não encontrado.', 404);

    let componentes = atual.get(idKit)!;
    if (req.body?.componentes !== undefined) {
      componentes = (await validarComponentes(conn, tenant, req.body.componentes, idKit)).componentes;
      await gravarComposicao(conn, tenant, idKit, componentes);
    }
    const dados = await carregarDadosComponentes(conn, tenant, componentes.map(c => c.idItem));
    const sets: string[] = ['custo_gerencial = ?'];
    const valores: any[] = [f4(custoDoKit(componentes, dados))];
    if (req.body?.nome !== undefined) {
      const nome = textoOuNulo(req.body.nome, 255);
      if (!nome) throw new ErroKit('Dê um nome ao kit.');
      sets.push('nome_comercial = ?');
      valores.push(nome);
    }
    if (req.body?.sku !== undefined) {
      const sku = textoOuNulo(req.body.sku, 60)?.toUpperCase();
      if (!sku) throw new ErroKit('Informe o SKU do kit.');
      await conferirSku(conn, tenant, sku, idKit);
      sets.push('sku_customizado = ?');
      valores.push(sku);
    }
    if (req.body?.precoVenda !== undefined && req.body?.precoVenda !== null && req.body?.precoVenda !== '') {
      const preco = Number(req.body.precoVenda);
      if (!Number.isFinite(preco) || preco < 0) throw new ErroKit('Preço de venda inválido.');
      sets.push('preco_venda = ?');
      valores.push(f4(preco));
    }
    if (req.body?.categoriaId !== undefined) {
      sets.push('categoria_id = ?');
      valores.push(Number(req.body.categoriaId) || null);
    }
    await conn.execute(
      `INSERT INTO comercial_produtos_dados (tenant_id, id_item) VALUES (?, ?) ON DUPLICATE KEY UPDATE id_item = id_item`,
      [tenant, idKit]
    );
    await conn.execute(`UPDATE comercial_produtos_dados SET ${sets.join(', ')} WHERE tenant_id = ? AND id_item = ?`, [...valores, tenant, idKit]);
    await connection.commit();
    const [kit] = await montarKits(pool as any, tenant, [idKit], diasDe(req));
    return res.json(kit);
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao salvar o kit.');
  } finally {
    connection.release();
  }
};

/**
 * DELETE /api/catalogo/kits/:idItem — desfaz o kit: apaga a composição e inativa o item
 * (as vendas antigas continuam certas: o cancelamento/devolução usa as saídas gravadas na venda).
 */
export const desfazerKit = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const idKit = Number(req.params.idItem);
  try {
    const [r]: any = await pool.execute(
      `DELETE FROM itens_composicoes WHERE tenant_id = ? AND id_item_pai = ? AND tipo_relacao = '${TIPO_KIT}'`, [tenant, idKit]
    );
    if (!r.affectedRows) throw new ErroKit('Kit não encontrado.', 404);
    await pool.execute(`UPDATE itens_core SET status = 'INATIVO' WHERE tenant_id = ? AND id_item = ?`, [tenant, idKit]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao desfazer o kit.');
  }
};

/** POST /api/catalogo/kits/atualizar-custos — grava no cadastro (custo gerencial) o custo atual de cada kit */
export const atualizarCustosKits = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const ids = await idsDosKits(pool as any, tenant);
    const composicoes = await carregarComposicoes(pool as any, tenant, ids);
    const dados = await carregarDadosComponentes(pool as any, tenant, [...composicoes.values()].flat().map(c => c.idItem));
    let alterados = 0;
    for (const [idKit, comp] of composicoes) {
      const [r]: any = await pool.execute(
        `UPDATE comercial_produtos_dados SET custo_gerencial = ? WHERE tenant_id = ? AND id_item = ? AND ABS(COALESCE(custo_gerencial, 0) - ?) >= 0.0001`,
        [f4(custoDoKit(comp, dados)), tenant, idKit, f4(custoDoKit(comp, dados))]
      );
      alterados += Number(r.affectedRows) || 0;
    }
    return res.json({ success: true, kits: composicoes.size, alterados });
  } catch (error) {
    return responderErro(res, error, 'Erro ao atualizar os custos dos kits.');
  }
};

/**
 * GET /api/catalogo/kits/relatorio?dias=90
 * Kits mais vendidos no período e, por componente, quanto saiu pelos kits, saldo, cobertura em dias
 * e quantos kits ele trava (o que comprar).
 */
export const relatorioKits = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const dias = diasDe(req);
  try {
    const kits = await montarKits(pool as any, tenant, await idsDosKits(pool as any, tenant), dias);
    const [consumo]: any = await pool.execute(
      `SELECT m.id_item, SUM(m.quantidade) AS qtd, COUNT(DISTINCT m.id_origem) AS vendas
       FROM estoque_movimentos m
       INNER JOIN vendas_pedidos_itens vi ON vi.id_venda_item = m.id_origem_item AND vi.id_venda = m.id_origem
       INNER JOIN vendas_pedidos v ON v.id_venda = vi.id_venda
       WHERE m.tenant_id = ? AND m.origem = ? AND m.tipo_movimento = 'SAIDA' AND m.id_item <> vi.id_item
         AND v.status = 'CONCLUIDA' AND v.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY m.id_item`,
      [tenant, ORIGEM_VENDA_PDV, dias]
    );
    const consumoPorItem = new Map<number, any>(consumo.map((c: any) => [Number(c.id_item), c]));

    // Componentes de todos os kits (mesmo os sem venda no período) + os que saíram por kits já desfeitos
    const porComponente = new Map<number, { kits: string[]; travaKits: string[] }>();
    for (const k of kits) {
      for (const c of k.componentes) {
        if (!porComponente.has(c.idItem)) porComponente.set(c.idItem, { kits: [], travaKits: [] });
        porComponente.get(c.idItem)!.kits.push(k.sku);
        if (k.estoquePossivel === 0 && !c.servico && c.saldo < c.quantidade) porComponente.get(c.idItem)!.travaKits.push(k.sku);
      }
    }
    for (const id of consumoPorItem.keys()) if (!porComponente.has(id)) porComponente.set(id, { kits: [], travaKits: [] });
    const dados = await carregarDadosComponentes(pool as any, tenant, [...porComponente.keys()]);

    const componentes = [...porComponente.entries()].map(([idItem, uso]) => {
      const d = dados.get(idItem);
      const consumido = Number(consumoPorItem.get(idItem)?.qtd) || 0;
      return {
        idItem,
        nome: d?.nome || `Item ${idItem}`,
        sku: d?.sku || '',
        unidade: d?.sigla || '',
        servico: Boolean(d?.servico),
        saldo: d?.saldo ?? 0,
        custo: d?.custo ?? 0,
        consumido,
        vendas: Number(consumoPorItem.get(idItem)?.vendas) || 0,
        consumoMensal: Math.round((consumido / dias) * 30 * 100) / 100,
        diasCobertura: diasDeCobertura(d?.saldo ?? 0, consumido, dias),
        kits: uso.kits,
        travaKits: uso.travaKits,
      };
    }).filter(c => !c.servico)
      .sort((a, b) => b.travaKits.length - a.travaKits.length
        || (a.diasCobertura ?? Infinity) - (b.diasCobertura ?? Infinity)
        || b.consumido - a.consumido);

    return res.json({
      dias,
      kits: kits.map(k => ({
        idItem: k.idItem, sku: k.sku, nome: k.nome, vendidos: k.vendidos, vendas: k.vendas, faturamento: k.faturamento,
        custo: k.custo, lucroEstimado: Math.round((k.faturamento - k.custoVendido) * 100) / 100,
        estoquePossivel: k.estoquePossivel, ultimaVenda: k.ultimaVenda,
      })),
      componentes,
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao montar o relatório de kits.');
  }
};
