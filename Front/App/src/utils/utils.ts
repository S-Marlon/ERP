// utils.ts

// Função para formatar o valor como Real Brasileiro (R$)
export const formatCurrency = (value: number): string => {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
};