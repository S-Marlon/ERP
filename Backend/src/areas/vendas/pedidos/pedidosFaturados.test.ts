import assert from 'assert';
import {
  etapaDoPedido, faltasNaEntrega, lerLinhaDigitavel, parcelasSugeridas, saidasDaEntrega, statusDoPedido, validarNotaExterna, validarParcelas,
} from './pedidosFaturados';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('pedido: etapas e status', () => {
  assert.strictEqual(etapaDoPedido('PEDIDO', false), 'CONFIRMADO');
  assert.strictEqual(etapaDoPedido('PEDIDO', true), 'ENTREGUE_SEM_NOTA');
  assert.strictEqual(etapaDoPedido('FATURADO', false), 'FATURADO');
  assert.strictEqual(etapaDoPedido('CONCLUIDA', true), 'CONCLUIDO');
  assert.strictEqual(etapaDoPedido('CANCELADA', false), 'CANCELADO');
  assert.strictEqual(statusDoPedido(false, false), 'PEDIDO');
  assert.strictEqual(statusDoPedido(true, false), 'FATURADO');
  assert.strictEqual(statusDoPedido(false, true), 'PEDIDO');
  assert.strictEqual(statusDoPedido(true, true), 'CONCLUIDA');
});

teste('pedido: nota emitida fora', () => {
  // chave: UF 35, AAMM 2611, CNPJ 14, modelo 55, série 001, número 000001234, tpEmis 1, código 8, DV 1
  const chave = `35261112345678000199550010000012341${'12345678'}9`;
  assert.strictEqual(chave.length, 44);
  assert.deepStrictEqual(validarNotaExterna({ numero: 1234, serie: 1, chave: chave.replace(/(\d{4})/g, '$1 '), emitidaEm: '2026-11-18' }, '2026-11-18'),
    { numero: 1234, serie: 1, chave, emitidaEm: '2026-11-18' });
  assert.deepStrictEqual(validarNotaExterna({ numero: '77' }, '2026-11-18'), { numero: 77, serie: 1, chave: null, emitidaEm: '2026-11-18' });
  assert.throws(() => validarNotaExterna({}, '2026-11-18'), /número/);
  assert.throws(() => validarNotaExterna({ numero: 1235, chave }, '2026-11-18'), /nota 1234 série 1/);
  assert.throws(() => validarNotaExterna({ numero: 1234, chave: chave.slice(0, 20) + '65' + chave.slice(22) }, '2026-11-18'), /modelo 55/);
  assert.throws(() => validarNotaExterna({ numero: 1, emitidaEm: '2026-11-19' }, '2026-11-18'), /futuro/);
});

teste('pedido: boleto e parcelas', () => {
  assert.strictEqual(lerLinhaDigitavel(''), null);
  assert.strictEqual(lerLinhaDigitavel('34191.79001 01043.510047 91020.150008 1 96610000012345'), '34191790010104351004791020150008196610000012345');
  assert.throws(() => lerLinhaDigitavel('123'), /47 dígitos/);
  // a prazo 28/56 com entrada de 100
  const p = parcelasSugeridas(1000, { forma: 'PRAZO', parcelas: 2, intervaloDias: 28, entrada: 100 }, '2026-11-18');
  assert.deepStrictEqual(p.map(x => [x.parcela, x.vencimento, x.valor, x.forma]), [[1, '2026-11-18', 100, 'PIX'], [2, '2026-12-16', 450, 'BOLETO'], [3, '2027-01-13', 450, 'BOLETO']]);
  // sem condição: um boleto em 30 dias; à vista no PIX: vence no faturamento
  assert.deepStrictEqual(parcelasSugeridas(500, null, '2026-11-18').map(x => [x.vencimento, x.forma]), [['2026-12-18', 'BOLETO']]);
  assert.deepStrictEqual(parcelasSugeridas(500, { forma: 'PIX', parcelas: 1, intervaloDias: null, entrada: 0 }, '2026-11-18').map(x => [x.vencimento, x.forma]), [['2026-11-18', 'PIX']]);
  // validação: reordena por vencimento, confere a soma e o boleto
  const v = validarParcelas([{ vencimento: '2027-01-13', valor: 500, forma: 'boleto' }, { vencimento: '2026-12-16', valor: 500, forma: 'BOLETO', codigoBarras: '3419 1790 0101 0435 1004 7910 2015 0008 1966 1000 0012 345' }], 1000);
  assert.deepStrictEqual(v.map(x => [x.parcela, x.vencimento, x.codigoBarras?.length ?? null]), [[1, '2026-12-16', 47], [2, '2027-01-13', null]]);
  assert.throws(() => validarParcelas([{ vencimento: '2026-12-16', valor: 900 }], 1000), /somam R\$ 900,00/);
  assert.throws(() => validarParcelas([{ vencimento: '2026-02-30', valor: 1000 }], 1000), /vencimento/);
  assert.throws(() => validarParcelas([{ vencimento: '2026-12-16', valor: 1000, codigoBarras: '12' }], 1000), /Parcela 1: A linha digitável/);
});

teste('pedido: entrega (kit, reserva de outros pedidos)', () => {
  const saidas = saidasDaEntrega([
    { idItem: 1, quantidadeBase: 10, componentes: [] },
    { idItem: 9, quantidadeBase: 2, componentes: [{ idItem: 1, quantidade: 1 }, { idItem: 2, quantidade: 3 }] },
  ]);
  assert.deepStrictEqual([...saidas.entries()], [[1, 12], [2, 6]]);
  const faltas = faltasNaEntrega(saidas, new Map([[1, 20], [2, 6]]), new Map([[1, 10]]), new Map([[1, false], [2, false]]));
  assert.deepStrictEqual(faltas, [{ idItem: 1, sai: 12, disponivel: 10 }]);
  assert.deepStrictEqual(faltasNaEntrega(saidas, new Map([[1, 20], [2, 6]]), new Map([[1, 10]]), new Map([[1, true], [2, false]])), []);
});
