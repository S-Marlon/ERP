import { avaliarPenteFino, calcularCustoMedio, chaveItemNovo, lerConversaoCompra, StagingItemRow } from './penteFino';
import { canonizar, criarResolvedor } from './unidadesEntrada';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const item = (patch: Partial<StagingItemRow>): StagingItemRow => ({
  id: 1,
  item_nfe_seq: '1',
  codigo_fornecedor: 'F1',
  nome_fornecedor: 'Item',
  quantidade: 10,
  quantidade_recebida: 10,
  custo_unitario_final: 5,
  preco_custo_unitario: 5,
  valor_total_nfe: 50,
  produto_id_sistema: 7,
  sku_sugerido: null,
  nome_item_sugerido: null,
  is_confirmed: 1,
  mapeamento_json: null,
  ...patch,
});

const lote = { id: 1, status: 'RASCUNHO', valor_total_nf_xml: 50, frete_adicional_valor: 0 };
const ctx = { idsItensExistentes: new Set([7]), skusExistentes: new Set(['JA-EXISTE']), fornecedorCadastrado: true };

export const runPenteFinoTests = (): void => {
  assert(avaliarPenteFino(lote, [item({})], ctx).aprovavel, 'Item vinculado e conferido deveria ser aprovável.');

  const naoConferido = avaliarPenteFino(lote, [item({ is_confirmed: 0 })], ctx);
  assert(!naoConferido.aprovavel && naoConferido.bloqueios[0].codigo === 'ITEM_NAO_CONFERIDO', 'Item não conferido deveria bloquear.');

  const semVinculo = avaliarPenteFino(lote, [item({ produto_id_sistema: null })], ctx);
  assert(semVinculo.bloqueios.some(b => b.codigo === 'ITEM_SEM_VINCULO'), 'Item sem vínculo nem SKU deveria bloquear.');

  const novoOk = avaliarPenteFino(lote, [item({ produto_id_sistema: null, sku_sugerido: 'NOVO-1', nome_item_sugerido: 'Novo' })], ctx);
  assert(novoOk.aprovavel && novoOk.resumo.novos === 1, 'Item novo com SKU e nome deveria ser aprovável.');

  const skuRepetido = avaliarPenteFino(lote, [item({ produto_id_sistema: null, sku_sugerido: 'LINHA-1', nome_item_sugerido: 'X',
    mapeamento_json: JSON.stringify({ mode: 'DRAFT', draftIdentity: { sku_comercial: 'ja-existe' } }) })], ctx);
  assert(skuRepetido.bloqueios.some(b => b.codigo === 'SKU_JA_EXISTE'), 'SKU customizado já existente no catálogo deveria bloquear.');
  // A chave da linha (sku_sugerido) nunca vira SKU: sem SKU customizado, a sequência é gerada na aprovação
  const soChave = avaliarPenteFino(lote, [item({ produto_id_sistema: null, sku_sugerido: 'JA-EXISTE', nome_item_sugerido: 'X' })], ctx);
  assert(!soChave.bloqueios.some(b => b.codigo === 'SKU_JA_EXISTE') && soChave.aprovavel, 'Chave da linha não pode ser tratada como SKU.');

  // SKU customizado: único entre os novos da nota e fora do formato das sequências
  const novoCom = (seq: string, sku: string) => item({ item_nfe_seq: seq, produto_id_sistema: null, sku_sugerido: `LINHA-${seq}`, nome_item_sugerido: 'X',
    mapeamento_json: JSON.stringify({ mode: 'DRAFT', draftIdentity: { sku_comercial: sku } }) });
  // Mesmo produto do fornecedor repetido na nota: agrupa num item só (aviso, não bloqueia)
  const repetido = avaliarPenteFino(lote, [novoCom('1', 'ABC'), novoCom('2', 'abc')], ctx);
  assert(repetido.aprovavel && repetido.avisos.some(a => a.codigo === 'SKU_AGRUPADO' && a.itens?.length === 2), 'Mesmo produto com o mesmo SKU deveria agrupar.');
  const soDescricao = avaliarPenteFino(lote, [novoCom('1', 'ABC'), { ...novoCom('2', 'ABC'), codigo_fornecedor: 'F9' }], ctx);
  assert(soDescricao.aprovavel, 'Mesma descrição do fornecedor (código diferente) deveria agrupar.');
  const diferentes = avaliarPenteFino(lote, [novoCom('1', 'ABC'), { ...novoCom('2', 'ABC'), codigo_fornecedor: 'F9', nome_fornecedor: 'Outro' }], ctx);
  assert(diferentes.bloqueios.some(b => b.codigo === 'SKU_REPETIDO_NA_NOTA' && b.itens?.join() === '2'), 'Produtos diferentes com o mesmo SKU deveriam bloquear.');
  assert(chaveItemNovo(novoCom('1', 'abc')) === chaveItemNovo(novoCom('2', 'ABC')), 'Mesma chave de criação para o mesmo SKU.');
  assert(chaveItemNovo(item({ sku_sugerido: 'LINHA-1' })) !== chaveItemNovo(item({ sku_sugerido: 'LINHA-2' })), 'Sem SKU: uma chave por linha.');
  assert(avaliarPenteFino(lote, [novoCom('1', 'ABC'), novoCom('2', 'ABD')], ctx).aprovavel, 'SKUs diferentes são aprováveis.');
  assert(avaliarPenteFino(lote, [novoCom('1', 'it-000045')], ctx).bloqueios.some(b => b.codigo === 'SKU_RESERVADO'), 'SKU no formato da sequência deveria bloquear.');

  const semFornecedor = avaliarPenteFino(lote, [item({})], { ...ctx, fornecedorCadastrado: false });
  assert(!semFornecedor.aprovavel && semFornecedor.bloqueios.some(b => b.codigo === 'FORNECEDOR_NAO_CADASTRADO'), 'Fornecedor não cadastrado deveria bloquear.');

  const importado = avaliarPenteFino({ ...lote, status: 'IMPORTADO' }, [item({})], ctx);
  assert(importado.bloqueios.some(b => b.codigo === 'LOTE_FINALIZADO'), 'Lote importado não pode ser aprovado de novo.');

  const divergente = avaliarPenteFino(lote, [item({ quantidade_recebida: 8 })], ctx);
  assert(divergente.aprovavel && divergente.avisos.some(a => a.codigo === 'DIVERGENCIA_QUANTIDADE'), 'Divergência deveria ser aviso, não bloqueio.');

  const conv = (fator: unknown) => item({ mapeamento_json: JSON.stringify({ conversaoCompra: { unidade_compra: 'CX', unidade_base: 'UN', fator } }) });
  assert(avaliarPenteFino(lote, [conv(0)], ctx).bloqueios.some(b => b.codigo === 'FATOR_INVALIDO'), 'Fator zero deveria bloquear.');
  const convertido = avaliarPenteFino(lote, [conv(50)], ctx);
  assert(convertido.aprovavel && convertido.avisos.some(a => a.codigo === 'CONVERSAO_UNIDADE'), 'Fator 50 deveria ser aprovável com aviso de conversão.');
  assert(lerConversaoCompra(item({ unidade_original: 'pc' })).fator === 1, 'Sem conversão no mapeamento, o fator padrão é 1.');

  const novoComConfig = (fatorConfig: number) => item({
    produto_id_sistema: null, sku_sugerido: 'NOVO-CX', nome_item_sugerido: 'Novo',
    mapeamento_json: JSON.stringify({
      conversaoCompra: { unidade_compra: 'CX', unidade_base: 'UN', fator: 50 },
      configVendas: { unidades: [{ sigla: 'UN', fator: 1, is_base: true }, { sigla: 'CX', fator: fatorConfig, is_base: false }], faixas: [] },
    }),
  });
  assert(avaliarPenteFino(lote, [novoComConfig(50)], ctx).aprovavel, 'Configuração coerente com a conversão deveria passar.');
  assert(avaliarPenteFino(lote, [novoComConfig(20)], ctx).bloqueios.some(b => b.codigo === 'CONFIG_VENDAS_INCOERENTE'), 'Fator da configuração diferente da conversão deveria bloquear.');

  const temAviso = (it: StagingItemRow, codigo: string, contexto = ctx) =>
    avaliarPenteFino(lote, [it], contexto).avisos.some(a => a.codigo === codigo);
  assert(temAviso(item({ ean: '7891000315508' }), 'GTIN_INVALIDO'), 'GTIN com dígito errado deveria gerar aviso.');
  assert(!temAviso(item({ ean: '7891000315507' }), 'GTIN_INVALIDO'), 'GTIN válido não deveria gerar aviso.');
  assert(temAviso(item({ ean: 'SEM GTIN' }), 'SEM_GTIN'), 'Item sem GTIN deveria gerar aviso.');
  assert(
    !temAviso(item({ ean: 'SEM GTIN', mapeamento_json: JSON.stringify({ gtin_manual: '7891000315507' }) }), 'SEM_GTIN'),
    'GTIN manual deveria cobrir o "SEM GTIN" do XML.'
  );
  const ctxGtin = { ...ctx, gtinsEmUso: new Map([['7891000315507', 99]]) };
  assert(temAviso(item({ ean: '7891000315507' }), 'GTIN_EM_USO', ctxGtin), 'GTIN de outro item deveria gerar aviso.');
  assert(!temAviso(item({ ean: '7891000315507', produto_id_sistema: 99 }), 'GTIN_EM_USO', { ...ctxGtin, idsItensExistentes: new Set([99]) }), 'GTIN do próprio item não é conflito.');

  assert(calcularCustoMedio(10, 5, 10, 7) === 6, 'Custo médio de 10@5 + 10@7 deveria ser 6.');
  assert(calcularCustoMedio(0, 0, 4, 9) === 9, 'Sem saldo anterior, o custo médio é o custo da entrada.');

  // Unidades de entrada: sigla da nota precisa ser do cadastro ou ter equivalência
  const unidades = criarResolvedor(['UN', 'MT'], [{ idFornecedor: null, siglaEntrada: 'M', siglaInterna: 'MT' }], null);
  const ctxUn = { ...ctx, unidades };
  const rM = avaliarPenteFino(lote, [item({ unidade_original: 'M' })], ctxUn);
  assert(rM.aprovavel && rM.avisos.some(a => a.codigo === 'UNIDADE_TRADUZIDA'), 'M com regra geral deveria passar com aviso de tradução.');
  const rKg = avaliarPenteFino(lote, [item({ unidade_original: 'KG' })], ctxUn);
  assert(!rKg.aprovavel && rKg.bloqueios.some(b => b.codigo === 'UNIDADE_NAO_RECONHECIDA' && b.mensagem.includes('KG')), 'KG sem regra deveria bloquear.');
  assert(avaliarPenteFino(lote, [item({ unidade_original: 'UN' })], ctxUn).avisos.every(a => a.codigo !== 'UNIDADE_TRADUZIDA'), 'UN do cadastro não é tradução.');
  const convM = lerConversaoCompra(item({ unidade_original: 'M', mapeamento_json: JSON.stringify({ conversaoCompra: { unidade_compra: 'M', unidade_base: 'M', fator: 1 } }) }), canonizar(unidades));
  assert(convM.unidadeCompra === 'MT' && convM.unidadeBase === 'MT' && convM.fator === 1, 'Conversão deveria usar MT nos dois lados.');
  const novoCfg = item({ produto_id_sistema: null, sku_sugerido: 'NOVO', nome_item_sugerido: 'Mangueira', unidade_original: 'M',
    mapeamento_json: JSON.stringify({ configVendas: { unidades: [{ sigla: 'M', fator: 1, is_base: true }] } }) });
  assert(!avaliarPenteFino(lote, [novoCfg], ctxUn).bloqueios.some(b => b.codigo === 'CONFIG_VENDAS_INCOERENTE'), 'Config de vendas em M deveria bater com a base MT traduzida.');
  assert(avaliarPenteFino(lote, [item({ unidade_original: 'KG' })], ctx).aprovavel, 'Sem dicionário no contexto não bloqueia (compatível).');
};
