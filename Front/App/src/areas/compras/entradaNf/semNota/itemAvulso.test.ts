import { mapeamentoItemAvulso } from './itemAvulso';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`itemAvulso: ${msg}`); };
const perto = (a: number, b: number) => Math.abs(a - b) < 0.0001;

// Produto de venda com SKU, marca e categoria: preço = custo × markup
const venda = mapeamentoItemAvulso({
  nItem: 1, nome: ' Graxa azul 500g ', skuCustomizado: ' GRX-500 ', tipoRecurso: 'produto', unidade: 'un', custoUnitario: 10, markup: 2,
  classificacao: { familiaId: null, categoriaId: 12, atributos: null, marcaId: 3 }, ean: '7891234567895',
});
ok(venda.mode === 'DRAFT' && venda.existingProductId === null, 'item novo');
ok(venda.draftIdentity?.nome_interno === 'Graxa azul 500g' && venda.draftIdentity?.nome_comercial === 'Graxa azul 500g', 'nome sem espaços');
ok(venda.draftIdentity?.sku_comercial === 'GRX-500' && venda.draftIdentity?.sku_interno === 'LINHA-1', 'SKU customizado e chave da linha');
ok(venda.draftIdentity?.categoria_id === 12 && venda.draftIdentity?.marca_id === 3 && venda.draftIdentity?.tipo_recurso === 'PRODUTO', 'classificação');
ok(venda.conversaoCompra.unidade_base === 'UN' && venda.conversaoCompra.fator === 1, 'unidade 1:1');
ok(venda.configVendas !== null && perto(venda.configVendas!.faixas[0].preco_unitario, 20), 'preço pelo markup');
ok(venda.supplierLinkData.ean_fornecedor === '7891234567895', 'EAN no vínculo');
console.log('venda: ok');

// Consumo: sem preço e SKU sequencial
const consumo = mapeamentoItemAvulso({ nItem: 1, nome: 'Estopa', skuCustomizado: 'X', tipoRecurso: 'CONSUMO', unidade: 'KG', custoUnitario: 5, markup: 1.8, classificacao: null });
ok(consumo.configVendas === null && consumo.draftIdentity?.sku_comercial === '', 'consumo sem preço e com sequencial');
console.log('consumo: ok');
