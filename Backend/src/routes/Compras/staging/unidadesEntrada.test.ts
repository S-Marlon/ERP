import { canonizar, criarResolvedor } from './unidadesEntrada';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const regras = [
  { idFornecedor: null, siglaEntrada: 'M', siglaInterna: 'MT' },
  { idFornecedor: null, siglaEntrada: 'mts', siglaInterna: 'mt' },
  { idFornecedor: 7, siglaEntrada: 'M', siglaInterna: 'MIL' },
  { idFornecedor: 9, siglaEntrada: 'UN', siglaInterna: 'PC' },
];
const geral = criarResolvedor(['UN', 'PC', 'MT'], regras, 3);
const forn7 = criarResolvedor(['UN', 'PC', 'MT'], regras, 7);
const forn9 = criarResolvedor(['UN', 'PC', 'MT'], regras, 9);
const semForn = criarResolvedor(['UN', 'PC', 'MT'], regras, null);

let r = geral('m ');
assert(r.siglaInterna === 'MT' && r.origem === 'geral', 'M vira MT pela regra geral');
assert(geral('MTS').siglaInterna === 'MT', 'regra geral normaliza maiúsculas');
r = geral('UN');
assert(r.siglaInterna === 'UN' && r.origem === 'cadastro', 'sigla igual ao cadastro é aceita');
r = geral('KG');
assert(r.siglaInterna === null && r.origem === null, 'KG não reconhecida');
r = forn7('M');
assert(r.siglaInterna === 'MIL' && r.origem === 'fornecedor', 'regra do fornecedor prevalece sobre a geral');
r = forn9('UN');
assert(r.siglaInterna === 'PC' && r.origem === 'fornecedor', 'regra do fornecedor prevalece até sobre o cadastro');
assert(semForn('M').siglaInterna === 'MT', 'sem fornecedor só vale a regra geral');
assert(geral('').origem === null, 'vazio não reconhecido');

const canon = canonizar(geral);
assert(canon('m') === 'MT' && canon('kg') === 'KG' && canon('UN') === 'UN', 'canonizar');
assert(canonizar(undefined)('m') === 'M', 'sem resolvedor mantém a sigla');

console.log('unidadesEntrada: ok');
