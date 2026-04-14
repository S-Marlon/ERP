// utils/formatters.ts
export const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatCurrency = (value: number): string => {
  return money.format(value);
};

export const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('pt-BR');
};