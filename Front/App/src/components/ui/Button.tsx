import React from "react";
import "./Button.css"; // Crie um CSS para estilos globais do botão

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

const Button: React.FC<ButtonProps> = ({ variant = "primary", children, ...props }) => (
  <button className={`ui-btn ui-btn--${variant}`} {...props}>
    {children}
  </button>
);

export default Button;