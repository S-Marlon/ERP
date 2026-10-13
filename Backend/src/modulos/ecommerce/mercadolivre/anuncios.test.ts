import assert from 'assert';
import {
  AnuncioDados, AtributoML, cortarTitulo, tituloLegivel, eixosDeVariacao, filtrarAtributosCategoria, ItemAnuncio, pendenciasAnuncio,
  precoNoMl, resolverValor, sugerirAtributos,
} from './anuncios';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const brutos = [
  { id: 'BRAND', name: 'Marca', value_type: 'string', tags: { required: true } },
  { id: 'MODEL', name: 'Modelo', value_type: 'string', tags: { catalog_required: true } },
  { id: 'VOLTAGE', name: 'Voltagem', value_type: 'list', tags: { allow_variations: true }, values: [{ id: '1', name: '220V' }, { id: '2', name: '127V' }] },
  { id: 'MATERIAL', name: 'Material', value_type: 'string', tags: {} },
  { id: 'MAX_PRESSURE', name: 'Pressão máxima', value_type: 'number_unit', tags: {}, allowed_units: [{ id: 'bar' }], default_unit: 'bar' },
  { id: 'GTIN', name: 'GTIN', value_type: 'string', tags: { variation_attribute: true } },
  { id: 'SELLER_PACKAGE_WEIGHT', name: 'Peso', value_type: 'number_unit', tags: { hidden: true } },
];
const atributos: AtributoML[] = filtrarAtributosCategoria(brutos);

const item = (id: number, extra: Partial<ItemAnuncio> = {}): ItemAnuncio => ({
  idItem: id, sku: `SKU-${id}`, nome: `Item ${id}`, ativo: true, preco: 100, precoMl: null, estoque: 5, fotos: 1, fotoUrl: null,
  gtin: '7891234567890', pesoKg: 0.2, medidasCm: { altura: 5, largura: 5, comprimento: 10 }, marca: 'Acme',
  valoresErp: {}, motivosCadastro: [], ...extra,
});
const dados = (extra: Partial<AnuncioDados> = {}): AnuncioDados => ({
  titulo: 'Bomba hidráulica', categoriaMl: 'MLB1', descricao: 'ok', ajustePreco: 0,
  atributos: { BRAND: { origem: 'marca' }, MODEL: { origem: 'fixo', valor: 'BH-1' } }, ...extra,
});
const categoria = { id: 'MLB1', final: true, maxTitulo: 60, maxVariacoes: 100, maxFotos: 10 };
const erros = (d: AnuncioDados, itens: ItemAnuncio[]) => pendenciasAnuncio(d, itens, categoria, atributos).filter(p => p.nivel === 'erro').map(p => p.texto);

teste('atributos da categoria: tira ocultos e automáticos, obrigatórios primeiro', () => {
  assert.deepStrictEqual(atributos.map(a => a.id), ['BRAND', 'MODEL', 'VOLTAGE', 'MATERIAL', 'MAX_PRESSURE']);
  assert.strictEqual(atributos[1].obrigatorio, true);
});

teste('sugestão: marca e atributo nosso com o mesmo nome', () => {
  const s = sugerirAtributos(atributos, [{ id: 7, nome: 'material' }, { id: 8, nome: 'Pressao Maxima' }], { MODEL: { origem: 'fixo', valor: 'X' } });
  assert.deepStrictEqual(s.BRAND, { origem: 'marca' });
  assert.deepStrictEqual(s.MATERIAL, { origem: 'erp', atributoId: 7 });
  assert.deepStrictEqual(s.MAX_PRESSURE, { origem: 'erp', atributoId: 8 });
  assert.deepStrictEqual(s.MODEL, { origem: 'fixo', valor: 'X' });
});

teste('valor resolvido: id da lista e número com unidade', () => {
  const volt = atributos.find(a => a.id === 'VOLTAGE');
  assert.deepStrictEqual(resolverValor(volt, { origem: 'erp', atributoId: 3 }, item(1, { valoresErp: { 3: '220v' } })), { valor: '220v', valorId: '1', unidade: null });
  const pres = atributos.find(a => a.id === 'MAX_PRESSURE');
  assert.deepStrictEqual(resolverValor(pres, { origem: 'erp', atributoId: 4 }, item(1, { valoresErp: { 4: '210 psi' } })), { valor: '210', valorId: null, unidade: 'psi' });
  assert.deepStrictEqual(resolverValor(pres, { origem: 'fixo', valor: '150' }, item(1)), { valor: '150', valorId: null, unidade: 'bar' });
  assert.strictEqual(resolverValor(volt, { origem: 'erp', atributoId: 3 }, item(1)), null);
});

teste('preço no ML: próprio do item ou ERP + ajuste', () => {
  assert.strictEqual(precoNoMl({ preco: 29.9, precoMl: null }, 15), 34.39);
  assert.strictEqual(precoNoMl({ preco: 29.9, precoMl: 39.9 }, 15), 39.9);
});

teste('anúncio simples completo não tem erro', () => {
  assert.deepStrictEqual(erros(dados(), [item(1)]), []);
});

teste('pendências de dados e itens', () => {
  const e = erros(dados({ categoriaMl: null, titulo: 'x'.repeat(61) }), [item(1, { fotos: 0, preco: 0, ativo: false })]);
  assert.ok(e.includes('Escolha a categoria do Mercado Livre.'));
  assert.ok(e.some(t => t.startsWith('Título com 61')));
  assert.ok(e.some(t => t.includes('sem foto')));
  assert.ok(e.some(t => t.includes('sem preço')));
  assert.ok(e.some(t => t.includes('inativo')));
  const avisos = pendenciasAnuncio(dados(), [item(1, { estoque: 0, gtin: null, pesoKg: null, motivosCadastro: ['falta Bitola'] })], categoria, atributos)
    .filter(p => p.nivel === 'aviso').map(p => p.area);
  assert.deepStrictEqual(avisos, ['itens', 'itens', 'itens', 'cadastro']);
  assert.ok(pendenciasAnuncio(dados(), [item(1)], { ...categoria, final: false }, atributos).some(p => p.texto.includes('subcategorias')));
});

teste('atributo obrigatório sem valor em parte dos itens', () => {
  const d = dados({ atributos: { BRAND: { origem: 'marca' }, MODEL: { origem: 'erp', atributoId: 9 } } });
  const e = erros(d, [item(1, { valoresErp: { 9: 'A' } }), item(2)]);
  assert.ok(e.includes('Atributo obrigatório "Modelo" sem valor em SKU-2.'));
});

teste('variações: eixo, atributo que não varia e combinação repetida', () => {
  const base = { BRAND: { origem: 'marca' }, MODEL: { origem: 'fixo', valor: 'BH' }, VOLTAGE: { origem: 'erp', atributoId: 3 } } as AnuncioDados['atributos'];
  const i1 = item(1, { valoresErp: { 3: '220V', 5: 'Aço' } });
  const i2 = item(2, { valoresErp: { 3: '127V', 5: 'Latão' } });
  assert.deepStrictEqual(eixosDeVariacao(atributos, dados({ atributos: base }), [i1, i2]).map(a => a.id), ['VOLTAGE']);
  assert.deepStrictEqual(erros(dados({ atributos: base }), [i1, i2]), []);
  // Material muda entre os itens e não é eixo
  assert.ok(erros(dados({ atributos: { ...base, MATERIAL: { origem: 'erp', atributoId: 5 } } }), [i1, i2]).some(t => t.startsWith('"Material" muda')));
  // sem eixo
  assert.ok(erros(dados({ atributos: { BRAND: { origem: 'marca' }, MODEL: { origem: 'fixo', valor: 'BH' } } }), [i1, i2]).some(t => t.includes('atributo de variação')));
  // repetida
  const i3 = item(3, { valoresErp: { 3: '220v' } });
  assert.ok(erros(dados({ atributos: base }), [i1, i2, i3]).some(t => t.startsWith('SKU-1 e SKU-3 ficam iguais')));
});

teste('título cortado na palavra', () => {
  assert.strictEqual(cortarTitulo('Conexão hidráulica JIC fêmea giratória 1/2 x 3/4 com porca de aço carbono zincado', 60), 'Conexão hidráulica JIC fêmea giratória 1/2 x 3/4 com porca');
  assert.strictEqual(cortarTitulo('  curto  '), 'curto');
});

teste('título: sem separador no fim e maiúsculas suavizadas', () => {
  assert.strictEqual(cortarTitulo('TERMINAL PRENSÁVEL JIC 37° FÊMEA GIRATÓRIA RETA - 1.1/16"-12 - 1" - 16', 50), 'TERMINAL PRENSÁVEL JIC 37° FÊMEA GIRATÓRIA RETA');
  assert.strictEqual(tituloLegivel('TERMINAL PRENSÁVEL JIC 37° FÊMEA GIRATÓRIA RETA X 1/2 NPT'), 'Terminal prensável JIC 37° fêmea giratória reta x 1/2 NPT');
  assert.strictEqual(tituloLegivel('Já está Normal'), 'Já está Normal');
});

teste('marca "Sem Marca" vira Genérica', () => {
  const marca = atributos.find(a => a.id === 'BRAND');
  assert.strictEqual(resolverValor(marca, { origem: 'marca' }, item(1, { marca: 'Sem Marca' }))?.valor, 'Genérica');
  assert.strictEqual(resolverValor(marca, { origem: 'marca' }, item(1, { marca: null })), null);
});
