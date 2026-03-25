import React, { useState, useEffect } from 'react';
import { searchProducts } from '../../api/EtiquetaApi';
import FlexGridContainer from '../../../../components/Layout/FlexGridContainer/FlexGridContainer';

import { generatePRN, LabelData } from '../../utils/labelGenerator';

interface ProductFromDB {
  id: number;
  sku: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  salePrice: number;
  currentStock: number;
  status: string;
}

// ✨ Note que LabelItem agora estende LabelData para manter compatibilidade total
interface LabelItem extends LabelData {
  id: number;
  isPromo: boolean;
  size: string;
}

const StockLabelingForm: React.FC = () => {
  // --- Estados de Busca ---
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ProductFromDB[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- Estados do Formulário (Item sendo configurado) ---
  const [selectedProduct, setSelectedProduct] = useState<ProductFromDB | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isPromo, setIsPromo] = useState(false);
  const [batch, setBatch] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedSize, setSelectedSize] = useState("105x27");

  const [unit, setUnit] = useState("UN");

  // --- Estado da Fila ---
  const [queue, setQueue] = useState<LabelItem[]>([]);

  // 1. Ajuste no useEffect (Removi a trava do !selectedProduct)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      // 💡 IMPORTANTE: Removi o "&& !selectedProduct" daqui
      if (searchTerm.length >= 3) {
        setIsLoading(true);
        try {
          setIsLoading(true);
          const response = await searchProducts(searchTerm); // 1. Busca primeiro

          // 2. Extrai os produtos (tratando se vem em .data ou direto)
          const products = Array.isArray(response) ? response : response.data;

          // 3. LOG DE TESTE: Vamos ver o que o banco está mandando de verdade!
          if (products && products.length > 0) {
            console.log("🔍 PRIMEIRO PRODUTO DO BANCO:", products[0]);
          }

          setSearchResults(products || []);
          setIsDropdownOpen(true);
        } catch (error) {
          console.error("❌ Erro na busca:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSearchResults([]);
        setIsDropdownOpen(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]); // 👈 Mantenha apenas o searchTerm aqui


  // 2. Ajuste na seleção (Para não travar a busca futura)
  const handleSelectProduct = (product: ProductFromDB) => {
    setSelectedProduct(product);
    setSearchTerm(product.name);
    setUnit(product.unitOfMeasure || "UN");
    setSearchResults([]); // ✨ Limpa os resultados antigos
    setIsDropdownOpen(false); // ✨ Fecha o dropdown
  };



  // Sanitização para Elgin
  const sanitize = (text: string): string => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/"/g, "'")
      .toUpperCase();
  };


  // ✨ Adição à Fila com todos os campos vinculados
  const addToQueue = () => {
    if (!selectedProduct) return alert("⚠️ Selecione um produto.");

  // Usamos Number() e um fallback (|| 0) para nunca dar NaN
  const precoFinal = Number(selectedProduct.salePrice || 0);

  const newItem: LabelItem = {
    id: Date.now(),
    name: selectedProduct.name,
    sku: selectedProduct.sku,
    price: precoFinal, 
    isPromo: isPromo,
    quantity: quantity,
    size: selectedSize,
    unit: unit,
    batch: batch,
    expiryDate: expiryDate
  };

    setQueue(prev => [...prev, newItem]);
  
  // Reset
    // Reset parcial
    setSelectedProduct(null);
    setSearchTerm("");
    setBatch("");
    setExpiryDate("");
    setQuantity(1);
  };


  const removeFromQueue = (id: number) => {
    setQueue(queue.filter(item => item.id !== id));
  };

  // ✨ Chama o Gerador Modular
  const handlePrint = () => {
    if (queue.length === 0) return alert("Fila vazia!");
    generatePRN(queue, selectedSize);
  };

  const clearQueue = () => {
    if (window.confirm("⚠️ Limpar toda a fila?")) setQueue([]);
  };

  // Helper visual para o preview (mantido localmente apenas para a tela)
  const sanitizeSimple = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  return (
    <div className="container">
      <style>{`
        .container { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; padding: 20px; display: flex; justify-content: center; min-height: 100vh; color:black}
        .wrapper {width: 100%; display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 20px; }
        .header-full { grid-column: 1 / -1; background: #fff; padding: 5px 5px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; }
        
        /* Coluna esquerda: Cadastro */
        .config-panel { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); height: fit-content; position: sticky; top: 20px; }
        
        /* Coluna direita: Lista e Preview */
        .main-content { display: flex; flex-direction: column; gap: 20px; }
        
        .section-title { font-weight: bold; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
        .form-group { margin-bottom: 12px; }
        label { display: block; font-size: 0.85rem; color: #555; margin-bottom: 4px; font-weight: 600; }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; }

        .btn-add { width: 100%; padding: 12px; background: #3498db; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; margin-top: 10px; }
        .btn-generate { padding: 12px 25px; background: #27ae60; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; font-size: 1rem; }

        /* Estilo da Fila/Lista */
        .queue-list { background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .table-labels { width: 100%; border-collapse: collapse; }
        .table-labels th { text-align: left; font-size: 0.8rem; color: #888; border-bottom: 1px solid #eee; padding: 10px; }
        .table-labels td { padding: 10px; border-bottom: 1px solid #f9f9f9; font-size: 0.9rem; }

        /* Preview da "Pilha" de Etiquetas */
        .preview-scroll { 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          gap: 00px; 
          background: #555; 
          padding: 30px; 
          border-radius: 10px; 
          max-height: 600px; 
          overflow-y: auto; 
          border: 5px solid #333;
        }
        
      .label-sticker { 
  background: white; 
  width: 400px; 
  height: 120px; 
  padding: 12px; 
  display: flex; 
  flex-direction: column; 
  position: relative;
  flex-shrink: 0;
  /* Alterado para border total para o arredondamento funcionar melhor */
  border-bottom: 1px  dotted #555; 
  border-radius: 15px;
  box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
  color: #000;
  
  /* IMPORTANTE: Removido overflow: hidden para o furo aparecer corretamente */
  overflow: visible; 
  
  text-align: center;
}

.label-row-1 { font-size: 0.9rem; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.label-row-2 { 
  display: flex; 
  align-items: center; 
  justify-content: center; /* Centraliza o preço horizontalmente */
  height: 45px; /* Altura fixa para o preço ter destaque */
  width: 100%;
}
.label-price-symbol { font-size: 1rem; font-weight: bold; margin-right: 4px; }
.label-price-value { font-size: 2.8rem; font-weight: 800; line-height: 1; letter-spacing: -1px; }
.label-row-3 { font-size: 0.75rem; color: #333; margin-top: 2px; }
.label-row-4 { margin-top: auto; }

.barcode-sim { 
  height: 20px; 
  background: repeating-linear-gradient(90deg, #000 0 1px, #fff 1px 3px); 
  width: 100%; 
}

.promo-badge {
  position: absolute;
  top: 5px;
  right: 5px;
  background: #000;
  color: #fff;
  font-size: 10px;
  padding: 2px 6px;
  font-weight: bold;
}

          /* Criando os furos (entalhes do laser) */
.label-sticker::before,
.label-sticker::after {
  content: "";
  position: absolute;
  width: 50px;   /* Largura do furo */
  height: 8px;  /* Altura do furo (meia lua) */
  background: #555; /* Deve ser da mesma cor do fundo do preview-scroll */
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
}

/* Furo de cima */
.label-sticker::before {
  top: -2px; /* Ajuste conforme a espessura da borda */
  border-radius: 0 0 10px 10px; /* Arredonda a parte de baixo */
}

/* Furo de baixo */
.label-sticker::after {
  bottom: -2px; /* Ajuste conforme a espessura da borda */
  border-radius: 10px 10px 0 0; /* Arredonda a parte de cima */
}

        .promo-tag { position: absolute; top: 5px; right: 5px; background: #e74c3c; color: white; font-size: 9px; padding: 2px 5px; border-radius: 3px; font-weight: bold; }
        .barcode-sim { height: 25px; background: repeating-linear-gradient(90deg, #000 0 2px, #fff 2px 4px); width: 100%; }
        
        .delete-btn { color: #e74c3c; cursor: pointer; background: none; border: none; font-size: 1.2rem; }
        
        .empty-state { text-align: center; color: #999; padding: 40px; }


        .search-container { position: relative; width: 100%; }
  .search-results { 
    position: absolute; top: 100%; left: 0; right: 0; 
    background: white; border: 1px solid #ddd; border-radius: 5px; 
    z-index: 100; max-height: 200px; overflow-y: auto; 
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .result-item { 
    padding: 10px; cursor: pointer; border-bottom: 1px solid #f5f5f5; 
    display: flex; justify-content: space-between; align-items: center;
  }
  .result-item:hover { background: #f0f7ff; }
  .result-item small { color: #888; font-size: 0.75rem; }

  .loading-indicator {
  position: absolute;
  right: 10px;
  top: 35px;
  font-size: 0.7rem;
  color: #3498db;
  font-style: italic;
}

/* Garante que o dropdown não suma se o usuário clicar dentro dele */
.search-results::-webkit-scrollbar {
  width: 6px;
}
.search-results::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 10px;
}
      `}</style>

      <div className="wrapper">
        <header className="header-full" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>🏷️ Sistema de Rotulagem</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            {queue.length > 0 && (
              <button className="btn-clear" onClick={clearQueue}>🗑️ Limpar Tudo</button>
            )}
            <button className="btn-generate" onClick={handlePrint} disabled={queue.length === 0}
              style={{ backgroundColor: queue.length === 0 ? '#ccc' : '#27ae60' }}>
              💾 Baixar .PRN ({queue.length})
            </button>
          </div>
        </header>

        {/* Formulário lateral */}
        <aside className="config-panel">

          <div className="form-group">
            <label>🔍 Buscar Produto (Nome ou SKU)</label>

            <div className="search-container">
              <input
                type="text"
                placeholder="Digite nome ou SKU (mín. 3 letras)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => searchTerm.length >= 3 && setIsDropdownOpen(true)}
              />

              {isLoading && <div className="loading-indicator">Buscando... ⏳</div>}

              {isDropdownOpen && searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((p: ProductFromDB) => (
                    <div
                      key={p.id}
                      className="result-item"
                      onClick={() => handleSelectProduct(p)}
                      style={{ opacity: p.status === 'inativo' ? 0.5 : 1 }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{p.name}</strong>
                          <span style={{ fontSize: '0.8rem', color: '#27ae60', fontWeight: 'bold' }}>
                            R$ {Number(p.salePrice || 0).toFixed(2)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', marginTop: '4px' }}>
                          <small>📦 SKU: {p.sku}</small>
                          <small>🏷️ {p.category}</small>
                          <small style={{ color: p.currentStock <= 0 ? 'red' : 'inherit' }}>
                            Estoque: {p.currentStock} {p.unitOfMeasure}
                          </small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="section-title">➕ Configurar Item</div>


          <FlexGridContainer layout='grid' template='1fr 1fr' >
            <div>
              <label>🔢 Quantidade de Cópias</label>
              <input
                type="number"
                value={quantity} // ✨ Vinculado ao estado
                onChange={(e) => setQuantity(Number(e.target.value))}
                min="1"
              />
            </div>

            <div>
              <label>📏 Tamanho</label>
              <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)}>
                <option value="105x27">105 x 27 mm</option>
                <option value="60x40">60 x 40 mm</option>
              </select>
            </div>
          </FlexGridContainer>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={isPromo} onChange={e => setIsPromo(e.target.checked)} />
              🔥 Etiqueta de Promoção
            </label>
          </div>
          {/* CAMPOS FUTUROS (Escondidos por padrão) */}
          <details className="advanced-settings">
            <summary>⚙️ Campos Avançados (Lote, Validade...)</summary>

            <div className="form-group">
              <label>📅 Data de Validade</label>
              <input type="date" />
            </div>

            <div className="form-group">
              <label>🏭 Identificador de Lote</label>
              <input type="text" placeholder="Ex: LOTE-A2" />
            </div>

            <div className="form-group">
              <label>📦 Unidade de Medida</label>
              <select defaultValue="UN">
                <option value="UN">Unidade (UN)</option>
                <option value="KG">Quilo (KG)</option>
                <option value="CX">Caixa (CX)</option>
              </select>
            </div>
          </details>

          <button
            className="btn-add"
            onClick={addToQueue}
            disabled={!selectedProduct}
            style={{
              opacity: !selectedProduct ? 0.5 : 1,
              cursor: !selectedProduct ? 'not-allowed' : 'pointer',
              backgroundColor: !selectedProduct ? '#95a5a6' : '#3498db'
            }}
          >
            📥 Incluir na Pilha
          </button>
        </aside>

        {/* Área Principal */}
        <main className="main-content">

          {/* Lista em Tabela */}
          <section className="queue-list" style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
            <div className="section-title">📋 Itens na Fila (Aguardando Impressão)</div>
            {queue.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#888' }}>A fila está vazia.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Produto</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Preço</th>
                    <th style={{ padding: '10px' }}>Qtd</th>
                    <th style={{ padding: '10px' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                      <td style={{ padding: '10px' }}>
                        <strong>{item.name}</strong><br />
                        <small>{item.sku}</small>
                      </td>
                      <td style={{ padding: '10px' }}>R$ {item.price.toFixed(2)}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}x</td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => removeFromQueue(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>❌</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>


        </main>
        <aside>

          {/* Preview Visual da Fita de Impressão */}
          <div className="section-title">🎞️ Visualização da Fita (Preview)</div>
          <section className="preview-scroll">
            {queue.length === 0 && <div style={{ color: '#aaa' }}>Aguardando itens...</div>}
            {queue.map((item, index) => (
              <div key={item.id} className="label-sticker">
                {/* Indicador de Ordem no Rolo */}
                <div style={{ position: 'absolute', left: '-30px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{index + 1}º</div>

                {/* TAG de Promoção (Opcional) */}
                {item.isPromo && <div className="promo-badge">OFERTA</div>}

                {/* LINHA 1: Nome do Produto */}
                <div className="label-row-1">{sanitize(item.name)}</div>

                {/* LINHA 2: Preço em Destaque (60% do peso visual) */}
                <div className="label-row-2">
                  <span className="label-price-symbol">R$</span>
                  <span className="label-price-value">
                    {item.price.toFixed(2).replace('.', ',')}
                  </span>
                </div>

                {/* LINHA 3: SKU / Detalhes Logísticos */}
                <div className="label-row-3">
                  <strong>COD:</strong> {item.sku} {item.unit ? `| UN: ${item.unit}` : ''}
                </div>

                {/* LINHA 4: Código de Barras Simulado */}
                <div className="label-row-4">
                  <div className="barcode-sim"></div>
                  <div style={{ fontSize: '8px', textAlign: 'center', letterSpacing: '2px' }}>{item.sku.replace(/\D/g, '') || '789123456789'}</div>
                </div>
              </div>
            ))}
          </section>

        </aside>

      </div>
    </div>
  );
};

export default StockLabelingForm;