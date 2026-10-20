import assert from 'assert';
import { validarClienteRapido } from './clienteRapido';
import { gerarParcelas, parcelaSemPrazo, situacaoTitulo, diasDeAtraso } from '../../financeiro/receber/receber';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('cliente rápido: nome e telefone', () => {
  assert.deepStrictEqual(validarClienteRapido({ nome: '  José   da Silva ', telefone: '(11) 98888-7777' }),
    { nome: 'José da Silva', digitos: '11988887777', telefone: '(11) 98888-7777', celular: true });
  assert.strictEqual(validarClienteRapido({ nome: 'Ana', telefone: '1144112233' }).telefone, '(11) 4411-2233');
  assert.strictEqual(validarClienteRapido({ nome: 'Ana', telefone: '+55 54 99707-7069' }).digitos, '54997077069');
  assert.throws(() => validarClienteRapido({ nome: 'Jo', telefone: '11988887777' }), /nome/);
  assert.throws(() => validarClienteRapido({ nome: 'José', telefone: '98888-7777' }), /DDD/);
});

teste('a prazo sem data: um título sem vencimento que nunca vence', () => {
  assert.deepStrictEqual(parcelaSemPrazo(150.456), [{ parcela: 1, totalParcelas: 1, vencimento: null, valor: 150.46 }]);
  assert.throws(() => parcelaSemPrazo(0), /inválido/);
  const hoje = new Date(2026, 9, 21);
  assert.strictEqual(situacaoTitulo('ABERTO', null, hoje), 'SEM_PRAZO');
  assert.strictEqual(situacaoTitulo('PAGO', null, hoje), 'PAGO');
  assert.strictEqual(diasDeAtraso(null, hoje), 0);
  assert.strictEqual(situacaoTitulo('ABERTO', '2026-10-20', hoje), 'VENCIDO');
  assert.strictEqual(gerarParcelas(100, 2, hoje, 30)[0].vencimento, '2026-11-20');   // a prazo com data continua igual
});
