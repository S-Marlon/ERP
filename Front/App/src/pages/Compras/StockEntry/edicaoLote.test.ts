import { aplicarClassificacao, configVendasRapida, foraDaVenda, linhaSemVinculo, mapeamentoRapido, situacaoSkusNovos } from './edicaoLote';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`edicaoLote: ${msg}`); };
const perto = (a: number, b: number) => Math.abs(a - b) < 0.0001;

export const runEdicaoLote = () => {
  ok(foraDaVenda('consumo') && foraDaVenda('ATIVO') && !foraDaVenda('PRODUTO') && !foraDaVenda(null), 'tipos fora da venda');
  ok(linhaSemVinculo({}) && !linhaSemVinculo({ mappedId: 'X' }) && !linhaSemVinculo({ mapeamento: {} }), 'linha sem vínculo');

  // Config rápida: só a unidade da nota, base, preço = custo x markup
  const cfg = configVendasRapida('cx', 10, 2);
  ok(cfg.unidades.length === 1 && cfg.unidades[0].sigla === 'CX' && cfg.unidades[0].is_base, 'unidade base = unidade da nota');
  ok(cfg.faixas.length === 1 && perto(cfg.faixas[0].preco_unitario, 20) && cfg.faixas[0].markup === 2, 'preço pelo markup');
  ok(perto(cfg.custo_gerencial, 10), 'custo gerencial');

  // Produto de venda
  const venda = mapeamentoRapido({ nItem: 3, sku: 'GRX-1', descricao: ' Graxa 500g ', unidade: 'un', valorUnitario: 12.5, tipoRecurso: 'PRODUTO' }, { markup: 1.5 });
  ok(venda.mode === 'DRAFT' && venda.draftIdentity?.sku_comercial === 'GRX-1', 'SKU customizado = código do fornecedor');
  ok(venda.draftIdentity?.nome_interno === 'Graxa 500g' && venda.draftIdentity?.sku_interno === 'LINHA-3', 'nome e chave da linha');
  ok(venda.conversaoCompra.fator === 1 && venda.conversaoCompra.unidade_base === 'UN', 'conversão 1:1');
  ok(venda.configVendas !== null && perto(venda.configVendas!.faixas[0].preco_unitario, 18.75), 'preço de varejo');
  ok(venda.draftIdentity?.familia_id === null && venda.draftIdentity?.atributos === null, 'sem classificação');

  // Consumo: sem preço e SKU sequencial; família manda na categoria
  const consumo = mapeamentoRapido({ nItem: 4, sku: 'LIMP', descricao: 'Detergente', unidade: 'UN', valorUnitario: 3, tipoRecurso: 'CONSUMO' },
    { markup: 1.8, classificacao: { familiaId: 7, categoriaId: 99, atributos: { 5: '500ml' } } });
  ok(consumo.configVendas === null && consumo.draftIdentity?.sku_comercial === '', 'consumo sem preço e com sequencial');
  ok(consumo.draftIdentity?.familia_id === 7 && consumo.draftIdentity?.categoria_id === null, 'categoria vem da família');
  ok((consumo.draftIdentity?.atributos as any)?.[5] === '500ml', 'atributos informados');

  // Classificação em lote
  ok(aplicarClassificacao(null, { familiaId: 1, categoriaId: null, atributos: null }) === null, 'sem mapeamento não classifica');
  ok(aplicarClassificacao({ ...venda, mode: 'EXISTING_DIRECT' }, { familiaId: 1, categoriaId: null, atributos: null }) === null, 'vinculado não classifica');

  const mesma = aplicarClassificacao(consumo, { familiaId: 7, categoriaId: null, atributos: { 6: '220V' } });
  ok((mesma?.draftIdentity?.atributos as any)?.[5] === '500ml' && (mesma?.draftIdentity?.atributos as any)?.[6] === '220V', 'mesma família soma valores');

  const outra = aplicarClassificacao(consumo, { familiaId: 8, categoriaId: null, atributos: null });
  ok(outra?.draftIdentity?.familia_id === 8 && outra?.draftIdentity?.atributos === null, 'outra família limpa valores antigos');

  const soCategoria = aplicarClassificacao(venda, { familiaId: null, categoriaId: 12, atributos: {} });
  ok(soCategoria?.draftIdentity?.categoria_id === 12 && soCategoria?.draftIdentity?.familia_id === null, 'só categoria');
  ok(soCategoria?.draftIdentity?.atributos === null, 'valores vazios não viram objeto');

  // Edição de uma linha: substitui (valor apagado some; desligar o preenchimento limpa)
  const unica = aplicarClassificacao(consumo, { familiaId: 7, categoriaId: null, atributos: { 6: '110V' } }, { substituir: true });
  ok((unica?.draftIdentity?.atributos as any)?.[5] === undefined && (unica?.draftIdentity?.atributos as any)?.[6] === '110V', 'substituir troca os valores');
  const limpa = aplicarClassificacao(consumo, { familiaId: 7, categoriaId: null, atributos: null }, { substituir: true });
  ok(limpa?.draftIdentity?.atributos === null, 'substituir sem valores limpa');

  // Mesmo SKU em itens novos: precisa de confirmação; mesmoProduto orienta pela nota do fornecedor
  const linha = (sku: string, cProd: string, xProd: string, conf?: string) =>
    ({ sku: cProd, descricao: xProd, mapeamento: { mode: 'DRAFT', draftIdentity: { sku_comercial: sku }, agrupamentoConfirmado: conf } });
  let s = situacaoSkusNovos([linha('ABC', 'F1', 'Terminal'), linha('abc', 'F1', 'Terminal')]).get('ABC');
  ok(s && s.mesmoProduto && !s.confirmado && s.linhas.length === 2, 'mesmo produto sem confirmação');
  s = situacaoSkusNovos([linha('ABC', 'F1', 'Terminal'), linha('ABC', 'F2', 'Mangueira')]).get('ABC');
  ok(s && !s.mesmoProduto, 'produtos diferentes');
  s = situacaoSkusNovos([linha('ABC', 'F1', 'T', 'abc'), linha('abc', 'F1', 'T', 'ABC')]).get('ABC');
  ok(s && s.confirmado, 'confirmado nas duas linhas');
  ok(situacaoSkusNovos([linha('ABC', 'F1', 'T'), linha('ABD', 'F1', 'T')]).size === 0, 'SKUs diferentes');
};
