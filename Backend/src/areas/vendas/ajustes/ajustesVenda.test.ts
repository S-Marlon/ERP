import assert from 'assert';
import { distribuirDiferenca, ErroAjuste, LinhaAtual, planejarAjuste, TituloDaVenda, totaisDaVenda } from './ajustesVenda';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const erro = (fn: () => unknown, trecho: RegExp) => assert.throws(fn, (e: unknown) => e instanceof ErroAjuste && trecho.test(e.message));

const linhas: LinhaAtual[] = [
  { idVendaItem: 1, idItem: 10, nome: 'Cano 25mm', quantidade: 6, fator: 1, precoTabela: 10, precoUnitario: 9.5, totalItem: 57, devolvido: 0, kit: false },
  { idVendaItem: 2, idItem: 11, nome: 'Joelho', quantidade: 2, fator: 12, precoTabela: 30, precoUnitario: 30, totalItem: 60, devolvido: 1, kit: false },
  { idVendaItem: 3, idItem: 12, nome: 'Kit bomba', quantidade: 1, fator: 1, precoTabela: 500, precoUnitario: 500, totalItem: 500, devolvido: 0, kit: true },
];

teste('ajuste de venda: linhas', () => {
  const a = planejarAjuste(linhas, [
    { idVendaItem: 1, quantidade: 8, precoUnitario: 9.5 },      // +2 cano
    { idVendaItem: 2, quantidade: 1, precoUnitario: 30 },       // -1 caixa de joelho (12 un)
    { idVendaItem: 3, quantidade: 1, precoUnitario: 500 },      // kit sem mudança: fica de fora
  ], [{ idItem: 20, nome: 'Fita veda', quantidade: 3, fator: 1, precoTabela: 5, precoUnitario: 4, idUnidade: null, sigla: 'UN' }]);
  assert.strictEqual(a.mudancas.length, 3);
  assert.deepStrictEqual(a.mudancas.map(m => [m.tipo, m.totalDepois, m.deltaBase]), [['ALTERADO', 76, 2], ['ALTERADO', 30, -12], ['INCLUIDO', 12, 3]]);
  assert.strictEqual(a.mudancas[2].descontoValor, 3);   // tabela 15, cobrado 12
  assert.strictEqual(a.diferenca, 19 - 30 + 12);
  const rem = planejarAjuste(linhas, [{ idVendaItem: 1, quantidade: 0, precoUnitario: 9.5 }], []);
  assert.strictEqual(rem.mudancas[0].tipo, 'REMOVIDO'); assert.strictEqual(rem.diferenca, -57);
  erro(() => planejarAjuste(linhas, [{ idVendaItem: 2, quantidade: 0.5, precoUnitario: 30 }], []), /já foram devolvidos 1/);
  erro(() => planejarAjuste(linhas, [{ idVendaItem: 3, quantidade: 2, precoUnitario: 500 }], []), /kit/);
  erro(() => planejarAjuste(linhas, [{ idVendaItem: 9, quantidade: 2, precoUnitario: 1 }], []), /não é desta venda/);
  erro(() => planejarAjuste(linhas, [{ idVendaItem: 1, quantidade: 6, precoUnitario: 9.5 }], []), /Nada mudou/);
  erro(() => planejarAjuste([linhas[0]], [{ idVendaItem: 1, quantidade: 0, precoUnitario: 9.5 }], []), /cancele a venda/);
});

const titulos: TituloDaVenda[] = [
  { idTitulo: 1, parcela: 1, vencimento: '2026-11-10', valor: 100, valorPago: 100, status: 'PAGO' },
  { idTitulo: 2, parcela: 2, vencimento: '2026-12-10', valor: 100, valorPago: 30, status: 'ABERTO' },
  { idTitulo: 3, parcela: 3, vencimento: '2027-01-10', valor: 100, valorPago: 0, status: 'ABERTO' },
];

teste('ajuste de venda: diferença nas parcelas', () => {
  assert.deepStrictEqual(distribuirDiferenca(titulos, 25.01, 'ESPALHAR').alteracoes, [
    { idTitulo: 2, novoValor: 112.5, status: 'ABERTO' }, { idTitulo: 3, novoValor: 112.51, status: 'ABERTO' }]);
  assert.deepStrictEqual(distribuirDiferenca(titulos, 25, 'ULTIMA').alteracoes, [{ idTitulo: 3, novoValor: 125, status: 'ABERTO' }]);
  assert.deepStrictEqual(distribuirDiferenca(titulos, 40, 'NOVA', '2027-02-10'), { alteracoes: [], nova: { valor: 40, vencimento: '2027-02-10' } });
  // redução: a 2 só tem 70 em aberto; a 3 leva o resto
  assert.deepStrictEqual(distribuirDiferenca(titulos, -150, 'ESPALHAR').alteracoes, [
    { idTitulo: 2, novoValor: 30, status: 'PAGO' }, { idTitulo: 3, novoValor: 20, status: 'ABERTO' }]);
  assert.deepStrictEqual(distribuirDiferenca(titulos, -120, 'ULTIMA').alteracoes, [
    { idTitulo: 2, novoValor: 80, status: 'ABERTO' }, { idTitulo: 3, novoValor: 0, status: 'CANCELADO' }]);
  erro(() => distribuirDiferenca(titulos, -171, 'ESPALHAR'), /use a devolução/);
  erro(() => distribuirDiferenca(titulos, -10, 'NOVA'), /não vira parcela nova/);
  erro(() => distribuirDiferenca([titulos[0]], 10, 'ESPALHAR'), /Não há parcela em aberto/);
  assert.deepStrictEqual(distribuirDiferenca(titulos, 0, 'ESPALHAR'), { alteracoes: [], nova: null });
});

teste('ajuste de venda: totais', () => {
  assert.deepStrictEqual(totaisDaVenda([
    { quantidade: 8, precoTabela: 10, precoUnitario: 9.5, totalItem: 76 }, { quantidade: 0, precoTabela: 30, precoUnitario: 30, totalItem: 0 },
    { quantidade: 2, precoTabela: 10, precoUnitario: 12, totalItem: 24 },
  ], 15), { totalBruto: 104, totalDesconto: 4, totalLiquido: 115 });
});
