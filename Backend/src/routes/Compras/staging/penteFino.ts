// Pente-fino do lote de staging: decide se a NF-e pode dar entrada definitiva no estoque.
// Função pura (sem banco) para ser usada tanto na análise da tela quanto na aprovação.
import { gtinEfetivo, isSemGtin, validarGtin } from './gtin';
import { destinoIncompativel, lerDestinos, validarDestinos } from './destinos';

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
  skusExistentes: Set<string>;       // SKUs já usados (raiz ou customizado) — comparados com o SKU customizado planejado
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

// ------------------------------------------------------------------ SKU do item novo
// Raiz (itens_core.sku): sempre gerado pelo sistema, sequencial e oculto (IT-000123).
// Customizado (o que o operador vê): o digitado no mapeamento; se vazio, código do fornecedor para itens de venda
// e sequencial (CON-000045 / ATV-000012) para consumo e patrimônio.
const TIPOS_FORA_DA_VENDA = ['CONSUMO', 'INSUMO', 'ATIVO'];

export const tipoRecursoDoMapeamento = (item: StagingItemRow): string => {
  const m = lerMapeamento(item);
  return String(m.tipo_recurso || m.draftIdentity?.tipo_recurso || 'PRODUTO').toUpperCase();
};

export const skuCustomizadoPlanejado = (item: StagingItemRow): string | null => {
  const draft = lerMapeamento(item).draftIdentity || {};
  const digitado = texto(draft.sku_comercial);
  if (digitado) return digitado;
  // Vazio: sequência gerada na aprovação com o id do banco (IT-/CON-/ATV-000123).
  // sku_interno/sku_sugerido são só a chave da linha na staging (LINHA-n) e nunca viram SKU.
  return null;
};

// Formato das sequências geradas pelo sistema: digitado assim, colidiria com um código gerado depois
export const skuNoFormatoReservado = (sku: string | null | undefined) => /^(IT|CON|ATV|TMP)-\d+$/i.test(String(sku || '').trim());

export const prefixoSkuSequencial = (tipoRecurso: string): string => {
  const t = String(tipoRecurso || '').toUpperCase();
  if (t === 'CONSUMO' || t === 'INSUMO') return 'CON';
  if (t === 'ATIVO') return 'ATV';
  return 'IT';
};

export const skuSequencial = (prefixo: string, idItem: number): string => `${prefixo}-${String(idItem).padStart(6, '0')}`;

// Destinos da linha (depósitos); para item vinculado o tipo vem do catálogo na aprovação
export const destinosDoItem = (item: StagingItemRow, tipoRecurso?: string) =>
  lerDestinos(lerMapeamento(item).destinos, num(item.quantidade_recebida), tipoRecurso || tipoRecursoDoMapeamento(item));

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

  coletar(bloqueios, 'ITEM_SEM_VINCULO', 'Itens sem vínculo (nem item do catálogo nem cadastro novo).',
    i => isItemNovo(i) && !texto(i.sku_sugerido));
  coletar(bloqueios, 'ITEM_NOVO_SEM_NOME', 'Itens novos sem nome interno definido.',
    i => isItemNovo(i) && !!texto(i.sku_sugerido) && !texto(i.nome_item_sugerido));
  coletar(bloqueios, 'ITEM_NAO_CONFERIDO', 'Itens ainda não conferidos.',
    i => Number(i.is_confirmed) !== 1);
  coletar(bloqueios, 'PRODUTO_INEXISTENTE', 'Itens vinculados a um produto que não existe mais no catálogo.',
    i => !isItemNovo(i) && !ctx.idsItensExistentes.has(Number(i.produto_id_sistema)));
  coletar(bloqueios, 'SKU_JA_EXISTE', 'SKU customizado do novo item já existe no catálogo (vincule ao existente ou altere o SKU).',
    i => {
      const sku = isItemNovo(i) ? skuCustomizadoPlanejado(i) : null;
      return !!sku && ctx.skusExistentes.has(sku.toUpperCase());
    });
  coletar(bloqueios, 'SKU_RESERVADO', 'SKU customizado no formato das sequências do sistema (IT-/CON-/ATV-000123): deixe vazio para gerar ou use outro código.',
    i => isItemNovo(i) && skuNoFormatoReservado(skuCustomizadoPlanejado(i)));
  // Itens novos diferentes (linhas diferentes) com o mesmo SKU customizado
  const donoSku = new Map<string, string>();
  coletar(bloqueios, 'SKU_REPETIDO_NA_NOTA', 'Itens novos diferentes com o mesmo SKU customizado nesta nota.',
    i => {
      const sku = isItemNovo(i) ? skuCustomizadoPlanejado(i) : null;
      if (!sku) return false;
      const chave = sku.toUpperCase();
      const grupo = texto(i.sku_sugerido).toUpperCase();
      if (!donoSku.has(chave)) { donoSku.set(chave, grupo); return false; }
      return donoSku.get(chave) !== grupo;
    });
  coletar(bloqueios, 'DESTINO_INVALIDO', 'Divisão entre depósitos não confere com a quantidade recebida.',
    i => validarDestinos(lerMapeamento(i).destinos, num(i.quantidade_recebida)) !== null);
  coletar(bloqueios, 'DESTINO_INCOMPATIVEL', 'Destino não combina com o tipo de entrada (ex.: produto de venda inteiro no almoxarifado). Ajuste o destino ou o tipo.',
    i => validarDestinos(lerMapeamento(i).destinos, num(i.quantidade_recebida)) === null
      && destinoIncompativel(lerMapeamento(i).destinos, num(i.quantidade_recebida), tipoRecursoDoMapeamento(i)) !== null);
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
  coletar(avisos, 'FORA_DA_VENDA', 'Itens (ou parte deles) que entram no almoxarifado ou patrimônio: não ficam disponíveis no PDV.',
    i => destinosDoItem(i).some(d => d.deposito !== 'VENDA'));

  const valorItens = itens.reduce((acc, i) => acc + num(i.valor_total_nfe), 0);
  const valorNota = num(lote.valor_total_nf_xml) + num(lote.frete_adicional_valor);
  if (itens.length > 0 && valorNota > 0 && Math.abs(valorItens - valorNota) > TOLERANCIA_TOTAL) {
    avisos.push({
      codigo: 'TOTAL_DIVERGENTE',
      mensagem: `Soma dos custos dos itens (R$ ${valorItens.toFixed(2)}) difere do total da nota + frete adicional (R$ ${valorNota.toFixed(2)}).`,
    });
  }

  // Sem o fornecedor cadastrado a entrada fica sem vínculo item x fornecedor (as próximas notas não reconhecem
  // os itens) e sem a quem atribuir a compra: bloqueia até cadastrar (botão Cadastrar no card do fornecedor)
  if (!ctx.fornecedorCadastrado) {
    bloqueios.push({
      codigo: 'FORNECEDOR_NAO_CADASTRADO',
      mensagem: 'Fornecedor da NF não cadastrado: cadastre-o (card do Fornecedor, botão Cadastrar) antes de dar entrada.',
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

// Custo médio após estornar uma entrada (tira do saldo o que entrou, pelo custo com que entrou).
// Saldo zerado ou conta sem sentido (custo negativo) mantém o custo médio anterior.
export const calcularCustoMedioEstorno = (saldoAnterior: number, custoMedioAnterior: number, quantidade: number, custoUnitario: number): number => {
  const saldoPosterior = saldoAnterior - quantidade;
  if (saldoPosterior <= 0.0000001) return custoMedioAnterior;
  const resultado = (saldoAnterior * custoMedioAnterior - quantidade * custoUnitario) / saldoPosterior;
  return resultado > 0 ? resultado : custoMedioAnterior;
};

// Custo médio ponderado após uma entrada
export const calcularCustoMedio = (saldoAnterior: number, custoMedioAnterior: number, quantidade: number, custoUnitario: number): number => {
  const saldoPosterior = saldoAnterior + quantidade;
  if (saldoAnterior <= 0 || saldoPosterior <= 0) return custoUnitario;
  return (saldoAnterior * custoMedioAnterior + quantidade * custoUnitario) / saldoPosterior;
};
