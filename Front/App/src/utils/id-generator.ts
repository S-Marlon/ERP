/**
 * GERADOR DE IDENTIFICADORES
 * Funções para gerar IDs únicos e legíveis
 */

/**
 * Gerar número de OS legível
 * Formato: OS-2026-0001
 */
export const generateOSNumber = (timestamp: Date = new Date()): string => {
  const year = timestamp.getFullYear();
  const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `OS-${year}-${sequence}`;
};

/**
 * Gerar número de Venda legível
 * Formato: VND-2026-0001
 */
export const generateSaleNumber = (timestamp: Date = new Date()): string => {
  const year = timestamp.getFullYear();
  const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `VND-${year}-${sequence}`;
};

/**
 * Gerar UUID v4
 * Para IDs internos únicos
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Gerar ID com prefixo
 * Ex: CUST-123456
 */
export const generatePrefixedId = (prefix: string): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
};

/**
 * Gerar número de Boleto simulado
 * Formato real: 12345.67890 12345.678901 12345.678901 1 12345678901234
 */
export const generateBoletoNumber = (): string => {
  const part1 = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const part2 = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const part3 = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const part4 = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  
  return `${part1}.${part2} ${part3}.${part4}`;
};

/**
 * Gerar número de NF-e simulado
 * Precisa ser integrado com SEFAZ depois
 */
export const generateNFeNumber = (): string => {
  const series = Math.floor(Math.random() * 900) + 100;
  const number = Math.floor(Math.random() * 900000) + 100000;
  return `${series}${number}`;
};

/**
 * Gerar chave de acesso NF-e simulada
 * 43 dígitos
 */
export const generateNFeAccessKey = (): string => {
  let key = '';
  for (let i = 0; i < 43; i++) {
    key += Math.floor(Math.random() * 10);
  }
  return key;
};

/**
 * Validar formato de UUID
 */
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validar formato de OS número
 */
export const isValidOSNumber = (number: string): boolean => {
  const osRegex = /^OS-\d{4}-\d{4}$/;
  return osRegex.test(number);
};

/**
 * Extrair ano de um número OS/VND
 */
export const extractYear = (number: string): number | null => {
  const match = number.match(/-(\d{4})-/);
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Extrair sequencial de um número OS/VND
 */
export const extractSequence = (number: string): number | null => {
  const match = number.match(/-(\d{4})$/);
  return match ? parseInt(match[1], 10) : null;
};
