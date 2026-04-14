// services/api/sales.ts
import { VendaPayload } from '../../types/sale.types';

export const submitSale = async (saleData: VendaPayload): Promise<{ success: boolean; saleId?: number }> => {
  // Implementação da submissão da venda
  console.log('Submitting sale:', saleData);
  // Simulação de sucesso
  return { success: true, saleId: Date.now() };
};