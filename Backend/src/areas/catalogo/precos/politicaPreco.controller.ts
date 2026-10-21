// Varejo e atacado em lote: escolhe os itens (categoria com as subcategorias, famílias, marca, busca), mostra o que a
// política faz em cada um (prévia) e grava as faixas da unidade base. A prévia e a gravação usam a mesma conta.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { carregarTaxaPreco } from '../../vendas/taxas/taxas.controller';
import { alvoEfetivo } from '../../compras/inteligente/margemAlvo';
import { temTaxaEmbutida } from './taxaEmbutida';
import { margemLiquida } from './precificacao';
import { ErroPolitica, ItemPolitica, planejarPolitica, Politica, validarPolitica } from './politicaPreco';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const ALVO_PADRAO = 30;
const MAX_ITENS = 500;
const lista = (n: number) => Array(n).fill('?').join(',');

interface Filtro { idCategoria?: number | null; idsFamilias?: number[]; idMarca?: number | null; busca?: string }
interface ItemCarregado extends ItemPolitica {
  idItem: number; sku: string; nome: string; familia: string | null; marca: string | null; idUnidade: number | null; unidade: string | null;
  alvoPct: number; idFaixaVarejo: number | null;
}

const erro = (res: Response, e: any, padrao: string) => {
  if (e instanceof ErroPolitica) return res.status(400).json({ error: e.message });
  console.error(padrao, e);
  return res.status(500).json({ error: padrao, details: e?.message });
};

/** A categoria e todas as que estão abaixo dela. */
const comSubcategorias = async (conn: any, tenant: number, id: number) => {
  const [cats]: any = await conn.execute(`SELECT id, categoria_pai_id FROM comercial_categorias WHERE tenant_id = ?`, [tenant]);
  const filhos = new Map<number, number[]>();
  for (const c of cats) {
    const pai = Number(c.categoria_pai_id) || 0;
    if (!filhos.has(pai)) filhos.set(pai, []);
    filhos.get(pai)!.push(Number(c.id));
  }
  const saida = new Set<number>([id]);
  const fila = [id];
  while (fila.length) for (const f of filhos.get(fila.shift()!) || []) if (!saida.has(f)) { saida.add(f); fila.push(f); }
  return [...saida];
};

/** Itens do filtro (ou dos ids) com o custo, o alvo e as faixas da unidade base. */
const carregarItens = async (conn: any, tenant: number, filtro: Filtro, ids?: number[], trava = false): Promise<ItemCarregado[]> => {
  const where = [`ic.tenant_id = ?`, `UPPER(COALESCE(ic.status, 'ATIVO')) <> 'INATIVO'`, `UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) = 'PRODUTO'`];
  const params: any[] = [tenant];
  if (ids) { where.push(`ic.id_item IN (${lista(ids.length)})`); params.push(...ids); }
  else {
    if (filtro.idCategoria) {
      const cats = await comSubcategorias(conn, tenant, Number(filtro.idCategoria));
      where.push(`COALESCE(f.categoria_id, cpd.categoria_id) IN (${lista(cats.length)})`); params.push(...cats);
    }
    const fams = (filtro.idsFamilias || []).map(Number).filter(n => n > 0);
    if (fams.length) { where.push(`cpd.familia_id IN (${lista(fams.length)})`); params.push(...fams); }
    if (filtro.idMarca) { where.push(`COALESCE(cpd.id_marca, f.id_marca) = ?`); params.push(Number(filtro.idMarca)); }
    const busca = String(filtro.busca || '').trim();
    if (busca) {
      where.push(`(ic.sku LIKE ? OR cpd.sku_customizado LIKE ? OR ic.nome_item LIKE ? OR cpd.nome_comercial LIKE ? OR f.nome LIKE ?)`);
      params.push(...Array(5).fill(`%${busca}%`));
    }
    if (!filtro.idCategoria && !fams.length && !filtro.idMarca && !busca) throw new ErroPolitica('Escolha uma categoria, família, marca ou digite uma busca.');
  }
  const [itens]: any = await conn.execute(
    `SELECT ic.id_item, COALESCE(cpd.sku_customizado, ic.sku) AS sku, COALESCE(cpd.nome_comercial, ic.nome_item) AS nome,
            f.nome AS familia, COALESCE(mi.nome, mf.nome) AS marca, ic.id_unidade, um.sigla AS unidade, cpd.custo_gerencial, f.margem_minima
     FROM itens_core ic
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
     LEFT JOIN comercial_marcas mi ON mi.id = cpd.id_marca
     LEFT JOIN comercial_marcas mf ON mf.id = f.id_marca
     LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
     WHERE ${where.join(' AND ')}
     ORDER BY f.nome, nome LIMIT ${MAX_ITENS + 1}
     ${trava ? 'FOR UPDATE' : ''}`,
    params
  );
  if (itens.length > MAX_ITENS) throw new ErroPolitica(`O filtro trouxe mais de ${MAX_ITENS} itens: restrinja (família, categoria ou busca).`);
  const idsItens = itens.map((i: any) => Number(i.id_item));
  const [faixas]: any = idsItens.length
    ? await conn.execute(
      `SELECT f.id_faixa, f.id_item, f.id_unidade, f.tipo_faixa, f.ordem, f.quantidade_minima, f.markup, f.preco_unitario
       FROM comercial_precos_faixas f INNER JOIN itens_core ic ON ic.id_item = f.id_item AND ic.id_unidade = f.id_unidade
       WHERE f.tenant_id = ? AND f.id_item IN (${lista(idsItens.length)}) ORDER BY f.ordem`,
      [tenant, ...idsItens])
    : [[]];
  return itens.map((i: any) => {
    const doItem = faixas.filter((f: any) => Number(f.id_item) === Number(i.id_item));
    const varejo = doItem.find((f: any) => f.tipo_faixa === 'VAREJO');
    const politica: ItemPolitica = {
      custo: i.custo_gerencial === null ? null : Number(i.custo_gerencial),
      varejoAtual: varejo ? { markup: Number(varejo.markup), preco: Number(varejo.preco_unitario) } : null,
      atacadoAtual: doItem.filter((f: any) => f.tipo_faixa === 'ATACADO')
        .map((f: any) => ({ quantidade: Number(f.quantidade_minima), markup: Number(f.markup), preco: Number(f.preco_unitario) }))
        .sort((a: any, b: any) => a.quantidade - b.quantidade),
    };
    return {
      idItem: Number(i.id_item), sku: i.sku, nome: i.nome, familia: i.familia || null, marca: i.marca || null,
      idUnidade: i.id_unidade ? Number(i.id_unidade) : null, unidade: i.unidade || null,
      alvoPct: alvoEfetivo(i.margem_minima === null ? null : Number(i.margem_minima), ALVO_PADRAO).alvoPct,
      idFaixaVarejo: varejo ? Number(varejo.id_faixa) : null,
      ...politica,
    };
  });
};

const lerPolitica = (b: any): Politica => {
  const p = b?.politica as Politica;
  if (!p?.varejo || !p?.atacado) throw new ErroPolitica('Defina a política de preço.');
  validarPolitica(p);
  return p;
};

const planejar = (itens: ItemCarregado[], p: Politica, taxa: { fator: number; percentual: number }) =>
  itens.map(i => {
    const plano = i.idUnidade
      ? planejarPolitica(i, p, { fatorTaxa: taxa.fator, taxaPct: taxa.percentual, alvoPct: i.alvoPct })
      : { situacao: 'ERRO' as const, erro: 'Item sem unidade base: ajuste no cadastro.', avisos: [], faixas: [], mexeNoAtacado: false };
    return { ...i, plano };
  });

// GET /api/catalogo/precos/politica/opcoes — categorias, famílias e marcas para o filtro
export const opcoesPolitica = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [categorias]: any = await pool.execute(`SELECT id, nome, categoria_pai_id FROM comercial_categorias WHERE tenant_id = ? AND ativa = 1 ORDER BY nome`, [tenant]);
    const [familias]: any = await pool.execute(
      `SELECT f.id, f.nome, COUNT(cpd.id_item) AS itens FROM comercial_familias f
       LEFT JOIN comercial_produtos_dados cpd ON cpd.familia_id = f.id AND cpd.tenant_id = f.tenant_id
       WHERE f.tenant_id = ? AND f.status <> 'INATIVO' GROUP BY f.id, f.nome ORDER BY f.nome`, [tenant]);
    const [marcas]: any = await pool.execute(`SELECT id, nome FROM comercial_marcas ORDER BY nome`);
    return res.json({
      categorias: categorias.map((c: any) => ({ id: Number(c.id), nome: c.nome, idPai: c.categoria_pai_id ? Number(c.categoria_pai_id) : null })),
      familias: familias.map((f: any) => ({ id: Number(f.id), nome: f.nome, itens: Number(f.itens) || 0 })),
      marcas: marcas.map((m: any) => ({ id: Number(m.id), nome: m.nome })),
    });
  } catch (e) { return erro(res, e, 'Erro ao carregar as opções do filtro.'); }
};

// POST /api/catalogo/precos/politica/previa { filtro, politica } — o que muda em cada item (nada é gravado)
export const previaPolitica = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const p = lerPolitica(req.body);
    const taxa = await carregarTaxaPreco(pool as any, tenant);
    const itens = planejar(await carregarItens(pool, tenant, req.body?.filtro || {}), p, taxa);
    return res.json({ taxaPct: taxa.percentual, itens });
  } catch (e) { return erro(res, e, 'Erro ao montar a prévia.'); }
};

// POST /api/catalogo/precos/politica/aplicar { idsItens, politica } — grava as faixas da unidade base (recalcula antes)
export const aplicarPolitica = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const ids = [...new Set<number>((req.body?.idsItens || []).map(Number).filter((n: number) => n > 0))];
  const conn: any = await pool.getConnection();
  try {
    const p = lerPolitica(req.body);
    if (!ids.length) throw new ErroPolitica('Nenhum item para aplicar.');
    if (ids.length > MAX_ITENS) throw new ErroPolitica(`No máximo ${MAX_ITENS} itens por vez.`);
    await conn.beginTransaction();
    const taxa = await carregarTaxaPreco(conn, tenant);
    const temColuna = await temTaxaEmbutida(conn);
    const planos = planejar(await carregarItens(conn, tenant, {}, ids, true), p, taxa);
    let alterados = 0;
    const ignorados: { idItem: number; sku: string; motivo: string }[] = [];
    for (const i of planos) {
      if (i.plano.situacao === 'ERRO') { ignorados.push({ idItem: i.idItem, sku: i.sku, motivo: i.plano.erro || 'erro' }); continue; }
      if (i.plano.situacao === 'IGUAL') continue;
      const temAtacado = i.plano.faixas.some(f => f.tipo === 'ATACADO');
      const varejo = i.plano.faixas.find(f => f.tipo === 'VAREJO')!;
      await conn.execute(
        `INSERT INTO comercial_unidades_venda (tenant_id, id_item, id_unidade, permite_venda, permite_atacado, markup_varejo, padrao_pdv)
         VALUES (?, ?, ?, 1, ?, ?, 1)
         ON DUPLICATE KEY UPDATE permite_atacado = VALUES(permite_atacado), markup_varejo = VALUES(markup_varejo)`,
        [tenant, i.idItem, i.idUnidade, temAtacado ? 1 : 0, varejo.markup]
      );
      const gravarFaixa = (f: typeof varejo) => conn.execute(
        temColuna
          ? `INSERT INTO comercial_precos_faixas (tenant_id, id_item, id_unidade, tipo_faixa, ordem, quantidade_minima, quantidade_maxima, markup, preco_unitario, taxa_embutida)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          : `INSERT INTO comercial_precos_faixas (tenant_id, id_item, id_unidade, tipo_faixa, ordem, quantidade_minima, quantidade_maxima, markup, preco_unitario)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenant, i.idItem, i.idUnidade, f.tipo, f.ordem, f.quantidadeMinima, f.quantidadeMaxima, f.markup, f.preco, ...(temColuna ? [taxa.percentual] : [])]
      );
      // varejo: atualiza a faixa que existe (ou cria)
      if (i.idFaixaVarejo) {
        await conn.execute(
          temColuna
            ? `UPDATE comercial_precos_faixas SET markup = ?, preco_unitario = ?, quantidade_minima = 0, quantidade_maxima = ?, taxa_embutida = ? WHERE id_faixa = ?`
            : `UPDATE comercial_precos_faixas SET markup = ?, preco_unitario = ?, quantidade_minima = 0, quantidade_maxima = ? WHERE id_faixa = ?`,
          [varejo.markup, varejo.preco, varejo.quantidadeMaxima, ...(temColuna ? [taxa.percentual] : []), i.idFaixaVarejo]
        );
      } else {
        await gravarFaixa(varejo);
      }
      // atacado: troca os níveis da unidade base pelos da política
      if (i.plano.mexeNoAtacado) {
        await conn.execute(`DELETE FROM comercial_precos_faixas WHERE tenant_id = ? AND id_item = ? AND id_unidade = ? AND tipo_faixa = 'ATACADO'`, [tenant, i.idItem, i.idUnidade]);
        for (const f of i.plano.faixas.filter(x => x.tipo === 'ATACADO')) await gravarFaixa(f);
      }
      // preço de referência (telas antigas): quando a base é a unidade do PDV
      const [[uv]]: any = await conn.execute(
        `SELECT COALESCE(MAX(CASE WHEN padrao_pdv = 1 AND id_unidade <> ? THEN 1 END), 0) AS outra_padrao FROM comercial_unidades_venda WHERE tenant_id = ? AND id_item = ?`,
        [i.idUnidade, tenant, i.idItem]
      );
      if (!Number(uv?.outra_padrao)) {
        await conn.execute(
          `UPDATE comercial_produtos_dados SET preco_venda = ?, margem_lucro = ? WHERE id_item = ? AND tenant_id = ?`,
          [varejo.preco, margemLiquida(varejo.preco, Number(i.custo), taxa.percentual), i.idItem, tenant]
        );
      }
      alterados++;
    }
    await conn.commit();
    return res.json({ alterados, iguais: planos.filter(x => x.plano.situacao === 'IGUAL').length, ignorados });
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    return erro(res, e, 'Erro ao aplicar a política de preço.');
  } finally {
    conn.release();
  }
};
