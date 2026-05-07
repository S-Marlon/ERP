/**
 * VALIDADORES E MÁSCARAS PARA CLIENTE
 */

// ============================================================================
// VALIDADORES
// ============================================================================

/**
 * Valida CPF
 * @param cpf String com ou sem formatação
 * @returns boolean
 */
export const validaCPF = (cpf: string): boolean => {
  // Remove caracteres não numéricos
  const numeros = cpf.replace(/\D/g, '');

  // Verifica se tem 11 dígitos
  if (numeros.length !== 11) return false;

  // Verifica se todos os dígitos são iguais (caso especial)
  if (/^(\d)\1{10}$/.test(numeros)) return false;

  // Calcula primeiro dígito verificador
  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(numeros.substring(i - 1, i)) * (11 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(numeros.substring(9, 10))) return false;

  // Calcula segundo dígito verificador
  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(numeros.substring(i - 1, i)) * (12 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(numeros.substring(10, 11))) return false;

  return true;
};

/**
 * Valida CNPJ
 * @param cnpj String com ou sem formatação
 * @returns boolean
 */
export const validaCNPJ = (cnpj: string): boolean => {
  // Remove caracteres não numéricos
  const numeros = cnpj.replace(/\D/g, '');

  // Verifica se tem 14 dígitos
  if (numeros.length !== 14) return false;

  // Verifica se todos os dígitos são iguais (caso especial)
  if (/^(\d)\1{13}$/.test(numeros)) return false;

  // Calcula primeiro dígito verificador
  let tamanho = numeros.length - 2;
  let numeros_calc = numeros.substring(0, tamanho);
  let digito = numeros.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += numeros_calc.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digito.charAt(0))) return false;

  // Calcula segundo dígito verificador
  tamanho = tamanho + 1;
  numeros_calc = numeros.substring(0, tamanho);
  digito = numeros.substring(tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += numeros_calc.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digito.charAt(0))) return false;

  return true;
};

/**
 * Valida CPF ou CNPJ
 * @param documento CPF ou CNPJ
 * @returns boolean
 */
export const validaCPFouCNPJ = (documento: string): boolean => {
  const numeros = documento.replace(/\D/g, '');

  if (numeros.length === 11) {
    return validaCPF(documento);
  } else if (numeros.length === 14) {
    return validaCNPJ(documento);
  }

  return false;
};

/**
 * Valida email
 * @param email String
 * @returns boolean
 */
export const validaEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Valida telefone (minimo 10 dígitos)
 * @param telefone String
 * @returns boolean
 */
export const validaTelefone = (telefone: string): boolean => {
  const numeros = telefone.replace(/\D/g, '');
  return numeros.length >= 10 && numeros.length <= 11;
};

/**
 * Valida CEP
 * @param cep String
 * @returns boolean
 */
export const validaCEP = (cep: string): boolean => {
  const numeros = cep.replace(/\D/g, '');
  return numeros.length === 8;
};

// ============================================================================
// MÁSCARAS (FORMATADORES)
// ============================================================================

/**
 * Formata CPF: 123.456.789-00
 */
export const mascaraCPF = (valor: string): string => {
  const numeros = valor.replace(/\D/g, '').slice(0, 11);
  return numeros
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

/**
 * Formata CNPJ: 12.345.678/0001-90
 */
export const mascaraCNPJ = (valor: string): string => {
  const numeros = valor.replace(/\D/g, '').slice(0, 14);
  return numeros
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

/**
 * Formata CPF ou CNPJ automaticamente
 */
export const mascaraCPFouCNPJ = (valor: string): string => {
  const numeros = valor.replace(/\D/g, '');

  if (numeros.length <= 11) {
    return mascaraCPF(valor);
  } else {
    return mascaraCNPJ(valor);
  }
};

/**
 * Formata telefone: (00) 00000-0000
 */
export const mascaraTelefone = (valor: string): string => {
  const numeros = valor.replace(/\D/g, '').slice(0, 11);
  if (numeros.length <= 10) {
    return numeros
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    return numeros
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
};

/**
 * Formata CEP: 00000-000
 */
export const mascaraCEP = (valor: string): string => {
  const numeros = valor.replace(/\D/g, '').slice(0, 8);
  return numeros.replace(/(\d{5})(\d)/, '$1-$2');
};

/**
 * Formata moeda brasileira
 */
export const formataMoeda = (valor: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
};

/**
 * Formata data para padrão brasileiro
 */
export const formataData = (data: Date | string): string => {
  const d = typeof data === 'string' ? new Date(data) : data;
  return d.toLocaleDateString('pt-BR');
};

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Remove caracteres especiais
 */
export const removeCaracteresEspeciais = (valor: string): string => {
  return valor.replace(/\D/g, '');
};

/**
 * Valida se cliente pode comprar
 * (limite não excedido, status correto)
 */
export const clientePodeComprar = (
  saldo_devedor_atual: number,
  limite_credito: number,
  status_credito: string,
  status_cliente: string
): boolean => {
  if (status_cliente !== 'ATIVO') return false;
  if (status_credito === 'BLOQUEADO') return false;
  if (saldo_devedor_atual >= limite_credito) return false;

  return true;
};

/**
 * Calcula saldo disponível
 */
export const calculaSaldoDisponivel = (
  limite_credito: number,
  saldo_devedor_atual: number
): number => {
  return Math.max(0, limite_credido - saldo_devedor_atual);
};

/**
 * Determina cor do status do cliente
 */
export const getCorStatus = (
  status_credito: string
): 'success' | 'warning' | 'danger' | 'info' => {
  switch (status_credito) {
    case 'LIBERADO':
      return 'success';
    case 'ANALISE':
      return 'warning';
    case 'BLOQUEADO':
      return 'danger';
    default:
      return 'info';
  }
};

/**
 * Determina ícone do status
 */
export const getIconStatus = (status_credito: string): string => {
  switch (status_credito) {
    case 'LIBERADO':
      return '✅';
    case 'ANALISE':
      return '⏳';
    case 'BLOQUEADO':
      return '🚫';
    default:
      return '❓';
  }
};
