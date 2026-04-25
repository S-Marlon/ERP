/**
 * LABOR CALCULATOR
 * Calculadora de mão de obra/prensagem
 */

import React, { useCallback, useMemo } from 'react';
import type { LaborCalculation, LaborCalculationType } from '../../../../types/erp.types';
import { calculateLaborTotal } from '../../../../utils/os-helpers';
import styles from '../OSPanel.module.css';

interface LaborCalculatorProps {
  labor: LaborCalculation;
  terminals?: number;
  onChange: (labor: LaborCalculation) => void;
  readonly?: boolean;
  money: Intl.NumberFormat;
}

const LaborCalculator: React.FC<LaborCalculatorProps> = ({
  labor,
  terminals = 0,
  onChange,
  readonly = false,
  money,
}) => {
  const laborTypes: Array<{ value: LaborCalculationType; label: string }> = [
    { value: 'per_point', label: 'R$ Por Terminal' },
    { value: 'fixed', label: 'Valor Fixo Montagem' },
    { value: 'table', label: '📋 Tabela por Bitola' },
  ];

  const handleTypeChange = useCallback(
    (type: LaborCalculationType) => {
      onChange({ ...labor, type });
    },
    [labor, onChange]
  );

  const handleValueChange = useCallback(
    (value: number) => {
      const total = calculateLaborTotal({ ...labor, value }, terminals);
      onChange({ ...labor, value, total });
    },
    [labor, onChange, terminals]
  );

  const calculatedTotal = useMemo(
    () => calculateLaborTotal(labor, terminals),
    [labor, terminals]
  );

  return (
    <div className={styles.laborContainer}>
      <label>Serviço de Prensagem</label>

      <div className={styles.laborTypeSelector}>
        {laborTypes.map((type) => (
          <button
            key={type.value}
            className={labor.type === type.value ? styles.activeType : ''}
            onClick={() => handleTypeChange(type.value)}
            disabled={readonly}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div className={styles.laborInputWrapper}>
        <div className={styles.inputWithIcon}>
          <span className={styles.currencyBadge}>R$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Custo da prensagem"
            value={labor.value || 0}
            onChange={(e) => handleValueChange(parseFloat(e.target.value) || 0)}
            disabled={readonly}
          />
        </div>

        {labor.type === 'per_point' && terminals > 0 && (
          <span className={styles.infoHelper}>
            * Multiplicado por {terminals} terminal(is): {money.format(calculatedTotal)}
          </span>
        )}
      </div>

      <p className={styles.laborPreview}>
        Subtotal do serviço: <strong>{money.format(calculatedTotal)}</strong>
      </p>
    </div>
  );
};

export default LaborCalculator;
