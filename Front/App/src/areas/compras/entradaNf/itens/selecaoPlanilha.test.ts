import { aplicarArraste, aplicarClique, intervalo } from './selecaoPlanilha';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};
const igual = (a: unknown, b: unknown, msg: string) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

const L = ['a', 'b', 'c', 'd', 'e', 'f'];

igual(intervalo(L, 'b', 'e'), ['b', 'c', 'd', 'e'], 'intervalo para baixo');
igual(intervalo(L, 'e', 'b'), ['b', 'c', 'd', 'e'], 'intervalo para cima');
igual(intervalo(L, null, 'c'), ['c'], 'sem âncora = só a linha');
igual(intervalo(L, 'x', 'c'), ['c'], 'âncora que saiu do filtro = só a linha');

// Clique simples substitui; Ctrl alterna
let r = aplicarClique(L, ['a', 'b'], 'a', 'd', {});
igual(r, { selecao: ['d'], ancora: 'd' }, 'clique simples');
r = aplicarClique(L, ['a'], 'a', 'c', { ctrl: true });
igual(r, { selecao: ['a', 'c'], ancora: 'c' }, 'ctrl inclui');
r = aplicarClique(L, ['a', 'c'], 'c', 'a', { ctrl: true });
igual(r.selecao, ['c'], 'ctrl tira');

// Shift: intervalo desde a âncora, somando ao que já estava
r = aplicarClique(L, ['a'], 'b', 'd', { shift: true });
igual(r, { selecao: ['a', 'b', 'c', 'd'], ancora: 'b' }, 'shift soma o intervalo e mantém a âncora');
// Shift numa linha já marcada desmarca o intervalo
r = aplicarClique(L, ['a', 'b', 'c', 'd', 'e'], 'b', 'd', { shift: true });
igual(r.selecao, ['a', 'e'], 'shift desmarca intervalo');

// Checkbox: alterna sem apagar as outras
r = aplicarClique(L, ['a', 'b'], 'a', 'e', {}, 'caixa');
igual(r.selecao, ['a', 'b', 'e'], 'checkbox inclui');

// Arraste
igual(aplicarArraste(L, ['b'], 'b', 'd'), ['b', 'c', 'd'], 'arraste');
igual(aplicarArraste(L, ['f', 'a'], 'c', 'b'), ['a', 'b', 'c', 'f'], 'arraste com ctrl soma, na ordem da tabela');

console.log('selecaoPlanilha: ok');
