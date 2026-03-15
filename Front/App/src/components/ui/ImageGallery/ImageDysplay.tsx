import React, { useState, useEffect } from 'react';

interface ImageDisplayProps {
  src?: string; // Agora é opcional para evitar erros
  size?: string;
  rounded?: string;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ 
  src, 
  size = "200px", 
  rounded = "8px" 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Se não houver URL, já marcamos como erro para não exibir nada quebrado
  useEffect(() => {
    if (!src) setHasError(true);
  }, [src]);

  // Bloqueia o scroll do corpo quando o modal está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  // Função de clique condicional
  const handleOpenModal = () => {
    if (!hasError && src) {
      setIsOpen(true);
    }
  };

  return (
    <>
      <style>{`
        .img-scope {
          --display-size: ${size};
          --display-radius: ${rounded};
        }

        .img-container {
          position: relative;
          width: var(--display-size);
          aspect-ratio: 1 / 1;
          border-radius: var(--display-radius);
          overflow: hidden;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          /* Só mostra o ponteiro de clique se NÃO houver erro */
          cursor: ${hasError ? 'default' : 'pointer'};
          border: 1px solid #e0e0e0;
        }

        .img-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }

        /* Efeito de zoom só funciona se a imagem estiver ok */
        .img-container:not(.has-error):hover .img-thumb {
          transform: scale(1.1);
        }

        .placeholder-text {
          color: #999;
          font-size: 12px;
          text-align: center;
          padding: 10px;
        }

        .modal-overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(5px);
          animation: fadeIn 0.2s ease;
        }

        .modal-img {
          max-width: 95%;
          max-height: 95%;
          object-fit: contain;
          animation: zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoomIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      <div className="img-scope">
        <div 
          className={`img-container ${hasError ? 'has-error' : ''}`} 
          onClick={handleOpenModal}
        >
          {!hasError && src ? (
            <img 
              src={src} 
              alt="Thumbnail" 
              className="img-thumb"
              onError={() => setHasError(true)} // Se a URL quebrar, vira placeholder
            />
          ) : (
            <div className="placeholder-text">Sem imagem</div>
          )}
        </div>

        {isOpen && !hasError && (
          <div className="modal-overlay" onClick={() => setIsOpen(false)}>
            <img 
              src={src} 
              className="modal-img" 
              alt="Full view"
            />
          </div>
        )}
      </div>
    </>
  );
};

export default ImageDisplay;