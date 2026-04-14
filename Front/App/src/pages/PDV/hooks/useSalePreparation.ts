// hooks/useSalePreparation.ts
import { useMemo } from 'react';
import { VendaPayload } from '../types/sale.types';
import { CartItem } from '../types/cart.types';
import { calculateCartTotals } from '../utils/calculations';

export const useSalePreparation = (cart: CartItem[], cliente: string) => {
  const saleData = useMemo(() => {
    if (!cart.length || !cliente) return null;

    const totals = calculateCartTotals(cart);

    const payload: VendaPayload = {
      data: new Date(),
      clienteNome: cliente,
      totalBruto: totals.totalBruto,
      totalDesconto: totals.totalDesconto,
      totalLiquido: totals.totalLiquido,
      totalCusto: totals.totalCusto,
      lucroNominal: totals.lucroNominal,
      percentualLucro: totals.percentualLucro,
      itens: cart.map(item => {
        const costPrice = item.costPrice || 0;
        const salePrice = item.price;
        const quantity = item.quantity;
        const subtotal = salePrice * quantity;
        const profitPerUnit = (salePrice - costPrice) * quantity;

        return {
          productId: item.id as number,
          nome: item.name,
          quantidade: quantity,
          precoVenda: salePrice,
          precoCusto: costPrice,
          subtotal,
          lucroUnitario: profitPerUnit
        };
      }),
      pagamentos: [] // Será preenchido no checkout
    };
    return payload;
  }, [cart, cliente]);

  const isValid = useMemo(() => {
    if (!saleData) return false;
    return saleData.itens.every(item => item.quantidade > 0) &&
           saleData.totalLiquido > 0 &&
           saleData.clienteNome.trim() !== '';
  }, [saleData]);

  return {
    saleData,
    isValid,
    prepareForSubmission: () => {
      // Aqui seria a lógica para enviar ao backend
      console.log('Preparando venda:', saleData);
      // Por enquanto, apenas log
    }
  };
};