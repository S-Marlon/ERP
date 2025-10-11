import React from "react";
import "./Typography.css";

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

interface TypographyProps {
  variant?: TypographyVariant;
  as?: TypographyVariant;
  className?: string;
  children: React.ReactNode;
}

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
  pMuted: "p",
  small: "small",
  strong: "strong",
  em: "em",
};

const Typography: React.FC<TypographyProps> = ({
  variant = "p",
  as,
  className = "",
  children,
  ...props
}) => {
  const Tag = tagMap[as || variant] || "p";
  return (
    <Tag className={`ui-typography ui-typography--${variant} ${className}`} {...props}>
      {children}
    </Tag>
  );
};

export default Typography;