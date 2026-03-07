import React, { useState, useEffect, useCallback } from 'react';

interface ImageGalleryProps {
  images?: string | string[] | null;
  width?: string | number;
  height?: string | number;
  layout?: 'side' | 'bottom';
  onValidationError?: (hasError: boolean) => void; // callback to notify parent of load failure
}

const EcommerceGallery: React.FC<ImageGalleryProps> = ({ 
  images, 
  width = '100%', 
  height = '100%', 
  layout = 'bottom',
  onValidationError
}) => {
  // Normalização: Filtra URLs válidas e remove vazias
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

  // --- RENDERIZAÇÃO DO ESTADO VAZIO ---
  if (imageList.length === 0) {
    return (
      <div className="gallery-empty-container" style={{ width, height }}>
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gray_140.png?_=20111031155906" 
          alt="Sem imagens" 
          className="empty-set-img"
        />
        <span className="empty-text">Sem foto disponível</span>
        <style>{`
          .gallery-empty-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            background: transparent;
          }
          .empty-set-img {
            width: 100%;
            height: 100%    ;
            opacity: 0.2; /* Deixa o símbolo discreto como um placeholder */
            filter: grayscale(1);
          }
          .empty-text {
            font-size: 11px;
            color: #9ca3af;
            font-family: sans-serif;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`gallery-container layout-${layout}`} style={{ width, height }}>
      <div className="gallery-wrapper">
        
        {/* Track de Miniaturas: Só aparece se houver mais de uma imagem (opcional) ou se houver imagens */}
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

        {/* Imagem Principal */}
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
        .gallery-container { font-family: sans-serif; display: flex; flex-direction: column; box-sizing: border-box; padding: 12px; background: #f9f9f9; }
        .gallery-wrapper { display: flex; gap: 12px; height: 100%; width: 100%; }
        
        .layout-side .gallery-wrapper { flex-direction: row; }
        .layout-bottom .gallery-wrapper { flex-direction: column-reverse; }

        .thumbnail-track { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 4px 2px; }
        .thumbnail-track::-webkit-scrollbar { display: none; }
        
        .layout-side .thumbnail-track { flex-direction: column; width: 60px; }
        .layout-bottom .thumbnail-track { flex-direction: row; width: 100%; }

        .thumb-item {
          width: 50px; height: 50px; flex-shrink: 0; border: 1px solid #d1d5db;
          border-radius: 6px; padding: 0; cursor: pointer; overflow: hidden;
          background: #fff; transition: all 0.2s;
        }
        .thumb-item.active { border-color: #2563eb; border-width: 2px; }
        .thumb-item img { width: 100%; height: 100%; object-fit: cover; }

        .main-display {
          flex: 1; position: relative; background: transparent;
          cursor: zoom-in; display: flex; align-items: center; 
          justify-content: center; overflow: hidden; min-height: 0;
        }
        
        .main-img-fluid { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; }

        .zoom-indicator {
          position: absolute; bottom: 8px; right: 8px; background: rgba(255,255,255,0.7);
          padding: 2px 6px; border-radius: 4px; font-size: 10px; color: #666;
        }

        /* Modal Styles */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.9); display: flex; align-items: center; justify-content: center; z-index: 99999; }
        .modal-pagination { position: absolute; top: 20px; color: white; font-size: 14px; }
        .close-btn { position: absolute; top: 15px; right: 25px; color: white; background: none; border: none; font-size: 35px; cursor: pointer; }
        .nav-btn { position: absolute; background: none; color: white; border: none; padding: 20px; cursor: pointer; font-size: 40px; opacity: 0.5; transition: 0.3s; }
        .nav-btn:hover { opacity: 1; }
        .prev { left: 10px; }
        .next { right: 10px; }
        .modal-content { max-width: 90vw; max-height: 80vh; }
        .full-res-img { max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default EcommerceGallery;