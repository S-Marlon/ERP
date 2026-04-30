/**
 * constants/index.ts
 * Centraliza todas as constantes do PDV
 */

export const PAYMENT_METHODS = {
  CASH: 'money',
  DEBIT_CARD: 'debit_card',
  CREDIT_CARD: 'credit_card',
  PIX: 'pix',
  BANK_TRANSFER: 'bank_transfer',
  STORE_CREDIT: 'store_credit'
} as const;

export const PAYMENT_METHOD_LABELS = {
  money: 'Dinheiro',
  debit_card: 'Cartão Débito',
  credit_card: 'Cartão Crédito',
  pix: 'PIX',
  bank_transfer: 'Transferência',
  store_credit: 'Crediário'
} as const;

export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
} as const;

export const PAYMENT_STATUS_LABELS = {
  pending: 'Pendente',
  processing: 'Processando',
  paid: 'Pago',
  failed: 'Falha',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado'
} as const;

export const DISPLAY_MODES = {
  CARDS: 'cards',
  LIST: 'lista',
  SIMPLIFIED: 'simplificado'
} as const;

export const VENDA_STATUSES = {
  AVAILABLE: 'disponivel',
  EDITING: 'editando',
  PAYMENT: 'pagamento'
} as const;

export const PRODUCT_STATUSES = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  LOW_STOCK: 'Baixo Estoque'
} as const;

export const PDV_SCREENS = {
  PDV: 'pdv',
  OS_LIST: 'os-list',
  OS_CREATE: 'os-create'
} as const;

export const DEBOUNCE_DELAY_MS = 500;
export const API_TIMEOUT_MS = 30000;
export const MAX_CART_ITEMS = 999;
export const MIN_SALE_VALUE = 0.01;
