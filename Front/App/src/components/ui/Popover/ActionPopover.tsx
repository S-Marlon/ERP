import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface PopoverAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface ActionPopoverProps {
  triggerLabel?: string;
  triggerIcon?: React.ReactNode;
  actions: PopoverAction[];
}

export const ActionPopover = ({ 
  triggerLabel = "Ações", 
  triggerIcon = "⚙️", 
  actions 
}: ActionPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Função para fechar o menu com segurança
  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Se o clique for fora do container do popover, fecha.
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeMenu]);

  // Função que gerencia o clique na ação
  const handleActionClick = (e: React.MouseEvent, actionFn: () => void) => {
    e.preventDefault();
    e.stopPropagation(); // Impede que o clique suba para outros elementos
    
    closeMenu(); // Primeiro fecha a interface
    
    // Pequeno delay para garantir que a animação de fechar inicie 
    // e não trave a UI se a função actionFn for pesada
    setTimeout(() => {
      actionFn();
    }, 50);
  };

  return (
    <div 
      style={{ position: 'relative', display: 'inline-block', verticalAlign: 'middle' }} 
      ref={popoverRef}
    >
      <style>{`
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.9) translateY(-10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .popover-content {
          animation: popIn 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .action-item:hover { background-color: #f8fafc !important; }
        .action-item-danger:hover { background-color: #fff1f2 !important; }
      `}</style>

      {/* Gatilho */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          ...styles.trigger,
          backgroundColor: isOpen ? '#f1f5f9' : '#ffffff',
          borderColor: isOpen ? '#3b82f6' : '#cbd5e1',
        }}
        type="button"
      >
        <span>{triggerIcon}</span>
        <span>{triggerLabel}</span>
        <span style={{ 
          fontSize: '10px', 
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s' 
        }}>▼</span>
      </button>

      {/* Menu */}
      {isOpen && (
        <div className="popover-content" style={styles.menu}>
          {actions.map((action, index) => (
            <button
              key={index}
              className={`action-item ${action.variant === 'danger' ? 'action-item-danger' : ''}`}
              style={{
                ...styles.item,
                color: action.variant === 'danger' ? '#e11d48' : '#334155',
                borderBottom: index === actions.length - 1 ? 'none' : '1px solid #f1f5f9'
              }}
              onClick={(e) => handleActionClick(e, action.onClick)}
            >
              {action.icon && <span style={{ marginRight: '8px' }}>{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: ' 4px',
    borderRadius: '8px',
    border: '1px solid',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    color:'black',

    outline: 'none',
    transition: 'all 0.2s',
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 5px)',
    right: 0,
    backgroundColor: '#ffffff',
    minWidth: '190px',
    borderRadius: '10px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0,0,0,0.05)',
    padding: '4px',
    zIndex: 100,
  },
  item: {
    width: '100%',
    padding: '8px 10px',
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    transition: 'background 0.2s',
  }
};