import React from "react";
import "./Button.css";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "outline";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  loading = false,
  disabled,
  children,
  ...props
}) => (
  <button
    className={`ui-btn ui-btn--${variant}${loading ? " ui-btn--loading" : ""}`}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? <span className="ui-btn__spinner" /> : children}
  </button>
);

export default Button;