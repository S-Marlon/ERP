import React from "react";
import "./Typography.css";

// Definindo os tipos de variante de tipografia
type TypographyVariant =
  | "h1" | "h1Alt"
  | "h2" | "h2Alt"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p" | "pMuted"
  | "small"
  | "strong"
  | "em";

// Estendendo a interface de props para incluir a propriedade 'color'
interface TypographyProps {
  variant?: TypographyVariant;
  as?: TypographyVariant;
  className?: string;
  children: React.ReactNode;
  // Propriedade opcional para atribuir a cor da fonte
  color?: string; // Aceita qualquer valor de cor CSS válido
}

// Mapeamento de variante para o elemento HTML tag
const tagMap: Record<TypographyVariant, keyof JSX.IntrinsicElements> = {
  h1: "h1",
  h1Alt: "h1",
  h2: "h2",
  h2Alt: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  p: "p",
  pMuted: "pMuted",
  small: "small",
  strong: "strong",
  em: "em",
};

const Typography: React.FC<TypographyProps> = ({
  variant = "p",
  as,
  className = "",
  children,
  color, // Destruturação da nova propriedade 'color'
  ...props
}) => {
  const Tag = tagMap[as || variant] || "p";

  // Cria um objeto de estilo para aplicar a cor, se fornecida
  const style = color ? { color } : {};
  
  return (
    <Tag 
      className={`ui-typography ui-typography--${variant} ${className}`}
      style={style} // Aplica o estilo inline
      {...props}
    >
      {children}
    </Tag>
  );
};

export default Typography;