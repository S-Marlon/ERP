import assert from 'assert';
import { validarFormacoes, validarParametros } from './custosObra';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('custos da obra: formações e parâmetros', () => {
  assert.deepStrictEqual(validarFormacoes([{ formacao: 'Argila', custoMetro: '15,5', rendimentoMH: 5 }, { formacao: 'Argila', custoMetro: 1 }, { formacao: 'Marte', custoMetro: 1 }]),
    [{ formacao: 'Argila', custoMetro: 15.5, rendimentoMH: 5 }]);
  assert.throws(() => validarFormacoes([{ formacao: 'Rocha sã', custoMetro: -1 }]), /Custo por metro/);
  assert.deepStrictEqual(validarParametros({ horasMobilizacao: 4, horasPorDia: 0, custoDia: '60' }),
    { horasMobilizacao: 4, horasRevestimento100m: 0, horasLimpeza: 0, horasInstalacaoBomba: 0, horasPorDia: 8, custoDia: 60 });
  assert.throws(() => validarParametros({ horasPorDia: 30 }), /Jornada/);
});
