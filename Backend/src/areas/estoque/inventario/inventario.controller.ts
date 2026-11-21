// Inventário rotativo (Estoque › Inventário rotativo): gera a lista do dia (uma área só), imprime, lança a contagem com o
// conferente e a hora, e ajusta o estoque pela diferença em relação ao saldo daquela hora. Regras em inventarioRotativo.ts.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { lancarMovimentoEstoque } from '../depositos';
import { carregarRegras } from '../../vendas/regras/regrasVenda.controller';
import { conferirSenha } from '../../vendas/regras/regrasVenda';
import {
  areaDaCategoria, avaliarDivergencia, Candidato, categoriaDoTopo, CONFIG_PADRAO, ConfigInventario, ErroInventario, escolherLista,
  motivoDoItem, saldoNaHora, Selecao, validarConfig,
} from './inventarioRotativo';
import { classesDeVenda } from '../curvaAbc/curvaAbc.controller';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const operadorDe = (req: Request) => String(req.body?.operador || req.query.operador || '').trim().slice(0, 60) || 'ADM';
const n = (v: unknown) => Number(v) || 0;
const f4 = (v: number) => Number(v || 0).toFixed(4);
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroInventario) return res.status(error.status).json({ error: error.message, detalhes: error.detalhes });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

// ------------------------------------------------------------------ leitura base

const carregarConfig = async (conn: any, tenant: number): Promise<ConfigInventario> => {
  const [[c]]: any = await conn.execute(`SELECT * FROM estoque_inventario_config WHERE tenant_id = ?`, [tenant]);
  if (!c) return CONFIG_PADRAO;
  return {
    itensPorDia: n(c.itens_por_dia) || CONFIG_PADRAO.itensPorDia, limiteDivergenciaValor: n(c.limite_divergencia_valor),
    limiteDivergenciaPct: n(c.limite_divergencia_pct), diasCurvaA: n(c.dias_curva_a) || 30, diasCurvaB: n(c.dias_curva_b) || 90, diasCurvaC: n(c.dias_curva_c) || 180,
  };
};

const carregarAreas = async (conn: any, tenant: number) => {
  const [areas]: any = await conn.execute(`SELECT id_area, nome, ordem, contar FROM estoque_inventario_areas WHERE tenant_id = ? ORDER BY ordem, nome`, [tenant]);
  const [mapa]: any = await conn.execute(`SELECT categoria_id, id_area FROM estoque_inventario_areas_categorias WHERE tenant_id = ?`, [tenant]);
  const [cats]: any = await conn.execute(`SELECT id, nome, categoria_pai_id FROM comercial_categorias WHERE tenant_id = ? ORDER BY nome`, [tenant]);
  return {
    areas: areas.map((a: any) => ({ id: Number(a.id_area), nome: a.nome, ordem: Number(a.ordem), contar: Boolean(Number(a.contar)),
      categorias: mapa.filter((m: any) => Number(m.id_area) === Number(a.id_area)).map((m: any) => Number(m.categoria_id)) })),
    mapa: new Map<number, number>(mapa.map((m: any) => [Number(m.categoria_id), Number(m.id_area)])),
    pais: new Map<number, number | null>(cats.map((c: any) => [Number(c.id), c.categoria_pai_id !== null ? Number(c.categoria_pai_id) : null])),
    categorias: cats.map((c: any) => ({ id: Number(c.id), nome: String(c.nome).replace(/^[^\p{L}\p{N}]+/u, '').trim(), pai: c.categoria_pai_id !== null ? Number(c.categoria_pai_id) : null })),
  };
};

/**
 * Candidatos do inventário: produtos ativos com saldo no depósito Venda (sem kit, fora de lista aberta, fora de área
 * "não contar"), com o grupo (área; sem área = categoria do topo) e o motivo de hoje. Itens sem motivo ficam de fora.
 */
const candidatosDeHoje = async (conn: any, tenant: number, cfg: ConfigInventario) => {
  const base = await carregarAreas(conn, tenant);
  const [rows]: any = await conn.execute(
    `SELECT ic.id_item, COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome, COALESCE(f.categoria_id, cpd.categoria_id) AS categoria_id,
            cat.nome AS categoria, es.quantidade_atual, es.custo_medio, es.ultimo_custo, cpd.custo_gerencial,
            DATE_FORMAT(es.ultima_contagem_em, '%Y-%m-%d') AS ultima, DATE_FORMAT(es.conferencia_pedida_em, '%Y-%m-%d') AS pedida, es.conferencia_motivo
     FROM itens_core ic
     INNER JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     LEFT JOIN comercial_familias f ON f.id = cpd.familia_id
     LEFT JOIN comercial_categorias cat ON cat.id = COALESCE(f.categoria_id, cpd.categoria_id)
     WHERE ic.tenant_id = ? AND ic.status = 'ATIVO' AND UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) = 'PRODUTO'
       AND NOT EXISTS (SELECT 1 FROM itens_composicoes k WHERE k.id_item_pai = ic.id_item AND k.tenant_id = ic.tenant_id)
       AND NOT EXISTS (SELECT 1 FROM estoque_inventarios_itens ii INNER JOIN estoque_inventarios li ON li.id_inventario = ii.id_inventario
                       WHERE ii.id_item = ic.id_item AND li.status = 'ABERTA' AND li.tenant_id = ic.tenant_id)`,
    [tenant]
  );
  // Curva de venda dos últimos 90 dias (Estoque › Curva ABC); quem não vendeu é C
  const curvas = await classesDeVenda(conn, tenant, 90);
  const areas = new Map<number, { nome: string; contar: boolean; ordem: number }>(base.areas.map((a: any) => [a.id, a]));
  const nomeCat = new Map<number, string>(base.categorias.map((c: any) => [c.id, c.nome]));
  const hoje = hojeIso();
  const grupos = new Map<string, { grupo: string; nome: string; idArea: number | null; ordem: number }>();
  const lista: Array<Candidato & Selecao> = [];
  for (const r of rows) {
    const idCat = r.categoria_id !== null ? Number(r.categoria_id) : null;
    const idArea = areaDaCategoria(idCat, base.pais, base.mapa);
    if (idArea !== null && areas.get(idArea) && !areas.get(idArea)!.contar) continue;
    const topo = idArea === null ? categoriaDoTopo(idCat, base.pais) : null;
    const grupo = idArea !== null ? `area:${idArea}` : topo !== null ? `cat:${topo}` : 'sem';
    if (!grupos.has(grupo)) {
      grupos.set(grupo, idArea !== null
        ? { grupo, nome: areas.get(idArea)!.nome, idArea, ordem: areas.get(idArea)!.ordem }
        : { grupo, nome: topo !== null ? `Sem área · ${nomeCat.get(topo) || 'categoria'}` : 'Sem área · sem categoria', idArea: null, ordem: 1000 });
    }
    const c: Candidato = {
      idItem: Number(r.id_item), grupo, nome: r.nome, categoria: r.categoria ? String(r.categoria).replace(/^[^\p{L}\p{N}]+/u, '').trim() : null,
      curva: curvas.get(Number(r.id_item)) || 'C', saldo: n(r.quantidade_atual), custoMedio: n(r.custo_medio), custoGerencial: n(r.custo_gerencial),
      ultimoCusto: n(r.ultimo_custo), ultimaContagem: r.ultima, pedidaEm: r.pedida, pedidoMotivo: r.conferencia_motivo,
    };
    const sel = motivoDoItem(c, hoje, cfg);
    if (sel) lista.push({ ...c, ...sel });
  }
  return { candidatos: lista, grupos, base };
};

// ------------------------------------------------------------------ painel

/** GET /api/estoque/inventario — configuração, áreas, grupos com itens devidos, listas abertas, pedidos, indicadores. */
export const painelInventario = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const cfg = await carregarConfig(pool, tenant);
    const { candidatos, grupos, base } = await candidatosDeHoje(pool, tenant, cfg);
    const porGrupo = [...grupos.values()].map(g => {
      const itens = candidatos.filter(c => c.grupo === g.grupo);
      return { ...g, devidos: itens.length, pedidos: itens.filter(i => i.motivo === 'PEDIDO').length, problemas: itens.filter(i => i.motivo === 'PROBLEMA').length,
        urgencia: itens.length ? Math.max(...itens.map(i => i.peso)) : 0 };
    }).filter(g => g.devidos > 0).sort((a, b) => b.urgencia - a.urgencia || a.ordem - b.ordem);
    const [abertas]: any = await pool.execute(
      `SELECT i.id_inventario, i.id_area, i.observacao, i.operador, DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i') AS criada, a.nome AS area,
              (SELECT COUNT(*) FROM estoque_inventarios_itens x WHERE x.id_inventario = i.id_inventario) AS itens
       FROM estoque_inventarios i LEFT JOIN estoque_inventario_areas a ON a.id_area = i.id_area
       WHERE i.tenant_id = ? AND i.status = 'ABERTA' ORDER BY i.id_inventario DESC`, [tenant]);
    const [pedidos]: any = await pool.execute(
      `SELECT es.id_item, COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome, COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku,
              es.conferencia_motivo, DATE_FORMAT(es.conferencia_pedida_em, '%Y-%m-%d') AS pedida
       FROM estoque_saldos_itens es INNER JOIN itens_core ic ON ic.id_item = es.id_item
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = es.id_item AND cpd.tenant_id = es.tenant_id
       WHERE es.tenant_id = ? AND es.deposito = 'VENDA' AND es.conferencia_pedida_em IS NOT NULL ORDER BY es.conferencia_pedida_em`, [tenant]);
    const [[ind]]: any = await pool.execute(
      `SELECT COUNT(DISTINCT i.id_inventario) AS listas, COUNT(x.id_inventario_item) AS contados, SUM(x.situacao = 'OK') AS certos,
              COALESCE(SUM(ABS(x.diferenca) * x.custo_unitario), 0) AS valor_ajustado,
              COALESCE(SUM(x.diferenca * x.custo_unitario), 0) AS saldo_ajustado
       FROM estoque_inventarios i INNER JOIN estoque_inventarios_itens x ON x.id_inventario = i.id_inventario AND x.situacao IN ('OK', 'AJUSTADO')
       WHERE i.tenant_id = ? AND i.status = 'LANCADA' AND i.lancado_em >= NOW() - INTERVAL 30 DAY`, [tenant]);
    return res.json({
      config: cfg, areas: base.areas, categorias: base.categorias, grupos: porGrupo,
      abertas: abertas.map((a: any) => ({ id: Number(a.id_inventario), area: a.area || a.observacao || 'Sem área', criada: a.criada, itens: Number(a.itens), operador: a.operador })),
      pedidos: pedidos.map((p: any) => ({ idItem: Number(p.id_item), nome: p.nome, sku: p.sku, motivo: p.conferencia_motivo, pedida: p.pedida })),
      indicadores: { listas: Number(ind?.listas) || 0, contados: Number(ind?.contados) || 0, certos: Number(ind?.certos) || 0,
        valorAjustado: n(ind?.valor_ajustado), saldoAjustado: n(ind?.saldo_ajustado) },
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar o inventário.');
  }
};

// ------------------------------------------------------------------ listas

/** POST /api/estoque/inventario/listas { grupo? } — gera a lista do dia (um grupo só, até N itens). */
export const gerarLista = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const cfg = await carregarConfig(conn, tenant);
    const { candidatos, grupos } = await candidatosDeHoje(conn, tenant, cfg);
    const pedido = req.body?.grupo ? String(req.body.grupo) : null;
    const { grupo, itens } = escolherLista(candidatos, cfg.itensPorDia, pedido);
    if (!grupo || !itens.length) throw new ErroInventario(pedido ? 'Este grupo não tem itens para conferir hoje.' : 'Nada para conferir hoje: tudo em dia.', 409);
    const g = grupos.get(grupo)!;
    const [cab]: any = await conn.execute(
      `INSERT INTO estoque_inventarios (tenant_id, id_area, deposito, status, observacao, operador) VALUES (?, ?, 'VENDA', 'ABERTA', ?, ?)`,
      [tenant, g.idArea, g.idArea ? null : g.nome.slice(0, 255), operadorDe(req)]
    );
    const id = Number(cab.insertId);
    for (const i of itens) {
      await conn.execute(
        `INSERT INTO estoque_inventarios_itens (tenant_id, id_inventario, id_item, motivo, detalhe_motivo, saldo_impresso) VALUES (?, ?, ?, ?, ?, ?)`,
        [tenant, id, i.idItem, i.motivo, i.detalhe ? String(i.detalhe).slice(0, 150) : null, f4(i.saldo)]
      );
    }
    await conn.commit();
    return res.status(201).json({ success: true, id, grupo: g.nome, itens: itens.length });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao gerar a lista.');
  } finally {
    conn.release();
  }
};

/** GET /api/estoque/inventario/listas?status=LANCADA — histórico (as abertas vêm no painel). */
export const listarListas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const [rows]: any = await pool.execute(
      `SELECT i.id_inventario, i.status, i.conferente, a.nome AS area, i.observacao, DATE_FORMAT(i.contado_em, '%Y-%m-%d %H:%i') AS contado,
              DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i') AS criada, i.autorizado_por,
              COUNT(x.id_inventario_item) AS itens, SUM(x.situacao = 'OK') AS certos, SUM(x.situacao = 'AJUSTADO') AS ajustados,
              COALESCE(SUM(x.diferenca * x.custo_unitario), 0) AS saldo_ajustado
       FROM estoque_inventarios i LEFT JOIN estoque_inventario_areas a ON a.id_area = i.id_area
       LEFT JOIN estoque_inventarios_itens x ON x.id_inventario = i.id_inventario
       WHERE i.tenant_id = ? AND i.status IN ('LANCADA', 'CANCELADA') GROUP BY i.id_inventario ORDER BY i.id_inventario DESC LIMIT 100`, [tenant]);
    return res.json(rows.map((r: any) => ({
      id: Number(r.id_inventario), status: r.status, conferente: r.conferente, area: r.area || r.observacao || 'Sem área', contado: r.contado, criada: r.criada,
      autorizadoPor: r.autorizado_por, itens: Number(r.itens), certos: Number(r.certos) || 0, ajustados: Number(r.ajustados) || 0, saldoAjustado: n(r.saldo_ajustado),
    })));
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar.');
  }
};

const carregarLista = async (conn: any, tenant: number, id: number, trava = false) => {
  const [[l]]: any = await conn.execute(
    `SELECT i.*, a.nome AS area, DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i') AS criada, DATE_FORMAT(i.contado_em, '%Y-%m-%d %H:%i') AS contado
     FROM estoque_inventarios i LEFT JOIN estoque_inventario_areas a ON a.id_area = i.id_area
     WHERE i.id_inventario = ? AND i.tenant_id = ? ${trava ? 'FOR UPDATE' : ''}`, [id, tenant]);
  if (!l) throw new ErroInventario('Lista não encontrada.', 404);
  return l;
};

/** GET /api/estoque/inventario/listas/:id — a folha (itens na ordem do percurso) com o saldo de agora. */
export const detalheLista = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const l = await carregarLista(pool, tenant, id);
    const [itens]: any = await pool.execute(
      `SELECT x.*, COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome, COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku,
              um.sigla AS unidade, cat.nome AS categoria, es.quantidade_atual, es.localizacao,
              COALESCE(NULLIF(es.custo_medio, 0), cpd.custo_gerencial, 0) AS custo
       FROM estoque_inventarios_itens x
       INNER JOIN itens_core ic ON ic.id_item = x.id_item
       LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = x.id_item AND cpd.tenant_id = x.tenant_id
       LEFT JOIN comercial_familias f ON f.id = cpd.familia_id
       LEFT JOIN comercial_categorias cat ON cat.id = COALESCE(f.categoria_id, cpd.categoria_id)
       LEFT JOIN estoque_saldos_itens es ON es.id_item = x.id_item AND es.tenant_id = x.tenant_id AND es.deposito = 'VENDA'
       WHERE x.id_inventario = ? ORDER BY es.localizacao IS NULL, es.localizacao, cat.nome, nome`, [id]);
    return res.json({
      id: Number(l.id_inventario), status: l.status, area: l.area || l.observacao || 'Sem área', criada: l.criada, contado: l.contado,
      conferente: l.conferente, autorizadoPor: l.autorizado_por, operador: l.operador,
      itens: itens.map((i: any) => ({
        idItem: Number(i.id_item), sku: i.sku, nome: i.nome, unidade: i.unidade, categoria: i.categoria ? String(i.categoria).replace(/^[^\p{L}\p{N}]+/u, '').trim() : null,
        localizacao: i.localizacao, motivo: i.motivo, detalheMotivo: i.detalhe_motivo, saldoImpresso: n(i.saldo_impresso), saldoAtual: n(i.quantidade_atual),
        custo: n(i.custo), contado: i.quantidade_contada !== null ? n(i.quantidade_contada) : null, saldoNaContagem: i.saldo_na_contagem !== null ? n(i.saldo_na_contagem) : null,
        diferenca: i.diferenca !== null ? n(i.diferenca) : null, situacao: i.situacao,
      })),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao abrir a lista.');
  }
};

/**
 * POST /api/estoque/inventario/listas/:id/lancar
 * { conferente, contadoEm: 'YYYY-MM-DD HH:mm', itens: [{ idItem, contado | null }], autorizacao?: { senha, nome } }
 * Compara com o saldo na hora da contagem; divergência acima do limite pede a senha; ajusta pela diferença.
 */
export const lancarLista = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const id = Number(req.params.id);
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const l = await carregarLista(conn, tenant, id, true);
    if (l.status !== 'ABERTA') throw new ErroInventario('Esta lista já foi lançada ou cancelada.', 409);
    const conferente = String(req.body?.conferente || '').trim().slice(0, 60);
    if (!conferente) throw new ErroInventario('Informe quem contou (o conferente que assinou a folha).');
    const contadoEm = String(req.body?.contadoEm || '').replace('T', ' ').slice(0, 16);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(contadoEm)) throw new ErroInventario('Informe a data e a hora da contagem.');
    if (new Date(contadoEm.replace(' ', 'T')).getTime() > Date.now() + 5 * 60000) throw new ErroInventario('A hora da contagem não pode ser no futuro.');
    const informados = new Map<number, number | null>((Array.isArray(req.body?.itens) ? req.body.itens : []).map((i: any) => [
      Number(i.idItem), i.contado === null || i.contado === undefined || i.contado === '' ? null : Number(i.contado)]));
    for (const [idItem, q] of informados) if (q !== null && !(q >= 0)) throw new ErroInventario(`Quantidade contada inválida no item ${idItem}.`);

    const [linhas]: any = await conn.execute(
      `SELECT x.id_inventario_item, x.id_item, COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome, cpd.custo_gerencial
       FROM estoque_inventarios_itens x INNER JOIN itens_core ic ON ic.id_item = x.id_item
       LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = x.id_item AND cpd.tenant_id = x.tenant_id
       WHERE x.id_inventario = ? ORDER BY x.id_item`, [id]);
    const contados = linhas.filter((x: any) => informados.get(Number(x.id_item)) !== null && informados.get(Number(x.id_item)) !== undefined);
    if (!contados.length) throw new ErroInventario('Nenhuma quantidade informada.');
    const ids = contados.map((x: any) => Number(x.id_item));
    const marcas = ids.map(() => '?').join(',');
    const [saldos]: any = await conn.execute(
      `SELECT id_item, quantidade_atual, custo_medio FROM estoque_saldos_itens WHERE tenant_id = ? AND deposito = 'VENDA' AND id_item IN (${marcas}) ORDER BY id_item FOR UPDATE`,
      [tenant, ...ids]);
    const [depois]: any = await conn.execute(
      `SELECT id_item, SUM(CASE WHEN tipo_movimento = 'ENTRADA' THEN quantidade ELSE -quantidade END) AS liquido FROM estoque_movimentos
       WHERE tenant_id = ? AND deposito = 'VENDA' AND id_item IN (${marcas}) AND created_at > ? GROUP BY id_item`,
      [tenant, ...ids, `${contadoEm}:59`]);
    const saldoDe = new Map<number, { q: number; custo: number }>(saldos.map((s: any) => [Number(s.id_item), { q: n(s.quantidade_atual), custo: n(s.custo_medio) }]));
    const liquidoDe = new Map<number, number>(depois.map((d: any) => [Number(d.id_item), n(d.liquido)]));
    const cfg = await carregarConfig(conn, tenant);

    const avaliados = contados.map((x: any) => {
      const idItem = Number(x.id_item);
      const atual = saldoDe.get(idItem) || { q: 0, custo: 0 };
      const custo = atual.custo > 0 ? atual.custo : n(x.custo_gerencial);
      const naHora = saldoNaHora(atual.q, liquidoDe.get(idItem) || 0);
      const contado = informados.get(idItem) as number;
      return { x, idItem, atual, custo, naHora, contado, ...avaliarDivergencia(contado, naHora, custo, cfg) };
    });
    const grandes = avaliados.filter((a: any) => a.exigeSenha);
    let autorizadoPor: string | null = null;
    if (grandes.length) {
      const motivos = grandes.map((a: any) => `${a.x.nome}: ${a.diferenca > 0 ? '+' : ''}${a.diferenca} (R$ ${a.valor.toFixed(2).replace('.', ',')})`);
      const regras = await carregarRegras(conn, tenant);
      const detalhes = { codigo: 'AUTORIZACAO_NECESSARIA', motivos, temSenha: Boolean(regras.senhaHash) };
      if (!regras.senhaHash) throw new ErroInventario('Divergência acima do limite e nenhuma senha de autorização definida (Vendas › Regras de venda).', 403, detalhes);
      const aut = req.body?.autorizacao;
      if (!aut) throw new ErroInventario(`Divergência acima do limite: ${motivos.join('; ')}.`, 403, detalhes);
      if (!conferirSenha(String(aut.senha || ''), regras.senhaHash)) throw new ErroInventario('Senha de autorização incorreta.', 403, { ...detalhes, senhaIncorreta: true });
      autorizadoPor = String(aut.nome || '').trim().slice(0, 60);
      if (!autorizadoPor) throw new ErroInventario('Informe quem autorizou.', 403, detalhes);
    }

    let ajustados = 0;
    for (const a of avaliados) {
      let idMovimento: number | null = null;
      if (a.diferenca !== 0) {
        const r = await lancarMovimentoEstoque(conn, {
          tenant, idItem: a.idItem, deposito: 'VENDA', tipo: a.diferenca > 0 ? 'ENTRADA' : 'SAIDA', origem: 'INVENTARIO',
          idOrigem: id, idOrigemItem: Number(a.x.id_inventario_item), documento: `INVENTARIO LISTA ${id}`, tipoRecurso: 'PRODUTO',
          quantidade: Math.abs(a.diferenca), custoUnitario: a.custo, recalcularCustoMedio: false,
          observacao: `Inventário lista ${id}: contou ${a.contado} (sistema ${a.naHora}) · ${conferente}${autorizadoPor && a.exigeSenha ? ` · autorizado por ${autorizadoPor}` : ''}`,
        });
        idMovimento = r.idMovimento;
        ajustados++;
      }
      await conn.execute(
        `UPDATE estoque_inventarios_itens SET quantidade_contada = ?, saldo_na_contagem = ?, diferenca = ?, custo_unitario = ?, situacao = ?, id_movimento = ?
         WHERE id_inventario_item = ?`,
        [f4(a.contado), f4(a.naHora), f4(a.diferenca), f4(a.custo), a.diferenca === 0 ? 'OK' : 'AJUSTADO', idMovimento, a.x.id_inventario_item]);
      await conn.execute(
        `UPDATE estoque_saldos_itens SET ultima_contagem_em = ?, conferencia_pedida_em = NULL, conferencia_motivo = NULL
         WHERE tenant_id = ? AND id_item = ? AND deposito = 'VENDA'`, [`${contadoEm}:00`, tenant, a.idItem]);
    }
    await conn.execute(`UPDATE estoque_inventarios_itens SET situacao = 'NAO_CONTADO' WHERE id_inventario = ? AND situacao = 'PENDENTE'`, [id]);
    await conn.execute(
      `UPDATE estoque_inventarios SET status = 'LANCADA', conferente = ?, contado_em = ?, lancado_em = NOW(), autorizado_por = ?, operador = ? WHERE id_inventario = ?`,
      [conferente, `${contadoEm}:00`, autorizadoPor, operadorDe(req), id]);
    await conn.commit();
    return res.json({ success: true, contados: avaliados.length, ajustados, naoContados: linhas.length - avaliados.length });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    return responderErro(res, error, 'Erro ao lançar a contagem.');
  } finally {
    conn.release();
  }
};

/** POST /api/estoque/inventario/listas/:id/cancelar — folha perdida/não feita: os itens voltam para as próximas listas. */
export const cancelarLista = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const l = await carregarLista(pool, tenant, Number(req.params.id));
    if (l.status !== 'ABERTA') throw new ErroInventario('Só lista aberta pode ser cancelada.', 409);
    await pool.execute(`UPDATE estoque_inventarios SET status = 'CANCELADA', operador = ? WHERE id_inventario = ?`, [operadorDe(req), l.id_inventario]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao cancelar a lista.');
  }
};

// ------------------------------------------------------------------ pedidos de conferência

/** POST /api/estoque/inventario/pedidos { idItem, motivo } — entra na próxima lista da área dele. */
export const pedirConferencia = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const idItem = Number(req.body?.idItem);
    const motivo = String(req.body?.motivo || '').trim().slice(0, 150);
    if (!(idItem > 0)) throw new ErroInventario('Informe o item.');
    if (!motivo) throw new ErroInventario('Informe o motivo (o que conferir).');
    const [r]: any = await pool.execute(
      `UPDATE estoque_saldos_itens SET conferencia_pedida_em = NOW(), conferencia_motivo = ? WHERE tenant_id = ? AND id_item = ? AND deposito = 'VENDA'`,
      [motivo, tenant, idItem]);
    if (!r.affectedRows) throw new ErroInventario('O item não tem estoque no depósito Venda.', 404);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao pedir a conferência.');
  }
};

/** DELETE /api/estoque/inventario/pedidos/:idItem */
export const retirarPedidoConferencia = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    await pool.execute(`UPDATE estoque_saldos_itens SET conferencia_pedida_em = NULL, conferencia_motivo = NULL WHERE tenant_id = ? AND id_item = ? AND deposito = 'VENDA'`,
      [tenant, Number(req.params.idItem)]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao retirar o pedido.');
  }
};

// ------------------------------------------------------------------ configuração e áreas

/** PUT /api/estoque/inventario/config */
export const salvarConfig = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const c = validarConfig(req.body || {});
    await pool.execute(
      `INSERT INTO estoque_inventario_config (tenant_id, itens_por_dia, limite_divergencia_valor, limite_divergencia_pct, dias_curva_a, dias_curva_b, dias_curva_c)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE itens_por_dia = VALUES(itens_por_dia), limite_divergencia_valor = VALUES(limite_divergencia_valor),
         limite_divergencia_pct = VALUES(limite_divergencia_pct), dias_curva_a = VALUES(dias_curva_a), dias_curva_b = VALUES(dias_curva_b), dias_curva_c = VALUES(dias_curva_c)`,
      [tenant, c.itensPorDia, f4(c.limiteDivergenciaValor), c.limiteDivergenciaPct.toFixed(4), c.diasCurvaA, c.diasCurvaB, c.diasCurvaC]);
    return res.json({ success: true, config: c });
  } catch (error) {
    return responderErro(res, error, 'Erro ao salvar a configuração.');
  }
};

const lerArea = (b: any) => {
  const nome = String(b?.nome || '').trim().slice(0, 80);
  if (!nome) throw new ErroInventario('Informe o nome da área.');
  return { nome, ordem: Math.floor(Number(b?.ordem) || 0), contar: b?.contar === false || b?.contar === 0 ? 0 : 1 };
};

/** POST /api/estoque/inventario/areas { nome, ordem, contar, categorias? } */
export const criarArea = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const a = lerArea(req.body);
    const [r]: any = await pool.execute(`INSERT INTO estoque_inventario_areas (tenant_id, nome, ordem, contar) VALUES (?, ?, ?, ?)`, [tenant, a.nome, a.ordem, a.contar]);
    if (Array.isArray(req.body?.categorias)) await gravarCategorias(tenant, Number(r.insertId), req.body.categorias);
    return res.status(201).json({ success: true, id: Number(r.insertId) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao criar a área.');
  }
};

/** PUT /api/estoque/inventario/areas/:id { nome, ordem, contar, categorias? } */
export const atualizarArea = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const a = lerArea(req.body);
    const id = Number(req.params.id);
    const [r]: any = await pool.execute(`UPDATE estoque_inventario_areas SET nome = ?, ordem = ?, contar = ? WHERE id_area = ? AND tenant_id = ?`, [a.nome, a.ordem, a.contar, id, tenant]);
    if (!r.affectedRows) throw new ErroInventario('Área não encontrada.', 404);
    if (Array.isArray(req.body?.categorias)) await gravarCategorias(tenant, id, req.body.categorias);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao salvar a área.');
  }
};

/** Categorias da área (substitui; uma categoria que estava em outra área passa para esta). */
const gravarCategorias = async (tenant: number, idArea: number, categorias: unknown[]) => {
  const ids = [...new Set(categorias.map(Number).filter(x => Number.isInteger(x) && x > 0))];
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`DELETE FROM estoque_inventario_areas_categorias WHERE tenant_id = ? AND id_area = ?`, [tenant, idArea]);
    for (const c of ids) {
      await conn.execute(
        `INSERT INTO estoque_inventario_areas_categorias (tenant_id, categoria_id, id_area) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id_area = VALUES(id_area)`,
        [tenant, c, idArea]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    throw e;
  } finally {
    conn.release();
  }
};

/** DELETE /api/estoque/inventario/areas/:id — as categorias dela ficam sem área. */
export const excluirArea = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    await pool.execute(`DELETE FROM estoque_inventario_areas WHERE id_area = ? AND tenant_id = ?`, [Number(req.params.id), tenant]);
    return res.json({ success: true });
  } catch (error) {
    return responderErro(res, error, 'Erro ao excluir a área.');
  }
};
