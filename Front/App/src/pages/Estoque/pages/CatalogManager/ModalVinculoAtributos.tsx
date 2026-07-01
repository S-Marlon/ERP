import React, { useState } from 'react';
import { AtributoConfig } from './CatalogManager.types';

interface ModalVinculoAtributosProps {
  isModalAberto: boolean;
  setIsModalAberto: (aberto: boolean) => void;
  destinoModal: 'dna' | 'grade' | 'especificacao'; 
  atributosGlobaisDisponiveis: AtributoConfig[];
  handleAdicionarAtributoAoGrupo: (atributo: Partial<AtributoConfig>) => void;
  brandColor?: string;
}

export const ModalVinculoAtributos: React.FC<ModalVinculoAtributosProps> = ({
  isModalAberto,
  setIsModalAberto,
  destinoModal,
  atributosGlobaisDisponiveis,
  handleAdicionarAtributoAoGrupo,
  brandColor = '#0050b3'
}) => {
  const [novoNome, setNovoNome] = useState('');
  const [novoTipo, setNovoTipo] = useState<'texto' | 'numero' | 'opcoes'>('texto');

  if (!isModalAberto) return null;

  const renderTagDestino = () => {
    switch (destinoModal) {
      case 'dna':
        return <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '20px', backgroundColor: '#e6f7ff', color: '#0050b3', border: '1px solid #91d5ff' }}>🧬 DNA</span>;
      case 'grade':
        return <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '20px', backgroundColor: '#fff7e6', color: '#d46b08', border: '1px solid #ffd591' }}>📏 Grade</span>;
      default:
        return <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '20px', backgroundColor: '#f5f5f5', color: '#595959', border: '1px solid #d9d9d9' }}>📋 Ficha Técnica</span>;
    }
  };

  const handleCriarInedito = () => {
    if (novoNome.trim()) {
      handleAdicionarAtributoAoGrupo({ 
        nome: novoNome.trim(), 
        tipoDado: novoTipo,
        classificacao: destinoModal
      });
      setNovoNome('');
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={() => setIsModalAberto(false)}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)', // Backdrop escurecido moderno (Slate 900)
        backdropFilter: 'blur(8px)', // Desfoque de fundo mais elegante
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '20px'
      }}
    >
      <div 
        className="modal-body" 
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          width: '100%',
          maxWidth: '480px', // Trava estrita de largura
          borderRadius: '12px', // Cantos levemente mais suaves
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', // Sombra premium suave
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
      >
        {/* CABEÇALHO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0f172a', letterSpacing: '-0.3px' }}>
              Vincular Atributo Global
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
              Selecione do dicionário corporativo do ERP ou cadastre um termo novo.
            </p>
          </div>
          <div>
            {renderTagDestino()}
          </div>
        </div>

        {/* LISTA DE ATRIBUTOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Termos Disponíveis no ERP
          </span>
          <div style={{ 
            maxHeight: '180px', 
            overflowY: 'auto', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            padding: '4px'
          }}>
            {atributosGlobaisDisponiveis.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
                Nenhum atributo pendente encontrado.
              </div>
            ) : (
              atributosGlobaisDisponiveis.map(attr => (
                <div 
                  key={attr.id} 
                  className="modal-list-item" 
                  onClick={() => handleAdicionarAtributoAoGrupo(attr)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: '#ffffff',
                    marginBottom: '4px',
                    border: '1px solid #f1f5f9',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => { 
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={(e) => { 
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#f1f5f9';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <strong style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>{attr.nome}</strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {attr.tipoDado === 'opcoes' ? '📋 Lista de Opções' : attr.tipoDado === 'numero' ? '🔢 Número' : '🔤 Texto'}
                    </span>
                  </div>
                  <button 
                    type="button"
                    style={{ 
                      fontSize: '11px', 
                      padding: '0 10px', 
                      height: '26px', 
                      fontWeight: 600,
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.1s'
                    }}
                  >
                    ＋ Vincular
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CRIAR ATRIBUTO INÉDITO */}
        <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '20px', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Não encontrou? Criar termo inédito
          </label>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Ex: Espessura da Camada" 
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              style={{ 
                flex: 1,
                height: '36px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0 12px',
                fontSize: '13px',
                color: '#0f172a',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s'
              }} 
              onFocus={(e) => e.target.style.borderColor = brandColor}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
            />

            <select
              value={novoTipo}
              onChange={e => setNovoTipo(e.target.value as any)}
              style={{
                height: '36px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0 8px',
                fontSize: '13px',
                color: '#334155',
                backgroundColor: '#ffffff',
                width: '100px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="texto">Texto</option>
              <option value="numero">Número</option>
              <option value="opcoes">Lista</option>
            </select>
            
            <button 
              type="button"
              onClick={handleCriarInedito} 
              style={{ 
                backgroundColor: brandColor, 
                color: '#ffffff', 
                height: '36px', 
                fontSize: '13px', 
                padding: '0 16px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Criar
            </button>
          </div>
        </div>

        {/* RODAPÉ */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <button 
            type="button"
            onClick={() => setIsModalAberto(false)} 
            style={{ 
              height: '34px', 
              padding: '0 16px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#475569';
            }}
          >
            Cancelar e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};