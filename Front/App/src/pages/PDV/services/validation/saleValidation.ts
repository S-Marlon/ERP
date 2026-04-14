// services/validation/saleValidation.ts
import { VendaPayload } from '../../types/sale.types';

export const validateSaleData = (saleData: VendaPayload | null): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!saleData) {
    errors.push('Dados da venda não foram preparados');
    return { isValid: false, errors };
  }

  if (!saleData.clienteNome || saleData.clienteNome.trim() === '') {
    errors.push('Nome do cliente é obrigatório');
  }

  if (saleData.itens.length === 0) {
    errors.push('A venda deve conter pelo menos um item');
  }

  if (saleData.totalLiquido <= 0) {
    errors.push('Total da venda deve ser maior que zero');
  }

  saleData.itens.forEach((item, index) => {
    if (item.quantidade <= 0) {
      errors.push(`Item ${index + 1}: quantidade deve ser maior que zero`);
    }
    if (item.precoVenda < 0) {
      errors.push(`Item ${index + 1}: preço de venda não pode ser negativo`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};