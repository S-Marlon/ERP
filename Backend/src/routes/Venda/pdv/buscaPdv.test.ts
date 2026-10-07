import { filtroBusca, padraoMedidas } from './buscaPdv';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

// Medidas com espaço vazio, mm grudado, decimal com ponto e sinal ×
assert(padraoMedidas('17 mm x    x 10mm') === '%| 17 mm x % x 10 mm%', `vazio no meio: ${padraoMedidas('17 mm x    x 10mm')}`);
assert(padraoMedidas('17 x 35 x 10') === '%| 17 mm x 35 mm x 10 mm%', 'três medidas');
assert(padraoMedidas('x 47 x') === '% x 47 mm x %', `só externo: ${padraoMedidas('x 47 x')}`);
assert(padraoMedidas('17x35') === '%| 17 mm x 35 mm%', 'duas medidas');
assert(padraoMedidas('28.575 × 62') === '%| 28,575 mm x 62 mm%', 'decimal e ×');
assert(padraoMedidas('6205') === null && padraoMedidas('6205 skf') === null && padraoMedidas('2rs x') === null, 'não é medida');

// O padrão casa com o nome padronizado (via LIKE): simulação simples
const casa = (padrao: string, texto: string) => new RegExp(`^${padrao.split('%').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(texto);
const nome6003 = 'ROLAMENTO 6003-2RS/C3 | 17 mm x 35 mm x 10 mm | TIMKEN';
assert(casa(padraoMedidas('17 mm x x 10mm')!, nome6003), 'acha o 6003');
assert(casa(padraoMedidas('x 35 x')!, nome6003), 'acha pelo externo');
assert(!casa(padraoMedidas('17 x x 12')!, nome6003), 'largura diferente não acha');
assert(!casa(padraoMedidas('7 x x 10')!, nome6003), '7 não casa com 17');

// Palavras em qualquer ordem: uma condição por palavra; GTIN pelo termo inteiro
const f = filtroBusca('skf 6205');
assert(f.params.length === 9 && f.params[0] === '%skf%' && f.params[4] === '%6205%' && f.params[8] === 'skf 6205', `palavras ${JSON.stringify(f.params)}`);
assert(f.sql.split(') AND (').length === 2, 'duas palavras com AND');
const m = filtroBusca('17 x x 10');
assert(m.params[0] === '%| 17 mm x % x 10 mm%' && m.params[2] === '17 x x 10', 'filtro de medidas');

console.log('buscaPdv: ok');
