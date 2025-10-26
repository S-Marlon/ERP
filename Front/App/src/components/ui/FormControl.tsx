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
    error?: string; // 💡 Propriedade para a mensagem de erro
    checked?: boolean;
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
    checked,
    error, // 💡 Desestruturado para uso
    disabled,
    required,
    maxLength,
    rows = 3,
    step = 1,
    className = "",
}) => (
    // O container principal não precisa de classe de erro, apenas o input
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

        {/* RENDERIZAÇÃO DO CHECKBOX */}
        {control === "checkbox" && (
            <div className="ui-form-checkbox-wrapper">
                
                <input
                    id={name}
                    name={name}
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    required={required}
                    className="ui-form-checkbox"
                    // Não aplicamos a classe ui-input-error no checkbox para manter a UX padrão
                />

                <label htmlFor={name} className="ui-form-label ui-form-checkbox-label">
                    {label}
                    {required && <span className="ui-form-required">*</span>}
                </label>
            </div>
        )}

        {/* Renderização do INPUT (COM REALCE DE ERRO) */}
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
                // 💡 ADIÇÃO: Adiciona 'ui-input-error' se houver a prop error
                className={`ui-form-input ${error ? 'ui-input-error' : ''}`}
            />
        )}
        
        {/* Renderização do SELECT (COM REALCE DE ERRO) */}
        {control === "select" && (
            <select
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                disabled={disabled}
                required={required}
                // 💡 ADIÇÃO: Adiciona 'ui-input-error' se houver a prop error
                className={`ui-form-select ${error ? 'ui-input-error' : ''}`}
            >
                <option value="">Selecione...</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        )}

        {/* Renderização do TEXTAREA (COM REALCE DE ERRO) */}
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
                // 💡 ADIÇÃO: Adiciona 'ui-input-error' se houver a prop error
                className={`ui-form-textarea ${error ? 'ui-input-error' : ''}`}
            />
        )}
        
        {/* 💡 EXIBIÇÃO DA MENSAGEM DE ERRO */}
        {error && <span className="ui-form-error">{error}</span>}
    </div>
);

export default FormControl;