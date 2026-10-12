// Kit configurável na venda: opções de cada posição (variações da família), conferência das escolhas do cliente,
// diferença de preço e gravação das escolhas (vendas_pedidos_itens_componentes) para venda, orçamento e suspensa.
import { carregarPrecos, SELECT_ITENS } from '../../vendas/pdv/pdv.controller';
import { faixaParaQuantidade } from '../../vendas/pdv/precoPdv';
import { avaliarPublicacaoItens } from '../produtos/publicacaoProdutos';
import { EscolhaKit, ErroKit, ItemDaEscolha, KitResolvido, resolverEscolhasKit, assinaturaKit } from './kits';
import { carregarComposicoes, carregarDadosComponentes } from './kitsBanco';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const marcadores = (ids: unknown[]) => ids.map(() => '?').join(',');
const f4 = (v: number) => Number(v || 0).toFixed(4);

/** Preço de venda por 1 unidade base (faixa de varejo da unidade base; sem faixa, o preço do cadastro). */
const precosBase = async (conn: Conn, tenant: number, rows: any[]) => {
  const precos = await carregarPrecos(conn as any, tenant, rows);
  const mapa = new Map<number, number>();
  for (const r of rows) {
    const id = Number(r.id_item);
    const base = (precos.unidadesPorItem.get(id) || []).find(u => u.isBase);
    const faixa = base ? faixaParaQuantidade(precos.faixasPorItem.get(id) || [], base.idUnidade, 1) : null;
    mapa.set(id, faixa && faixa.precoUnitario > 0 ? faixa.precoUnitario : Number(r.preco_venda) || 0);
  }
  return mapa;
};

/** Dados de cada item para conferir as escolhas (família, situação, se é kit e preço base). */
export const carregarItensDaEscolha = async (conn: Conn, tenant: number, ids: number[]): Promise<Map<number, ItemDaEscolha>> => {
  const mapa = new Map<number, ItemDaEscolha>();
  const unicos = [...new Set(ids.filter(id => id > 0))];
  if (unicos.length === 0) return mapa;
  const [rows] = await conn.execute(
    `${SELECT_ITENS.replace('cpd.sku_customizado,', 'cpd.sku_customizado, cpd.familia_id,')} WHERE ic.tenant_id = ? AND ic.id_item IN (${marcadores(unicos)})`,
    [tenant, ...unicos]
  );
  const kits = await carregarComposicoes(conn, tenant, unicos);
  const precos = await precosBase(conn, tenant, rows as any[]);
  for (const r of rows as any[]) {
    const id = Number(r.id_item);
    mapa.set(id, {
      idItem: id,
      sku: r.sku_customizado || r.sku_core,
      nome: r.nome_comercial || r.nome_item,
      familiaId: r.familia_id ? Number(r.familia_id) : null,
      ativo: String(r.status || '').toUpperCase() === 'ATIVO',
      ehKit: kits.has(id),
      preco: precos.get(id) || 0,
    });
  }
  return mapa;
};

/**
 * Confere as escolhas de cada linha do pedido. Para linha que não é kit devolve null.
 * pedidos: na mesma ordem das linhas ({ idItem, componentes?: [{ slot, idItem, quantidade }] }).
 */
export const resolverKitsDoPedido = async (
  conn: Conn, tenant: number, pedidos: Array<{ idItem: number; componentes?: EscolhaKit[] | null; nome?: string }>
): Promise<Array<KitResolvido | null>> => {
  const composicoes = await carregarComposicoes(conn, tenant, pedidos.map(p => p.idItem));
  if (composicoes.size === 0) return pedidos.map(() => null);
  for (const p of pedidos) {
    if (p.componentes && !composicoes.has(p.idItem)) throw new ErroKit(`O item ${p.idItem} não é kit: tire as escolhas de kit da linha.`);
  }
  const ids = [
    ...[...composicoes.values()].flat().map(c => c.idItem),
    ...pedidos.flatMap(p => (Array.isArray(p.componentes) ? p.componentes.map(c => Number(c.idItem)) : [])),
  ];
  const itens = await carregarItensDaEscolha(conn, tenant, ids);
  return pedidos.map(p => {
    const comp = composicoes.get(p.idItem);
    return comp ? resolverEscolhasKit(comp, p.componentes, itens, p.nome ? `kit "${p.nome}"` : 'kit') : null;
  });
};

/** Grava as escolhas da linha (só para kit; sem troca grava também, para o orçamento lembrar a composição). */
export const gravarEscolhasKit = async (conn: Conn, tenant: number, idVenda: number, idVendaItem: number, k: KitResolvido | null) => {
  if (!k) return;
  for (const p of k.posicoes) {
    await conn.execute(
      `INSERT INTO vendas_pedidos_itens_componentes
         (tenant_id, id_venda, id_venda_item, id_composicao, id_item, quantidade, id_item_padrao, quantidade_padrao, ajuste)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, idVenda, idVendaItem, p.idComposicao, p.idItem, f4(p.quantidade), p.idItemPadrao, f4(p.quantidadePadrao), f4(p.ajuste)]
    );
  }
};

/** Escolhas gravadas por linha (orçamento/suspensa voltando ao carrinho e preço congelado do orçamento). */
export const escolhasDasLinhas = async (conn: Conn, tenant: number, idVenda: number) => {
  const [rows] = await conn.execute(
    `SELECT id_venda_item, id_composicao, id_item, quantidade FROM vendas_pedidos_itens_componentes
     WHERE tenant_id = ? AND id_venda = ? ORDER BY id_componente`,
    [tenant, idVenda]
  );
  const mapa = new Map<number, { escolhas: EscolhaKit[]; assinatura: string }>();
  for (const r of rows as any[]) {
    const id = Number(r.id_venda_item);
    if (!mapa.has(id)) mapa.set(id, { escolhas: [], assinatura: '' });
    mapa.get(id)!.escolhas.push({ slot: Number(r.id_composicao), idItem: Number(r.id_item), quantidade: Number(r.quantidade) });
  }
  for (const v of mapa.values()) {
    v.assinatura = assinaturaKit(v.escolhas.map(e => ({ idComposicao: e.slot, idItem: e.idItem, quantidade: e.quantidade })));
  }
  return mapa;
};

/** Texto da grade de cada item (ex.: "1 CV · 220V"), pelos atributos de grade que valem para ele. */
const gradesDosItens = async (conn: Conn, tenant: number, ids: number[]) => {
  const mapa = new Map<number, string>();
  if (ids.length === 0) return mapa;
  const publicacao = await avaliarPublicacaoItens(conn, tenant, ids);
  const [valores] = await conn.execute(
    `SELECT v.id_entidade, v.atributo_id,
            COALESCE(o.valor, NULLIF(TRIM(v.valor_texto), ''), v.valor_numero,
                     TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(v.valor_decimal AS CHAR)))) AS valor
     FROM atributos_comercial_valores v
     LEFT JOIN atributos_comercial_opcoes o ON o.id = v.opcao_id
     WHERE v.tenant_id = ? AND v.tipo_entidade = 'produto' AND v.id_entidade IN (${marcadores(ids)})`,
    [tenant, ...ids]
  );
  const porItem = new Map<number, Map<string, string>>();
  for (const v of valores as any[]) {
    if (v.valor === null || v.valor === undefined || v.valor === '') continue;
    const id = Number(v.id_entidade);
    if (!porItem.has(id)) porItem.set(id, new Map());
    porItem.get(id)!.set(String(v.atributo_id), String(v.valor));
  }
  for (const id of ids) {
    const grade = publicacao.get(id)?.atributosGrade || [];
    const textos = grade.map(a => porItem.get(id)?.get(String(a))).filter(Boolean) as string[];
    if (textos.length) mapa.set(id, textos.join(' · '));
  }
  return mapa;
};

/**
 * Opções do kit para a tela de escolha do PDV: cada posição com o padrão e, se trocável,
 * as variações ativas da mesma família (com grade, preço base e saldo).
 */
export const opcoesDoKit = async (conn: Conn, tenant: number, idKit: number) => {
  const comp = (await carregarComposicoes(conn, tenant, [idKit])).get(idKit);
  if (!comp) throw new ErroKit('Kit não encontrado.', 404);
  const padroes = await carregarDadosComponentes(conn, tenant, comp.map(c => c.idItem));
  const familias = [...new Set(comp.filter(c => c.permiteTrocar).map(c => padroes.get(c.idItem)?.familiaId).filter(Boolean))] as number[];
  let irmaos: number[] = [];
  if (familias.length) {
    const [rows] = await conn.execute(
      `SELECT cpd.id_item FROM comercial_produtos_dados cpd
       INNER JOIN itens_core ic ON ic.id_item = cpd.id_item AND ic.tenant_id = cpd.tenant_id
       WHERE cpd.tenant_id = ? AND cpd.familia_id IN (${marcadores(familias)}) AND ic.status = 'ATIVO'
         AND ic.tipo_recurso IN ('PRODUTO', 'SERVICO')`,
      [tenant, ...familias]
    );
    irmaos = (rows as any[]).map(r => Number(r.id_item));
  }
  const todos = [...new Set([...comp.map(c => c.idItem), ...irmaos])];
  const [itens, dados, grades] = await Promise.all([
    carregarItensDaEscolha(conn, tenant, todos),
    carregarDadosComponentes(conn, tenant, todos),
    gradesDosItens(conn, tenant, todos),
  ]);
  const opcao = (id: number) => {
    const i = itens.get(id);
    const d = dados.get(id);
    return {
      idItem: id,
      sku: i?.sku || d?.sku || '',
      nome: i?.nome || d?.nome || `Item ${id}`,
      grade: grades.get(id) || '',
      unidade: d?.sigla || '',
      preco: i?.preco || 0,
      saldo: d?.saldo ?? 0,
      servico: Boolean(d?.servico),
      podeVenderSemEstoque: Boolean(d?.podeVenderSemEstoque),
    };
  };
  return comp.map(c => {
    const familiaId = padroes.get(c.idItem)?.familiaId ?? null;
    const variacoes = c.permiteTrocar && familiaId
      ? todos.filter(id => dados.get(id)?.familiaId === familiaId && !itens.get(id)?.ehKit)
      : [c.idItem];
    return {
      slot: c.idComposicao!,
      quantidadePadrao: c.quantidade,
      permiteTrocar: Boolean(c.permiteTrocar && familiaId),
      permiteAlterarQtd: Boolean(c.permiteAlterarQtd),
      familia: padroes.get(c.idItem)?.familia || '',
      padrao: opcao(c.idItem),
      opcoes: variacoes.map(opcao).sort((a, b) => a.preco - b.preco || a.nome.localeCompare(b.nome)),
    };
  });
};
