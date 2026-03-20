import React, { useState } from 'react';
import './EditableField.css';

interface EditableFieldProps {
  label: string;
  isDirty: boolean;
  originalValue: any;
  showOriginalValue?: boolean;
  onRevert: () => void;
  showLock?: boolean;
  children: React.ReactElement;
}

const EditableField: React.FC<EditableFieldProps> = ({
  label,
  isDirty,
originalValue,
showOriginalValue = true, // Padronizei como true para manter o comportamento atual
onRevert,
  showLock = false,
  children
}) => {
  // A lógica de trava agora é INTERNA ao componente
  const [isLocked, setIsLocked] = useState(showLock); 

  const toggleLock = () => setIsLocked(!isLocked);

  const child = React.Children.only(children) as React.ReactElement;

  return (
    <div className="inputGroup">
      <label className="label">{label}</label>
      
      <div className={`fieldWrapper ${isDirty ? 'isDirty' : ''}`}>
        
        {/* CADEADO: Só renderiza se o pai pedir (showLock={true}) */}
        {showLock && (
          <button 
            type="button"
            onClick={toggleLock} 
            className={`groupButton lockButton ${!isLocked ? 'unlocked' : ''}`}
            title={isLocked ? "Clique para destravar edição" : "Clique para travar edição"}
          >
            {isLocked ? '🔒' : '🔓'}
          </button>
        )}

        {/* INPUT/SELECT: Fica desabilitado se showLock for true E isLocked estiver true */}
        {React.cloneElement(child, {
          disabled: showLock ? isLocked : child.props.disabled,
          className: `inputDefault ${child.props.className || ''}`,
        })}

        {/* REVERTER: Aparece se alterado E (não tem trava OU está destravado) */}
        {isDirty && (!showLock || !isLocked) && (
          <button 
            type="button"
            onClick={onRevert}
            className="groupButton revertButton"
            title="Reverter para o valor original"
          >
            ↺
          </button>
        )}
      </div>

      {/* AJUSTE AQUI: Só mostra se estiver "sujo" E se a prop permitir */}
      {isDirty && showOriginalValue && (
        <span className="originalValueText">
          Valor original: <strong>{originalValue}</strong>
        </span>
      )}
    </div>
  );
};

export default EditableField;