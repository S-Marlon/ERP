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
    onChange?: React.ChangeEventHandler<any>; // Permite passar qualquer handler (incluindo o que retorna booleano)
    options?: { value: string; label: string }[];
    placeholder?: string;
    error?: string;
    checked?: boolean; // ✨ Essencial para o checkbox controlado
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
    checked, // ✨ Desestruturado e usado
    error,
    disabled,
    required,
    maxLength,
    rows = 3,
    step = 1,
    className = "",
}) => (
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

        {/* RENDERIZAÇÃO DO CHECKBOX (CORRETO: Usa 'checked') */}
        {control === "checkbox" && (
            <div className="ui-form-checkbox-wrapper">
                
                <input
                    id={name}
                    name={name}
                    type="checkbox"
                    checked={checked} // ✅ LIGAÇÃO CRUCIAL
                    onChange={onChange}
                    disabled={disabled}
                    required={required}
                    className="ui-form-checkbox"
                />

                <label htmlFor={name} className="ui-form-label ui-form-checkbox-label">
                    {label}
                    {required && <span className="ui-form-required">*</span>}
                </label>
            </div>
        )}

        {/* Renderização dos Outros Controles (Input, Select, Textarea - Usam 'value') */}
        {control === "input" && (
            <input
                id={name}
                name={name}
                type={type}
                value={value} // ✅ LIGAÇÃO CRUCIAL
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
                value={value} // ✅ LIGAÇÃO CRUCIAL
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
                value={value} // ✅ LIGAÇÃO CRUCIAL
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