import assert from 'assert';
import { validarFormacoes, validarParametros } from './custosObra';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('custos da obra: formações e parâmetros', () => {
  assert.deepStrictEqual(validarFormacoes([{ formacao: 'Argila', custoMetro: '15,5', rendimentoMH: 5 }, { formacao: 'Argila', custoMetro: 1 }, { formacao: 'Marte', custoMetro: 1 }]),
    [{ formacao: 'Argila', custoMetro: 15.5, rendimentoMH: 5 }]);
  assert.throws(() => validarFormacoes([{ formacao: 'Rocha sã', custoMetro: -1 }]), /Custo por metro/);
  assert.deepStrictEqual(validarParametros({ horasMobilizacao: 4, horasPorDia: 0, custoDia: '60' }),
    { horasMobilizacao: 4, horasRevestimento100m: 0, horasLimpeza: 0, horasInstalacaoBomba: 0, horasPorDia: 8, custoDia: 60,
      horasVisitaTecnica: 0, custoKmCaminhao: 0, custoFixoTransporte: 0, viagensMaquina: 1 });
  assert.deepStrictEqual(Object.entries(validarParametros({ horasVisitaTecnica: '1,5', custoKmCaminhao: 6.5, custoFixoTransporte: 300, viagensMaquina: 2 })).slice(6),
    [['horasVisitaTecnica', 1.5], ['custoKmCaminhao', 6.5], ['custoFixoTransporte', 300], ['viagensMaquina', 2]]);
  assert.throws(() => validarParametros({ viagensMaquina: 50 }), /Viagens/);
  assert.throws(() => validarParametros({ horasPorDia: 30 }), /Jornada/);
});
