// Fieldset.tsx
import React from 'react';
import './Fieldset.css'; // Importa os estilos CSS Modules

/**
 * Define os tipos de variantes de estilo.
 */
export type FieldsetVariant = 'standard' | 'card' | 'highlight';

/**
 * Propriedades aceitas pelo componente Fieldset.
 */
export interface FieldsetProps extends React.FieldsetHTMLAttributes<HTMLFieldSetElement> {
  /** O título (legend) a ser exibido no fieldset. */
  legend: string;
  /** A variante de estilo para o fieldset. Padrão: 'standard'. */
  variant?: FieldsetVariant;
  /** O conteúdo a ser renderizado dentro do fieldset. */
  children: React.ReactNode;
}

/**
 * Um componente React/TypeScript para renderizar um elemento <fieldset>
 * com suporte a diferentes variantes de estilo.
 */
const Fieldset: React.FC<FieldsetProps> = ({
  legend,
  variant = 'standard', // Define 'standard' como padrão
  children,
  
}) => {
  // Constrói a lista de classes CSS
  // styles.fieldset é a classe base.
  // styles[variant] adiciona a classe da variante específica (e.g., styles.card).
   

  return (
    <fieldset className={'fieldset fieldset-'+variant} >
      {/* O elemento <legend> recebe a classe de estilo para a legenda */}
      <legend className='legend' >{legend}</legend>
      {children}
    </fieldset>
  );
};

export default Fieldset;