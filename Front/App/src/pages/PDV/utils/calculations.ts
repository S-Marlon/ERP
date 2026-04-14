// utils/calculations.ts
import { CartItem } from '../types/cart.types';

export const calculateCartTotals = (cart: CartItem[]) => {
  const itemsSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalBruto = cart.reduce((acc, item) => acc + (item.originalPrice || item.price) * item.quantity, 0);
  const totalDesconto = totalBruto - itemsSubtotal;
  const totalCusto = cart.reduce((acc, item) => acc + (item.originalPrice || item.price) * item.quantity, 0); // Ajustar se houver custo real
  const lucroNominal = itemsSubtotal - totalCusto;
  const percentualLucro = itemsSubtotal > 0 ? (lucroNominal / itemsSubtotal) * 100 : 0;

  return {
    itemsSubtotal,
    totalBruto,
    totalDesconto,
    totalLiquido: itemsSubtotal,
    totalCusto,
    lucroNominal,
    percentualLucro
  };
};

export const calculateLabor = (osData: any, itemsSubtotal: number): number => {
  if (osData.laborType === 'percent') {
    return itemsSubtotal * (osData.laborValue / 100);
  }
  if (osData.laborType === 'service') {
    // Lógica para serviço
    return osData.laborValue;
  }
  return osData.laborValue; // fixed
};