import React from 'react';
import './EditableField.css';

interface EditableFieldProps {
  label: string;
  isDirty: boolean;
  originalValue: string | number | undefined;
  onRevert: () => void;
  children: React.ReactNode; // Aqui entra o seu <input> ou <select>
}

const EditableField: React.FC<EditableFieldProps> = ({
  label,
  isDirty,
  originalValue,
  onRevert,
  children
}) => {

// 1. Garantimos que existe apenas um filho
  const child = React.Children.only(children) as React.ReactElement;

  // 2. Clonamos o filho injetando a nova classe mantendo as que ele já tinha
  const clonedChild = React.cloneElement(child, {
    className: `${child.props.className || ''} ${isDirty ? 'inputDirty' : ''}`.trim()
  });

  return (
    <div className="inputGroup" >
      <div className="labelContainer">
        <label className="label">{label}</label>
        
        {isDirty && (
          <button 
            type="button"
            onClick={onRevert}
            className="revertBadge"
            title="Reverter para o valor original"
          >
            ↺ Reverter
          </button>
        )}
      </div>

      {/* O Input/Select injetado via children */}
      <div className={isDirty ? "inputContainerDirty" : ""}>
        {clonedChild}
      </div>

      {isDirty && (
        <small className="originalValueText">
          <strong>Original:</strong> {originalValue || '(vazio)'}
        </small>
      )}
    </div>
  );
};

export default EditableField;