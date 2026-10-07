import React from "react";
import "./Badge.css";

interface BadgeProps {
  // Adicionei "info" e mantive os seus personalizados
  color?: "default" | "success" | "warning" | "danger" | "poco" | "paper" | "info";
  children: React.ReactNode;
  className?: string;
  // Nova prop para estilo: 'filled' (sólido) ou 'subtle' (fundo claro)
  variant?: "filled" | "subtle"; 
}

const Badge: React.FC<BadgeProps> = ({
  color = "default",
  children,
  className = "",
  variant = "subtle",
}) => (
  <span className={`ui-badge ui-badge--${color} ui-badge--${variant} ${className}`}>
    {children}
  </span>
);

export default Badge;