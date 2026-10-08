import { aplicarAcao, arredondar, faltaUnidade, comCusto, comMarkup, comPreco, linhaAlterada, linhaDoPainel, margemLiquida, pedidoDaLinha } from './precificacaoLote';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`precificacaoLote: ${msg}`); };
const f = 1 / (1 - 0.1224);

// Arredondamento para cima, no padrão de vitrine
ok(arredondar(70.07, 'CENTAVOS_90') === 70.9 && arredondar(70.95, 'CENTAVOS_90') === 71.9 && arredondar(70.9, 'CENTAVOS_90') === 70.9, ',90');
ok(arredondar(70.07, 'CENTAVOS_99') === 70.99 && arredondar(71, 'CENTAVOS_99') === 71.99, ',99');
ok(arredondar(70.07, 'MEIO') === 70.5 && arredondar(70.5, 'MEIO') === 70.5 && arredondar(70.51, 'MEIO') === 71, 'meio real');
ok(arredondar(70.07, 'INTEIRO') === 71 && arredondar(71, 'INTEIRO') === 71, 'inteiro');
ok(arredondar(70.074, 'NENHUM') === 70.07, 'sem arredondar');
console.log('arredondar: ok');

const painel = { idItem: 1, sku: 'A1', nome: 'Bico', unidadeBase: 'PC', custoGerencial: 27.95, ultimoCusto: 30, custoMedio: 28.5, markupVarejo: 2, precoVarejo: 63.7 };
const l = linhaDoPainel(painel, f);
ok(l.custo === 27.95 && l.markup === 2 && l.preco === 63.7 && !linhaAlterada(l), 'linha começa igual ao gravado');
const semPreco = linhaDoPainel({ ...painel, markupVarejo: null, precoVarejo: null }, f);
ok(semPreco.markup === 1.8 && semPreco.preco === Math.round(27.95 * 1.8 * f * 100) / 100 && linhaAlterada(semPreco), 'sem preço: markup padrão e já conta como alterada');
console.log('linha: ok');

// Cada campo puxa os outros
ok(comMarkup(l, 2.2, f).preco === 70.07, 'markup → preço com a taxa');
const precoDigitado = comPreco(l, 69.9, f);
ok(Math.abs(precoDigitado.markup! - 69.9 / (27.95 * f)) < 0.0001, 'preço → markup');
ok(comCusto(l, 30, f).preco === Math.round(30 * 2 * f * 100) / 100, 'custo → preço, markup mantido');
console.log('edição: ok');

// Ações em massa
const lista = [l, linhaDoPainel({ ...painel, idItem: 2, ultimoCusto: null }, f)];
const ultimo = aplicarAcao(lista, { tipo: 'CUSTO', origem: 'ULTIMO' }, f);
ok(ultimo[0].custo === 30 && ultimo[1].custo === 27.95, 'usar último custo (sem último, fica como está)');
const markup = aplicarAcao(lista, { tipo: 'MARKUP', valor: 2.5 }, f);
ok(markup.every(x => x.markup === 2.5), 'markup para todos');
const ajuste = aplicarAcao(lista, { tipo: 'AJUSTE_PCT', pct: 10 }, f);
ok(ajuste[0].preco === 70.07, '+10% no preço');
const redondo = aplicarAcao(ajuste, { tipo: 'ARREDONDAR', modo: 'CENTAVOS_90' }, f);
ok(redondo[0].preco === 70.9 && Math.abs(redondo[0].markup! - 70.9 / (27.95 * f)) < 0.0001, 'arredondar ajusta o markup');
ok(!linhaAlterada(aplicarAcao(redondo, { tipo: 'DESFAZER' }, f)[0]), 'desfazer volta ao gravado');
console.log('massa: ok');

// Pedido: custo só quando muda
ok(pedidoDaLinha(l).custo === null && pedidoDaLinha(ultimo[0]).custo === 30, 'custo só se mudou');
ok(margemLiquida(63.7, 27.95, 12.24) === 43.9, 'margem líquida: (63,70 × 0,8776 − 27,95) ÷ 63,70');
console.log('pedido: ok');

// Item antigo sem unidade base: unidade escolhida na lista vai no pedido
const semUnidade = linhaDoPainel({ ...painel, idItem: 9, unidadeBase: null }, f);
ok(faltaUnidade(semUnidade) && pedidoDaLinha(semUnidade).unidade === null, 'sem unidade: falta escolher');
const comUnidade = aplicarAcao([semUnidade, l], { tipo: 'UNIDADE', sigla: ' lt ' }, f);
ok(comUnidade[0].unidadeNova === 'LT' && !faltaUnidade(comUnidade[0]) && linhaAlterada(comUnidade[0]), 'unidade em massa só nos sem unidade');
ok(comUnidade[1].unidadeNova === undefined, 'quem já tem unidade não muda');
ok(pedidoDaLinha(comUnidade[0]).unidade === 'LT' && pedidoDaLinha(l).unidade === null, 'unidade só no pedido de quem não tem');
console.log('unidade: ok');
