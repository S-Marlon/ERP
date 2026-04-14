// services/validation/cartValidation.ts
import { CartItem } from '../../types/cart.types';

export const validateCartItem = (item: CartItem): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!item.name || item.name.trim() === '') {
    errors.push('Nome do produto é obrigatório');
  }

  if (item.quantity <= 0) {
    errors.push('Quantidade deve ser maior que zero');
  }

  if (item.price < 0) {
    errors.push('Preço não pode ser negativo');
  }

  if (item.type === 'part' && item.stock !== undefined && item.quantity > item.stock) {
    errors.push('Quantidade excede o estoque disponível');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateCart = (cart: CartItem[]): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (cart.length === 0) {
    errors.push('Carrinho está vazio');
  }

  cart.forEach((item, index) => {
    const itemValidation = validateCartItem(item);
    if (!itemValidation.isValid) {
      errors.push(`Item ${index + 1}: ${itemValidation.errors.join(', ')}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};