import { useState, useCallback } from 'react';

// Tornamos os parâmetros opcionais para suportar a inicialização antes do Fetch
export const usePricing = (initialCost = 0, initialUnits = 1, initialMarkup = 1) => {
  const [values, setValues] = useState({
    costPrice: initialCost,
    unitsPerPackage: initialUnits || 1,
    markup: initialMarkup,
    salePrice: (initialCost / (initialUnits || 1)) * initialMarkup,
    margin: (initialMarkup - 1) * 100,
  });

  // Função para injetar os dados que vêm da API (SQL)
  const setAllValues = useCallback((data: { 
    costPrice: number, 
    markup: number, 
    unitsPerPackage: number, 
    salePrice?: number 
  }) => {
    const cost = Number(data.costPrice) || 0;
    const units = Number(data.unitsPerPackage) || 1;
    const markup = Number(data.markup) || 1;
    const uCost = cost / units;

    setValues({
      costPrice: cost,
      unitsPerPackage: units,
      markup: markup,
      margin: (markup - 1) * 100,
      salePrice: Number(data.salePrice) || (uCost * markup)
    });
  }, []);

  // Centraliza a lógica de cálculo para qualquer campo alterado
  const handleFieldChange = useCallback((field: string, value: string | number) => {
    const val = value === '' ? 0 : Number(value);

    setValues(prev => {
      const updated = { ...prev, [field]: val };
      
      // Cálculo do Custo Unitário atualizado dentro do estado
      const currentCost = field === 'costPrice' ? val : prev.costPrice;
      const currentUnits = field === 'unitsPerPackage' ? (val || 1) : prev.unitsPerPackage;
      const unitCost = currentCost / currentUnits;

     if (field === 'margin') {
  const newMarkup = 1 + (val / 100);
  updated.markup = Number(newMarkup.toFixed(4)); // Limita casas decimais
  updated.salePrice = unitCost * newMarkup;
}
      else if (field === 'markup') {
        updated.margin = (val - 1) * 100;
        updated.salePrice = unitCost * val;
      } 
      else if (field === 'salePrice') {
        if (unitCost > 0) {
          updated.markup = val / unitCost;
          updated.margin = (updated.markup - 1) * 100;
        }
      }
      else if (field === 'costPrice' || field === 'unitsPerPackage') {
        // Se mudar o custo ou a qtd, mantém o markup e atualiza a venda
        updated.salePrice = unitCost * prev.markup;
      }

      return updated;
    });
  }, []);

  return { 
    values, 
    handleFieldChange, 
    setAllValues,
    // Aqui está o segredo: exportamos a função handleFieldChange 
    // com o "apelido" de updatePrices
    updatePrices: handleFieldChange, 
    unitCost: values.costPrice / (values.unitsPerPackage || 1)
  };
};