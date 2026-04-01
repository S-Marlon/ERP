import { useState, useCallback } from 'react';

// Tornamos os parâmetros opcionais para suportar a inicialização antes do Fetch
export const usePricing = (initialCost = 0, initialUnits = 1, initialMarkup = 1) => {
  const [values, setValues] = useState({
    costPrice: initialCost,
    unitsPerPackage: initialUnits || 1,
    markup: initialMarkup,
    salePrice: ((initialUnits || 1) ? initialCost / initialUnits : initialCost) * initialMarkup,
    margin: (initialMarkup - 1) * 100,
  });

  // Função para injetar os dados que vêm da API (SQL) ou da NF
  const setAllValues = useCallback((data: { 
    costPrice: number, 
    markup: number, 
    unitsPerPackage: number, 
    salePrice?: number 
  }) => {
    const cost = Number(data.costPrice) || 0;
    const units = Number(data.unitsPerPackage) || 1;
    const markup = Number(data.markup) || 1;
    const unitCost = units > 0 ? cost / units : cost;

    setValues({
      costPrice: cost,
      unitsPerPackage: units,
      markup: markup,
      margin: (markup - 1) * 100,
      salePrice: Number(data.salePrice) || unitCost * markup
    });
  }, []);

  // Centraliza a lógica de cálculo para qualquer campo alterado
  const handleFieldChange = useCallback((field: string, value: string | number) => {
    const val = value === '' ? 0 : Number(value);

    setValues(prev => {
      const updated = { ...prev, [field]: val };

      // Calcula o custo unitário de forma segura
      const currentUnits = prev.unitsPerPackage || 1;
      const currentCost = prev.costPrice || 0;
      const unitCost = currentUnits > 0 ? currentCost / currentUnits : currentCost;

      switch (field) {
        case 'margin': {
          const newMarkup = 1 + (val / 100);
          updated.markup = Number(newMarkup.toFixed(4));
          updated.salePrice = unitCost * newMarkup;
          break;
        }
        case 'markup': {
          updated.margin = (val - 1) * 100;
          updated.salePrice = unitCost * val;
          break;
        }
        case 'salePrice': {
          if (unitCost > 0) {
            updated.markup = val / unitCost;
            updated.margin = (updated.markup - 1) * 100;
          }
          break;
        }
        case 'costPrice':
        case 'unitsPerPackage': {
          // Mantém markup e recalcula o preço de venda
          const units = field === 'unitsPerPackage' ? (val || 1) : prev.unitsPerPackage || 1;
          const cost = field === 'costPrice' ? val : prev.costPrice || 0;
          const safeUnitCost = units > 0 ? cost / units : cost;
          updated.salePrice = safeUnitCost * prev.markup;
          break;
        }
      }

      return updated;
    });
  }, []);

  return { 
    values, 
    handleFieldChange, 
    setAllValues,
    updatePrices: handleFieldChange, 
    unitCost: (values.unitsPerPackage || 1) > 0 
      ? values.costPrice / values.unitsPerPackage 
      : values.costPrice
  };
};