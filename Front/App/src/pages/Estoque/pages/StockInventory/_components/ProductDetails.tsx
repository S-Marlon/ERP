import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Product } from '../types/Stock_Products';
import EditableField from '../../../../../components/forms/EditableField/EditableField';
import { styles } from './producDetails';
import Swal from 'sweetalert2';
import { updateProduct } from '../service/productService';
import EcommerceGallery from '../../../../../components/ui/ImageGallery/EcommerceGallery';
import PricingCalculator from '../../../../../components/Layout/PricingCalculator/PricingCalculator';

interface ProductDetailsProps {
  product?: Product | null;
  onSave?: (updatedProduct: Product) => void;
  onClose?: () => void;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ product, onSave, onClose }) => {


  const [formData, setFormData] = useState<Product | null>(null);
  const btnUrlRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<'financeiro' | 'estoque' | 'fiscal' | 'fornecedor' | 'ecommerce'>('financeiro');
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
    pictureUrl: "URL da Imagem",
    unitsPerPackage: "Itens por Embalagem",
  };


const handlePricingChange = useCallback((updatedPrices: any) => {
  setFormData(prev => {
    if (!prev) return null;

    const hasChanged = 
      prev.costPrice !== updatedPrices.costPrice ||
      prev.salePrice !== updatedPrices.salePrice ||
      prev.markup !== updatedPrices.markup ||
      prev.unitsPerPackage !== updatedPrices.unitsPerPackage ||
      prev.priceMethod !== updatedPrices.priceMethod; // ⭐ NOVO

    if (!hasChanged) return prev;

    return {
      ...prev,
      costPrice: updatedPrices.costPrice,
      salePrice: updatedPrices.salePrice,
      markup: updatedPrices.markup,
      unitsPerPackage: updatedPrices.unitsPerPackage,
      priceMethod: updatedPrices.priceMethod // ⭐ ESSENCIAL
    };
  });
}, []);

  useEffect(() => {
  if (!product) return;

  setFormData(prev => prev ?? { ...product });
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

const hasChanges = formData
  ? Object.keys(getChangedFields(product, formData)).length > 0
  : false;

  // Exemplo de como você usaria no seu componente pai:
  const [urlError, setUrlError] = useState(false); // Estado para o aviso de erro
  const [showUrlManager, setShowUrlManager] = useState(false);




  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Se o modal estiver aberto
      if (showUrlManager) {
        // Verifica se o clique foi fora do container do gerenciador
        // E também se não foi no botão que abre o gerenciador (para evitar conflito)
        const isOutside = !target.closest('.url-manager-container');
        const isNotToggleButton = !target.closest('.btn-url-manager');

        if (isOutside && isNotToggleButton) {
          setShowUrlManager(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUrlManager]);


const [imageList, setImageList] = useState<string[]>([]);  const [currentUrl, setCurrentUrl] = useState('');

useEffect(() => {
  if (product?.pictureUrl) {
    setImageList(product.pictureUrl.split(',').filter(Boolean));
  } else {
    setImageList([]);
  }
}, [product]);



  const [isSaving, setIsSaving] = useState(false);

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

const calculateMarkup = (sale: number, cost: number) => {
  if (cost <= 0 || sale <= 0) return 0;
  return parseFloat((sale / cost).toFixed(2));
};

const calculateSale = (cost: number, markup: number) => {
  if (cost <= 0 || markup <= 0) return 0;
  return parseFloat((cost * markup).toFixed(2));
};
  

const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  const { name, value, type } = e.target;
  
  // Tratamento para números para evitar o "zero" quando apaga o campo
  const numValue = type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value;

  setFormData(prev => {
    if (!prev) return null;
    const updated = { ...prev, [name]: numValue };

    const cost = name === 'costPrice' ? (numValue as number) : (prev.costPrice || 0);
    const markup = name === 'markup' ? (numValue as number) : (prev.markup || 0);
    const sale = name === 'salePrice' ? (numValue as number) : (prev.salePrice || 0);

    // LÓGICA: SE ALTERAR O MÉTODO DE PRECIFICAÇÃO
    if (name === 'priceMethod') {
      if (numValue === 'MARKUP' && cost > 0) {
        // Ao mudar para Markup, calcula o multiplicador atual baseado no preço que já existe
        updated.markup = parseFloat((sale / cost).toFixed(2));
      }
    }

    // LÓGICA: MÉTODO MARKUP (O Markup manda no Preço de Venda)
    if (updated.priceMethod === 'MARKUP') {
      if (name === 'markup' || name === 'costPrice') {
        // Venda = Custo * Markup (Ex: 10 * 1.5 = 15)
        updated.salePrice = parseFloat((cost * markup).toFixed(2));
      }
    } 
    
    // LÓGICA: MÉTODO MANUAL (O Preço de Venda manda no Markup)
    else if (updated.priceMethod === 'MANUAL') {
      if (name === 'salePrice' || name === 'costPrice') {
        // Markup = Venda / Custo (Ex: 15 / 10 = 1.5)
        if (cost > 0) {
          updated.markup = parseFloat((sale / cost).toFixed(2));
        } else {
          updated.markup = 0;
        }
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
        return await updateProduct(product.id!, changes);
      } catch (error) {
        Swal.showValidationMessage(`Erro no servidor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    },
    allowOutsideClick: () => !Swal.isLoading(),
    reverseButtons: true
  });

  if (result.isConfirmed) {
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
          <div style={styles.headerTop}>

            <div style={styles.toggleRow}>
              <div>

                <span style={styles.label}> Status do Produto: </span>
                <button
                  onClick={() => setFormData({ ...formData, status: formData.status === 'Ativo' ? 'Inativo' : 'Ativo' })}
                  style={{ ...styles.switch, backgroundColor: formData.status === 'Ativo' ? '#2563eb' : '#d1d5db' }}
                >
                  <div style={{ ...styles.switchHandle, transform: formData.status === 'Ativo' ? 'translateX(20px)' : 'translateX(0px)' }} />
                </button>
              </div>
              <span style={{
                ...styles.badge,
                backgroundColor: formData.status === 'Ativo' ? '#dcfce7' : '#fee2e2',
                color: formData.status === 'Ativo' ? '#166534' : '#991b1b'
              }}>
                {formData.status?.toUpperCase()}
              </span>
            </div>




            {/* <button onClick={onClose} style={styles.btnClose}>&times;</button> */}
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

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', // Força as colunas a serem idênticas
              alignItems: 'stretch',
              gap: '10px',
              width: '100%'
            }}>

              {/* COLUNA 1: IMAGEM */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '100%', overflow: 'hidden' }}>

                <EcommerceGallery

                  images={imageList}
                  onValidationError={(hasError: boolean) => setUrlError(hasError)}
                />
                {/* <EcommerceGallery   images={['https://korax.com.br/wp-content/uploads/2025/03/APERTO-MANUAL-3.jpg','https://korax.com.br/wp-content/uploads/2025/03/APERTO-MANUAL-2.jpg']}  /> */}


                {/* GERENCIADOR DE URLS (APENAS INPUTS) */}
                <div style={{ position: 'relative', width: '100%' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={styles.label}>Imagens ({imageList.length})</label>


                    {/* Botão que abre o gerenciador */}
                    <button
                      ref={btnUrlRef} // Adicione o ref aqui
                      className="btn-url-manager"
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

                    {showUrlManager && (
                      <div
                        className="url-manager-container"
                        style={{
                          position: 'fixed', // Mudança crucial: ignora o overflow do pai
                          top: btnUrlRef.current ? btnUrlRef.current.getBoundingClientRect().bottom + 8 : 0,
                          left: btnUrlRef.current ? btnUrlRef.current.getBoundingClientRect().left - 240 : 0, // Ajusta para a esquerda
                          zIndex: 9999, // Fica acima de tudo, inclusive de outros modais
                          backgroundColor: 'white',
                          padding: '16px',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                          border: '1px solid #e5e7eb',
                          width: '320px',
                        }}
                      >
                        {/* Triângulo indicador ajustado para fixed */}
                        <div style={{
                          position: 'absolute',
                          top: '-6px',
                          right: '25px',
                          width: '12px',
                          height: '12px',
                          backgroundColor: 'white',
                          transform: 'rotate(45deg)',
                          borderLeft: '1px solid #e5e7eb',
                          borderTop: '1px solid #e5e7eb'
                        }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280' }}>
                              GERENCIAR LINKS DAS IMAGENS
                            </span>
                            <button
                              onClick={() => setShowUrlManager(false)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', backgroundColor: '#f3f4f6', color: '#6b7280', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              &times;
                            </button>
                          </div>

                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            paddingRight: '5px'
                          }}>
                            {[...imageList, ''].map((url, index) => (
                              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="text"
                                  placeholder="Cole o link da imagem..."
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
                                    const filtered = updatedImages.filter(Boolean);
                                    setImageList(filtered);
setFormData(prev => prev ? { ...prev, pictureUrl: filtered.join(',') } : prev);
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
                                      cursor: 'pointer'
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





              </div>

              {/* COLUNA 2: INFOS (Ajustada para espaçar) */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flex: 1,
                minWidth: 0,        // Importante: permite que a coluna encolha
                width: '100%',      // Garante que ela ocupe o espaço disponível
                overflow: 'hidden', // Corta qualquer coisa que tente vazar por erro
                paddingBottom: '5px',
                boxSizing: 'border-box'
              }}>

                {/* Grupo do Topo (IDs e Códigos) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={styles.sku}><strong>CÓD Barras:</strong> {formData.barcode || 'N/A'}</label>
                  <label style={styles.sku}><strong>CÓD Interno:</strong> {formData.sku}</label>
                  <label style={styles.sku}><strong>ID Registro:</strong> {formData.id}</label>
                  <label style={styles.sku}><strong>NCM:</strong> {formData.ncm || 'N/A'}</label>

                  <label style={styles.sku}><strong>CEST:</strong> {formData.cest || 'N/A'}</label>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    width: '100%',      // Ocupa tudo
                    maxWidth: '100%',   // Não passa de tudo
                    minWidth: 0,        // Permite encolher
                    overflow: 'hidden'  // Previne vazamento de texto longo nas labels
                  }}>

                    <EditableField
                      label="categoria"
                      isDirty={formData.category !== product?.category}
                      originalValue={product?.category}
                      onRevert={() => revertField('category')}
                      style={{ width: '100%', maxWidth: '100%' }}
                    >
                      <select name="category" value={formData.category || ''} onChange={handleChange} style={styles.input} style={{ ...styles.input, width: '100%', minWidth: 0 }}>
                        <option value="">Selecione...</option>
                        <option value={formData.category || ''}>{formData.category || 'Selecione...'}</option>
                      </select>
                    </EditableField>

                    <EditableField
                      label="Marca"
                      isDirty={formData.brand !== product?.brand}
                      originalValue={product?.brand}
                      showLock={true}
                      onRevert={() => revertField('brand')}
                      style={{ width: '100%', maxWidth: '100%' }}
                    >
                      <select name="brand" value={formData.brand || ''} onChange={handleChange} style={styles.input} style={{ ...styles.input, width: '100%', minWidth: 0 }}>
                        <option value="">Selecione...</option>
                        <option value={formData.brand || ''}>{formData.brand || 'Selecione...'}</option>
                      </select>
                    </EditableField>
                  </div>





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
            <button style={{ ...styles.tabButton, ... (activeTab === 'financeiro' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('financeiro')}>💵 Financeiro</button>
            <button style={{ ...styles.tabButton, ... (activeTab === 'estoque' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('estoque')}>📦 Estoque</button>
            <button style={{ ...styles.tabButton, ... (activeTab === 'ecommerce' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('ecommerce')}>🌐 E-commerce</button>
            <button style={{ ...styles.tabButton, ... (activeTab === 'fiscal' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('fiscal')}>📑 Fiscal</button>
            <button style={{ ...styles.tabButton, ... (activeTab === 'fornecedor' ? styles.tabButtonActive : {}) }} onClick={() => setActiveTab('fornecedor')}>👨‍💼 Fornecedor</button>
          </nav>

         

{activeTab === 'financeiro' && formData?.id && (
  <PricingCalculator 
    key={formData.id} // <--- CRUCIAL: Força o componente a reiniciar do zero
    productId={formData.id} 
    onChange={handlePricingChange} 
  />
)}

          {activeTab === 'estoque' && (
            <>
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>📦 Controle de Estoque</h3>

                {/* Grid de Níveis de Estoque */}
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
                    <small style={{ fontSize: '10px', color: '#6b7280' }}>Gera alerta abaixo deste valor</small>
                  </div>

                  <div style={styles.inputGroup}>
                    <EditableField
                      label="Estoque Máximo / Ideal"
                      isDirty={formData.maxStock !== product?.maxStock}
                      originalValue={product?.maxStock}
                      onRevert={() => revertField('maxStock')}
                    >
                      <input
                        type="number"
                        name="maxStock"
                        value={formData.maxStock || 0}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>
                  </div>

                  <div style={styles.inputGroup}>
                    <EditableField
                      label="Estoque Atual"
                      showLock={true} // Bloqueado pois depende de movimentação
                      isDirty={formData.currentStock !== product?.currentStock}
                      originalValue={product?.currentStock}
                      onRevert={() => revertField('currentStock')}
                    >
                      <input
                        type="number"
                        name="currentStock"
                        value={formData.currentStock || 0}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>
                    <button
                      style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '10px', cursor: 'pointer', padding: 0 }}
                      onClick={() => {/* Abrir Modal de Ajuste/Inventário */ }}
                    >
                      ⚙️ Ajustar Inventário
                    </button>
                  </div>
                </div>

                {/* Informativo de Sugestão de Compra */}
                {formData.currentStock <= formData.minStock && (
                  <div style={{
                    marginTop: '15px',
                    padding: '10px',
                    borderRadius: '6px',
                    backgroundColor: '#fff7ed',
                    border: '1px solid #ffedd5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '20px' }}>🛒</span>
                    <div>
                      <div style={{ color: '#9a3412', fontWeight: 'bold', fontSize: '13px' }}>Sugestão de Reposição</div>
                      <div style={{ color: '#c2410c', fontSize: '12px' }}>
                        Comprar <strong>{(formData.maxStock || 0) - (formData.currentStock || 0)}</strong> {product?.unitOfMeasure || 'un'} para atingir o estoque ideal.
                      </div>
                    </div>
                  </div>
                )}

                <hr style={{ margin: '20px 0', border: '0', borderTop: '1px solid #e5e7eb' }} />

                <h3 style={styles.sectionTitle}>🚛 Logística e Armazenagem</h3>
                <div style={styles.grid}>
                  <div style={styles.inputGroup}>
                    <EditableField
                      label="Localização (Endereço)"
                      isDirty={formData.location !== product?.location}
                      originalValue={product?.location}
                      onRevert={() => revertField('location')}
                    >
                      <input
                        type="text"
                        name="location"
                        placeholder="Ex: RUA 02 - A10"
                        value={formData.location || ''}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>
                  </div>

                  <div style={styles.inputGroup}>
                    <EditableField
                      label="Peso Bruto (kg)"
                      isDirty={formData.weight !== product?.weight}
                      originalValue={product?.weight}
                      onRevert={() => revertField('weight')}
                    >
                      <input
                        type="number"
                        step="0.001"
                        name="weight"
                        value={formData.weight || 0}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'ecommerce' && (
            <>
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>🌐 Dados para Venda Online</h3>

                {/* Dimensões para Cálculo de Frete */}
                <div style={{ ...styles.grid, gap: '15px' }}>
                  <div style={styles.inputGroup}>
                    <EditableField label="Peso Bruto (kg)">
                      <input type="number" step="0.001" name="weight" value={formData.weight || 0} onChange={handleChange} style={styles.input} />
                    </EditableField>
                    <small style={{ fontSize: '10px', color: '#6b7280' }}>Ex: 0.500 para 500g</small>
                  </div>

                  <div style={styles.inputGroup}>
                    <EditableField label="Comprimento (cm)">
                      <input type="number" name="length" value={formData.length || 0} onChange={handleChange} style={styles.input} />
                    </EditableField>
                  </div>

                  <div style={styles.inputGroup}>
                    <EditableField label="Altura (cm)">
                      <input type="number" name="height" value={formData.height || 0} onChange={handleChange} style={styles.input} />
                    </EditableField>
                  </div>

                  <div style={styles.inputGroup}>
                    <EditableField label="Largura (cm)">
                      <input type="number" name="width" value={formData.width || 0} onChange={handleChange} style={styles.input} />
                    </EditableField>
                  </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <EditableField label="Título para Anúncio (SEO)">
                    <input
                      type="text"
                      name="seoTitle"
                      placeholder="Título otimizado para buscas"
                      value={formData.seoTitle || ''}
                      onChange={handleChange}
                      style={styles.input}
                    />
                  </EditableField>
                </div>

                <div style={{ marginTop: '15px' }}>
                  <label style={styles.label}>Descrição Detalhada (HTML)</label>
                  <textarea
                    name="descriptionHtml"
                    rows={5}
                    style={{ ...styles.input, resize: 'vertical', fontFamily: 'inherit' }}
                    value={formData.descriptionHtml || ''}
                    onChange={handleChange}
                    placeholder="Conteúdo que aparecerá na página do produto..."
                  />
                </div>

                {/* Checkbox de Ativação */}
                <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="syncEcommerce"
                    name="syncEcommerce"
                    checked={formData.syncEcommerce}
                    onChange={(e) => setFormData({ ...formData, syncEcommerce: e.target.checked })}
                  />
                  <label htmlFor="syncEcommerce" style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Publicar este produto na Loja Virtual
                  </label>
                </div>
              </div>
            </>
          )}

          {activeTab === 'fiscal' && (
            <>
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>📑 Classificação Fiscal (NF-e/XML)</h3>

                <div style={styles.grid}>
                  {/* NCM - Essencial para qualquer nota */}
                  <div style={styles.inputGroup}>
                    <EditableField
                      label="NCM (Nomenclatura Comum do Mercosul)"
                      isDirty={formData.ncm !== product?.ncm}
                      originalValue={product?.ncm}
                      onRevert={() => revertField('ncm')}
                    >
                      <input
                        type="text"
                        name="ncm"
                        maxLength={8}
                        placeholder="Ex: 61091000"
                        value={formData.ncm || ''}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>
                    <small style={{ fontSize: '10px', color: '#6b7280' }}>8 dígitos - Define a alíquota do IPI/II</small>
                  </div>

                  {/* CEST - Necessário se houver Substituição Tributária (ST) */}
                  <div style={styles.inputGroup}>
                    <EditableField
                      label="CEST (Cód. Esp. Subst. Tributária)"
                      isDirty={formData.cest !== product?.cest}
                      originalValue={product?.cest}
                      onRevert={() => revertField('cest')}
                    >
                      <input
                        type="text"
                        name="cest"
                        maxLength={7}
                        placeholder="Ex: 2803800"
                        value={formData.cest || ''}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>
                    <small style={{ fontSize: '10px', color: '#6b7280' }}>7 dígitos - Obrigatório para produtos com ST</small>
                  </div>
                </div>

                <div style={{ ...styles.grid, marginTop: '15px' }}>
                  {/* Origem da Mercadoria - Campo 0 a 8 da NF-e */}
                  <div style={styles.inputGroup}>
                    <EditableField
                      label="Origem da Mercadoria"
                      isDirty={formData.origem !== product?.origem}
                      originalValue={product?.origem}
                      onRevert={() => revertField('origem')}
                    >
                      <select name="origem" value={formData.origem || '0'} onChange={handleChange} style={styles.input}>
                        <option value="0">0 - Nacional</option>
                        <option value="1">1 - Estrangeira (Importação Direta)</option>
                        <option value="2">2 - Estrangeira (Adquirida no Mercado Interno)</option>
                        <option value="3">3 - Nacional (Conteúdo Importado - 40%)</option>
                        <option value="4">4 - Nacional (Processos Básicos)</option>
                        <option value="5">5 - Nacional (Conteúdo Importado  40%)</option>
                      </select>
                    </EditableField>
                  </div>

                  {/* CFOP Padrão (Sugestão de saída) */}
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>CFOP Padrão de Saída</label>
                    <input
                      type="text"
                      name="cfop_padrao"
                      placeholder="Ex: 5102"
                      value={formData.cfop_padrao || ''}
                      onChange={handleChange}
                      style={styles.input}
                    />
                  </div>
                </div>

                {/* Alerta de Auditoria Fiscal */}
                <div style={{
                  marginTop: '20px',
                  padding: '12px',
                  backgroundColor: '#eff6ff',
                  borderRadius: '6px',
                  borderLeft: '4px solid #3b82f6',
                  fontSize: '12px',
                  color: '#1e40af'
                }}>
                  <strong>💡 Dica Fiscal:</strong> O NCM informado reflete diretamente no cálculo do <strong>IPI</strong> e <strong>ICMS</strong>. Verifique se o código possui 8 dígitos para evitar rejeição no momento da emissão da Nota Fiscal.
                </div>
              </div>
            </>
          )}


          {activeTab === 'fornecedor' && (
            <>
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>🏭 Relacionamento com Fornecedor</h3>

                <div style={styles.grid}>
                  {/* Seleção do Fornecedor Principal */}
                  <div style={styles.inputGroup}>
                    <EditableField
                      label="Fornecedor Principal"
                      isDirty={formData.id_fornecedor !== product?.id_fornecedor}
                      originalValue={product?.nome_fantasia}
                      onRevert={() => revertField('id_fornecedor')}
                    >
                      <select
                        name="id_fornecedor"
                        value={formData.id_fornecedor || ''}
                        onChange={handleChange}
                        style={styles.input}
                      >
                        <option value="">Selecione um fornecedor...</option>
                        {/* Aqui você deve mapear o array de fornecedores vindo do seu banco */}
                        {/* {listFornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.nome_fantasia}</option>
              ))} */}
                      </select>
                    </EditableField>
                  </div>

                  {/* Código do Produto no Fornecedor (SKU do Fornecedor) */}
                  <div style={styles.inputGroup}>
                    <EditableField
                      label="SKU no Fornecedor"
                      isDirty={formData.supplierProductCode !== product?.supplierProductCode}
                      originalValue={product?.supplierProductCode}
                      onRevert={() => revertField('supplierProductCode')}
                    >
                      <input
                        type="text"
                        name="supplierProductCode"
                        placeholder="Ex: REF-1234"
                        value={formData.supplierProductCode || ''}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>
                    <small style={{ fontSize: '10px', color: '#6b7280' }}>Útil para conferência de XML de compra</small>
                  </div>
                </div>

                <div style={{ ...styles.grid, marginTop: '15px' }}>
                  {/* Fator de Conversão */}
                  <div style={styles.inputGroup}>
                    <EditableField
                      label="Fator de Conversão"
                      isDirty={formData.conversionFactor !== product?.conversionFactor}
                      originalValue={product?.conversionFactor}
                      onRevert={() => revertField('conversionFactor')}
                    >
                      <input
                        type="number"
                        name="conversionFactor"
                        placeholder="Ex: 12 (se comprar caixa c/ 12)"
                        value={formData.conversionFactor || 1}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>
                    <small style={{ fontSize: '10px', color: '#6b7280' }}>Qtde por embalagem de compra</small>
                  </div>

                  {/* Prazo de Entrega Estimado */}
                  <div style={styles.inputGroup}>
                    <EditableField
                      label="Lead Time (Dias)"
                      isDirty={formData.leadTime !== product?.leadTime}
                      originalValue={product?.leadTime}
                      onRevert={() => revertField('leadTime')}
                    >
                      <input
                        type="number"
                        name="leadTime"
                        value={formData.leadTime || 0}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </EditableField>
                    <small style={{ fontSize: '10px', color: '#6b7280' }}>Dias para o produto chegar após o pedido</small>
                  </div>
                </div>

                {/* Histórico de Compras (Informativo) */}
                <div style={{
                  marginTop: '20px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#475569' }}>📊 Última Negociação</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span><strong>Data:</strong> {product?.data_ultima_compra || 'Nenhuma compra'}</span>
                    <span><strong>Preço NF:</strong> R$ {product?.ultimo_custo || '0,00'}</span>
                    <span><strong>Qtd Comprada:</strong> {product?.ultima_qtd_comprada || 0}</span>
                  </div>
                </div>
              </div>
            </>
          )}
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


// Pricing PricingCalculator, está apenas funcionando o modo manual: