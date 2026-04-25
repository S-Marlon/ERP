/**
 * OS FORM
 * Formulário de configuração da OS
 */

import React, { useCallback, useMemo } from 'react';
import type { HydraulicAssemblyConfig } from '../../../../types/erp.types';
import styles from '../OSPanel.module.css';

interface Field {
  key: keyof HydraulicAssemblyConfig;
  label: string;
  type: 'text' | 'number' | 'select';
  placeholder?: string;
  options?: Array<{ value: string | number; label: string }>;
}

interface OSFormProps {
  config: HydraulicAssemblyConfig;
  onChange: (config: Partial<HydraulicAssemblyConfig>) => void;
  readonly?: boolean;
}

const OSForm: React.FC<OSFormProps> = ({ config, onChange, readonly = false }) => {
  const handleFieldChange = useCallback(
    (key: keyof HydraulicAssemblyConfig, value: string | number) => {
      onChange({ [key]: value });
    },
    [onChange]
  );

  const fields: Field[] = useMemo(() => [
    {
      key: 'equipment',
      label: 'Equipamento / Frota',
      type: 'text',
      placeholder: 'Ex: Escavadeira PC200 / Lote 04',
    },
    {
      key: 'application',
      label: 'Local de Aplicação',
      type: 'text',
      placeholder: 'Ex: Comando Central / Lança',
    },
    {
      key: 'gauge',
      label: 'Bitola (Pol/Dash)',
      type: 'select',
      options: [
        { value: '', label: 'Selecione...' },
        { value: '1/4', label: '1/4" (-04)' },
        { value: '3/8', label: '3/8" (-06)' },
        { value: '1/2', label: '1/2" (-08)' },
        { value: '3/4', label: '3/4" (-12)' },
        { value: '1', label: '1" (-16)' },
      ],
    },
    {
      key: 'layers',
      label: 'Nº de Tramas/Reforço',
      type: 'select',
      options: [
        { value: 1, label: '1 Trama (R1)' },
        { value: 2, label: '2 Tramas (R2)' },
        { value: 4, label: '4 Espirais (4SH/4SP)' },
        { value: 6, label: '6 Espirais (R13/R15)' },
      ],
    },
    {
      key: 'finalLength',
      label: 'Medida Final (mm)',
      type: 'number',
      placeholder: 'Ex: 1250',
    },
  ], []);

  return (
    <div className={styles.osForm}>
      <h2>Configuração da Montagem Hidráulica</h2>

      <div className={styles.inputGroupRow}>
        {fields.map((field) => (
          <div className={styles.inputField} key={field.key}>
            <label>{field.label}</label>
            {field.type === 'select' ? (
              <select
                value={config[field.key] || ''}
                onChange={(e) =>
                  handleFieldChange(
                    field.key,
                    field.key === 'layers' ? parseInt(e.target.value, 10) : e.target.value
                  )
                }
                disabled={readonly}
              >
                {field.options?.map((opt) => (
                  <option key={String(opt.value)} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={config[field.key] || ''}
                onChange={(e) =>
                  handleFieldChange(
                    field.key,
                    field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                  )
                }
                disabled={readonly}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OSForm;
