import assert from 'assert';
import { faixaMoeda, passaNoFiltro, resumirFinanceiro } from './listaAnuncios';
import type { AnuncioResumo, FinanceiroItem } from './mercadoLivreApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

const fin = (lucro: number, nivel: FinanceiroItem['nivel'], extra: Partial<FinanceiroItem> = {}): FinanceiroItem => ({
  idItem: 1, preco: 10, tarifa: 1, frete: 0, recebe: 9 + lucro, custo: 9, lucro, lucroSobreCustoPct: (lucro / 9) * 100, nivel,
  freteGratis: false, freteDesconhecido: false, alvoPct: 30, ...extra,
});
const anuncio = (extra: Partial<AnuncioResumo>): AnuncioResumo => ({
  id: 1, titulo: 'x', idFamilia: null, familia: null, categoriaMl: null, categoriaNome: null, tipoAnuncio: 'gold_pro', situacao: 'PUBLICADO', preparo: null,
  mlbId: 'MLB1', permalink: null, qtdItens: 1, publicados: 1, aPublicar: 0, fotoUrl: null, estoque: 10, precoMin: 10, precoMax: 10, erros: 0, avisos: 0,
  atualizadoEm: '', ultimoErro: null, estoqueMl: 10, estoqueReserva: 0, estoqueMaximo: null, ativosMl: 1, pausadosMl: 0, itens: [], ...extra,
});

teste('resumo do lucro: o pior item manda', () => {
  const r = resumirFinanceiro([fin(6.59, 'ALTO'), fin(0.16, 'BAIXO', { frete: 7 }), fin(16.48, 'ALTO')])!;
  assert.deepStrictEqual([r.lucroMin, r.lucroMax, r.nivel, r.comFrete], [0.16, 16.48, 'BAIXO', 1]);
  assert.strictEqual(resumirFinanceiro([fin(-2.72, 'PREJUIZO'), fin(3, 'SEM_CUSTO')])!.nivel, 'PREJUIZO');
  assert.strictEqual(resumirFinanceiro([]), null);
});

teste('filtros rápidos', () => {
  const baixo = resumirFinanceiro([fin(0.16, 'BAIXO')]);
  assert.ok(passaNoFiltro(anuncio({}), baixo, 'lucroBaixo'));
  assert.ok(!passaNoFiltro(anuncio({}), resumirFinanceiro([fin(5, 'BOM')]), 'lucroBaixo'));
  assert.ok(passaNoFiltro(anuncio({ ativosMl: 0, pausadosMl: 1 }), null, 'pausados'));
  assert.ok(passaNoFiltro(anuncio({ estoqueMl: 0 }), null, 'semEstoque'));
  assert.ok(!passaNoFiltro(anuncio({ estoqueMl: 0, ativosMl: 0, situacao: 'RASCUNHO', publicados: 0 }), null, 'semEstoque'));
  assert.ok(passaNoFiltro(anuncio({ situacao: 'RASCUNHO', preparo: 'PRONTO' }), null, 'prontos'));
});

teste('faixa de valores', () => {
  const f = (v: number) => v.toFixed(2);
  assert.strictEqual(faixaMoeda(3, 3, f), '3.00');
  assert.strictEqual(faixaMoeda(3, 7.5, f), '3.00 a 7.50');
});
