import assert from 'assert';
import {
  AnuncioDados, AtributoML, cortarTitulo, tituloLegivel, eixosDeVariacao, filtrarAtributosCategoria, ItemAnuncio, pendenciasAnuncio,
  precoNoMl, resolverValor, sugerirAtributos, estoqueParaMl, regraDoItem, mudancasParaMl, saldoNaUnidade, statusDoMl, foraDoMl, situacaoPorItens, modoPublicacao, tituloPeloModelo, corpoDoItem, fotoPequena, errosDoValidador, ligarPorSku,
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

teste('modo: página única só quando a variação diferencia todos os itens', () => {
  const base = { BRAND: { origem: 'marca' }, MODEL: { origem: 'fixo', valor: 'BH' }, VOLTAGE: { origem: 'erp', atributoId: 3 } } as AnuncioDados['atributos'];
  const i1 = item(1, { valoresErp: { 3: '220V' }, tituloMl: 'Bomba 220V' });
  const i2 = item(2, { valoresErp: { 3: '127V' }, tituloMl: 'Bomba 127V' });
  const i3 = item(3, { valoresErp: { 3: '220v' }, tituloMl: 'Bomba 220V outra' });
  assert.deepStrictEqual(eixosDeVariacao(atributos, dados({ atributos: base }), [i1, i2]).map(a => a.id), ['VOLTAGE']);
  assert.strictEqual(modoPublicacao(atributos, dados({ atributos: base }), [i1, i2]), 'FAMILIA');
  // 220V repetido: o ML juntaria i1 e i3 -> anúncios separados
  assert.strictEqual(modoPublicacao(atributos, dados({ atributos: base }), [i1, i2, i3]), 'SEPARADO');
  // nenhuma variação (ex.: abraçadeiras só variam por Cor e todas são pretas) -> separados
  assert.strictEqual(modoPublicacao(atributos, dados({ atributos: { BRAND: { origem: 'marca' }, MODEL: { origem: 'fixo', valor: 'BH' } } }), [i1, i2]), 'SEPARADO');
  assert.strictEqual(modoPublicacao(atributos, dados({ atributos: base }), [i1]), 'SEPARADO');
});

teste('anúncios separados: título igual trava (o ML juntaria como o mesmo produto)', () => {
  const d = dados({ atributos: { BRAND: { origem: 'marca' }, MODEL: { origem: 'fixo', valor: 'BH' } } });
  const a = item(1, { tituloMl: 'Abraçadeira de nylon' });
  const b = item(2, { tituloMl: 'ABRAÇADEIRA DE NYLON' });
  assert.ok(erros(d, [a, b]).some(t => t.includes('mesmo título no ML')));
  assert.deepStrictEqual(erros(d, [a, item(2, { tituloMl: 'Abraçadeira de nylon 3.6x150mm' })]), []);
  assert.ok(erros(d, [item(1, { tituloMl: '' })]).some(t => t.includes('sem título')));
  // separado não exige o título do anúncio
  assert.deepStrictEqual(erros(dados({ titulo: '', atributos: d.atributos }), [a]), []);
});

teste('título pelo modelo', () => {
  const i = item(1, { nome: 'ABRAÇADEIRA de NYLON - 3.6x100mm - C/ 100 UN', marca: 'Gadan', valoresErp: { 17: '3.6', 23: '100mm' } });
  const ctx = { familia: 'ABRAÇADEIRA de NYLON', atributosErp: [{ id: 17, nome: 'Bitola' }, { id: 23, nome: 'Comprimento' }] };
  assert.deepStrictEqual(tituloPeloModelo(null, i, ctx), { titulo: 'ABRAÇADEIRA de NYLON - 3.6x100mm - C/ 100 UN', cortado: false });
  assert.strictEqual(tituloPeloModelo('{familia} {Bitola}x{Comprimento} {marca}', i, ctx).titulo, 'ABRAÇADEIRA de NYLON 3.6x100mm Gadan');
  assert.strictEqual(tituloPeloModelo('{familia} - {Cor} - {Comprimento}', i, ctx).titulo, 'ABRAÇADEIRA de NYLON - 100mm');
  assert.strictEqual(tituloPeloModelo('{titulo} {Comprimento}', i, { ...ctx, titulo: 'Abraçadeira nylon preta' }).titulo, 'Abraçadeira nylon preta 100mm');
  const longo = tituloPeloModelo('{nome} {nome}', i, ctx);
  assert.ok(longo.cortado && longo.titulo.length <= 60);
  assert.strictEqual(tituloPeloModelo('{nome}', item(2, { nome: 'TERMINAL JIC FÊMEA' }), ctx).titulo, 'Terminal JIC fêmea');
});

teste('corpo do envio usa o título do item', () => {
  const c: any = corpoDoItem({ dados: dados(), tipoAnuncio: 'gold_special', condicao: 'new', item: item(1, { tituloMl: 'Bomba 220V' }), atributos, temGtin: false, fotos: [], porFamilia: true });
  assert.strictEqual(c.family_name, 'Bomba 220V');
});

teste('GTIN: marca conhecida avisa que o ML costuma exigir', () => {
  const textos = (marca: string) => pendenciasAnuncio(dados(), [item(1, { gtin: null, marca })], categoria, atributos).map(p => p.texto);
  assert.ok(textos('Starrett').some(t => t.includes('com marca "Starrett"')));
  assert.ok(textos('Sem Marca').some(t => t.includes('produto sem código')));
});

teste('corpo do envio: família, preço, estoque, fotos e atributos', () => {
  const d = dados({ ajustePreco: 10, atributos: { BRAND: { origem: 'marca' }, MODEL: { origem: 'fixo', valor: 'BH-1' }, MAX_PRESSURE: { origem: 'fixo', valor: '210', unidade: 'bar' } } });
  const c: any = corpoDoItem({ dados: d, tipoAnuncio: 'gold_special', condicao: 'new', item: item(1, { estoque: 4.7, gtin: null }), atributos, temGtin: true, fotos: [{ id: 'F1' }], porFamilia: true });
  assert.strictEqual(c.family_name, 'Bomba hidráulica');
  assert.strictEqual(c.title, undefined);
  assert.strictEqual(c.price, 110);
  assert.strictEqual(c.available_quantity, 4);
  assert.deepStrictEqual(c.attributes, [
    { id: 'BRAND', value_name: 'Acme' },
    { id: 'MODEL', value_name: 'BH-1' },
    { id: 'MAX_PRESSURE', value_name: '210 bar' },
    { id: 'SELLER_SKU', value_name: 'SKU-1' },
    { id: 'EMPTY_GTIN_REASON', value_id: '17055160' },
    { id: 'SELLER_PACKAGE_HEIGHT', value_name: '5 cm' },
    { id: 'SELLER_PACKAGE_WIDTH', value_name: '5 cm' },
    { id: 'SELLER_PACKAGE_LENGTH', value_name: '10 cm' },
    { id: 'SELLER_PACKAGE_WEIGHT', value_name: '200 g' },
  ]);
  const antigo: any = corpoDoItem({ dados: d, tipoAnuncio: 'gold_pro', condicao: 'used', item: item(2), atributos, temGtin: false, fotos: [], porFamilia: false });
  assert.strictEqual(antigo.title, 'Bomba hidráulica');
  assert.strictEqual(antigo.condition, 'used');
  assert.ok(!antigo.attributes.some((a: any) => a.id === 'GTIN' || a.id === 'EMPTY_GTIN_REASON'));
});

teste('foto pequena, erros do validador e ligação por SKU', () => {
  assert.strictEqual(fotoPequena('498x343'), true);
  assert.strictEqual(fotoPequena('1200x900'), false);
  assert.strictEqual(fotoPequena(undefined), false);
  assert.deepStrictEqual(errosDoValidador({ cause: [{ type: 'error', message: 'A' }, { type: 'warning', message: 'B' }], message: 'Validation error' }), ['A']);
  assert.deepStrictEqual(errosDoValidador({ error: 'The fields [title] are invalid', message: 'body.invalid_fields', cause: [] }), ['Campos recusados pelo ML: title.']);
  assert.deepStrictEqual(errosDoValidador({ cause: [{ type: 'error', message: 'The attributes [BRAND] are required for category MLB260685 and channel marketplace.' }] }), ['O ML exige os atributos: BRAND.']);
  const erp = [{ idItem: 799, sku: '1460', skuRaiz: 'IT-000799' }, { idItem: 1169, sku: 'KIT-1169', skuRaiz: 'IT-001169' }];
  assert.strictEqual(ligarPorSku(' kit-1169 ', erp)?.idItem, 1169);
  assert.strictEqual(ligarPorSku('IT-000799', erp)?.idItem, 799);
  assert.strictEqual(ligarPorSku('9999', erp), null);
  assert.strictEqual(ligarPorSku(null, erp), null);
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

teste('item sem foto herda a foto da família (vira aviso)', () => {
  const semFoto = [item(1, { fotos: 0 })];
  assert.ok(erros(dados(), semFoto).some(t => t.includes('sem foto')));
  assert.deepStrictEqual(erros(dados({ fotoFamilia: 'https://x/familia.jpg' }), semFoto), []);
  assert.ok(pendenciasAnuncio(dados({ fotoFamilia: 'https://x/familia.jpg' }), semFoto, categoria, atributos).some(p => p.nivel === 'aviso' && p.texto.includes('foto da família')));
});

teste('estoque dividido entre loja e ML', () => {
  assert.strictEqual(estoqueParaMl(24, { reserva: 0, maximo: null }), 24);
  assert.strictEqual(estoqueParaMl(24, { reserva: 4, maximo: 10 }), 10);
  assert.strictEqual(estoqueParaMl(5, { reserva: 4, maximo: 10 }), 1);
  assert.strictEqual(estoqueParaMl(3, { reserva: 4, maximo: null }), 0);
  assert.strictEqual(estoqueParaMl(7.6, { reserva: 0, maximo: null }), 7);
  assert.deepStrictEqual(regraDoItem({ reserva: 2, maximo: 10 }, { reserva: null, maximo: 3 }), { reserva: 2, maximo: 3 });
  const c: any = corpoDoItem({ dados: dados(), tipoAnuncio: 'gold_special', condicao: 'new', item: item(1, { estoque: 9, estoqueMl: 4 }), atributos, temGtin: false, fotos: [], porFamilia: true });
  assert.strictEqual(c.available_quantity, 4);
  assert.ok(pendenciasAnuncio(dados(), [item(1, { estoque: 3, estoqueMl: 0 })], categoria, atributos).some(p => p.texto.includes('reservado para a loja')));
});

teste('sincronização manda só o que mudou', () => {
  assert.strictEqual(mudancasParaMl({ estoque: 5, preco: 29.9 }, { estoque: 5, preco: 29.9 }), null);
  assert.deepStrictEqual(mudancasParaMl({ estoque: 0, preco: 29.9 }, { estoque: 5, preco: 29.9 }), { available_quantity: 5 });
  assert.deepStrictEqual(mudancasParaMl({ estoque: 5, preco: 29.9 }, { estoque: 5, preco: 31.5 }), { price: 31.5 });
  assert.deepStrictEqual(mudancasParaMl({ estoque: null, preco: null }, { estoque: 2, preco: 10 }), { available_quantity: 2, price: 10 });
});

teste('unidade do ML: saldo em pacotes', () => {
  assert.strictEqual(saldoNaUnidade(24, 12), 2);
  assert.strictEqual(saldoNaUnidade(23, 12), 1);
  assert.strictEqual(saldoNaUnidade(120, 12), 10);
  assert.strictEqual(saldoNaUnidade(7, null), 7);
  assert.strictEqual(saldoNaUnidade(36, 12), 3);
});

teste('status do ML: excluído, encerrado e situação do anúncio', () => {
  assert.strictEqual(statusDoMl({ status: 'closed', sub_status: ['deleted', 'paused_by_seller'] }), 'deleted');
  assert.strictEqual(statusDoMl({ status: 'paused', sub_status: ['out_of_stock'] }), 'paused');
  assert.ok(foraDoMl('deleted') && foraDoMl('closed') && !foraDoMl('paused'));
  assert.strictEqual(situacaoPorItens(['deleted']), 'ENCERRADO');
  assert.strictEqual(situacaoPorItens(['paused', 'deleted']), 'PAUSADO');
  assert.strictEqual(situacaoPorItens(['paused', 'active']), 'PUBLICADO');
  assert.strictEqual(situacaoPorItens([]), null);
});
