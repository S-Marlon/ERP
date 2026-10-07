import { avaliarRegras, conferirSenha, gerarHashSenha, validarNovaSenha } from './regrasVenda';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const linha = (totalItem: number, custoTotal: number, nome = 'Item') => ({ idItem: 1, nome, totalItem, custoTotal });
const regras = { descontoMaxPercentual: 4, politicaAbaixoCusto: 'AVISAR' as const, senhaHash: null };

// Critério da fase 3: 10% com limite de 4% exige autorização; 4% passa
let r = avaliarRegras(100, 10, [linha(90, 50)], regras);
assert(r.percentualDesconto === 10 && r.excedeDesconto && r.exigeAutorizacao && !r.bloqueio, 'desconto de 10% exige autorização');
assert(r.motivos[0].includes('10.00%') && r.motivos[0].includes('4.00%'), `motivo ${r.motivos[0]}`);
r = avaliarRegras(100, 4, [linha(96, 50)], regras);
assert(!r.exigeAutorizacao && r.motivos.length === 0, 'desconto no limite passa');
assert(!avaliarRegras(0, 0, [], regras).exigeAutorizacao, 'venda zerada não quebra');

// Abaixo do custo
r = avaliarRegras(100, 0, [linha(100, 120, 'Mangueira')], regras);
assert(r.exigeAutorizacao && r.abaixoCusto.length === 1 && r.motivos[0].includes('Mangueira'), 'AVISAR exige autorização');
r = avaliarRegras(100, 0, [linha(100, 120)], { ...regras, politicaAbaixoCusto: 'BLOQUEAR' });
assert(r.bloqueio !== null && !r.exigeAutorizacao, 'BLOQUEAR impede');
r = avaliarRegras(100, 0, [linha(100, 120)], { ...regras, politicaAbaixoCusto: 'PERMITIR' });
assert(!r.exigeAutorizacao && !r.bloqueio, 'PERMITIR libera');
assert(!avaliarRegras(100, 0, [linha(100, 0)], regras).exigeAutorizacao, 'sem custo conhecido não bloqueia');
assert(!avaliarRegras(100, 0, [linha(100, 100)], regras).exigeAutorizacao, 'no custo exato passa');

// Desconto + abaixo do custo com BLOQUEAR: bloqueio prevalece
r = avaliarRegras(100, 20, [linha(80, 90)], { ...regras, politicaAbaixoCusto: 'BLOQUEAR' });
assert(r.bloqueio !== null && !r.exigeAutorizacao, 'bloqueio prevalece');

// Senha
const hash = gerarHashSenha('4321');
assert(hash.startsWith('scrypt$') && !hash.includes('4321'), 'hash não guarda a senha');
assert(conferirSenha('4321', hash) && !conferirSenha('1234', hash) && !conferirSenha('4321', null), 'conferir senha');
assert(gerarHashSenha('4321') !== hash, 'sal diferente a cada hash');
assert(validarNovaSenha('123') !== null && validarNovaSenha('1234') === null, 'tamanho mínimo');

console.log('regrasVenda: ok');
