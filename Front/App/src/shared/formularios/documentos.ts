// Kit dos formulários de cadastro: CPF, CNPJ, telefone, CEP, RG e UF. Padrão do sistema: o formulário guarda SÓ OS
// NÚMEROS (é o que vai para o banco) e o campo mostra a máscara enquanto digita; a validação confere os dígitos
// verificadores (CPF/CNPJ), o DDD (telefone) e os 8 números do CEP. Espelho das regras do backend em
// Backend/src/areas/parceiros/documentos.ts e cnpj.ts. Puro, com teste (menos buscarCep, que consulta o ViaCEP).

export const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** Máscara progressiva: põe os separadores só até onde já tem número ("529.98" enquanto digita o CPF). */
export const aplicarMascara = (digitos: string, padrao: string) => {
  let saida = '';
  let i = 0;
  for (const ch of padrao) {
    if (i >= digitos.length) break;
    if (ch === '#') saida += digitos[i++];
    else saida += ch;
  }
  return saida;
};

// ---------------------------------------------------------------- CPF e CNPJ
export const CNPJ_COMPRA_AVULSA = '00000000000000';

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

export const cnpjValido = (v: unknown) => {
  const c = soDigitos(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base: string) => {
    let soma = 0;
    let peso = base.length - 7;
    for (const d of base) { soma += Number(d) * peso; peso = peso === 2 ? 9 : peso - 1; }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(c.slice(0, 12)) === Number(c[12]) && dv(c.slice(0, 13)) === Number(c[13]);
};

export const mascaraCpf = (v: unknown) => aplicarMascara(soDigitos(v).slice(0, 11), '###.###.###-##');
export const mascaraCnpj = (v: unknown) => aplicarMascara(soDigitos(v).slice(0, 14), '##.###.###/####-##');
/** Até 11 números é CPF; daí em diante, CNPJ. */
export const mascaraCpfCnpj = (v: unknown) => (soDigitos(v).length <= 11 ? mascaraCpf(v) : mascaraCnpj(v));

/** Para mostrar: CPF (11) ou CNPJ (14) com máscara; outro tamanho volta como veio. */
export const formatarDocumento = (v: unknown) => {
  const c = soDigitos(v);
  if (c.length === 11) return mascaraCpf(c);
  if (c.length === 14) return mascaraCnpj(c);
  return String(v ?? '');
};

// ---------------------------------------------------------------- telefone
const SERVICO = /^0[3589]00/;   // 0800, 0300, 0500, 0900: sem DDD

/** Só os números, sem o +55 e sem o 0 da operadora ("011 4411-2233"). 0800 fica como está. */
export const limparTelefone = (v: unknown) => {
  let t = soDigitos(v);
  if (SERVICO.test(t)) return t;
  if (t.startsWith('55') && t.length >= 12) t = t.slice(2);
  return t.replace(/^0+/, '');
};

export const telefoneValido = (v: unknown) => {
  const t = limparTelefone(v);
  if (SERVICO.test(t)) return t.length === 11;
  if (!/^[1-9][1-9]/.test(t)) return false;
  return t.length === 10 || (t.length === 11 && t[2] === '9');
};

/** Máscara enquanto digita: "(11) 4411-2233" com 10 números, "(11) 98888-7777" com 11, "0800 123 4567". */
export const mascaraTelefone = (v: unknown) => {
  const t = soDigitos(v).slice(0, 11);
  if (SERVICO.test(t)) return aplicarMascara(t, '#### ### ####');
  return aplicarMascara(t, t.length === 11 ? '(##) #####-####' : '(##) ####-####');
};

/** Para mostrar (lista, ficha, impressão): aceita o número gravado de qualquer jeito. */
export const formatarTelefone = (v: unknown) => {
  const t = limparTelefone(v);
  if ((SERVICO.test(t) && t.length === 11) || t.length === 10 || t.length === 11) return mascaraTelefone(t);
  return String(v ?? '');
};

// ---------------------------------------------------------------- CEP, UF, RG
export const cepValido = (v: unknown) => { const c = soDigitos(v); return c.length === 8 && c !== '00000000'; };
export const mascaraCep = (v: unknown) => aplicarMascara(soDigitos(v).slice(0, 8), '#####-###');
export const formatarCep = (v: unknown) => (soDigitos(v).length === 8 ? mascaraCep(v) : String(v ?? ''));

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

/** RG varia por estado (alguns têm X no fim): números e letras, sem pontos, em maiúsculas. */
export const limparRg = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 30);

// ---------------------------------------------------------------- regras do antd Form (campo vazio passa; "obrigatório" é outra regra)
type Regra = { validator: (_: unknown, valor: unknown) => Promise<void> };
const regra = (ok: (v: string) => boolean, mensagem: string): Regra => ({
  validator: (_, valor) => (!soDigitos(valor) || ok(String(valor)) ? Promise.resolve() : Promise.reject(new Error(mensagem))),
});

export const regraCpf = regra(cpfValido, 'CPF inválido: confira os números.');
export const regraCnpj = (opcoes: { aceitaCompraAvulsa?: boolean } = {}) =>
  regra(v => cnpjValido(v) || (!!opcoes.aceitaCompraAvulsa && soDigitos(v) === CNPJ_COMPRA_AVULSA), 'CNPJ inválido: confira os números.');
export const regraCpfCnpj = regra(v => (soDigitos(v).length <= 11 ? cpfValido(v) : cnpjValido(v)), 'CPF/CNPJ inválido: confira os números.');
export const regraTelefone = regra(telefoneValido, 'Telefone com DDD: 10 ou 11 números (ex.: (11) 98888-7777).');
export const regraCep = regra(cepValido, 'CEP com 8 números (ex.: 01310-100).');

// ---------------------------------------------------------------- ViaCEP
export type EnderecoDoCep = { cep: string; logradouro: string; complemento: string; bairro: string; cidade: string; uf: string };

/** Endereço do CEP pelo ViaCEP; null se o CEP não existe. Erro de rede sobe (a tela avisa e o operador digita). */
export const buscarCep = async (cep: unknown): Promise<EnderecoDoCep | null> => {
  const c = soDigitos(cep);
  if (!cepValido(c)) return null;
  const resp = await fetch(`https://viacep.com.br/ws/${c}/json/`);
  if (!resp.ok) throw new Error('Não foi possível consultar o CEP agora.');
  const d = await resp.json();
  if (d?.erro) return null;
  return { cep: c, logradouro: d.logradouro || '', complemento: d.complemento || '', bairro: d.bairro || '', cidade: d.localidade || '', uf: d.uf || '' };
};
