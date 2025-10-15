import React from "react";
import "./FormControl.css";

// ControlType e FormControlProps permanecem inalterados
type ControlType = "input" | "select" | "textarea" | "checkbox";

interface FormControlProps {
  label: string;
  name?: string;
  type?: string;
  control?: ControlType;
  value?: any; 
  onChange?: React.ChangeEventHandler<any>;
  options?: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  className?: string;
  maxLength?: number;
  step?: number;
}

const FormControl: React.FC<FormControlProps> = ({
  label,
  name,
  type = "text",
  control = "input",
  value,
  onChange,
  options = [],
  placeholder,
  error,
  disabled,
  required,
  maxLength,
  rows = 3,
  step = 1,
  className = "",
}) => (
    // Lógica da Classe do Container (Correta):
    <div className={`
        ${control === "checkbox" ? 'ui-form-control-checkbox' : 'ui-form-control'}
        ${className}
    `}>

      {/* Label para Inputs Padrão (APENAS SE NÃO for checkbox) */}
      {control !== "checkbox" && (
        <label htmlFor={name} className="ui-form-label">
          {label}
          {required && <span className="ui-form-required">*</span>}
        </label>
      )}

      {/* RENDERIZAÇÃO DO CHECKBOX (CORRIGIDA) */}
      {control === "checkbox" && (
        <div className="ui-form-checkbox-wrapper">
          
          <input
            id={name}
            name={name}
            type="checkbox"
            checked={!!value}
            onChange={onChange}
            disabled={disabled}
            required={required}
            className="ui-form-checkbox"
          />

          {/* O LABEL FOI REINSERIDO AQUI! */}
          <label htmlFor={name} className="ui-form-label ui-form-checkbox-label">
            {label}
            {required && <span className="ui-form-required">*</span>}
          </label>
        </div>
      )}

      {/* Renderização dos Outros Controles (Input, Select, Textarea) */}
      {control === "input" && (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          step={step}
          className="ui-form-input"
        />
      )}
      {control === "select" && (
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className="ui-form-select"
        >
          <option value="">Selecione...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {control === "textarea" && (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={rows}
          className="ui-form-textarea"
        />
      )}
      {error && <span className="ui-form-error">{error}</span>}
    </div>
);

export default FormControl;