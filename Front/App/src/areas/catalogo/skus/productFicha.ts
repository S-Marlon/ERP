// Ficha do produto: conversão banco <-> formulário e montagem do payload de atualização parcial.
// Só os campos alterados vão para a API; campo esvaziado vai como null (limpa no banco).
import type { ProdutoDetalhe } from './CatalogSku.service';

// campo do formulário -> campo da API (PUT /produtos/:id_item)
export const CAMPOS_FICHA: Record<string, { api: string; label: string }> = {
  nomeInterno: { api: 'nome_item', label: 'Nome Interno' },
  // O SKU raiz (itens_core.sku) é a identidade do item e não é editável; o operador trabalha com o customizado
  skuComercial: { api: 'sku_customizado', label: 'SKU' },
  status: { api: 'status', label: 'Status' },
  variacao: { api: 'descricao_variacao', label: 'Variação' },
  idMarca: { api: 'id_marca', label: 'Marca' },
  categoriaId: { api: 'categoria_id', label: 'Categoria' },
  familiaId: { api: 'familia_id', label: 'Família' },
  nomeComercial: { api: 'nome_comercial', label: 'Nome Comercial' },
  descricaoComercial: { api: 'descricao_comercial', label: 'Descrição Comercial' },
  exibirNoPdv: { api: 'exibir_no_pdv', label: 'Exibir no PDV' },
  podeVenderSemEstoque: { api: 'pode_vender_sem_estoque', label: 'Vender sem Estoque' },
  pesoLiquido: { api: 'peso_liquido', label: 'Peso Líquido' },
  pesoBruto: { api: 'peso_bruto', label: 'Peso Bruto' },
  alturaCm: { api: 'altura_cm', label: 'Altura' },
  larguraCm: { api: 'largura_cm', label: 'Largura' },
  comprimentoCm: { api: 'comprimento_cm', label: 'Comprimento' },
  ncm: { api: 'ncm', label: 'NCM' },
  cest: { api: 'cest', label: 'CEST' },
  origemMercadoria: { api: 'origem_mercadoria', label: 'Origem da Mercadoria' },
  cfopPadrao: { api: 'cfop_padrao', label: 'CFOP Padrão' },
  fornecedorPadraoId: { api: 'fornecedor_padrao_id', label: 'Fornecedor Padrão' },
};

export type FichaForm = Record<string, unknown>;

export const detalheParaForm = (detalhe: ProdutoDetalhe): FichaForm => {
  const i = detalhe.item;
  const padrao = detalhe.fornecedores.find(f => f.padrao);
  return {
    nomeInterno: i.nome_core ?? undefined,
    skuComercial: i.sku_customizado ?? undefined,
    status: String(i.status || 'ATIVO').toUpperCase() !== 'INATIVO',
    variacao: i.descricao_variacao ?? undefined,
    idMarca: i.id_marca ?? undefined,
    categoriaId: i.categoria_id ?? undefined,
    familiaId: i.familia_id ?? undefined,
    nomeComercial: i.nome_comercial ?? undefined,
    descricaoComercial: i.descricao_comercial ?? undefined,
    exibirNoPdv: i.exibir_no_pdv,
    podeVenderSemEstoque: i.pode_vender_sem_estoque,
    pesoLiquido: i.peso_liquido ?? undefined,
    pesoBruto: i.peso_bruto ?? undefined,
    alturaCm: i.altura_cm ?? undefined,
    larguraCm: i.largura_cm ?? undefined,
    comprimentoCm: i.comprimento_cm ?? undefined,
    ncm: i.ncm ?? undefined,
    cest: i.cest ?? undefined,
    origemMercadoria: i.origem_mercadoria ?? undefined,
    cfopPadrao: i.cfop_padrao ?? undefined,
    fornecedorPadraoId: padrao?.id_fornecedor ?? undefined,
  };
};

const vazio = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

export const mesmoValor = (a: unknown, b: unknown): boolean => {
  if (vazio(a) && vazio(b)) return true;
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  return a === b;
};

export interface Alteracao {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

export const calcularAlteracoes = (inicial: FichaForm, atual: FichaForm): Alteracao[] =>
  Object.keys(CAMPOS_FICHA)
    .filter(campo => campo in atual && !mesmoValor(inicial[campo], atual[campo]))
    .map(campo => ({ field: campo, label: CAMPOS_FICHA[campo].label, before: inicial[campo], after: atual[campo] }));

// Payload parcial: só os campos alterados, com o nome da API; vazio vira null (limpa)
export const alteracoesParaPayload = (alteracoes: Alteracao[]): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  alteracoes.forEach(({ field, after }) => {
    const api = CAMPOS_FICHA[field].api;
    if (field === 'status') payload[api] = after ? 'ATIVO' : 'INATIVO';
    else payload[api] = vazio(after) ? null : typeof after === 'string' ? after.trim() : after;
  });
  return payload;
};
