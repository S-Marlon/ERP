// Leituras de kit usadas pelo catálogo e pelas vendas (PDV, venda, cancelamento, devolução).
import { ComponenteKit, DadosComponente, estoqueDoKit, custoDoKit, TIPO_KIT } from './kits';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

/** Origem das saídas de venda do PDV em estoque_movimentos (a mesma de vendas.controller). */
export const ORIGEM_VENDA_PDV = 'VENDA_PDV';

export type DadosComponenteBanco = DadosComponente & {
  nome: string;
  sku: string;
  sigla: string;
  tipoRecurso: string;
  status: string;
  custoMedio: number;
  custoGerencial: number;
};

const marcadores = (ids: unknown[]) => ids.map(() => '?').join(',');

/** Componentes de cada kit (só os ids pedidos que são kit aparecem no mapa). */
export const carregarComposicoes = async (conn: Conn, tenant: number, idsKits: number[]): Promise<Map<number, ComponenteKit[]>> => {
  const mapa = new Map<number, ComponenteKit[]>();
  const ids = [...new Set(idsKits.filter(id => Number(id) > 0))];
  if (ids.length === 0) return mapa;
  const [rows] = await conn.execute(
    `SELECT id_item_pai, id_item_filho, quantidade FROM itens_composicoes
     WHERE tenant_id = ? AND tipo_relacao = '${TIPO_KIT}' AND id_item_pai IN (${marcadores(ids)})
     ORDER BY id_composicao`,
    [tenant, ...ids]
  );
  for (const r of rows as any[]) {
    const pai = Number(r.id_item_pai);
    if (!mapa.has(pai)) mapa.set(pai, []);
    mapa.get(pai)!.push({ idItem: Number(r.id_item_filho), quantidade: Number(r.quantidade) });
  }
  return mapa;
};

/** Ids de todos os kits do tenant. */
export const idsDosKits = async (conn: Conn, tenant: number): Promise<number[]> => {
  const [rows] = await conn.execute(
    `SELECT DISTINCT id_item_pai FROM itens_composicoes WHERE tenant_id = ? AND tipo_relacao = '${TIPO_KIT}'`, [tenant]
  );
  return (rows as any[]).map(r => Number(r.id_item_pai));
};

/** Saldo (depósito VENDA), custo e cadastro dos componentes. Custo: médio do estoque; sem ele, o gerencial. */
export const carregarDadosComponentes = async (conn: Conn, tenant: number, idsItens: number[]): Promise<Map<number, DadosComponenteBanco>> => {
  const mapa = new Map<number, DadosComponenteBanco>();
  const ids = [...new Set(idsItens.filter(id => Number(id) > 0))];
  if (ids.length === 0) return mapa;
  const [rows] = await conn.execute(
    `SELECT ic.id_item, ic.sku AS sku_core, ic.nome_item, ic.tipo_recurso, ic.status, um.sigla,
            cpd.sku_customizado, cpd.nome_comercial, COALESCE(cpd.custo_gerencial, 0) AS custo_gerencial,
            COALESCE(cpd.pode_vender_sem_estoque, 0) AS pode_vender_sem_estoque,
            COALESCE(es.quantidade_atual, 0) AS saldo, COALESCE(es.custo_medio, 0) AS custo_medio
     FROM itens_core ic
     LEFT JOIN itens_unidades_medida um ON um.id_unidade = ic.id_unidade
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'
     WHERE ic.tenant_id = ? AND ic.id_item IN (${marcadores(ids)})`,
    [tenant, ...ids]
  );
  for (const r of rows as any[]) {
    const custoMedio = Number(r.custo_medio) || 0;
    const custoGerencial = Number(r.custo_gerencial) || 0;
    const tipoRecurso = String(r.tipo_recurso || 'PRODUTO').toUpperCase();
    mapa.set(Number(r.id_item), {
      idItem: Number(r.id_item),
      nome: r.nome_comercial || r.nome_item,
      sku: r.sku_customizado || r.sku_core,
      sigla: r.sigla || '',
      tipoRecurso,
      status: String(r.status || '').toUpperCase(),
      saldo: Number(r.saldo) || 0,
      custoMedio,
      custoGerencial,
      custo: custoMedio > 0 ? custoMedio : custoGerencial,
      servico: tipoRecurso === 'SERVICO',
      podeVenderSemEstoque: Boolean(Number(r.pode_vender_sem_estoque)),
    });
  }
  return mapa;
};

/**
 * Linhas do SELECT_ITENS do PDV: o kit não tem saldo próprio, então o estoque mostrado é quantos kits
 * dá para montar e o custo é a soma dos componentes. Marca eh_kit = 1.
 */
export const aplicarKitsNasLinhasPdv = async (conn: Conn, tenant: number, rows: any[]) => {
  if (rows.length === 0) return rows;
  const composicoes = await carregarComposicoes(conn, tenant, rows.map(r => Number(r.id_item)));
  if (composicoes.size === 0) return rows;
  const dados = await carregarDadosComponentes(conn, tenant, [...composicoes.values()].flat().map(c => c.idItem));
  for (const r of rows) {
    const comp = composicoes.get(Number(r.id_item));
    if (!comp) continue;
    const possivel = estoqueDoKit(comp, dados);
    r.eh_kit = 1;
    r.estoque_base = possivel ?? 0;
    if (possivel === null) r.pode_vender_sem_estoque = 1;
    r.custo_medio = custoDoKit(comp, dados);
  }
  return rows;
};

export interface SaidaDeKit {
  idItem: number;
  tipoRecurso: string;
  quantidade: number;
  custo: number;
  sigla: string | null;
}

/**
 * Saídas dos componentes gravadas na venda para uma linha. null = a linha não é kit (o próprio item saiu do
 * estoque, ou não houve saída e o item não é kit); lista vazia = kit só com serviços (nada a devolver).
 * Usa o que saiu de verdade, então a devolução fica certa mesmo se a composição mudar depois.
 */
export const saidasDoKitNaVenda = async (
  conn: Conn, tenant: number, idVenda: number, idVendaItem: number, idItemLinha: number
): Promise<SaidaDeKit[] | null> => {
  const [rows] = await conn.execute(
    `SELECT id_item, tipo_recurso, quantidade, custo_unitario, unidade_documento
     FROM estoque_movimentos
     WHERE tenant_id = ? AND origem = ? AND id_origem = ? AND id_origem_item = ? AND tipo_movimento = 'SAIDA'
     ORDER BY id_item`,
    [tenant, ORIGEM_VENDA_PDV, idVenda, idVendaItem]
  );
  const todas = rows as any[];
  const componentes = todas.filter(r => Number(r.id_item) !== Number(idItemLinha));
  if (componentes.length === 0) {
    if (todas.length > 0) return null;
    return (await carregarComposicoes(conn, tenant, [idItemLinha])).has(Number(idItemLinha)) ? [] : null;
  }
  return componentes.map(r => ({
    idItem: Number(r.id_item),
    tipoRecurso: r.tipo_recurso || 'PRODUTO',
    quantidade: Number(r.quantidade) || 0,
    custo: Number(r.custo_unitario) || 0,
    sigla: r.unidade_documento || null,
  }));
};
