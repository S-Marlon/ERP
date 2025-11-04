import React from "react";
import "./FormControl.css";

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
    checked?: boolean;
    disabled?: boolean;
    required?: boolean;
    rows?: number;
    className?: string;
    maxLength?: number;
    step?: number;
    // 💡 Corrigido para OPCIONAL no TypeScript
    readOnlyDisplay?: boolean; 
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
    error,
    disabled,
    required,
    maxLength,
    rows = 3,
    step = 1,
    className = "",
    readOnlyDisplay = false,
}) => {
    
    // --- 🎯 LÓGICA DE RETORNO CONDICIONAL (DEVE ESTAR AQUI) ---
    if (readOnlyDisplay) {
        // Lógica de valor para SELECT
        const displayValue = control === 'select' 
            ? options.find(opt => opt.value === value)?.label || value 
            : value;
        
        // Determina o valor de exibição para checkbox (Sim/Não)
        const displayCheckboxValue = control === 'checkbox' 
            ? (checked ? 'Sim' : 'Não') 
            : displayValue;

        // Utilizamos uma div simples estilizada para parecer um campo travado
        return (
            <div className={`ui-form-control ${className}`}>
                <label htmlFor={name} className="ui-form-label">
                    {label}
                </label>
                {/* 💡 Aplica o valor baseado no controle, usando o estilo de display travado */}
                <div className="ui-form-read-only-display">
                    {displayCheckboxValue || '-'} 
                </div>
            </div>
        );
    }
    // -------------------------------------------------------------------

    // --- RENDERIZAÇÃO PADRÃO (SE readOnlyDisplay for FALSE) ---
    return (
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
                    className={`ui-form-textarea ${error ? 'ui-input-error' : ''}`}
                />
            )}
            
            {/* EXIBIÇÃO DA MENSAGEM DE ERRO */}
            {error && <span className="ui-form-error">{error}</span>}
        </div>
    );
};

export default FormControl;