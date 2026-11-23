// CPF, telefone, CEP, RG e UF do cadastro de pessoas: no banco ficam SÓ OS NÚMEROS (como o CNPJ, ver cnpj.ts) e a tela
// formata na hora de mostrar. Os cadastros manuais conferem (CPF com dígitos verificadores, telefone com DDD, CEP com
// 8 números); o que vem de nota (NF-e) só é limpo, sem recusar. Espelho no front: shared/formularios/documentos.ts.
// Puro, com teste.
import { cnpjValido, CNPJ_COMPRA_AVULSA, limparCnpj } from './cnpj';

export const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

// ---------------------------------------------------------------- CPF
/** Dígitos verificadores do CPF (módulo 11). Repetido (11111111111) é inválido. */
export const cpfValido = (v: unknown) => {
  const c = soDigitos(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base: string) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(c.slice(0, 9)) === Number(c[9]) && dv(c.slice(0, 10)) === Number(c[10]);
};

export const formatarCpf = (v: unknown) => {
  const c = soDigitos(v);
  return c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : String(v ?? '');
};

// ---------------------------------------------------------------- telefone
const SERVICO = /^0[3589]00/;   // 0800, 0300, 0500, 0900: sem DDD

/** Só os números, sem o +55 e sem o 0 da operadora/DDD ("011 4411-2233"). 0800 fica como está. */
export const limparTelefone = (v: unknown) => {
  let t = soDigitos(v);
  if (SERVICO.test(t)) return t;
  if (t.startsWith('55') && t.length >= 12) t = t.slice(2);
  t = t.replace(/^0+/, '');
  return t;
};

/** Com DDD: fixo 10 números, celular 11 (começa com 9); ou 0800 com 11. */
export const telefoneValido = (v: unknown) => {
  const t = limparTelefone(v);
  if (SERVICO.test(t)) return t.length === 11;
  if (!/^[1-9][1-9]/.test(t)) return false;
  return t.length === 10 || (t.length === 11 && t[2] === '9');
};

export const celular = (v: unknown) => { const t = limparTelefone(v); return t.length === 11 && !SERVICO.test(t); };

/** "(11) 98888-7777", "(11) 4411-2233", "0800 123 4567"; fora do padrão volta como veio. */
export const formatarTelefone = (v: unknown) => {
  const t = limparTelefone(v);
  if (SERVICO.test(t) && t.length === 11) return `${t.slice(0, 4)} ${t.slice(4, 7)} ${t.slice(7)}`;
  if (t.length === 11) return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`;
  if (t.length === 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
  return String(v ?? '');
};

// ---------------------------------------------------------------- CEP, UF, RG
export const cepValido = (v: unknown) => { const c = soDigitos(v); return c.length === 8 && c !== '00000000'; };
export const formatarCep = (v: unknown) => { const c = soDigitos(v); return c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : String(v ?? ''); };

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;
export const ufValida = (v: unknown) => (UFS as readonly string[]).includes(String(v ?? '').trim().toUpperCase());

/** RG varia por estado (alguns têm X no fim): números e letras, sem pontos, em maiúsculas. */
export const limparRg = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 30);

// ---------------------------------------------------------------- conferência do cadastro manual
export class ErroCadastro extends Error { status = 400; }

/** Documento da pessoa (CPF na PF, CNPJ na PJ), só números; vazio = null. Recusa número com dígito errado. */
export const documentoDaPessoa = (tipo: 'PF' | 'PJ', v: unknown, opcoes: { aceitaCompraAvulsa?: boolean } = {}) => {
  if (tipo === 'PJ') {
    const c = limparCnpj(v);
    if (!c) return null;
    if (opcoes.aceitaCompraAvulsa && c === CNPJ_COMPRA_AVULSA) return c;
    if (!cnpjValido(c)) throw new ErroCadastro('CNPJ inválido: confira os números (dígitos verificadores).');
    return c;
  }
  const c = soDigitos(v);
  if (!c) return null;
  if (!cpfValido(c)) throw new ErroCadastro('CPF inválido: confira os números (dígitos verificadores).');
  return c;
};

/** Telefone digitado no cadastro: só números; vazio = null; sem DDD ou incompleto é recusado. */
export const telefoneDoCadastro = (v: unknown) => {
  if (!soDigitos(v)) return null;
  if (!telefoneValido(v)) throw new ErroCadastro(`Telefone "${String(v).trim()}" inválido: use DDD + número (10 ou 11 números, ex.: (11) 98888-7777).`);
  return limparTelefone(v);
};

/** CEP digitado no cadastro: só números; vazio = '' (a coluna não aceita nulo); incompleto é recusado. */
export const cepDoCadastro = (v: unknown) => {
  if (!soDigitos(v)) return '';
  if (!cepValido(v)) throw new ErroCadastro(`CEP "${String(v).trim()}" inválido: são 8 números (ex.: 01310-100).`);
  return soDigitos(v);
};

/** UF do endereço: sigla em maiúsculas; vazio = ''; sigla que não existe é recusada. */
export const ufDoCadastro = (v: unknown) => {
  const uf = String(v ?? '').trim().toUpperCase();
  if (!uf) return '';
  if (!ufValida(uf)) throw new ErroCadastro(`UF "${uf}" não existe.`);
  return uf;
};
