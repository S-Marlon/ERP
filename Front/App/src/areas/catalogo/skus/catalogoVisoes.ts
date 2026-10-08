// Gerenciador de catálogos: visões por tipo de item, agrupamento por família, filtros e indicadores (regras puras).
import type { ItemParentType, SkuChildType } from './CatalogSku.types';

/** Venda: produtos e serviços; Almoxarifado: consumo e insumo; Patrimônio: ativos. */
export type Visao = 'VENDA' | 'ALMOXARIFADO' | 'PATRIMONIO' | 'TODOS';
export const VISOES: Array<{ value: Visao; label: string; descricao: string }> = [
  { value: 'VENDA', label: 'Produtos de venda', descricao: 'Itens que vão para o PDV e as etiquetas' },
  { value: 'ALMOXARIFADO', label: 'Almoxarifado', descricao: 'Consumo interno e insumos (não são vendidos)' },
  { value: 'PATRIMONIO', label: 'Patrimônio', descricao: 'Ativos / imobilizado (não são vendidos)' },
  { value: 'TODOS', label: 'Todos', descricao: 'Tudo junto' },
];

export const visaoDoTipo = (tipo: unknown): Exclude<Visao, 'TODOS'> => {
  const t = String(tipo || 'PRODUTO').toUpperCase();
  if (t === 'ATIVO') return 'PATRIMONIO';
  if (t === 'CONSUMO' || t === 'INSUMO') return 'ALMOXARIFADO';
  return 'VENDA';
};
export const ehDaVisao = (tipo: unknown, visao: Visao) => visao === 'TODOS' || visaoDoTipo(tipo) === visao;

export type Situacao = 'TODAS' | 'COM_ESTOQUE' | 'ESGOTADO' | 'CRITICO' | 'SEM_FAMILIA' | 'NAO_PUBLICAVEL' | 'SEM_PRECO' | 'SEM_CUSTO' | 'SEM_UNIDADE';
export const ROTULO_SITUACAO: Record<Situacao, string> = {
  TODAS: 'Todas', COM_ESTOQUE: 'Com estoque', ESGOTADO: 'Esgotado', CRITICO: 'Estoque crítico (≤ 5)', SEM_FAMILIA: 'Sem família',
  NAO_PUBLICAVEL: 'Não publicável', SEM_PRECO: 'Sem preço', SEM_CUSTO: 'Sem custo', SEM_UNIDADE: 'Sem unidade',
};

/** Linha da tabela: um item avulso ou uma família com as variações (skus). */
export type Linha = ItemParentType & { familiaReal: boolean };

/** Agrupa as variações de uma mesma família numa linha; itens sem família ficam sozinhos. */
export const agruparPorFamilia = (itens: ItemParentType[]): Linha[] => {
  const grupos = new Map<string, Linha>();
  for (const item of itens) {
    const chave = item.familia_id ? `familia-${item.familia_id}` : `item-${item.id_item}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        ...item,
        key: chave,
        sku: item.familia_id ? `FAM-${item.familia_id}` : item.sku,
        nome_item: item.familia_id ? (item.familia || 'Família') : item.nome_item,
        familiaReal: Boolean(item.familia_id),
        skus: [],
      });
    }
    const grupo = grupos.get(chave)!;
    const base = item.skus?.[0];
    if (!base || grupo.skus.some(s => s.id_item === item.id_item)) continue;
    grupo.skus.push({ ...base, nome_item: item.nome_item, unidade: base.unidade || item.unidade } as SkuChildType);
  }
  return [...grupos.values()];
};

const estoques = (l: Linha) => l.skus.map(s => Number(s.estoque) || 0);

/** A linha (ou alguma variação dela) está nessa situação? */
export const naSituacao = (l: Linha, s: Situacao): boolean => {
  switch (s) {
    case 'TODAS': return true;
    case 'COM_ESTOQUE': return estoques(l).some(e => e > 0);
    case 'ESGOTADO': return estoques(l).some(e => e <= 0);
    case 'CRITICO': return estoques(l).some(e => e > 0 && e <= 5);
    case 'SEM_FAMILIA': return !l.familiaReal;
    case 'NAO_PUBLICAVEL': return l.skus.some(x => x.publicavel === false);
    case 'SEM_PRECO': return l.skus.some(x => !(Number(x.preco_venda) > 0));
    case 'SEM_CUSTO': return l.skus.some(x => !(Number(x.custo_gerencial) > 0));
    case 'SEM_UNIDADE': return l.skus.some(x => !x.unidade);
    default: return true;
  }
};

export interface Filtros { busca: string; categoriaId: number | null; marca: string | null; situacao: Situacao; estrutura: 'TODAS' | 'FAMILIAS' | 'AVULSOS' }

export const filtrarLinhas = (linhas: Linha[], f: Filtros): Linha[] => {
  const termo = f.busca.trim().toLowerCase();
  return linhas.filter(l => {
    if (termo) {
      const casa = [l.nome_item, l.sku, ...l.skus.flatMap(s => [s.sku, s.nome_item || ''])]
        .some(t => String(t || '').toLowerCase().includes(termo));
      if (!casa) return false;
    }
    if (f.categoriaId && Number(l.categoria_id) !== f.categoriaId) return false;
    if (f.marca && !l.skus.some(s => String(s.marca || '').toLowerCase() === f.marca!.toLowerCase())) return false;
    if (f.estrutura === 'FAMILIAS' && !l.familiaReal) return false;
    if (f.estrutura === 'AVULSOS' && l.familiaReal) return false;
    return naSituacao(l, f.situacao);
  });
};

/** Contagem por situação (os cards), sobre as linhas da visão atual. */
export const contarSituacoes = (linhas: Linha[]) => {
  const c = {} as Record<Situacao, number>;
  (Object.keys(ROTULO_SITUACAO) as Situacao[]).forEach(s => { c[s] = linhas.filter(l => naSituacao(l, s)).length; });
  return c;
};

/** Itens (variações) das linhas selecionadas, para a lista de trabalho / precificação. */
export const itensDasLinhas = (linhas: Linha[]) => linhas.flatMap(l => l.skus.map(s => ({
  idItem: Number(s.id_item), sku: s.sku, nome: s.nome_item || l.nome_item, unidade: s.unidade || undefined,
})));
