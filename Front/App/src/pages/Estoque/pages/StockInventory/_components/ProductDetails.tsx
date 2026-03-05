import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../types/Stock_Products';
import ImageGallery from '../../../../../components/ui/ImageGallery/ImageGallery';
import EditableField from '../../../../../components/forms/EditableField/EditableField';
import { styles } from './producDetails';

interface ProductDetailsProps {
  product?: Product | null;
  onSave?: (updatedProduct: Product) => void;
  onClose?: () => void;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ product, onSave, onClose }) => {
  const [formData, setFormData] = useState<Product | null>(null);
  const isDirty = (field: keyof Product) => formData?.[field] !== product?.[field];


  const [activeTab, setActiveTab] = useState<'financeiro' | 'estoque' | 'fiscal' | 'fornecedor' >('financeiro');


  // Verifica se existe QUALQUER alteração no formulário
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(product);

  // Sincroniza o formulário quando o produto selecionado muda
  useEffect(() => {
    if (product) setFormData({ ...product });
    else setFormData(null);
  }, [product]);

  const handleSaveClick = () => {
    if (!formData || !product) return;

    // Filtra apenas o que é diferente do objeto original (product)
    const changes: Partial<Product> = {};

    (Object.keys(formData) as Array<keyof Product>).forEach((key) => {
      if (formData[key] !== product[key]) {
        // @ts-ignore - tipagem dinâmica para simplificar a comparação
        changes[key] = formData[key];
      }
    });

    // Verifica se houve alguma mudança antes de chamar o onSave
    if (Object.keys(changes).length === 0) {
      alert("Nenhuma alteração detectada.");
      return;
    }

    // Enviamos o ID (obrigatório) + as alterações
    const updatedPayload = { id: product.id, ...changes };

    console.log("Enviando para o banco:", updatedPayload);
    onSave?.(updatedPayload as Product);
  };

  // Cálculo de margem adaptado para os novos campos
  const margin = useMemo(() => {
    if (!formData || !formData.salePrice || formData.salePrice <= 0) return 0;
    const cost = formData.costPrice || 0;
    const calc = ((formData.salePrice - cost) / formData.salePrice) * 100;
    return parseFloat(calc.toFixed(2));
  }, [formData?.costPrice, formData?.salePrice]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => prev ? ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }) : null);
  };

  const handleReset = () => {
    if (product) {
      setFormData({ ...product });
    }
  };

  const revertField = (fieldName: keyof Product) => {
    if (!product || !formData) return;

    setFormData({
      ...formData,
      [fieldName]: product[fieldName]
    });
  };

  if (!formData) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          👉 Selecione um produto na tabela para editar as informações.
        </p>
      </div>
    );
  }



  return (
    <>
      <aside style={styles.sidebar}>
        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.headerTop}>

            <div style={styles.toggleRow}>
              <span style={styles.label}>Produto Ativo</span>
              <button
                onClick={() => setFormData({ ...formData, status: formData.status === 'Ativo' ? 'Inativo' : 'Ativo' })}
                style={{ ...styles.switch, backgroundColor: formData.status === 'Ativo' ? '#2563eb' : '#d1d5db' }}
              >
                <div style={{ ...styles.switchHandle, transform: formData.status === 'Ativo' ? 'translateX(20px)' : 'translateX(0px)' }} />
              </button>
              <span style={{
                ...styles.badge,
                backgroundColor: formData.status === 'Ativo' ? '#dcfce7' : '#fee2e2',
                color: formData.status === 'Ativo' ? '#166534' : '#991b1b'
              }}>
                {formData.status?.toUpperCase()}
              </span>
            </div>




            <button onClick={onClose} style={styles.btnClose}>&times;</button>
          </div>

          <div style={styles.section}>

            

            <EditableField
              label="Nome do Produto"
              isDirty={formData.name !== product?.name}
              originalValue={product?.name}
              onRevert={() => revertField('name')}
            >
              <input
                name="name"
                value={formData.name || ''}
                onChange={handleChange}
                
                style={styles.input}
              />
            </EditableField>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{
                width: '200px',
                height: '200px',
                borderRadius: '12px', // Cantos um pouco mais arredondados ficam mais modernos
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f3f4f6',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // Sombra suave
                position: 'relative',
                transition: 'transform 0.2s ease-in-out', // Preparado para efeito de hover
              }}>


                {formData.pictureUrl ? (
                  <ImageGallery images={formData.pictureUrl} />

                ) : (
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '24px' }}>📦</span>
                    <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Sem foto disponível</span>
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }}>

                <label style={styles.sku}>CÓD Interno: {formData.sku} </label>
                <label style={styles.label}>SKU / Cód.  Barras {formData.id}</label>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Unidade</label>
                              <EditableField
                    label="Unidade de Medida"
                    isDirty={formData.unitOfMeasure !== product?.unitOfMeasure}
                    originalValue={product?.unitOfMeasure}
                    onRevert={() => revertField('unitOfMeasure')}
                  > 
                  <select name="unidade" onChange={handleChange} style={styles.input}>
                    <option value={formData.unitOfMeasure || ''}>{formData.unitOfMeasure || 'Selecione...'}</option>
                    <option value="UN">UN (Unidade)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="KG">KG (Quilo)</option>
                    <option value="PCT">PCT (Pacote)</option>
                  </select>
                  </EditableField>
                </div>


                <label style={styles.label}>URL da Imagem</label>
                <input type="text" name="imagem_url" value={formData.pictureUrl} onChange={handleChange} style={styles.input} />
                <small style={{ fontSize: '10px', color: '#6b7280' }}>Cole o link de uma imagem ou caminho do servidor.</small>
              </div>
            </div>



            {/* Nome do Produto agora é um input para edição rápida */}




          </div>

          <div style={{ ...styles.grid, marginTop: '12px' }}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Categoria</label>
                              <EditableField
                    label="Categoria"
                    isDirty={formData.category !== product?.category}
                    originalValue={product?.category}
                    onRevert={() => revertField('category')}
                  >
              <select name="id_categoria" onChange={handleChange} style={styles.input}>
                {/* Aqui você mapearia categorias vindo do banco */}
                <option value={formData.category || ''}>{formData.category || 'Selecione...'}</option>
                {/* {categorias.map(cat => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>{cat.nome_categoria}</option>
                ))} */}
              </select>

              </EditableField>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Marca</label>
                              <EditableField
                    label="Marca"
                    isDirty={formData.brand !== product?.brand}
                    originalValue={product?.brand}
                    onRevert={() => revertField('brand')}
                  >
              <select name="id_marca" onChange={handleChange} style={styles.input}>
                <option value={formData.suppliers || ''}>{formData.suppliers || 'Selecione...'}</option>
                {/* {marcas.map(m => (
                  <option key={m.id_marca} value={m.id_marca}>{m.nome_marca}</option>
                ))} */}
              </select>
              </EditableField>
            </div>
          </div>

        </div>

        <div style={styles.content}>




          {/* Alerta de Variação de Custo */}
          {/* {formData.tem_alerta && (
          <div style={styles.alertBox}>
            <span style={{fontWeight: 'bold'}}>⚠️ Alerta de Custo:</span>
            <p style={{margin: '4px 0 0', fontSize: '12px'}}>O custo subiu %. Reajuste o preço!</p>
          </div>
        )} */}

          {/* 1. Identificação e Organização */}
          <div style={styles.section}>


            <div style={{ ...styles.grid, marginTop: '12px' }}>


            </div>


          </div>

          <nav style={styles.tabsContainer}>
            <button style={{ ...styles.tabButton, ... (activeTab === 'financeiro' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('financeiro')}> Financeiro</button>
            <button style={{ ...styles.tabButton, ... (activeTab === 'estoque' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('estoque')}> Estoque</button>
            <button style={{ ...styles.tabButton, ... (activeTab === 'fiscal' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('fiscal')}> Fiscal</button>
            <button style={{ ...styles.tabButton, ... (activeTab === 'fornecedor' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('fornecedor')}> Fornecedor</button>
          </nav>

          {activeTab === 'financeiro' && (
            <>
              {/* 2. Precificação */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>💵 Financeiro</h3>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Método de Precificação</label>
                  <EditableField
                    label="Método de Precificação"
                    isDirty={formData.priceMethod !== product?.priceMethod}
                    originalValue={product?.priceMethod}
                    onRevert={() => revertField('priceMethod')}
                  >
                    <select name="metodo_precificacao" onChange={handleChange} style={styles.input}>
                      <option value={formData.priceMethod || ''}>{formData.priceMethod || 'Selecione...'}</option>
                      <option value="MARKUP">Markup (%)</option>
                      <option value="MANUAL">Preço de Venda Manual</option>
                    </select>
                  </EditableField>
                </div>

                <div style={{ ...styles.grid, marginTop: '12px' }}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Markup (%)</label> 
                    <EditableField
                      label="Markup (%)"
                      isDirty={formData.markup !== product?.markup}
                      originalValue={product?.markup}
                      onRevert={() => revertField('markup')}
                    >
                    <input
                      type="number" name="markup_praticado" value={formData.markup}
                      onChange={handleChange} style={styles.input} disabled={formData.priceMethod === 'MANUAL'}
                    />
                    </EditableField>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Preço de Venda (R$)</label>
                    <input
                      type="number"
                      name="salePrice" // Antes era 'preco_venda'
                      value={formData.salePrice}
                      disabled={formData.priceMethod === 'MARKUP'}
                      onChange={handleChange}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={{ ...styles.marginBox, backgroundColor: margin >= 0 ? '#f0fdf4' : '#fef2f2', color: margin >= 0 ? '#166534' : '#991b1b' }}>
                  <span>Lucro sobre custo médio:</span>
                  <strong style={{ fontSize: '16px' }}>{margin}%</strong>
                </div>
              </div>
            </>)}

          {activeTab === 'estoque' && (
            <>




              {/* 3. Estoque */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>📦 Estoque e Logística</h3>
                <div style={styles.grid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Estoque Mínimo</label>
                    <input type="number" name="estoque_minimo" onChange={handleChange} style={styles.input} value={formData.minStock} />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Qtd Atual</label>
                    <input type="number" name="quantidade" readOnly style={{ ...styles.input, backgroundColor: '#f9fafb' }} value={formData.currentStock} />
                    <small style={{ fontSize: '10px', color: '#6b7280' }}>Ajuste via Movimentação</small>
                  </div>
                </div>
              </div>

            </>)}

          {activeTab === 'fiscal' && (
            <>

              {/* 4. Fiscal */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>📑 Fiscal (NFE/XML)</h3>
                <div style={styles.grid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>NCM</label>
                    <input type="text" name="ncm" onChange={handleChange} style={styles.input} value={formData.ncm} />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>CEST</label>
                    <input type="text" name="cest" onChange={handleChange} style={styles.input} value={formData.cest} />
                  </div>
                </div>
              </div>

        </>)}


        {activeTab === 'fornecedor' && (
            <>

              {/* 5. fornecedor */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>🏭 Fornecedor</h3>
                <div style={styles.grid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Fornecedor</label>
                    <select name="id_fornecedor" onChange={handleChange} style={styles.input}>
                      <option value={formData.suppliers || ''}>{formData.suppliers || 'Selecione...'}</option>
                      {/* {fornecedores.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))} */}
                    </select>

                    <label style={styles.label}>Codigo do Fornecedor</label>
                    <input type="text" name="codigo_fornecedor" onChange={handleChange} style={styles.input} value={formData.supplierCode || ''} />

                    <label style={styles.label}>Codigo do produto no Fornecedor</label>
                    <input type="text" name="codigo_produto_fornecedor" onChange={handleChange} style={styles.input} value={formData.supplierProductCode || ''} />


                  </div>
                </div>
              </div>

        </>)}
            </div>

        {/* FOOTER */}
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.btnCancel}>Cancelar</button>
          {hasChanges && (
            <button onClick={handleReset} style={styles.btnReset} title="Reverter alterações">
              <span>↺</span> Desfazer Alterações
            </button>
          )}
          <button onClick={() => onSave?.(formData)} style={styles.btnSave}>Salvar Alterações</button>
        </div>
      </aside>
    </>
  );
};



export default ProductDetails;