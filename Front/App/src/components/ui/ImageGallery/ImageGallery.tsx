import React, { useState } from 'react';

interface ImageGalleryProps {
  images: string | string[];
  width?: string | number;  // Propriedade opcional
  height?: string | number; // Propriedade opcional
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  images, 
  width = '100%',   // Padrão: ocupa 100% do pai
  height = '100%'  // Padrão: altura fixa de 200px
}) => {
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const imageList = (Array.isArray(images) ? images : [images]).filter(Boolean);

  const handleOpen = (url: string) => {
    setSelectedImg(url);
    setTimeout(() => setIsModalOpen(true), 10);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedImg(null), 300);
  };

  return (
    <div style={{ ...galleryStyles.container, width, height }}>
      {/* Container de Miniaturas */}
      <div style={{ ...galleryStyles.wrapper, height: '100%' }}>
        {imageList.length > 0 ? (
          imageList.map((url, index) => (
            <div
              key={index}
              onClick={() => handleOpen(url)}
              style={{ 
                ...galleryStyles.thumbnailWrapper, 
                width: '100%', 
                height: '100%' 
              }}
              className="thumb-hover"
            >
              <img src={url} alt={`Produto ${index}`} style={galleryStyles.thumb} />
            </div>
          ))
        ) : (
          <div style={{ ...galleryStyles.empty, height: '100%' }}>
            <span style={{ fontSize: '24px' }}>🖼️</span>
            <p style={{ margin: 0 }}>Sem imagem</p>
          </div>
        )}
      </div>

      {/* Modal Lightbox */}
      {selectedImg && (
        <div
          onClick={handleClose}
          style={{
            ...galleryStyles.overlay,
            opacity: isModalOpen ? 1 : 0,
            visibility: isModalOpen ? 'visible' : 'hidden',
          }}
        >
          <div
            style={{
              ...galleryStyles.modalContent,
              transform: isModalOpen ? 'scale(1)' : 'scale(0.8)',
              opacity: isModalOpen ? 1 : 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={handleClose} style={galleryStyles.closeBtn}>&times;</button>
            <img src={selectedImg} alt="Zoom" style={galleryStyles.fullImage} />
          </div>
        </div>
      )}

      <style>{`
        .thumb-hover { transition: all 0.3s ease; border: 1px solid #e5e7eb; }
        .thumb-hover:hover { 
          filter: brightness(0.9);
          box-shadow: 0 8px 15px rgba(0,0,0,0.1);
          cursor: zoom-in;
        }
      `}</style>
    </div>
  );
};

const galleryStyles: { [key: string]: React.CSSProperties } = {
  container: { 
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '12px',
  },
  wrapper: {
    display: 'flex',
    gap: '8px',
  },
  thumbnailWrapper: {
    backgroundColor: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  thumb: { 
    width: '100%', 
    height: '100%', 
    objectFit: 'contain', // Mantém a proporção sem cortar
    padding: '10px' 
  },
  empty: { 
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px dashed #e5e7eb',
    borderRadius: '12px',
    color: '#9ca3af',
    backgroundColor: '#f9fafb'
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    transition: 'all 0.3s ease',
  },
  modalContent: {
    position: 'relative',
    backgroundColor: '#fff',
    padding: '8px',
    borderRadius: '16px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  fullImage: {
    maxWidth: '100%',
    maxHeight: '85vh',
    borderRadius: '8px',
    objectFit: 'contain'
  },
  closeBtn: {
    position: 'absolute',
    top: '-50px',
    right: '0',
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '44px',
    cursor: 'pointer',
  }
};

export default ImageGallery;