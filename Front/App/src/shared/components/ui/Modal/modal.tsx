import { FC, ReactNode } from 'react';
import './modal.css';

// 📚 Definição das Props usando TypeScript
interface ModalProps {
  // Estado para controlar se o modal está visível ou não
  isOpen: boolean;
  // Função de callback para fechar o modal
  onClose: () => void;
  // Conteúdo que será exibido dentro do modal (qualquer elemento React)
  children: ReactNode;
  // Opcional: Título do modal
  title?: string;
}

// 🧩 Componente Modal
const Modal: FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
  // Se o modal não estiver aberto (isOpen é false), não renderiza nada
  if (!isOpen) {
    return null;
  }

  return (
    // Overlay (Fundo escuro que cobre a tela)
    <div className="modal-overlay" onClick={onClose}>
      {/* Container principal do Modal */}
      {/* ⚠️ Adicionamos onCLick={(e) => e.stopPropagation()} para evitar que
          o clique dentro do modal feche-o (já que o overlay escuta o clique) */}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          {/* Título opcional */}
          {title && <h2>{title}</h2>}
          {/* Botão de Fechar */}
          <button className="modal-close-button" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {/* Conteúdo dinâmico do modal (props.children) */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;