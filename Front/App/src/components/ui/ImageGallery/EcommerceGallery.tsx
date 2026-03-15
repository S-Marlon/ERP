import React, { useState, useEffect, useCallback } from 'react';

interface ImageGalleryProps {
  images?: string | string[] | null;
  width?: string | number;
  height?: string | number; // Agora secundário ao aspecto quadrado
  layout?: 'side' | 'bottom';
  onValidationError?: (hasError: boolean) => void;
}

const EcommerceGallery: React.FC<ImageGalleryProps> = ({ 
  images, 
  width = '100%', 
  layout = 'bottom',
  onValidationError
}) => {
  const imageList = (Array.isArray(images) ? images : [images || '']).filter(url => url && url.trim() !== '');
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  const nextImage = useCallback(() => {
    setModalIndex((prev) => (prev + 1 === imageList.length ? 0 : prev + 1));
  }, [imageList.length]);

  const prevImage = useCallback(() => {
    setModalIndex((prev) => (prev === 0 ? imageList.length - 1 : prev - 1));
  }, [imageList.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen) return;
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, nextImage, prevImage]);

  // --- RENDERIZAÇÃO DO ESTADO VAZIO (QUADRADO TAMBÉM) ---
  if (imageList.length === 0) {
    return (
      <div className="gallery-empty-container" style={{ width, aspectRatio: '1/1' }}>
        <div className="empty-content">
           <img 
            src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gray_140.png" 
            alt="Sem imagens" 
            className="empty-set-img"
          />
          <span className="empty-text">Sem foto disponível</span>
        </div>
        <style>{`
          .gallery-empty-container {
            display: flex;
            background: #f3f4f6;
            border-radius: 8px;
            overflow: hidden;
          }
          .empty-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
          }
          .empty-set-img { width: 40%; opacity: 0.2; filter: grayscale(1); }
          .empty-text { font-size: 11px; color: #9ca3af; margin-top: 8px; }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`gallery-container layout-${layout}`} style={{ width, aspectRatio: '1 / 1' }}>
      <div className="gallery-wrapper">
        
        {/* Track de Miniaturas */}
        <div className="thumbnail-track">
          {imageList.map((url, index) => (
            <button
              key={index}
              className={`thumb-item ${activeIndex === index ? 'active' : ''}`}
              onClick={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <img src={url} alt={`Thumbnail ${index}`} />
            </button>
          ))}
        </div>

        {/* Imagem Principal (Ocupa o resto do quadrado) */}
        <div className="main-display" onClick={() => { setModalIndex(activeIndex); setIsModalOpen(true); }}>
          <img
            src={imageList[activeIndex]}
            alt="Produto"
            className="main-img-fluid"
            onError={() => onValidationError?.(true)}
            onLoad={() => onValidationError?.(false)}
          />
          <div className="zoom-indicator">🔍 Clique para ampliar</div>
        </div>
      </div>

      {/* Modal Lightbox */}
      {isModalOpen && (
        <div className="modal-overlay show" onClick={() => setIsModalOpen(false)}>
          <div className="modal-pagination">{modalIndex + 1} / {imageList.length}</div>
          <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
          <button className="nav-btn prev" onClick={(e) => { e.stopPropagation(); prevImage(); }}>&#10094;</button>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={imageList[modalIndex]} alt="Zoom" className="full-res-img" />
          </div>
          <button className="nav-btn next" onClick={(e) => { e.stopPropagation(); nextImage(); }}>&#10095;</button>
        </div>
      )}

      <style>{`
        .gallery-container { 
          font-family: sans-serif; 
          display: flex; 
          flex-direction: column; 
          box-sizing: border-box; 
          padding: 8px; 
          background: #fff; 
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden; /* Garante que nada saia do quadrado */
        }
        
        .gallery-wrapper { 
          display: flex; 
          gap: 10px; 
          height: 100%; 
          width: 100%; 
          min-height: 0; /* Importante para flexbox não estourar */
        }
        
        .layout-side .gallery-wrapper { flex-direction: row; }
        .layout-bottom .gallery-wrapper { flex-direction: column-reverse; }

        .thumbnail-track { 
          display: flex; 
          gap: 8px; 
          overflow: auto; 
          scrollbar-width: none; 
          padding: 2px;
        }
        .thumbnail-track::-webkit-scrollbar { display: none; }
        
        .layout-side .thumbnail-track { flex-direction: column; width: 60px; }
        .layout-bottom .thumbnail-track { flex-direction: row; height: 60px; width: 100%; }

        .thumb-item {
          width: 50px; height: 50px; flex-shrink: 0; border: 1px solid #e5e7eb;
          border-radius: 6px; padding: 0; cursor: pointer; overflow: hidden;
          background: #fff; transition: all 0.2s;
        }
        .thumb-item.active { border-color: #2563eb; box-shadow: 0 0 0 1px #2563eb; }
        .thumb-item img { width: 100%; height: 100%; object-fit: cover; }

        .main-display {
          flex: 1; 
          position: relative; 
          background: #fff;
          cursor: zoom-in; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          overflow: hidden;
          min-height: 0;
          border-radius: 8px;
        }
        
        .main-img-fluid { 
          width: 100%; 
          height: 100%; 
          object-fit: contain; /* Contain é melhor para e-commerce para não cortar o produto */
          padding: 5px;
        }

        .zoom-indicator {
          position: absolute; bottom: 8px; right: 8px; background: rgba(255,255,255,0.8);
          padding: 4px 8px; border-radius: 20px; font-size: 9px; color: #374151;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-weight: 600;
        }

        /* Modal Styles */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.95); display: flex; align-items: center; justify-content: center; z-index: 99999; }
        .modal-pagination { position: absolute; top: 20px; color: white; font-size: 14px; font-weight: bold; }
        .close-btn { position: absolute; top: 15px; right: 25px; color: white; background: none; border: none; font-size: 40px; cursor: pointer; z-index: 10; }
        .nav-btn { position: absolute; background: rgba(255,255,255,0.1); color: white; border: none; width: 60px; height: 60px; border-radius: 50%; cursor: pointer; font-size: 30px; transition: 0.3s; display: flex; align-items: center; justify-content: center; }
        .nav-btn:hover { background: rgba(255,255,255,0.2); }
        .prev { left: 20px; }
        .next { right: 20px; }
        .modal-content { max-width: 85vw; max-height: 85vh; display: flex; align-items: center; justify-content: center; }
        .full-res-img { max-width: 100%; max-height: 85vh; object-fit: contain; }
      `}</style>
    </div>
  );
};

export default EcommerceGallery;