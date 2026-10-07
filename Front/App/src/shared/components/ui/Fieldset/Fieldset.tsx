import React from 'react';
import './Fieldset.css';

export type FieldsetVariant = 'standard' | 'card' | 'highlight' | 'basic';

export interface FieldsetProps extends React.FieldsetHTMLAttributes<HTMLFieldSetElement> {
  legend?: string | React.ReactNode;
  variant?: FieldsetVariant;
  children: React.ReactNode;
  /** Se true, a legenda fica dentro do container como um cabeçalho. */
  legendInner?: boolean; 
}

const Fieldset: React.FC<FieldsetProps> = ({
  legend,
  variant = 'standard',
  legendInner = false, // Padrão falso para não quebrar outros componentes
  children,
  ...rest
}) => {
  const { className, ...fieldsetProps } = rest;
  const fieldsetClassName = `fieldset fieldset-${variant} ${className || ''}`.trim();

  return (
    <fieldset 
      className={fieldsetClassName} 
      data-legend-inner={legendInner} 
      {...fieldsetProps}
    >
      <legend className='legend'>{legend}</legend>
      {/* Container auxiliar para garantir que o padding do conteúdo funcione bem com a legenda interna */}
      <div className="fieldset-body">
        {children}
      </div>
    </fieldset>
  );
};

export default Fieldset;