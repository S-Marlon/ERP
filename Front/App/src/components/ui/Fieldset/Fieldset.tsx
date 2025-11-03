// Fieldset.tsx
import React from 'react';
import './Fieldset.css'; // Importa os estilos
import Badge from './Badge/Badge';

/**
 * Define os tipos de variantes de estilo.
 */
export type FieldsetVariant = 'standard' | 'card' | 'highlight' | 'basic'; // Adicionado 'basic'

/**
 * Propriedades aceitas pelo componente Fieldset.
 */
export interface FieldsetProps extends React.FieldsetHTMLAttributes<HTMLFieldSetElement> {
  /** O título (legend) a ser exibido no fieldset. */
  legend: string | React.ReactNode;
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
  variant = 'standard', // 'standard' como padrão
  children,
  ...rest // Captura quaisquer outras props padrão de fieldset (como `className`, `id`, etc.)
}) => {
  // Constrói a lista de classes CSS
  // A classe base 'fieldset' é aplicada.
  // A classe de variante específica (e.g., 'fieldset-card') é aplicada e sobrescreve, se necessário.
  
  // Combina as classes passadas via props com as classes internas
  const fieldsetClassName = `fieldset fieldset-${variant} ${rest.className || ''}`.trim();

  // Remove className das props a serem passadas para o fieldset
  const { className, ...fieldsetProps } = rest; 

  return (
    <fieldset className={fieldsetClassName} {...fieldsetProps}> {/* Usa a classe combinada e as props restantes */}
      {/* O elemento <legend> recebe a classe de estilo para a legenda */}
      <legend className='legend'>{legend}</legend>
      {children}
      
    </fieldset>
  );
};

export default Fieldset;