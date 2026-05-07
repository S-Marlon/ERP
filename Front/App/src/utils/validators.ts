/**
 * VALIDADORES E MÁSCARAS
 * Funções utilitárias para validação e formatação de dados
 */

// ======================================================================
// VALIDAÇÕES
// ======================================================================

/**
 * Valida CPF usando algoritmo de dígitos verificadores
 */
export function validaCPF(cpf: string): boolean {
  // Remove caracteres especiais
  const limpo = cpf.replace(/\D/g, '');

  // Verifica comprimento
  if (limpo.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(limpo)) return false;

  // Calcula primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(limpo[i]) * (10 - i);
  }
  let resto = soma % 11;
  let digito1 = resto < 2 ? 0 : 11 - resto;

  if (parseInt(limpo[9]) !== digito1) return false;

  // Calcula segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(limpo[i]) * (11 - i);
  }
  resto = soma % 11;
  let digito2 = resto < 2 ? 0 : 11 - resto;

  if (parseInt(limpo[10]) !== digito2) return false;

  return true;
}

/**
 * Valida CNPJ usando algoritmo de dígitos verificadores
 */
export function validaCNPJ(cnpj: string): boolean {
  // Remove caracteres especiais
  const limpo = cnpj.replace(/\D/g, '');

  // Verifica comprimento
  if (limpo.length !== 14) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(limpo)) return false;

  // Calcula primeiro dígito verificador
  let tamanho = limpo.length - 2;
  let numeros = limpo.substring(0, tamanho);
  let digitos = limpo.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  // Calcula segundo dígito verificador
  tamanho = tamanho + 1;
  numeros = limpo.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
}

/**
 * Valida email básico
 */
export function validaEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Valida telefone (10 ou 11 dígitos)
 */
export function validaTelefone(telefone: string): boolean {
  const limpo = telefone.replace(/\D/g, '');
  return limpo.length === 10 || limpo.length === 11;
}

/**
 * Valida CEP (formato 12345-678 ou 12345678)
 */
export function validaCEP(cep: string): boolean {
  const limpo = cep.replace(/\D/g, '');
  return limpo.length === 8;
}

// ======================================================================
// MÁSCARAS / FORMATAÇÃO
// ======================================================================

/**
 * Máscara para CPF: 123.456.789-00
 */
export function maskCPF(value: string): string {
  const limpo = value.replace(/\D/g, '').substring(0, 11);
  return limpo
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Máscara para CNPJ: 12.345.678/0001-00
 */
export function maskCNPJ(value: string): string {
  const limpo = value.replace(/\D/g, '').substring(0, 14);
  return limpo
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/**
 * Máscara para Telefone: (11) 99999-9999
 */
export function maskPhone(value: string): string {
  const limpo = value.replace(/\D/g, '').substring(0, 11);
  
  if (limpo.length <= 2) {
    return limpo ? `(${limpo}` : '';
  }
  if (limpo.length <= 7) {
    return limpo.replace(/(\d{2})(\d)/, '($1) $2');
  }
  return limpo.replace(/(\d{2})(\d{5})(\d)/, '($1) $2-$3');
}

/**
 * Máscara para CEP: 12345-678
 */
export function maskCEP(value: string): string {
  const limpo = value.replace(/\D/g, '').substring(0, 8);
  return limpo.replace(/(\d{5})(\d)/, '$1-$2');
}

/**
 * Máscara para Moeda (Real): 1.234,56
 */
export function maskCurrency(value: string): string {
  const limpo = value.replace(/\D/g, '');
  const inteiro = limpo.replace(/(\d)(\d{2})$/, '$1,$2');
  return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ======================================================================
// FORMATADORES
// ======================================================================

/**
 * Formata número como moeda brasileira: R$ 1.234,56
 */
export function formatCurrency(value: number | string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

/**
 * Formata data: 01/01/2025
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return '';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Formata data e hora: 01/01/2025 14:30
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return '';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

/**
 * Formata CPF para exibição: 123.456.789-00
 */
export function formatCPF(cpf: string): string {
  return maskCPF(cpf);
}

/**
 * Formata CNPJ para exibição: 12.345.678/0001-00
 */
export function formatCNPJ(cnpj: string): string {
  return maskCNPJ(cnpj);
}

/**
 * Formata telefone para exibição: (11) 99999-9999
 */
export function formatPhone(phone: string): string {
  return maskPhone(phone);
}

/**
 * Formata CEP para exibição: 12345-678
 */
export function formatCEP(cep: string): string {
  return maskCEP(cep);
}

/**
 * Remove máscara de valor (retorna apenas números)
 */
export function removeMask(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Calcula dias de diferença entre duas datas
 */
export function calcularDiasAtraso(dataVencimento: Date | string, dataPagamento?: Date | string | null): number {
  const vencimento = typeof dataVencimento === 'string' ? new Date(dataVencimento) : dataVencimento;
  const pagamento = dataPagamento ? (typeof dataPagamento === 'string' ? new Date(dataPagamento) : dataPagamento) : new Date();
  
  const diferenca = pagamento.getTime() - vencimento.getTime();
  const dias = Math.ceil(diferenca / (1000 * 60 * 60 * 24));
  
  return dias > 0 ? dias : 0;
}
