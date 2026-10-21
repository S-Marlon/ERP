// Embalagens no banco: as embalagens (itens de consumo com custo, peso e medidas) e as regras que valem para cada item
// (as dele ou as da família). Usado pela logística em lote e por quem precisa do pacote de um envio (ex.: o ML).
import { Embalagem, Medidas, pacoteDoEnvio, RegraEmbalagem, regraParaQuantidade, regrasEfetivas } from './logistica';

const lista = (n: number) => Array(n).fill('?').join(',');
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export interface EmbalagemCatalogo extends Embalagem { sku: string; estoque: number }

const medidasDe = (r: any): Medidas | null => {
  const [a, l, c] = [Number(r.altura_cm), Number(r.largura_cm), Number(r.comprimento_cm)];
  return a > 0 && l > 0 && c > 0 ? { altura: a, largura: l, comprimento: c } : null;
};

/** Embalagens do catálogo (itens de consumo) ou só as dos ids, com peso, medidas, custo e estoque. */
export const carregarEmbalagens = async (conn: any, tenant: number, ids?: number[]): Promise<EmbalagemCatalogo[]> => {
  if (ids && !ids.length) return [];
  const [rows]: any = await conn.execute(
    `SELECT ic.id_item, COALESCE(cpd.sku_customizado, ic.sku) AS sku, COALESCE(cpd.nome_comercial, ic.nome_item) AS nome,
            COALESCE(ic.peso_bruto, ic.peso_liquido) AS peso, lg.altura_cm, lg.largura_cm, lg.comprimento_cm, cpd.custo_gerencial,
            COALESCE(es.quantidade_atual, 0) AS estoque
     FROM itens_core ic
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     LEFT JOIN itens_dados_logisticos lg ON lg.id_item = ic.id_item
     LEFT JOIN estoque_saldos_itens es ON es.id_item = ic.id_item AND es.tenant_id = ic.tenant_id AND es.deposito = 'VENDA'
     WHERE ic.tenant_id = ? AND UPPER(COALESCE(ic.status, 'ATIVO')) <> 'INATIVO'
       ${ids ? `AND ic.id_item IN (${lista(ids.length)})` : `AND UPPER(COALESCE(ic.tipo_recurso, 'PRODUTO')) = 'CONSUMO'`}
     ORDER BY nome`,
    ids ? [tenant, ...ids] : [tenant]
  );
  return rows.map((r: any) => ({
    idEmbalagem: Number(r.id_item), sku: r.sku, nome: r.nome, pesoKg: nulo(r.peso) || null, medidas: medidasDe(r),
    custo: Number(r.custo_gerencial) || 0, estoque: Number(r.estoque) || 0,
  }));
};

export interface EmbalagensDoItem { origem: 'ITEM' | 'FAMILIA' | null; regras: RegraEmbalagem[] }

/** As regras de embalagem que valem para cada item (as dele ou as da família) e as embalagens usadas nelas. */
export const embalagensDosItens = async (conn: any, tenant: number, itens: { idItem: number; idFamilia: number | null }[]) => {
  const ids = [...new Set(itens.map(i => i.idItem))];
  const fams = [...new Set(itens.map(i => i.idFamilia).filter((x): x is number => !!x))];
  const [doItem]: any = ids.length ? await conn.execute(`SELECT id_item, quantidade_ate, id_embalagem FROM comercial_embalagens_itens WHERE id_item IN (${lista(ids.length)})`, ids) : [[]];
  const [daFamilia]: any = fams.length ? await conn.execute(`SELECT id_familia, quantidade_ate, id_embalagem FROM comercial_embalagens_familias WHERE id_familia IN (${lista(fams.length)})`, fams) : [[]];
  const regra = (r: any): RegraEmbalagem => ({ quantidadeAte: Number(r.quantidade_ate), idEmbalagem: Number(r.id_embalagem) });
  const porItem = new Map<number, EmbalagensDoItem>();
  for (const i of itens) {
    porItem.set(i.idItem, regrasEfetivas(
      doItem.filter((r: any) => Number(r.id_item) === i.idItem).map(regra),
      daFamilia.filter((r: any) => Number(r.id_familia) === i.idFamilia).map(regra),
    ));
  }
  const usadas = [...new Set([...porItem.values()].flatMap(e => e.regras.map(r => r.idEmbalagem)))];
  const embalagens = new Map<number, EmbalagemCatalogo>((await carregarEmbalagens(conn, tenant, usadas)).map(e => [e.idEmbalagem, e]));
  return { porItem, embalagens };
};

/** Pacote do envio de N unidades do item: a embalagem da faixa e o peso (produto × N + embalagem); null sem regra que comporte. */
export const pacoteDoItem = (
  dados: Awaited<ReturnType<typeof embalagensDosItens>>, idItem: number, quantidade: number, pesoProdutoKg: number | null,
) => {
  const regras = dados.porItem.get(idItem)?.regras || [];
  const r = regraParaQuantidade(regras, quantidade);
  const embalagem = r ? dados.embalagens.get(r.idEmbalagem) || null : null;
  const pacote = pacoteDoEnvio({ pesoProdutoKg, quantidade, embalagem });
  return pacote && embalagem ? { ...pacote, embalagem: { idEmbalagem: embalagem.idEmbalagem, nome: embalagem.nome }, quantidadeAte: r!.quantidadeAte } : null;
};
