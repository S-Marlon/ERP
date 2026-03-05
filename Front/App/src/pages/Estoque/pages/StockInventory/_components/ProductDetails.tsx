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
        {/* Nome do Produto agora é um input para edição rápida */}
        <input 
          style={{...styles.title, width: '100%', border: 'none', background: 'transparent', outline: 'none'}} 
          name="descricao"
          onChange={handleChange}
        />
        <p style={styles.sku}>CÓD Interno: </p>
      </div>

      <div style={styles.content}>


        <div style={styles.section}>
  <h3 style={styles.sectionTitle}>🖼️ Imagem do Produto</h3>
  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
    <div style={{
      width: '100px',
      height: '100px',
      borderRadius: '8px',
      border: '1px solid #ddd',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb'
    }}>
      {/* {formData.imagem_url ? (
        <img src={formData.imagem_url} alt="Produto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize: '10px', color: '#9ca3af' }}>Sem foto</span>
      )} */}
    </div>
    
    <div style={{ flex: 1 }}>
      <label style={styles.label}>URL da Imagem</label>
      <input 
        type="text" 
        name="imagem_url" 
        placeholder="https://link-da-imagem.com/foto.jpg"
        onChange={handleChange} 
        style={styles.input} 
      />
      <small style={{ fontSize: '10px', color: '#6b7280' }}>Cole o link de uma imagem ou caminho do servidor.</small>
    </div>
  </div>
</div>

        {/* Alerta de Variação de Custo */}
        {/* {formData.tem_alerta && (
          <div style={styles.alertBox}>
            <span style={{fontWeight: 'bold'}}>⚠️ Alerta de Custo:</span>
            <p style={{margin: '4px 0 0', fontSize: '12px'}}>O custo subiu %. Reajuste o preço!</p>
          </div>
        )} */}

        {/* 1. Identificação e Organização */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>📌 Identificação</h3>
          <div style={styles.toggleRow}>
            <span style={styles.label}>Produto Ativo</span>
            <button 
              onClick={() => setFormData({...formData, status: formData.status === 'Ativo' ? 'Inativo' : 'Ativo'})}
              style={{...styles.switch, backgroundColor: formData.status === 'Ativo' ? '#2563eb' : '#d1d5db'}}
            >
              <div style={{...styles.switchHandle, transform: formData.status === 'Ativo' ? 'translateX(20px)' : 'translateX(0px)'}} />
            </button>
          </div>

          <div style={{...styles.grid, marginTop: '12px'}}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>SKU / Cód. Barras</label>
              <input type="text" name="codigo_barras" onChange={handleChange} style={styles.input} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Unidade</label>
              <select name="unidade"  onChange={handleChange} style={styles.input}>
                <option value="UN">UN (Unidade)</option>
                <option value="CX">CX (Caixa)</option>
                <option value="KG">KG (Quilo)</option>
                <option value="PCT">PCT (Pacote)</option>
              </select>
            </div>
          </div>

          <div style={{...styles.grid, marginTop: '12px'}}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Categoria</label>
              <select name="id_categoria"  onChange={handleChange} style={styles.input}>
                {/* Aqui você mapearia categorias vindo do banco */}
                <option value="">Selecione...</option>
                {/* {categorias.map(cat => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>{cat.nome_categoria}</option>
                ))} */}
              </select>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Marca</label>
              <select name="id_marca"  onChange={handleChange} style={styles.input}>
                <option value="">Selecione...</option>
                {/* {marcas.map(m => (
                  <option key={m.id_marca} value={m.id_marca}>{m.nome_marca}</option>
                ))} */}
              </select>
            </div>
          </div>
        </div>

        {/* 2. Precificação */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>💵 Financeiro</h3>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Método de Precificação</label>
            <select name="metodo_precificacao"  onChange={handleChange} style={styles.input}>
              <option value="MARKUP">MARKUP (Automático)</option>
              <option value="MANUAL">MANUAL (Preço Fixo)</option>
            </select>
          </div>

          <div style={{...styles.grid, marginTop: '12px'}}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Markup (%)</label>
              <input 
                type="number" name="markup_praticado"  
                onChange={handleChange} style={styles.input} disabled={formData.metodo_precificacao === 'MANUAL'}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Preço de Venda (R$)</label>
              <input 
                type="number" name="preco_venda" 
                onChange={handleChange} style={styles.input} 
              />
            </div>
          </div>

          <div style={{...styles.marginBox, backgroundColor: margin >= 0 ? '#f0fdf4' : '#fef2f2', color: margin >= 0 ? '#166534' : '#991b1b'}}>
            <span>Lucro sobre custo médio:</span>
            <strong style={{ fontSize: '16px' }}>{margin}%</strong>
          </div>
        </div>

        {/* 3. Estoque */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>📦 Estoque e Logística</h3>
          <div style={styles.grid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Estoque Mínimo</label>
              <input type="number" name="estoque_minimo"  onChange={handleChange} style={styles.input} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Qtd Atual</label>
              <input type="number" name="quantidade" readOnly style={{...styles.input, backgroundColor: '#f9fafb'}} />
              <small style={{fontSize: '10px', color: '#6b7280'}}>Ajuste via Movimentação</small>
            </div>
          </div>
        </div>

        {/* 4. Fiscal */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>📑 Fiscal (NFE/XML)</h3>
          <div style={styles.grid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>NCM</label>
              <input type="text" name="ncm" onChange={handleChange} style={styles.input} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>CEST</label>
              <input type="text" name="cest"  onChange={handleChange} style={styles.input} />
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