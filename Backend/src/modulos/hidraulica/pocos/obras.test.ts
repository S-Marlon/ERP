import assert from 'assert';
import { garantiaAte, lerGps, lerServicos, podeIrPara, pocoDoRelatorio, relatorioInicial, validarObra, validarPoco } from './obras';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('obras de poços: obra e serviços', () => {
  const o = validarObra({ idCliente: 7, servicos: ['instalacao', 'PERFURACAO', 'instalacao'], metrosPrevistos: '120', valorContratado: '18000', garantiaMeses: 12 });
  assert.deepStrictEqual(o.servicos, ['PERFURACAO', 'INSTALACAO']);      // sem repetir, na ordem padrão
  assert.deepStrictEqual([o.metrosPrevistos, o.valorContratado, o.garantiaMeses, o.idPoco], [120, 18000, 12, null]);
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

teste('obras de poços: garantia', () => {
  assert.strictEqual(garantiaAte('2026-10-20', 12), '2027-10-20');
  assert.strictEqual(garantiaAte('2026-08-31', 6), '2027-02-28');
  assert.strictEqual(garantiaAte(null, 12), null);
});
