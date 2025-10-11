import React from "react";
import "./FormControl.css";

type ControlType = "input" | "select" | "textarea";

interface FormControlProps {
  label: string;
  name?: string;
  type?: string; // Para input
  control?: ControlType;
  value?: any;
  onChange?: React.ChangeEventHandler<any>;
  options?: { value: string; label: string }[]; // Para select
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number; // Para textarea
  className?: string;
  maxLength?: number; // Para input
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
  className = "",
}) => (
  <div className={`ui-form-control ${className}`}>
    <label htmlFor={name} className="ui-form-label">
      {label}
      {required && <span className="ui-form-required">*</span>}
    </label>
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