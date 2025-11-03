import React from "react";
import "./Button.css";

// Adicione 'switch' ou qualquer nome que você usará para o TypeSwitch
type ButtonVariant =
   | "primary"
   | "secondary"
   | "success"
   | "danger"
   | "warning"
   | "outline"
   | "switch"; // Adicionei 'switch' ou similar, se for o caso

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
   variant?: ButtonVariant;
   loading?: boolean;
   active?: boolean; // Propriedade para estado ativo/selecionado
}

const Button: React.FC<ButtonProps> = ({
   variant = "primary",
   loading = false,
   disabled,
   active = false, // Inclua a prop e defina um valor padrão
   children,
   ...props
}) => {
    
   // 1. CONSTRÓI A CLASSE BASE
   let className = `ui-btn ui-btn--${variant}`;
    
   // 2. ADICIONA CLASSE DE LOADING
   if (loading) {
      className += " ui-btn--loading";
   }
    
   // 3. ADICIONA CLASSE DE ATIVO/SELECIONADO (A correção principal)
   if (active) {
      className += " ui-btn--active"; // Você usará esta classe no seu CSS
   }

   return (
      <button
         className={className}
         disabled={disabled || loading}
         {...props}
      >
         {loading ? <span className="ui-btn__spinner" /> : children}
      </button>
   );
};

export default Button;