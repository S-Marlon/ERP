import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../types/Stock_Products';
import EditableField from '../../../../../components/forms/EditableField/EditableField';
import { styles } from './producDetails';
import Swal from 'sweetalert2';
import { updateProduct } from '../service/productService';
import EcommerceGallery from '../../../../../components/ui/ImageGallery/EcommerceGallery';

interface ProductDetailsProps {
  product?: Product | null;
  onSave?: (updatedProduct: Product) => void;
  onClose?: () => void;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ product, onSave, onClose }) => {



  const [formData, setFormData] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'financeiro' | 'estoque' | 'fiscal' | 'fornecedor'>('financeiro');
  const fieldLabels: Record<string, string> = {
    name: "Nome do Produto",
    salePrice: "Preço de Venda",
    costPrice: "Preço de Custo",
    markup: "Markup",
    unitOfMeasure: "Unidade",
    category: "Categoria",
    brand: "Marca",
    status: "Status do Produto",
    minStock: "Estoque Mínimo",
    ncm: "NCM",
    cest: "CEST",
    supplierCode: "Cód. Fornecedor",
    pictureUrl: "URL da Imagem"
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(product);

  useEffect(() => {
    if (product) setFormData({ ...product });
    else setFormData(null);
    setImageList(product?.pictureUrl ? product.pictureUrl.split(',').filter(Boolean) : []);
  }, [product]);

  const margin = useMemo(() => {
    if (!formData || !formData.salePrice || formData.salePrice <= 0) return 0;
    const cost = formData.costPrice || 0;
    const calc = ((formData.salePrice - cost) / formData.salePrice) * 100;
    return parseFloat(calc.toFixed(2));
  }, [formData]);


  const getChangedFields = (original: Product | null | undefined, current: Product | null): Partial<Product> => {
    if (!original || !current) return {};
    const changes: Record<string, unknown> = {};
    const normalize = (value: unknown) => value == null || value === '' ? null : value;
    (Object.keys(current) as Array<keyof Product>).forEach(key => {
      if (normalize(original[key]) !== normalize(current[key])) {
        changes[key as string] = current[key];
      }
    });
    return changes as Partial<Product>;
  };


  // Exemplo de como você usaria no seu componente pai:
  const [urlError, setUrlError] = useState(false); // Estado para o aviso de erro
  const [showUrlManager, setShowUrlManager] = useState(false);
  const [imageList, setImageList] = useState<string[]>(formData?.pictureUrl ? formData.pictureUrl.split(',').filter(Boolean) : []);
  const [currentUrl, setCurrentUrl] = useState('');

  // 2. Lógica para Adicionar a URL atual à lista de imagens
  const handleAddImage = () => {
    if (currentUrl && !urlError) {
      setImageList([...imageList, currentUrl]);
      setCurrentUrl('');
      setUrlError(false);
      Swal.fire({ title: 'Adicionado!', icon: 'success', timer: 800, showConfirmButton: false });
    }
  };

  // 3. Função para testar a URL manualmente (opcional, já que a galeria testa via onError)
  const handleTestUrl = () => {
    if (!currentUrl) return;

    const img = new Image();
    img.src = currentUrl;
    img.onload = () => {
      setUrlError(false);
      Swal.fire({ title: 'URL Válida!', icon: 'success', timer: 1000, showConfirmButton: false });
    };
    img.onerror = () => {
      setUrlError(true);
      Swal.fire({ title: 'Erro', text: 'Não foi possível carregar a imagem desta URL.', icon: 'error' });
    };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {

    const { name, value, type } = e.target;
    const numValue = type === 'number' ? parseFloat(value) || 0 : value;

    setFormData(prev => {
      if (!prev) return null;
      const updated = { ...prev, [name]: numValue };

      // Lógica inteligente de precificação
      if (name === 'markup' && prev.priceMethod === 'MARKUP') {
        const costPrice = prev.costPrice || 0;
        updated.salePrice = costPrice * (1 + (numValue as number) / 100);
      } else if (name === 'salePrice' && prev.priceMethod === 'MANUAL') {
        const costPrice = prev.costPrice || 0;
        const newSalePrice = numValue as number;
        if (costPrice > 0) {
          updated.markup = ((newSalePrice - costPrice) / costPrice) * 100;
        }
      } else if (name === 'costPrice') {
        const currentMarkup = prev.markup || 0;
        if (prev.priceMethod === 'MARKUP') {
          updated.salePrice = (numValue as number) * (1 + currentMarkup / 100);
        }
      }

      return updated;
    });
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

  // Adicione o 'async' aqui na declaração da função
  const handleSaveClick = async () => {
    // Verificação de segurança: precisamos do ID para o service saber quem atualizar
    if (!product?.id || !formData) {
      Swal.fire('Erro', 'Produto sem identificação válida.', 'error');
      return;
    }

    const changes = getChangedFields(product, formData);
    const keys = Object.keys(changes);

    if (keys.length === 0) return;

    let changesHtml = `
    <div style="text-align: left; font-size: 14px; max-height: 300px; overflow-y: auto; padding: 10px; border: 1px solid #edf2f7; border-radius: 8px; background: #f8fafc;">
    `;
    keys.forEach(key => {
      changesHtml += `
        <div style="margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          <strong style="color: #2563eb; font-size: 12px; text-transform: uppercase;">${fieldLabels[key] || key}:</strong><br/>
          <span style="color: #94a3b8; text-decoration: line-through; font-size: 13px;">De: ${product[key as keyof Product] ?? '(vazio)'}</span><br/>
          <span style="color: #059669; font-weight: 600; font-size: 15px;">Para: ${changes[key as keyof Product]}</span>
        </div>
      `;
    });
    changesHtml += `</div>`;

    const result = await Swal.fire({
      title: 'Confirmar Alterações?',
      html: changesHtml,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, salvar!',
      cancelButtonText: 'Revisar',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#94a3b8',
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
          // Envia para o service e retorna o resultado para o 'result.value'
          return await updateProduct(product.id!, changes);
        } catch (error: unknown) {
          Swal.showValidationMessage(`Erro no servidor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
      },
      allowOutsideClick: () => !Swal.isLoading(),
      reverseButtons: true
    });

    if (result.isConfirmed) {
      // result.value contém o produto atualizado retornado pelo backend
      onSave?.(result.value);

      Swal.fire({
        title: 'Sucesso!',
        text: 'Produto atualizado com sucesso.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    }
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
        {/* header start */}
        <div style={styles.header}>
          <div>
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
            {/* <FlexGridContainer layout='grid' template='1fr 1fr' gap="15px" alignItems="center">
              <label style={styles.sku}>CÓD Barras: {formData.barcode || 'N/A'}</label>
              <label style={styles.sku}>CÓD Interno: {formData.sku} </label>
              <label style={styles.label}>SKU / Cód.  Barras {formData.id}</label>
            </FlexGridContainer> */}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'stretch', gap: '10px' }}>

              {/* COLUNA 1: IMAGEM */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                <EcommerceGallery
                  images={imageList}
                  onValidationError={(hasError: boolean) => setUrlError(hasError)}
                />
                {/* <EcommerceGallery   images={['https://korax.com.br/wp-content/uploads/2025/03/APERTO-MANUAL-3.jpg','https://korax.com.br/wp-content/uploads/2025/03/APERTO-MANUAL-2.jpg']}  /> */}


                {/* GERENCIADOR DE URLS (APENAS INPUTS) */}
                <div style={{ position: 'relative', width: '100%' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={styles.label}>Imagens ({imageList.length})</label>
                    <button
                      onClick={() => setShowUrlManager(!showUrlManager)}
                      style={{
                        padding: '4px 12px',
                        fontSize: '11px',
                        backgroundColor: showUrlManager ? '#ef4444' : '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {showUrlManager ? 'Fechar' : 'Gerenciar URLs'}
                    </button>
                  </div>

                  {showUrlManager && (
                    <div style={{
                      position: 'absolute',   // Essencial para flutuar
                      top: '35px',            // Posiciona logo abaixo do botão
                      left: '0',
                      right: '0',
                      zIndex: 999,            // Garante que fique por cima de TUDO
                      backgroundColor: 'white',
                      padding: '16px',
                      borderRadius: '12px',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                      border: '1px solid #e5e7eb',
                      minWidth: '280px'
                    }}>

                      {/* Triângulo indicador (opcional, dá o visual de popover) */}
                      <div style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '20px',
                        width: '12px',
                        height: '12px',
                        backgroundColor: 'white',
                        transform: 'rotate(45deg)',
                        borderLeft: '1px solid #e5e7eb',
                        borderTop: '1px solid #e5e7eb'
                      }} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', marginBottom: '4px' }}>
                          LISTA DE URLS
                        </span>

                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          paddingRight: '5px' // Espaço para a scrollbar
                        }}>
                          {[...imageList, ''].map((url, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="text"
                                autoFocus={index === imageList.length && index > 0}
                                placeholder="Cole o link aqui..."
                                value={url}
                                style={{
                                  ...styles.input,
                                  flex: 1,
                                  fontSize: '12px',
                                  height: '32px',
                                  borderColor: url ? '#2563eb' : '#d1d5db'
                                }}
                                onChange={(e) => {
                                  const newUrl = e.target.value;
                                  const updatedImages = [...imageList];
                                  if (index < updatedImages.length) {
                                    updatedImages[index] = newUrl;
                                  } else if (newUrl.trim() !== '') {
                                    updatedImages.push(newUrl);
                                  }
                                  setImageList(updatedImages);
                                  setFormData({ ...formData, pictureUrl: updatedImages.join(',') });
                                }}
                              />
                              {url && (
                                <button
                                  onClick={() => {
                                    const updated = imageList.filter((_, i) => i !== index);
                                    setImageList(updated);
                                    setFormData({ ...formData, pictureUrl: updated.join(',') });
                                  }}
                                  style={{
                                    border: 'none',
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    borderRadius: '4px',
                                    width: '24px',
                                    height: '24px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  &times;
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>





              </div>

              {/* COLUNA 2: INFOS (Ajustada para espaçar) */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between', // ISSO VAI ESPAÇAR OS ITENS
                alignItems: 'flex-start',
                flex: 1,
                paddingBottom: '5px'
              }}>

                {/* Grupo do Topo (IDs e Códigos) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={styles.sku}><strong>CÓD Barras:</strong> {formData.barcode || 'N/A'}</label>
                  <label style={styles.sku}><strong>CÓD Interno:</strong> {formData.sku}</label>
                  <label style={styles.sku}><strong>ID Registro:</strong> {formData.id}</label>

                  <EditableField
                    label="categoria"
                    isDirty={formData.category !== product?.category}
                    originalValue={product?.category}
                    onRevert={() => revertField('category')}
                  >
                    <select name="category" value={formData.category || ''} onChange={handleChange} style={styles.input}>
                      <option value="">Selecione...</option>
                      <option value={formData.category || ''}>{formData.category || 'Selecione...'}</option>
                    </select>
                  </EditableField>

                  <EditableField
                    label="Marca"
                    isDirty={formData.brand !== product?.brand}
                    originalValue={product?.brand}
                    onRevert={() => revertField('brand')}
                  >
                    <select name="brand" value={formData.brand || ''} onChange={handleChange} style={styles.input}>
                      <option value="">Selecione...</option>
                      <option value={formData.brand || ''}>{formData.brand || 'Selecione...'}</option>
                    </select>
                  </EditableField>

                  <label style={styles.sku}><strong>NCM:</strong> {formData.ncm || 'N/A'}</label>

                  <label style={styles.sku}><strong>CEST:</strong> {formData.cest || 'N/A'}</label>



                </div>

                {/* Grupo de Baixo (Unidade) */}
                <div style={{ width: '100%' }}>
                  <EditableField
                    label="Unidade de Medida"
                    showLock={true}
                    isDirty={formData.unitOfMeasure !== product?.unitOfMeasure}
                    originalValue={product?.unitOfMeasure}
                    onRevert={() => revertField('unitOfMeasure')}
                  >
                    <select
                      name="unitOfMeasure"
                      value={formData.unitOfMeasure || ''}
                      onChange={handleChange}
                      style={{ ...styles.input, width: '100%' }}
                    >
                      <option value="" disabled>Selecione...</option>
                      <option value="UN">UN (Unidade)</option>
                      <option value="CX">CX (Caixa)</option>
                      <option value="KG">KG (Quilo)</option>
                      <option value="PCT">PCT (Pacote)</option>
                    </select>
                  </EditableField>
                </div>

              </div>
            </div>

          </div>



        </div>

        <div style={styles.content}>






          <nav style={styles.tabsContainer}>
            <button style={{ ...styles.tabButton, ... (activeTab === 'financeiro' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('financeiro')}> Financeiro</button>
            <button style={{ ...styles.tabButton, ... (activeTab === 'estoque' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('estoque')}> Estoque</button>
            <button style={{ ...styles.tabButton, ... (activeTab === 'fiscal' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('fiscal')}> Fiscal</button>
            <button style={{ ...styles.tabButton, ... (activeTab === 'fornecedor' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('fornecedor')}> Fornecedor</button>
          </nav>

          {activeTab === 'financeiro' && (
            <>
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>💵 Financeiro</h3>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Método de Precificação</label>
                  <EditableField
                    label="metodo_precificacao"
                    showLock={true}
                    isDirty={formData.priceMethod !== product?.priceMethod}
                    originalValue={product?.priceMethod}
                    onRevert={() => revertField('priceMethod')}
                  >
                    <select name="priceMethod" value={formData.priceMethod || ''} onChange={handleChange} style={styles.input}>
                      <option value="">Selecione...</option>
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
                      showLock={true}
                      isDirty={formData.markup !== product?.markup}
                      originalValue={product?.markup}
                      onRevert={() => revertField('markup')}
                    >
                      <input
                        type="number"
                        name="markup"
                        value={formData.markup || 0}
                        onChange={handleChange}
                        style={styles.input}
                        disabled={formData.priceMethod === 'MANUAL'}
                      />
                    </EditableField>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Preço de Venda (R$)</label>
                    <EditableField
                      label="Preço de Venda (R$)"
                      showLock={true}
                      isDirty={formData.salePrice !== product?.salePrice}
                      originalValue={product?.salePrice}
                      onRevert={() => revertField('salePrice')}
                    >
                      <input
                        type="number"
                        name="salePrice"
                        value={formData.salePrice || 0}
                        disabled={formData.priceMethod === 'MARKUP'}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>
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

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>📦 Estoque e Logística</h3>
                <div style={styles.grid}>
                  <div style={styles.inputGroup}>
                    <EditableField
                      label="Estoque Mínimo"
                      isDirty={formData.minStock !== product?.minStock}
                      originalValue={product?.minStock}
                      onRevert={() => revertField('minStock')}
                    >
                      <input
                        type="number"
                        name="minStock"
                        value={formData.minStock || 0}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>
                  </div>
                  <div style={styles.inputGroup}>
                    <EditableField
                      label="Estoque Atual"
                      showLock={true}
                      isDirty={formData.currentStock !== product?.currentStock}
                      originalValue={product?.currentStock}
                      onRevert={() => revertField('currentStock')}
                    >
                      <input
                        type="number"
                        name="currentStock"
                        style={{ ...styles.input, backgroundColor: '#f9fafb' }}
                        value={formData.currentStock || 0}
                      />
                    </EditableField>
                    <small style={{ fontSize: '10px', color: '#6b7280' }}>Ajuste via Movimentação</small>
                  </div>
                </div>
              </div>

            </>)}

          {activeTab === 'fiscal' && (
            <>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>📑 Fiscal (NFE/XML)</h3>
                <div style={styles.grid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>NCM</label>

                  </div>
                </div>
              </div>

            </>)}


          {activeTab === 'fornecedor' && (
            <>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>🏭 Fornecedor</h3>
                <div style={styles.grid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Fornecedor</label>
                    <EditableField
                      label="Fornecedor"
                      isDirty={formData.suppliers !== product?.suppliers}
                      originalValue={product?.suppliers}
                      onRevert={() => revertField('suppliers')}
                    >
                      <select name="suppliers" value={formData.suppliers || ''} onChange={handleChange} style={styles.input}>
                        <option value="">Selecione...</option>
                        <option value={formData.suppliers || ''}>{formData.suppliers || 'Selecione...'}</option>
                      </select>
                    </EditableField>

                    <EditableField
                      label="Código do Fornecedor"
                      isDirty={formData.supplierCode !== product?.supplierCode}
                      originalValue={product?.supplierCode}
                      onRevert={() => revertField('supplierCode')}
                    >
                      <input
                        type="text"
                        name="supplierCode"
                        value={formData.supplierCode || ''}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>

                    <label style={styles.label}>Código do Produto no Fornecedor</label>
                    <EditableField
                      label="Código do Produto no Fornecedor"
                      showLock={true}
                      isDirty={formData.supplierProductCode !== product?.supplierProductCode}
                      originalValue={product?.supplierProductCode}
                      onRevert={() => revertField('supplierProductCode')}
                    >
                      <input
                        type="text"
                        name="supplierProductCode"
                        value={formData.supplierProductCode || ''}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>
                  </div>
                </div>
              </div>

            </>)}
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.btnCancel}>Cancelar</button>
          {hasChanges && (
            <button onClick={handleReset} style={styles.btnReset} title="Reverter alterações">
              <span>↺</span> Desfazer Alterações
            </button>
          )}
          <button
            onClick={handleSaveClick}
            style={{ ...styles.btnSave, opacity: hasChanges ? 1 : 0.5, cursor: hasChanges ? 'pointer' : 'not-allowed' }}
            disabled={!hasChanges}
          >
            Salvar Alterações
          </button>
        </div>
      </aside>

    </>
  );
};



export default ProductDetails;