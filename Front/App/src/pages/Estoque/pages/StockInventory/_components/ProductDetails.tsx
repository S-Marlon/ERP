import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../../../../types/types';

interface ProductDetailsProps {
  product?: Product | null;
  onSave?: (updatedProduct: Product) => void;
  onClose?: () => void;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ product, onSave, onClose }) => {
  const [formData, setFormData] = useState<Product | null>(null);

  useEffect(() => {
    if (product) setFormData({ ...product });
    else setFormData(null);
  }, [product]);

  const margin = useMemo(() => {
    if (!formData || !formData.salePrice || formData.salePrice <= 0) return 0;
    const cost = formData.costPrice || 0;
    const calc = ((formData.salePrice - cost) / formData.salePrice) * 100;
    return parseFloat(calc.toFixed(2));
  }, [formData?.costPrice, formData?.salePrice]);

  if (!formData) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          👉 Selecione um produto na tabela para editar as informações.
        </p>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => prev ? ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }) : null);
  };

  return (
    <>
      <aside style={styles.sidebar}>
        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.headerTop}>
            <span style={{
              ...styles.badge,
              backgroundColor: formData.status === 'Ativo' ? '#dcfce7' : '#fee2e2',
              color: formData.status === 'Ativo' ? '#166534' : '#991b1b'
            }}>
              {formData.status?.toUpperCase()}
            </span>
            <button onClick={onClose} style={styles.btnClose}>&times;</button>
          </div>
          <h2 style={styles.title}>{formData.descricao}</h2>
          <p style={styles.sku}>CÓD: {formData.codigo_interno} | SKU: {formData.codigo_barras}</p>
        </div>

        <div style={styles.content}>
          {/* Alerta de Variação de Custo (Tabela alertas_precos) */}
          {formData.tem_alerta && (
            <div style={styles.alertBox}>
              <span style={{fontWeight: 'bold'}}>⚠️ Alerta de Custo:</span>
              <p style={{margin: '4px 0 0', fontSize: '12px'}}>O custo subiu {formData.variacao_percentual}%. Reajuste o preço!</p>
            </div>
          )}

          {/* Status e Tipo */}
          <div style={styles.section}>
            <div style={styles.toggleRow}>
              <span style={styles.label}>Produto Ativo</span>
              <button 
                onClick={() => setFormData({...formData, status: formData.status === 'Ativo' ? 'Inativo' : 'Ativo'})}
                style={{...styles.switch, backgroundColor: formData.status === 'Ativo' ? '#2563eb' : '#d1d5db'}}
              >
                <div style={{...styles.switchHandle, transform: formData.status === 'Ativo' ? 'translateX(20px)' : 'translateX(0px)'}} />
              </button>
            </div>
          </div>

          {/* Precificação Baseada no Banco */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>💵 Financeiro</h3>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Método de Precificação</label>
              <select name="metodo_precificacao" value={formData.metodo_precificacao} onChange={handleChange} style={styles.input}>
                <option value="MARKUP">MARKUP (Automático)</option>
                <option value="MANUAL">MANUAL (Preço Fixo)</option>
              </select>
            </div>

            <div style={{...styles.grid, marginTop: '12px'}}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Markup Praticado</label>
                <input 
                  type="number" name="markup_praticado" value={formData.markup_praticado} 
                  onChange={handleChange} style={styles.input} disabled={formData.metodo_precificacao === 'MANUAL'}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Preço de Venda (R$)</label>
                <input 
                  type="number" name="preco_venda" value={formData.preco_venda} 
                  onChange={handleChange} style={styles.input} 
                />
              </div>
            </div>

            <div style={{...styles.marginBox, backgroundColor: margin >= 0 ? '#f0fdf4' : '#fef2f2', color: margin >= 0 ? '#166534' : '#991b1b'}}>
              <span>Lucro sobre custo médio:</span>
              <strong style={{ fontSize: '16px' }}>{margin}%</strong>
            </div>
          </div>

          {/* Estoque (estoque_atual) */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>📦 Estoque e Logística</h3>
            <div style={styles.grid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Qtd Atual ({formData.unidade})</label>
                <input type="number" name="quantidade" value={formData.quantidade} onChange={handleChange} style={styles.input} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Estoque Mínimo</label>
                <input type="number" name="estoque_minimo" value={formData.estoque_minimo} onChange={handleChange} style={styles.input} />
              </div>
            </div>
          </div>

          {/* Dados Fiscais (produtos) */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>📑 Fiscal (NFE/XML)</h3>
            <div style={styles.grid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>NCM</label>
                <input type="text" name="ncm" value={formData.ncm || ''} onChange={handleChange} style={styles.input} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>CEST</label>
                <input type="text" name="cest" value={formData.cest || ''} onChange={handleChange} style={styles.input} />
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.btnCancel}>Cancelar</button>
          <button onClick={() => onSave?.(formData)} style={styles.btnSave}>Salvar Alterações</button>
        </div>
      </aside>
    </>
  );
};

// CSS-in-JS (CSS Puro)
const styles: { [key: string]: React.CSSProperties } = {
 
  header: {
    padding: '24px',
    borderBottom: '1px solid #f3f4f6'
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    color: '#111827',
    fontWeight: 700
  },
  sku: {
    margin: 0,
    fontSize: '12px',
    color: '#9ca3af',
    textTransform: 'uppercase'
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '99px',
    fontSize: '10px',
    fontWeight: 700
  },
  btnClose: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#9ca3af'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px'
  },
  section: {
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '12px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginBottom: '12px',
    fontWeight: 600
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  label: {
    fontSize: '12px',
    color: '#4b5563',
    fontWeight: 500
  },
  input: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    outline: 'none'
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px'
  },
  switch: {
    width: '40px',
    height: '20px',
    borderRadius: '20px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: '0.3s'
  },
  switchHandle: {
    width: '16px',
    height: '16px',
    backgroundColor: '#fff',
    borderRadius: '50%',
    position: 'absolute',
    top: '2px',
    left: '2px',
    transition: '0.3s'
  },
  marginBox: {
    marginTop: '16px',
    padding: '12px',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px'
  },
  footer: {
    padding: '20px 24px',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    gap: '12px',
    backgroundColor: '#f9fafb'
  },
  btnSave: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  btnCancel: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#fff',
    color: '#4b5563',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontWeight: 500,
    cursor: 'pointer'
  }
};

export default ProductDetails;