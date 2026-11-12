import assert from 'assert';
import { garantiaAte, lerGps, nomePadraoPoco, lerServicos, podeIrPara, pocoDoRelatorio, relatorioInicial, validarCliente, validarObra, validarPoco } from './obras';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('obras de poços: obra e serviços', () => {
  const o = validarObra({ idCliente: 7, servicos: ['instalacao', 'PERFURACAO', 'instalacao'], metrosPrevistos: '120', valorContratado: '18000', garantiaMeses: 12 });
  assert.deepStrictEqual(o.servicos, ['PERFURACAO', 'INSTALACAO']);      // sem repetir, na ordem padrão
  assert.deepStrictEqual([o.metrosPrevistos, o.valorContratado, o.garantiaMeses, o.idPoco], [120, 18000, 12, null]);
  assert.deepStrictEqual([o.valorSinal, o.sinalQuando], [null, 'ANTES']);
  const s = validarObra({ idCliente: 7, servicos: ['PERFURACAO'], valorSinal: '5000', sinalQuando: 'no_ato' });
  assert.deepStrictEqual([s.valorSinal, s.sinalQuando], [5000, 'NO_ATO']);
  const orc = validarObra({ idCliente: 7, servicos: ['PERFURACAO'], escopo: '  Perfuração de 120 m\r\nRevestimento 6"  ', prazoExecucaoDias: '10', formaPagamento: '50% de sinal' });
  assert.deepStrictEqual([orc.escopo, orc.prazoExecucaoDias, orc.formaPagamento, orc.validadeOrcamentoDias], ['Perfuração de 120 m\nRevestimento 6"', 10, '50% de sinal', null]);
  assert.throws(() => validarObra({ idCliente: 7, servicos: ['PERFURACAO'], prazoExecucaoDias: 0 }), /1 a 365/);
  assert.deepStrictEqual(lerServicos('LIMPEZA, troca_bomba'), ['LIMPEZA', 'TROCA_BOMBA']);
  assert.throws(() => validarObra({ servicos: ['PERFURACAO'] }), /cliente/);
  assert.throws(() => validarObra({ idCliente: 1, servicos: [] }), /ao menos um serviço/);
  assert.throws(() => validarObra({ idCliente: 1, servicos: ['VOAR'] }), /Serviço inválido/);
});

teste('obras de poços: passagens de situação', () => {
  assert.ok(podeIrPara('ORCAMENTO', 'AGUARDANDO_SINAL'));
  assert.ok(podeIrPara('AGUARDANDO_SINAL', 'EM_EXECUCAO'));
  assert.ok(podeIrPara('EM_EXECUCAO', 'CONCLUIDA'));
  assert.ok(!podeIrPara('ORCAMENTO', 'CONCLUIDA'));      // não conclui sem executar
  assert.ok(!podeIrPara('CONCLUIDA', 'CANCELADA'));
  assert.ok(podeIrPara('CANCELADA', 'ORCAMENTO'));
});

teste('obras de poços: ficha do poço e GPS', () => {
  assert.deepStrictEqual(lerGps('-23.550520, -46.633308'), { latitude: -23.55052, longitude: -46.633308 });
  assert.deepStrictEqual(lerGps('-23,5505; -46,6333'), { latitude: -23.5505, longitude: -46.6333 });
  assert.strictEqual(lerGps('rua tal'), null);
  const p = validarPoco({ identificacao: ' Sítio  São José - poço 1 ', gps: '-23.05, -47.04', uf: 'sp', perfuradoPor: 'terceiro', profundidadeM: '150' });
  assert.deepStrictEqual([p.identificacao, p.latitude, p.longitude, p.uf, p.perfuradoPor, p.profundidadeM, p.situacao],
    ['Sítio São José - poço 1', -23.05, -47.04, 'SP', 'TERCEIRO', 150, 'ATIVO']);
  assert.throws(() => validarPoco({}), /identificação/);
  assert.throws(() => validarPoco({ identificacao: 'P1', gps: 'sem número' }), /GPS/);
});

teste('obras de poços: relatório inicial e o que volta para o poço', () => {
  const r = relatorioInicial({ nome: 'José', telefone: '(54) 99123-4567' }, { cidade: 'Jundiaí', uf: 'SP', latitude: -23.1, longitude: -46.9 }, { metrosPrevistos: 120, valorContratado: 18000 });
  assert.deepStrictEqual([r.cliente, r.celular, r.cidade, r.localizacao, r.finMetrosContratados, r.finValorContratado], ['José', '(54) 99123-4567', 'Jundiaí', '-23.1, -46.9', 120, 18000]);
  const p = pocoDoRelatorio({ perfuracoes: [{ perfDe: 0, perfAte: 60 }, { perfDe: 60, perfAte: 132 }], vazaoAprox: 4500, bombaNivelEstatico: 18, bombaNivelDinamico: 62,
    tipoSolo: 'Cristalino', dtTermino: '2026-10-20', localizacao: '-23.1, -46.9', diametroInterno: 6 });
  assert.deepStrictEqual(p, { profundidadeM: 132, vazaoLh: 4500, nivelEstaticoM: 18, nivelDinamicoM: 62, tipoSolo: 'Cristalino', diametro: '6"', dataPerfuracao: '2026-10-20', latitude: -23.1, longitude: -46.9 });
  assert.deepStrictEqual(pocoDoRelatorio({}), {});
});

teste('obras de poços: qualificação do cliente', () => {
  const pf = validarCliente({ nome: 'José', documento: '123.456.789-01', rgIe: '12.345.678-9', estadoCivil: 'casado', profissao: 'agricultor', cep: '13250000', representante: 'x' });
  assert.deepStrictEqual([pf.tipoPessoa, pf.documento, pf.estadoCivil, pf.cep, pf.representante], ['PF', '12345678901', 'casado', '13250-000', null]);
  const pj = validarCliente({ nome: 'Fazenda Boa Vista Ltda', tipoPessoa: 'pj', documento: '12.345.678/0001-90', representante: 'Maria', representanteDocumento: '98765432100', estadoCivil: 'x' });
  assert.deepStrictEqual([pj.tipoPessoa, pj.representante, pj.representanteDocumento, pj.estadoCivil], ['PJ', 'Maria', '98765432100', null]);
  assert.throws(() => validarCliente({ nome: 'A', tipoPessoa: 'PJ', documento: '12345678901' }), /CNPJ tem 14/);
  assert.throws(() => validarCliente({ nome: 'A', documento: '12345678000190' }), /marque PJ/);
  assert.throws(() => validarCliente({ nome: 'A', cep: '1325' }), /CEP/);
});

teste('obras de poços: garantia', () => {
  assert.strictEqual(garantiaAte('2026-10-20', 12), '2027-10-20');
  assert.strictEqual(garantiaAte('2026-08-31', 6), '2027-02-28');
  assert.strictEqual(garantiaAte(null, 12), null);
});

teste('poço sem nome: "Poço de <cliente>" e depois #2', () => {
  assert.strictEqual(nomePadraoPoco('José  da Silva', []), 'Poço de José da Silva');
  assert.strictEqual(nomePadraoPoco('José da Silva', ['Poço de José da Silva']), 'Poço de José da Silva #2');
  assert.strictEqual(nomePadraoPoco('José da Silva', ['poço de josé da silva', 'Poço de José da Silva #2', 'Sítio']), 'Poço de José da Silva #3');
  assert.strictEqual(nomePadraoPoco('José da Silva', ['Poço de José da Silva #2']), 'Poço de José da Silva', 'o primeiro nome livre');
  assert.strictEqual(nomePadraoPoco(null, []), 'Poço de cliente');
  assert.ok(nomePadraoPoco('X'.repeat(200), []).length <= 94);
  assert.strictEqual(validarPoco({ identificacao: '', idProprietario: 5 }).identificacao, null);
  assert.throws(() => validarPoco({ identificacao: '' }), /proprietário/);
});
