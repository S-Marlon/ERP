import assert from 'assert';
import type { LinhaEnvio } from './mercadoLivreApi';
import { cairiaEmPrejuizo, contarEnvio, passaNoFiltroEnvio, podeEnviarPacote } from './envioLista';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const linha = (l: Partial<LinhaEnvio>) => ({ publicado: true, situacaoPacote: 'IGUAL', lucro: 5, lucroComEmbalagem: 4.5, faltas: [], ...l }) as LinhaEnvio;

teste('envio: prejuízo com a embalagem e o que dá para enviar', () => {
  assert.strictEqual(cairiaEmPrejuizo(linha({ lucro: 0.2, lucroComEmbalagem: -0.1 })), true);
  assert.strictEqual(cairiaEmPrejuizo(linha({ lucro: -1, lucroComEmbalagem: -1.3 })), false);   // já estava em prejuízo
  assert.strictEqual(podeEnviarPacote(linha({ situacaoPacote: 'DIFERENTE' })), true);
  assert.strictEqual(podeEnviarPacote(linha({ situacaoPacote: 'DIFERENTE', publicado: false })), false);
  assert.strictEqual(podeEnviarPacote(linha({ situacaoPacote: 'SEM_ERP' })), false);
});

teste('envio: filtros e contagens', () => {
  const l = [linha({ situacaoPacote: 'FALTA_NO_ML' }), linha({ situacaoPacote: 'SEM_ERP', faltas: ['EMBALAGEM'] }), linha({ lucro: 0.1, lucroComEmbalagem: -0.2 })];
  assert.deepStrictEqual(contarEnvio(l), { todos: 3, diferente: 1, semErp: 1, prejuizo: 1, falta: 1 });
  assert.deepStrictEqual(l.filter(x => passaNoFiltroEnvio(x, 'falta')).length, 1);
});
