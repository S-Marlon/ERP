// Pente-fino do lote de staging: decide se a NF-e pode dar entrada definitiva no estoque.
// Função pura (sem banco) para ser usada tanto na análise da tela quanto na aprovação.
import { gtinEfetivo, isSemGtin, validarGtin } from './gtin';

export interface StagingItemRow {
  id: number;
  item_nfe_seq: string | null;
  codigo_fornecedor: string | null;
  nome_fornecedor: string | null;
  quantidade: number | string | null;
  quantidade_recebida: number | string | null;
  custo_unitario_final: number | string | null;
  preco_custo_unitario: number | string | null;
  valor_total_nfe: number | string | null;
  produto_id_sistema: number | null;
  sku_sugerido: string | null;
  nome_item_sugerido: string | null;
  is_confirmed: number | null;
  mapeamento_json: string | null;
  unidade_original?: string | null;
  ean?: string | null; // cEAN do XML
  ncm_original?: string | null;
  cest_original?: string | null;
}

export interface LoteRow {
  id: number;
  status: string;
  valor_total_nf_xml: number | string | null; // vNF lido do dados_nota_fiscal
  frete_adicional_valor: number | string | null;
}

export interface PenteFinoContexto {
  idsItensExistentes: Set<number>;   // produto_id_sistema que existem em itens_core
  skusExistentes: Set<string>;       // SKUs já usados em itens_core (para itens novos)
  fornecedorCadastrado: boolean;
  gtinsEmUso?: Map<string, number>; // GTIN -> id_item que já usa esse código
}

export interface Verificacao {
  codigo: string;
  mensagem: string;
  itens?: string[]; // sequências da NF afetadas
}

export interface ResultadoPenteFino {
  aprovavel: boolean;
  bloqueios: Verificacao[];
  avisos: Verificacao[];
  resumo: {
    totalItens: number;
    conferidos: number;
    novos: number;
    vinculados: number;
    valorItens: number;
    valorNota: number;
  };
}

export const STATUS_LOTE_FINALIZADO = ['IMPORTADO', 'DESCARTADO'];
const TOLERANCIA_TOTAL = 0.05;

const num = (value: unknown): number => Number(value) || 0;
const seq = (item: StagingItemRow): string => String(item.item_nfe_seq || item.id);
const texto = (value: unknown): string => String(value ?? '').trim();

export const lerMapeamento = (item: StagingItemRow): Record<string, any> => {
  if (!item.mapeamento_json) return {};
  try {
    return JSON.parse(item.mapeamento_json) || {};
  } catch {
    return {};
  }
};

export const isItemNovo = (item: StagingItemRow): boolean => !item.produto_id_sistema;

// GTIN que será gravado no item (manual tem prioridade sobre o XML)
export const gtinDoItem = (item: StagingItemRow): string | null =>
  gtinEfetivo(lerMapeamento(item).gtin_manual, item.ean);

export interface ConversaoCompra {
  unidadeCompra: string;  // unidade da NF (uCom)
  unidadeBase: string;    // unidade de estoque do item
  fator: number;          // unidades base em 1 unidade da NF
}

// Conversão escolhida no mapeamento; sem ela, 1 unidade da NF = 1 unidade base
export const lerConversaoCompra = (item: StagingItemRow): ConversaoCompra => {
  const conv = lerMapeamento(item).conversaoCompra || {};
  const unidadeCompra = String(conv.unidade_compra || item.unidade_original || 'UN').trim().toUpperCase();
  const fatorInformado = conv.fator === undefined || conv.fator === null ? 1 : Number(conv.fator);
  return {
    unidadeCompra,
    unidadeBase: String(conv.unidade_base || unidadeCompra).trim().toUpperCase(),
    fator: Number.isFinite(fatorInformado) ? fatorInformado : NaN,
  };
};

export const avaliarPenteFino = (
  lote: LoteRow,
  itens: StagingItemRow[],
  ctx: PenteFinoContexto
): ResultadoPenteFino => {
  const bloqueios: Verificacao[] = [];
  const avisos: Verificacao[] = [];

  const coletar = (lista: Verificacao[], codigo: string, mensagem: string, filtro: (i: StagingItemRow) => boolean) => {
    const afetados = itens.filter(filtro).map(seq);
    if (afetados.length > 0) lista.push({ codigo, mensagem, itens: afetados });
  };

  if (STATUS_LOTE_FINALIZADO.includes(lote.status)) {
    bloqueios.push({ codigo: 'LOTE_FINALIZADO', mensagem: `Lote já está ${lote.status}.` });
  }
  if (itens.length === 0) {
    bloqueios.push({ codigo: 'SEM_ITENS', mensagem: 'Lote sem itens na staging.' });
  }

  coletar(bloqueios, 'ITEM_SEM_VINCULO', 'Itens sem código interno (vínculo ou SKU do novo item).',
    i => isItemNovo(i) && !texto(i.sku_sugerido));
  coletar(bloqueios, 'ITEM_NOVO_SEM_NOME', 'Itens novos sem nome interno definido.',
    i => isItemNovo(i) && !!texto(i.sku_sugerido) && !texto(i.nome_item_sugerido));
  coletar(bloqueios, 'ITEM_NAO_CONFERIDO', 'Itens ainda não conferidos.',
    i => Number(i.is_confirmed) !== 1);
  coletar(bloqueios, 'PRODUTO_INEXISTENTE', 'Itens vinculados a um produto que não existe mais no catálogo.',
    i => !isItemNovo(i) && !ctx.idsItensExistentes.has(Number(i.produto_id_sistema)));
  coletar(bloqueios, 'SKU_JA_EXISTE', 'SKU do novo item já existe no catálogo (vincule ao existente ou altere o SKU).',
    i => isItemNovo(i) && ctx.skusExistentes.has(texto(i.sku_sugerido).toUpperCase()));
  coletar(bloqueios, 'CUSTO_INVALIDO', 'Itens recebidos com custo unitário zerado.',
    i => num(i.quantidade_recebida) > 0 && num(i.custo_unitario_final || i.preco_custo_unitario) <= 0);

  coletar(bloqueios, 'FATOR_INVALIDO', 'Itens com fator de conversão de compra inválido (precisa ser maior que zero).',
    i => !(lerConversaoCompra(i).fator > 0));

  coletar(bloqueios, 'CONFIG_VENDAS_INCOERENTE', 'Configuração de vendas do item novo não bate com a conversão de compra (unidade base ou fator).',
    i => {
      const config = lerMapeamento(i).configVendas;
      if (!isItemNovo(i) || !config || !Array.isArray(config.unidades) || config.unidades.length === 0) return false;
      const conv = lerConversaoCompra(i);
      const unidades = config.unidades as Array<{ sigla: string; fator: number; is_base: boolean }>;
      const base = unidades.find(u => u.is_base);
      if (!base || String(base.sigla).toUpperCase() !== conv.unidadeBase) return true;
      if (conv.unidadeCompra === conv.unidadeBase) return false;
      const compra = unidades.find(u => String(u.sigla).toUpperCase() === conv.unidadeCompra);
      return !compra || Math.abs(Number(compra.fator) - conv.fator) > 0.000001;
    });

  coletar(avisos, 'GTIN_INVALIDO', 'Itens com GTIN inválido (dígito verificador): o código não será gravado. Corrija na conferência.',
    i => {
      const gtin = gtinDoItem(i);
      return gtin !== null && !validarGtin(gtin);
    });
  coletar(avisos, 'GTIN_EM_USO', 'Itens com GTIN já usado por outro item do catálogo: o código não será gravado neste item.',
    i => {
      const gtin = gtinDoItem(i);
      if (!gtin || !validarGtin(gtin) || !ctx.gtinsEmUso) return false;
      const dono = ctx.gtinsEmUso.get(gtin);
      return dono !== undefined && (isItemNovo(i) || dono !== Number(i.produto_id_sistema));
    });
  coletar(avisos, 'SEM_GTIN', 'Itens sem código de barras (XML "SEM GTIN" e nenhum informado).',
    i => isSemGtin(lerMapeamento(i).gtin_manual) && isSemGtin(i.ean));

  coletar(avisos, 'CONVERSAO_UNIDADE', 'Itens com conversão de unidade: a quantidade da NF será multiplicada pelo fator no estoque.',
    i => lerConversaoCompra(i).fator > 0 && lerConversaoCompra(i).fator !== 1);
  coletar(avisos, 'DIVERGENCIA_QUANTIDADE', 'Quantidade recebida diferente da nota (entra a quantidade recebida).',
    i => Math.abs(num(i.quantidade_recebida) - num(i.quantidade)) > 0.0001);
  coletar(avisos, 'QUANTIDADE_ZERO', 'Itens com quantidade recebida zero não geram movimento de estoque.',
    i => num(i.quantidade_recebida) <= 0);

  const valorItens = itens.reduce((acc, i) => acc + num(i.valor_total_nfe), 0);
  const valorNota = num(lote.valor_total_nf_xml) + num(lote.frete_adicional_valor);
  if (itens.length > 0 && valorNota > 0 && Math.abs(valorItens - valorNota) > TOLERANCIA_TOTAL) {
    avisos.push({
      codigo: 'TOTAL_DIVERGENTE',
      mensagem: `Soma dos custos dos itens (R$ ${valorItens.toFixed(2)}) difere do total da nota + frete adicional (R$ ${valorNota.toFixed(2)}).`,
    });
  }

  if (!ctx.fornecedorCadastrado) {
    avisos.push({
      codigo: 'FORNECEDOR_NAO_CADASTRADO',
      mensagem: 'Fornecedor da NF não cadastrado: o vínculo item x fornecedor não será gravado.',
    });
  }

  const novos = itens.filter(isItemNovo).length;
  return {
    aprovavel: bloqueios.length === 0,
    bloqueios,
    avisos,
    resumo: {
      totalItens: itens.length,
      conferidos: itens.filter(i => Number(i.is_confirmed) === 1).length,
      novos,
      vinculados: itens.length - novos,
      valorItens: Number(valorItens.toFixed(2)),
      valorNota: Number(valorNota.toFixed(2)),
    },
  };
};

// Custo médio ponderado após uma entrada
export const calcularCustoMedio = (saldoAnterior: number, custoMedioAnterior: number, quantidade: number, custoUnitario: number): number => {
  const saldoPosterior = saldoAnterior + quantidade;
  if (saldoAnterior <= 0 || saldoPosterior <= 0) return custoUnitario;
  return (saldoAnterior * custoMedioAnterior + quantidade * custoUnitario) / saldoPosterior;
};
