import assert from 'assert';
import {
  acertoDoSinal, adicionalPodeIr, aplicarRecebimento, bloqueioDoSinal, descricaoParcela, diasAtraso, estornarRecebimento, parcelaUnicaSemPrazo, planejarParcelas,
  resumoCobranca, situacaoParcela, sugestaoExcedente, validarAdicional, validarAprovacao,
} from './cobranca';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('cobrança de obra: adicional e aprovação', () => {
  assert.deepStrictEqual(validarAdicional({ tipo: 'metro_excedente', descricao: ' 12 m  excedentes ', quantidade: '12,5', valorUnitario: '180' }),
    { tipo: 'METRO_EXCEDENTE', descricao: '12 m excedentes', quantidade: 12.5, valorUnitario: 180, valor: 2250 });
  assert.strictEqual(validarAdicional({ descricao: 'Conexão', quantidade: 3, valorUnitario: 3.333 }).valor, 9.99);   // 3 × 3,33
  assert.throws(() => validarAdicional({ descricao: 'X', valorUnitario: 0 }), /maior que zero/);
  assert.throws(() => validarAdicional({ valorUnitario: 10 }), /Descreva/);
  assert.deepStrictEqual(validarAprovacao({ meio: 'mensagem', observacao: 'WhatsApp 14h' }), { meio: 'MENSAGEM', observacao: 'WhatsApp 14h' });
  assert.throws(() => validarAprovacao({}), /como o cliente aprovou/);
  assert.ok(adicionalPodeIr('PENDENTE', 'APROVADO') && adicionalPodeIr('APROVADO', 'CANCELADO') && !adicionalPodeIr('APROVADO', 'RECUSADO'));
});

teste('cobrança de obra: resumo (total, recebido, parcelado e o que falta parcelar)', () => {
  const r = resumoCobranca({ valorContratado: 18000, valorSinal: 5000 },
    [{ valor: 2250, situacao: 'APROVADO' }, { valor: 300, situacao: 'PENDENTE' }, { valor: 99, situacao: 'RECUSADO' }],
    [{ tipo: 'SINAL', valor: 5000, valorPago: 5000, status: 'PAGO' }, { tipo: 'SALDO', valor: 6000, valorPago: 1000.1, status: 'ABERTO' },
      { tipo: 'SALDO', valor: 7000, valorPago: 0, status: 'CANCELADO' }]);
  assert.deepStrictEqual(r, {
    contratado: 18000, adicionaisAprovados: 2250, adicionaisPendentes: 300, total: 20250, sinal: 5000, sinalPago: true,
    recebido: 6000.1, aReceber: 14249.9, parcelado: 11000, semParcela: 9250,
  });
  assert.strictEqual(resumoCobranca({ valorContratado: null, valorSinal: null }, [], []).total, 0);
});

teste('cobrança de obra: o sinal libera o início', () => {
  assert.strictEqual(bloqueioDoSinal(null, 'ANTES', null), null);                     // sem sinal
  assert.strictEqual(bloqueioDoSinal(5000, 'NO_ATO', null), null);                    // pago no dia da perfuração
  assert.match(bloqueioDoSinal(5000, 'ANTES', { status: 'ABERTO', valor: 5000, valorPago: 2000 })!, /faltam R\$ 3000,00/);
  assert.strictEqual(bloqueioDoSinal(5000, 'ANTES', { status: 'PAGO', valor: 5000, valorPago: 5000 }), null);
});

teste('cobrança de obra: acerto da parcela do sinal', () => {
  assert.deepStrictEqual(acertoDoSinal(5000, null), { acao: 'CRIAR', valor: 5000 });
  assert.deepStrictEqual(acertoDoSinal(null, null), { acao: 'NADA' });
  const p = { idParcela: 7, valor: 5000, valorPago: 2000, status: 'ABERTO' };
  assert.deepStrictEqual(acertoDoSinal(5000, p), { acao: 'NADA' });
  assert.deepStrictEqual(acertoDoSinal(4000, p), { acao: 'ATUALIZAR', idParcela: 7, valor: 4000, status: 'ABERTO' });
  assert.deepStrictEqual(acertoDoSinal(2000, p), { acao: 'ATUALIZAR', idParcela: 7, valor: 2000, status: 'PAGO' });   // baixou até o pago: quitado
  assert.throws(() => acertoDoSinal(1500, p), /menor que o já recebido/);
  assert.throws(() => acertoDoSinal(null, p), /estorne/);
  assert.deepStrictEqual(acertoDoSinal(0, { ...p, valorPago: 0 }), { acao: 'CANCELAR', idParcela: 7 });
  assert.deepStrictEqual(acertoDoSinal(3000, { ...p, status: 'CANCELADO' }), { acao: 'CRIAR', valor: 3000 });
});

teste('cobrança de obra: sugestão do metro excedente e descrição', () => {
  assert.deepStrictEqual(sugestaoExcedente(120, 132.5, 180, false), {
    tipo: 'METRO_EXCEDENTE', quantidade: 12.5, valorUnitario: 180, valor: 2250, descricao: '12,5 m excedentes (perfurado 132,5 m, previsto 120 m)',
  });
  assert.strictEqual(sugestaoExcedente(120, 118, 180, false), null);
  assert.strictEqual(sugestaoExcedente(120, 132, 180, true), null);
  assert.strictEqual(sugestaoExcedente(120, 132, null, false), null);
  assert.deepStrictEqual([descricaoParcela(12, 'SINAL', 1, 1), descricaoParcela(12, 'SALDO', 2, 3), descricaoParcela(12, 'SALDO', 1, 1)],
    ['Obra 12 · sinal', 'Obra 12 · saldo 2/3', 'Obra 12 · saldo']);
});

teste('cobrança de obra: parcelas, recebimento e estorno (regras do próprio módulo)', () => {
  const hoje = new Date(2026, 9, 22);
  assert.deepStrictEqual(planejarParcelas(15250, 3, hoje), [
    { parcela: 1, totalParcelas: 3, vencimento: '2026-11-21', valor: 5083.34 },
    { parcela: 2, totalParcelas: 3, vencimento: '2026-12-21', valor: 5083.33 },
    { parcela: 3, totalParcelas: 3, vencimento: '2027-01-20', valor: 5083.33 },
  ]);
  assert.strictEqual(planejarParcelas(100, 1, hoje, 30, '2026-10-30')[0].vencimento, '2026-10-30');
  assert.throws(() => planejarParcelas(100, 1, hoje, 30, '2026-10-01'), /antes de hoje/);
  assert.throws(() => planejarParcelas(100, 40, hoje), /1 a 36/);
  assert.deepStrictEqual(parcelaUnicaSemPrazo(99.999), [{ parcela: 1, totalParcelas: 1, vencimento: null, valor: 100 }]);
  assert.deepStrictEqual(aplicarRecebimento(5000, 1000, 4000, 'pix', 'ABERTO'), { forma: 'PIX', valor: 4000, valorPago: 5000, status: 'PAGO' });
  assert.strictEqual(aplicarRecebimento(5000, 0, 1000, 'CHEQUE', 'ABERTO').status, 'ABERTO');
  assert.throws(() => aplicarRecebimento(5000, 1000, 4000.01, 'PIX', 'ABERTO'), /passa do saldo/);
  assert.throws(() => aplicarRecebimento(5000, 5000, 1, 'PIX', 'PAGO'), /já paga/);
  assert.throws(() => aplicarRecebimento(5000, 0, 1, 'FIADO', 'ABERTO'), /Forma/);
  assert.deepStrictEqual(estornarRecebimento(5000, 5000, 1000), { valorPago: 4000, status: 'ABERTO' });
  assert.deepStrictEqual([situacaoParcela('ABERTO', '2026-10-21', hoje), situacaoParcela('ABERTO', '2026-10-22', hoje), situacaoParcela('ABERTO', null, hoje),
    situacaoParcela('PAGO', '2020-01-01', hoje)], ['VENCIDO', 'VENCE_HOJE', 'SEM_PRAZO', 'PAGO']);
  assert.deepStrictEqual([diasAtraso('2026-10-12', hoje), diasAtraso('2026-11-01', hoje), diasAtraso(null, hoje)], [10, 0, 0]);
});
