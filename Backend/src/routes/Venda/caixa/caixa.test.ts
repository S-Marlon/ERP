import { calcularResumoCaixa, conferirFechamento, estornoDaVenda, validarMovimentoManual } from './caixa';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

// Critério da fase 1: abre com 100, vende 50 em dinheiro, sangria de 30 -> espera 120 em dinheiro
let resumo = calcularResumoCaixa(100, [{ forma: 'DINHEIRO', valor: 50, troco: 0 }], [{ tipo: 'SANGRIA', forma: 'DINHEIRO', valor: 30 }]);
assert(resumo.dinheiroEsperado === 120, `esperado 120, veio ${resumo.dinheiroEsperado}`);

// Troco sai do dinheiro; cartão e PIX ficam separados; suprimento e estorno
resumo = calcularResumoCaixa(
  50,
  [
    { forma: 'DINHEIRO', valor: 100, troco: 12.5 },
    { forma: 'PIX', valor: 40, troco: 0 },
    { forma: 'CREDITO', valor: 60.1, troco: 0 },
    { forma: 'PIX', valor: 9.9, troco: 0 },
  ],
  [
    { tipo: 'SUPRIMENTO', forma: 'DINHEIRO', valor: 20 },
    { tipo: 'ESTORNO_VENDA', forma: 'DINHEIRO', valor: 7.5 },
    { tipo: 'RECEBIMENTO', forma: 'DINHEIRO', valor: 30 },
  ]
);
const dinheiro = resumo.linhas.find(l => l.forma === 'DINHEIRO')!;
assert(dinheiro.vendas === 87.5, 'vendas em dinheiro líquidas do troco');
assert(resumo.dinheiroEsperado === 50 + 87.5 + 20 - 7.5 + 30, `dinheiro esperado ${resumo.dinheiroEsperado}`);
assert(resumo.linhas.find(l => l.forma === 'PIX')!.esperado === 49.9, 'PIX somado');
assert(resumo.totalVendas === 87.5 + 49.9 + 60.1, `total de vendas ${resumo.totalVendas}`);
assert(resumo.linhas[0].forma === 'DINHEIRO', 'dinheiro primeiro');

// Caixa sem vendas ainda mostra a linha de dinheiro com o troco inicial
assert(calcularResumoCaixa(80, [], []).dinheiroEsperado === 80, 'só abertura');

// Movimentos manuais
assert(validarMovimentoManual('suprimento', 10, 0, '').tipo === 'SUPRIMENTO', 'suprimento sem motivo é aceito');
const falha = (fn: () => unknown, msg: string) => { try { fn(); } catch { return; } throw new Error(msg); };
falha(() => validarMovimentoManual('SANGRIA', 10, 100, ''), 'sangria sem motivo deveria falhar');
falha(() => validarMovimentoManual('SANGRIA', 150, 100, 'banco'), 'sangria acima do dinheiro deveria falhar');
falha(() => validarMovimentoManual('SANGRIA', 0, 100, 'banco'), 'valor zero deveria falhar');
falha(() => validarMovimentoManual('VENDA', 10, 100, 'x'), 'tipo inválido deveria falhar');
assert(validarMovimentoManual('SANGRIA', 100, 100, 'banco').valor === 100, 'sangria do total é aceita');

// Fechamento: faltou 2 reais no dinheiro, PIX bateu, forma não contada vale zero
const conf = conferirFechamento(resumo.linhas, { dinheiro: 178, PIX: 49.9 });
const d = conf.conferencia.find(l => l.forma === 'DINHEIRO')!;
assert(d.diferenca === -2, `diferença no dinheiro ${d.diferenca}`);
assert(conf.conferencia.find(l => l.forma === 'PIX')!.diferenca === 0, 'PIX bateu');
assert(conf.conferencia.find(l => l.forma === 'CREDITO')!.diferenca === -60.1, 'crédito não informado conta como zero');
falha(() => conferirFechamento(resumo.linhas, { DINHEIRO: -1 }), 'valor negativo deveria falhar');

// Estorno: líquido do troco, sem prazo
const est = estornoDaVenda([
  { forma: 'DINHEIRO', valor: 50, troco: 5 },
  { forma: 'PRAZO', valor: 100, troco: 0 },
  { forma: 'PIX', valor: 20, troco: 0 },
]);
assert(JSON.stringify(est) === JSON.stringify([{ forma: 'DINHEIRO', valor: 45 }, { forma: 'PIX', valor: 20 }]), `estorno ${JSON.stringify(est)}`);

// Estorno de recebimento sai do caixa
assert(calcularResumoCaixa(0, [], [{ tipo: 'RECEBIMENTO', forma: 'PIX', valor: 50 }, { tipo: 'ESTORNO_RECEBIMENTO', forma: 'PIX', valor: 20 }])
  .linhas.find(l => l.forma === 'PIX')!.esperado === 30, 'estorno de recebimento');

// Prazo não entra na conferência do fechamento
const comPrazo = calcularResumoCaixa(0, [{ forma: 'PRAZO', valor: 300, troco: 0 }, { forma: 'PIX', valor: 10, troco: 0 }], []);
assert(!conferirFechamento(comPrazo.linhas, { PIX: 10 }).conferencia.some(l => l.forma === 'PRAZO'), 'prazo fora da conferência');
assert(conferirFechamento(comPrazo.linhas, { PIX: 10 }).diferencaTotal === 0, 'sem diferença por causa do prazo');

// Adiantamento entra; devolução sai; pagar com adiantamento não é contado nem estornado em dinheiro
const comSinal = calcularResumoCaixa(0, [{ forma: 'ADIANTAMENTO', valor: 50, troco: 0 }], [
  { tipo: 'ADIANTAMENTO', forma: 'DINHEIRO', valor: 50 }, { tipo: 'DEVOLUCAO_SINAL', forma: 'DINHEIRO', valor: 20 },
]);
assert(comSinal.dinheiroEsperado === 30, `sinal no caixa ${comSinal.dinheiroEsperado}`);
assert(!conferirFechamento(comSinal.linhas, { DINHEIRO: 30 }).conferencia.some(l => l.forma === 'ADIANTAMENTO'), 'adiantamento fora da conferência');
assert(estornoDaVenda([{ forma: 'ADIANTAMENTO', valor: 50, troco: 0 }]).length === 0, 'cancelar venda paga com sinal não tira dinheiro');

console.log('caixa: ok');
