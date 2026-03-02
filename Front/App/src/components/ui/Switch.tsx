import React, { forwardRef, InputHTMLAttributes } from 'react';
import './Switch.css';

interface SwitchProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, id, ...props }, ref) => {
    // Gerar um ID único se não for passado, para o label funcionar
    const switchId = id || `switch-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <label htmlFor={switchId} className="switch-container">
        {label && <span className="switch-label">{label}</span>}
        
        <input
          type="checkbox"
          id={switchId}
          className="switch-input"
          ref={ref}
          {...props}
        />
        
        <span className="slider"></span>
      </label>
    );
  }
);

Switch.displayName = 'Switch';

export default Switch;