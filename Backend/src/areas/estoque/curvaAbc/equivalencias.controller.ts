// Equivalentes (Estoque › Marcas e equivalentes): grupos de itens que servem para a mesma coisa (atributos marcados como
// "define equivalência"), quem vende e quem trava, demanda por valor de atributo, giro por marca, atributos e pendências.
// Também grava a decisão de compra do item (PREFERIDO / NAO_RECOMPRAR). Regras em equivalencias.ts.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { carregarCurva, PERIODOS } from './curvaAbc.controller';
import { carregarMargensNegociacao } from '../../vendas/regras/regrasVenda.controller';
import { analisarGrupo, demandaPorAtributo, giroPorMarca, ItemEquivalencia, montarGrupos, normalizarValor } from './equivalencias';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const operadorDe = (req: Request) => String(req.body?.operador || req.query.operador || '').trim().slice(0, 60) || 'ADM';
const n = (v: unknown) => Number(v) || 0;
const limpo = (s: unknown) => String(s ?? '').replace(/^[^\p{L}\p{N}]+/u, '').trim();

/** Grupos de equivalentes, demanda por atributo, giro por marca, atributos e pendências (relatório e sugestão de compra). */
export const montarEquivalencias = async (tenant: number, dias: number, curvaPronta?: Awaited<ReturnType<typeof carregarCurva>>) => {
  {
    const [curva, margens, [extras], [atributos], [valores], [uso]]: any = await Promise.all([
      curvaPronta ?? carregarCurva(tenant, dias),
      carregarMargensNegociacao(pool, tenant),
      pool.execute(
        `SELECT cpd.id_item, COALESCE(f.categoria_id, cpd.categoria_id) AS categoria_id, cat.nome AS categoria, mar.nome AS marca, f.nome AS familia,
                cpd.decisao_compra, cpd.decisao_compra_motivo, DATE_FORMAT(cpd.decisao_compra_em, '%Y-%m-%d') AS decisao_em, cpd.decisao_compra_por
         FROM comercial_produtos_dados cpd
         LEFT JOIN comercial_familias f ON f.id = cpd.familia_id
         LEFT JOIN comercial_categorias cat ON cat.id = COALESCE(f.categoria_id, cpd.categoria_id)
         LEFT JOIN comercial_marcas mar ON mar.id = COALESCE(cpd.id_marca, f.id_marca)
         WHERE cpd.tenant_id = ?`, [tenant]),
      pool.execute(`SELECT id, nome, tipo, define_equivalencia FROM atributos_comercial WHERE tenant_id = ? AND ativo = 1 ORDER BY nome`, [tenant]),
      pool.execute(
        `SELECT v.id_entidade, v.atributo_id, COALESCE(NULLIF(v.valor_texto, ''), v.valor_decimal, v.valor_numero, o.valor) AS valor
         FROM atributos_comercial_valores v
         INNER JOIN atributos_comercial a ON a.id = v.atributo_id AND a.define_equivalencia = 1
         LEFT JOIN atributos_comercial_opcoes o ON o.id = v.opcao_id
         WHERE v.tenant_id = ? AND v.tipo_entidade = 'produto'`, [tenant]),
      pool.execute(
        `SELECT v.atributo_id, COUNT(DISTINCT v.id_entidade) AS itens,
                SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT COALESCE(NULLIF(v.valor_texto, ''), v.valor_decimal, v.valor_numero, o.valor) ORDER BY v.id SEPARATOR ' · '), ' · ', 4) AS exemplos
         FROM atributos_comercial_valores v LEFT JOIN atributos_comercial_opcoes o ON o.id = v.opcao_id
         WHERE v.tenant_id = ? AND v.tipo_entidade = 'produto' GROUP BY v.atributo_id`, [tenant]),
    ]);
    const extra = new Map<number, any>(extras.map((e: any) => [Number(e.id_item), e]));
    const nomes = new Map<number, string>(atributos.map((a: any) => [Number(a.id), a.nome]));
    const rotulos = new Map<string, string>();
    const atributosDoItem = new Map<number, Map<number, string>>();
    for (const v of valores) {
      if (v.valor === null || v.valor === undefined || String(v.valor).trim() === '') continue;
      const norm = normalizarValor(v.valor);
      rotulos.set(`${v.atributo_id}|${norm}`, String(v.valor).trim());
      const m = atributosDoItem.get(Number(v.id_entidade)) || new Map<number, string>();
      m.set(Number(v.atributo_id), norm);
      atributosDoItem.set(Number(v.id_entidade), m);
    }
    const itens: ItemEquivalencia[] = curva.itens.map((i: any) => {
      const e = extra.get(i.idItem) || {};
      return {
        idItem: i.idItem, sku: i.sku, nome: i.nome, categoriaId: e.categoria_id !== null && e.categoria_id !== undefined ? Number(e.categoria_id) : null,
        categoria: e.categoria ? limpo(e.categoria) : null, marca: e.marca && !/^sem\s*marca$/i.test(String(e.marca).trim()) ? e.marca : null, familia: e.familia || null, atributos: atributosDoItem.get(i.idItem) || new Map(),
        quantidade: i.quantidade, receita: i.receita, lucro: i.lucro, vendas: i.vendas, estoque: i.estoque, valorEstoque: i.valorEstoque,
        custoUnitario: i.custoUnitario, precoVenda: i.precoVenda, decisaoCompra: e.decisao_compra || null,
      };
    });
    const decisoes = new Map<number, any>(extras.filter((e: any) => e.decisao_compra).map((e: any) => [Number(e.id_item), e]));

    const grupos = montarGrupos(itens).map(g => {
      const a = analisarGrupo(g.itens, margens.margemMinimaNegociacao);
      const primeiro = g.itens[0];
      const valoresGrupo = [...primeiro.atributos.entries()].sort((x, y) => x[0] - y[0])
        .map(([id, v]) => ({ atributo: nomes.get(id) || `Atributo ${id}`, valor: rotulos.get(`${id}|${v}`) || v }));
      return {
        chave: g.chave, categoria: primeiro.categoria, valores: valoresGrupo,
        titulo: `${primeiro.categoria || 'Sem categoria'} · ${valoresGrupo.map(v => `${v.atributo} ${v.valor}`).join(' · ')}`,
        ...a,
        itens: a.itens.map(l => {
          const d = decisoes.get(l.idItem);
          return { ...l, decisaoMotivo: d?.decisao_compra_motivo || null, decisaoEm: d?.decisao_em || null, decisaoPor: d?.decisao_compra_por || null };
        }),
      };
    }).sort((x, y) => (y.alerta ? 1 : 0) - (x.alerta ? 1 : 0) || y.valorTravado - x.valorTravado || y.quantidadeVendida - x.quantidadeVendida);

    // Pendências: itens das categorias que têm grupos, sem marca ou sem os atributos de equivalência
    const categoriasComGrupo = new Set(grupos.map(g => g.chave.split('|')[0]));
    const pendencias = itens.filter(i => i.categoriaId !== null && categoriasComGrupo.has(String(i.categoriaId)) && (!i.marca || !i.atributos.size))
      .slice(0, 100).map(i => ({ idItem: i.idItem, sku: i.sku, nome: i.nome, categoria: i.categoria, falta: [!i.marca && 'marca', !i.atributos.size && 'atributo de equivalência'].filter(Boolean).join(' e ') }));
    const usoDe = new Map<number, any>(uso.map((u: any) => [Number(u.atributo_id), u]));

    return {
      dias, diasDeHistorico: curva.diasDeHistorico, margemMinima: margens.margemMinimaNegociacao,
      grupos,
      demanda: demandaPorAtributo(itens.filter(i => i.atributos.size), nomes, rotulos).slice(0, 60),
      marcas: giroPorMarca(itens),
      atributos: atributos.filter((a: any) => usoDe.has(Number(a.id))).map((a: any) => ({
        id: Number(a.id), nome: a.nome, tipo: a.tipo, define: Boolean(Number(a.define_equivalencia)),
        itens: Number(usoDe.get(Number(a.id))?.itens || 0), exemplos: usoDe.get(Number(a.id))?.exemplos || '',
      })).sort((x: any, y: any) => Number(y.define) - Number(x.define) || y.itens - x.itens),
      pendencias,
      itensSemMarca: itens.filter(i => !i.marca).length,
    };
  }
};

/** GET /api/estoque/equivalencias?dias=90 */
export const relatorioEquivalencias = async (req: Request, res: Response) => {
  try {
    const dias = PERIODOS.includes(Number(req.query.dias)) ? Number(req.query.dias) : 90;
    return res.json(await montarEquivalencias(tenantDe(req), dias));
  } catch (error: any) {
    console.error('Erro nas equivalências:', error);
    return res.status(500).json({ error: 'Erro ao montar os equivalentes.', details: error?.message });
  }
};

/** PUT /api/estoque/equivalencias/atributos/:id { define } — liga/desliga "define equivalência" no atributo. */
export const marcarAtributoEquivalencia = async (req: Request, res: Response) => {
  try {
    const [r]: any = await pool.execute(`UPDATE atributos_comercial SET define_equivalencia = ? WHERE id = ? AND tenant_id = ?`,
      [req.body?.define ? 1 : 0, Number(req.params.id), tenantDe(req)]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Atributo não encontrado.' });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao salvar o atributo.', details: error?.message });
  }
};

/** PUT /api/estoque/itens/:idItem/decisao-compra { decisao: PREFERIDO | NAO_RECOMPRAR | null, motivo } */
export const gravarDecisaoCompra = async (req: Request, res: Response) => {
  try {
    const decisao = req.body?.decisao ? String(req.body.decisao).toUpperCase() : null;
    if (decisao !== null && !['PREFERIDO', 'NAO_RECOMPRAR'].includes(decisao)) return res.status(400).json({ error: 'Decisão inválida (PREFERIDO ou NAO_RECOMPRAR).' });
    const motivo = String(req.body?.motivo || '').trim().slice(0, 150) || null;
    const [r]: any = await pool.execute(
      `UPDATE comercial_produtos_dados SET decisao_compra = ?, decisao_compra_motivo = ?, decisao_compra_em = ${decisao ? 'NOW()' : 'NULL'}, decisao_compra_por = ?
       WHERE id_item = ? AND tenant_id = ?`,
      [decisao, decisao ? motivo : null, decisao ? operadorDe(req) : null, Number(req.params.idItem), tenantDe(req)]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Item não encontrado.' });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao gravar a decisão.', details: error?.message });
  }
};
