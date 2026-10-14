import assert from 'assert';
import {
  atributosEfetivos, comRascunho, corposParaSalvar, desfazer, limparIguais, listarAlteracoes, mudarAnuncio, mudarAtributo, mudarItem, RASCUNHO_VAZIO,
  valorAnuncio, valorItem,
} from './rascunhoAnuncio';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const item = (idItem: number, extra: any = {}) => ({
  idItem, sku: `SKU-${idItem}`, precoMl: null, siglaBase: 'PC', unidadeMl: null,
  unidades: [{ idUnidade: 9, sigla: 'PCT', nome: 'Pacote', fator: 12, preco: 40 }],
  ml: { mlbId: null, status: null, permalink: null, erro: null, estoqueEnviado: null, precoEnviado: null, sincronizadoEm: null, regra: { reserva: null, maximo: null } },
  ...extra,
});
const det: any = {
  titulo: 'Disco', modeloTitulo: '', tipoAnuncio: 'gold_special', condicao: 'new', descricao: '', ajustePreco: 0,
  estoqueReserva: 0, estoqueMaximo: null, estoqueAutomatico: true, faixasQuantidade: [], faixasGerenciadas: false,
  atributos: { BRAND: { origem: 'marca' }, MODEL: { origem: 'fixo', valor: 'X1', valorId: null, unidade: null } },
  publicados: 0, itens: [item(1), item(2, { ml: { ...item(2).ml, mlbId: 'MLB1' } })],
};
const nomes = { atributo: (id: string) => ({ BRAND: 'Marca', MODEL: 'Modelo', COLOR: 'Cor' } as any)[id] || id, erp: (id: number) => `Atr ${id}` };

teste('mudar e voltar ao salvo some do rascunho', () => {
  let r = mudarAnuncio(RASCUNHO_VAZIO, det, 'titulo', 'Disco de corte');
  assert.strictEqual(valorAnuncio(det, r, 'titulo'), 'Disco de corte');
  r = mudarAnuncio(r, det, 'titulo', 'Disco');
  assert.deepStrictEqual(r.anuncio, {});
  assert.strictEqual(valorAnuncio(det, r, 'estoqueMaximo'), null);
});

teste('atributos: mapa inteiro e voltar ao salvo', () => {
  let r = mudarAtributo(RASCUNHO_VAZIO, det, 'COLOR', { origem: 'erp', atributoId: 22 });
  assert.ok(atributosEfetivos(det, r).COLOR);
  assert.ok(atributosEfetivos(det, r).BRAND);
  r = mudarAtributo(r, det, 'COLOR', null);
  assert.strictEqual(r.anuncio.atributos, undefined);
  // valor fixo igual com campos vazios diferentes (undefined x null) conta como igual
  r = mudarAtributo(RASCUNHO_VAZIO, det, 'MODEL', { origem: 'fixo', valor: 'X1' });
  assert.strictEqual(r.anuncio.atributos, undefined);
});

teste('itens: preço, unidade e voltar ao salvo', () => {
  let r = mudarItem(RASCUNHO_VAZIO, det, 1, 'precoMl', 39.9);
  r = mudarItem(r, det, 1, 'idUnidade', 9);
  assert.strictEqual(valorItem(det.itens[0], r, 'precoMl'), 39.9);
  r = mudarItem(r, det, 1, 'precoMl', null);
  assert.deepStrictEqual(r.itens, { 1: { idUnidade: 9 } });
  r = mudarItem(r, det, 1, 'idUnidade', null);
  assert.deepStrictEqual(r.itens, {});
});

teste('lista antes → depois, desfazer e o que vai ao ML', () => {
  let r = mudarAnuncio(RASCUNHO_VAZIO, det, 'ajustePreco', 15);
  r = mudarAtributo(r, det, 'MODEL', { origem: 'fixo', valor: 'X2' });
  r = mudarItem(r, det, 2, 'precoMl', 44.9);
  r = mudarAnuncio(r, det, 'faixasQuantidade', [{ minimo: 5, desconto: 5 }]);
  const l = listarAlteracoes({ ...det, publicados: 1 }, r, nomes);
  assert.deepStrictEqual(l.map(a => [a.rotulo, a.antes, a.depois, a.vaiAoMl]), [
    ['Ajuste sobre o preço do ERP', '0%', '15%', 'NA_HORA'],
    ['Preço por quantidade', 'o ERP não mexe', '5+ −5%', 'NA_HORA'],
    ['Modelo', 'X1', 'X2', 'BOTAO'],
    ['Preço no ML', 'ERP + ajuste', 'R$ 44,90', 'NA_HORA'],
  ]);
  r = desfazer(r, det, 't:MODEL');
  r = desfazer(r, det, 'i:2:precoMl');
  r = desfazer(r, det, 'a:faixasQuantidade');
  assert.deepStrictEqual(listarAlteracoes(det, r, nomes).map(a => a.chave), ['a:ajustePreco']);
});

teste('corpos para salvar e limpar o que já foi gravado', () => {
  let r = mudarAnuncio(RASCUNHO_VAZIO, det, 'descricao', 'Novo texto');
  r = mudarItem(r, det, 1, 'estoqueMaximo', 5);
  r = mudarItem(r, det, 1, 'precoMl', 10);
  assert.deepStrictEqual(corposParaSalvar(r), { anuncio: { descricao: 'Novo texto' }, itens: [{ idItem: 1, corpo: { preco: 10, estoqueMaximo: 5 } }] });
  // depois de gravar a descrição, ela some do rascunho; o item continua
  const salvo = { ...det, descricao: 'Novo texto' };
  assert.deepStrictEqual(limparIguais(r, salvo), { anuncio: {}, itens: { 1: { estoqueMaximo: 5, precoMl: 10 } } });
});

teste('modo de venda: tipo e frete grátis no rascunho e na lista', () => {
  const pub = { ...det, publicados: 1, vendaMl: { tipo: 'gold_special', freteGratis: false, tiposPermitidos: ['gold_special', 'gold_pro'], podeMudarFrete: true, misturado: false } } as any;
  let r = mudarAnuncio(RASCUNHO_VAZIO, pub, 'freteGratis', true);
  r = mudarAnuncio(r, pub, 'tipoAnuncio', 'gold_pro');
  const lista = listarAlteracoes(pub, r, nomes);
  const frete = lista.find(a => a.chave === 'a:freteGratis')!;
  assert.deepStrictEqual([frete.grupo, frete.antes, frete.depois, frete.vaiAoMl], ['Venda no ML', 'Desligado (o comprador paga)', 'Ligado (você paga o frete)', 'NA_HORA']);
  assert.strictEqual(lista.find(a => a.chave === 'a:tipoAnuncio')!.vaiAoMl, 'NA_HORA');
  assert.strictEqual(comRascunho(pub, r).vendaMl!.freteGratis, true);
  assert.deepStrictEqual(corposParaSalvar(r).anuncio, { freteGratis: true, tipoAnuncio: 'gold_pro' });
  assert.deepStrictEqual(mudarAnuncio(r, pub, 'freteGratis', false).anuncio, { tipoAnuncio: 'gold_pro' });
});
