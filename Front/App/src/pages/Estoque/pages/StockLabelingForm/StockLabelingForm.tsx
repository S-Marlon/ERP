import React, { useState, useEffect } from 'react';
import { 
  Input, 
  Button, 
  Select, 
  Checkbox, 
  Table, 
  Card, 
  Typography, 
  Space, 
  Divider, 
  Collapse, 
  Row, 
  Col, 
  message,
  AutoComplete
} from 'antd';
import { 
  SearchOutlined, 
  DeleteOutlined, 
  PrinterOutlined, 
  ClearOutlined, 
  PlusOutlined,
  BarcodeOutlined
} from '@ant-design/icons';

import { listProducts, searchProducts } from '../../api/EtiquetaApi';
import FlexGridContainer from '../../../../components/Layout/FlexGridContainer/FlexGridContainer';
import { generatePRN, LabelData } from '../../utils/labelGenerator';

const { Title, Text } = Typography;

interface ProductFromDB {
  id: number;
  sku: string;
  barcode?: string;
  name: string;
  category?: string;
  unitOfMeasure?: string;
  salePrice?: number;
  currentStock?: number;
  minStock?: number;
  status?: string;
  pictureUrl?: string;
}

interface LabelItem extends LabelData {
  id: number;
  isPromo: boolean;
  size: string;
}

const StockLabelingForm: React.FC = () => {
  // --- Estados de Busca ---
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ProductFromDB[]>([]);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");

  const loadCatalogProducts = async () => {
    try {
      setIsLoading(true);
      const products = await listProducts();
      const normalizedProducts = Array.isArray(products) ? products : [];
      setSearchResults(normalizedProducts);
      setSearchResultCount(normalizedProducts.length);
      setIsDropdownOpen(normalizedProducts.length > 0);
    } catch (error) {
      console.error('❌ Erro ao carregar catálogo:', error);
      message.error('Erro ao carregar produtos do catálogo.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Estados do Formulário (Item sendo configurado) ---
  const [selectedProduct, setSelectedProduct] = useState<ProductFromDB | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isPromo, setIsPromo] = useState(false);
  const [batch, setBatch] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [selectedSize, setSelectedSize] = useState("105x27");
  const [unit, setUnit] = useState("");

  // --- Estado da Fila ---
  const [queue, setQueue] = useState<LabelItem[]>([]);

  useEffect(() => {
    loadCatalogProducts();
  }, []);

  // 1. Efeito de busca aprimorado (Debounce)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        setIsLoading(true);
        try {
          const products = await searchProducts(searchTerm);
          const normalizedProducts = Array.isArray(products) ? products : [];
          setSearchResults(normalizedProducts);
          setSearchResultCount(normalizedProducts.length);
          setIsDropdownOpen(true);
        } catch (error) {
          console.error("❌ Erro na busca:", error);
          message.error("Erro ao buscar produtos.");
        } finally {
          setIsLoading(false);
        }
      } else {
        const fallbackProducts = searchResults.length > 0 ? searchResults : [];
        setSearchResults(fallbackProducts);
        setSearchResultCount(fallbackProducts.length);
        setIsDropdownOpen(fallbackProducts.length > 0);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // 2. Seleção de Produto corrigida
  const handleSelectProduct = (value: string | number, option: any) => {
    const productId = Number(option?.productId ?? value ?? 0);
    const product = searchResults.find(p => p.id === productId || p.name === String(value));

    if (!product) return;

    setSelectedProduct(product);
    setSearchTerm(product.name);
    setUnit(product.unitOfMeasure || "");
    setIsDropdownOpen(false);
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

  // Adição à Fila
  const addToQueue = () => {
    if (!selectedProduct) {
      message.warning("⚠️ Selecione um produto.");
      return;
    }

    const precoFinal = Number(selectedProduct.salePrice ?? 0);
    const unidade = unit || selectedProduct.unitOfMeasure || "";

    const newItem: LabelItem = {
      id: Date.now(),
      name: selectedProduct.name,
      sku: selectedProduct.sku,
      price: precoFinal,
      isPromo: isPromo,
      quantity: quantity,
      size: selectedSize,
      unit: unidade,
      batch: batch,
      expiryDate: expiryDate,
      gtin: selectedProduct.barcode || selectedProduct.sku
    };

    setQueue(prev => [...prev, newItem]);
    message.success("Item incluído na pilha com sucesso!");
  
    // Reset parcial
    setSelectedProduct(null);
    setSearchTerm("");
    setBatch("");
    setExpiryDate("");
    setUnit("");
    setQuantity(1);
    setIsPromo(false);
  };

  const removeFromQueue = (id: number) => {
    setQueue(queue.filter(item => item.id !== id));
  };

  const handlePrint = () => {
    if (queue.length === 0) {
      message.warning("Fila vazia!");
      return;
    }
    generatePRN(queue, selectedSize);
    message.success("Arquivo .PRN gerado com sucesso!");
  };

  const clearQueue = () => {
    if (window.confirm("⚠️ Limpar toda a fila?")) {
      setQueue([]);
      message.info("Fila limpa.");
    }
  };

  // Extrair categorias únicas para filtro avançado
  const availableCategories = Array.from(new Set(searchResults.map(p => p.category))).filter(Boolean);

  const filteredSearchResults = searchResults.filter(p => {
    if (selectedCategoryFilter === "ALL") return true;
    return p.category === selectedCategoryFilter;
  });

  // Opções formatadas para o AutoComplete do Antd mostrando o nome e mantendo o ID real do produto do banco
  const autoCompleteOptions = filteredSearchResults.map((p) => ({
    value: p.name,
    productId: p.id,
    label: (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
        <div>
          <Text strong>{p.name}</Text>
          <div style={{ fontSize: '11px', color: '#888' }}>
            SKU: {p.sku} {p.category ? `| Cat: ${p.category}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Text type="success" strong>R$ {Number(p.salePrice || 0).toFixed(2)}</Text>
          <div style={{ fontSize: '11px', color: Number(p.currentStock ?? 0) <= 0 ? 'red' : '#555' }}>
            Estoque: {Number(p.currentStock ?? 0)}
          </div>
        </div>
      </div>
    ),
  }));

  // Colunas para a tabela Antd da Fila
  const queueColumns = [
    {
      title: 'Produto',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: LabelItem) => (
        <div>
          <Text strong>{text}</Text><br />
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.sku} {record.isPromo ? '🔥 [PROMO]' : ''}</Text>
        </div>
      ),
    },
    {
      title: 'Preço',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `R$ ${price.toFixed(2)}`,
    },
    {
      title: 'Qtd',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center' as const,
      render: (qty: number) => `${qty}x`,
    },
    {
      title: 'Ação',
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: LabelItem) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => removeFromQueue(record.id)} 
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>
      
      {/* CSS Exclusivo mantido estritamente para a Fita de Preview Física */}
      <style>{`
        .preview-scroll { 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          gap: 15px; 
          background: #555; 
          padding: 20px; 
          border-radius: 10px; 
          max-height: 600px; 
          overflow-y: auto; 
          border: 5px solid #333;
        }
        .label-sticker { 
          background: white; 
          width: 380px; 
          height: 120px; 
          padding: 12px; 
          display: flex; 
          flex-direction: column; 
          position: relative;
          flex-shrink: 0;
          border-bottom: 1px dotted #555; 
          border-radius: 15px;
          box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
          color: #000;
          overflow: visible; 
          text-align: center;
        }
        .label-row-1 { font-size: 0.9rem; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .label-row-2 { 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          height: 45px; 
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
          border-radius: 3px;
        }
        .label-sticker::before,
        .label-sticker::after {
          content: "";
          position: absolute;
          width: 50px; 
          height: 8px; 
          background: #555; 
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
        }
        .label-sticker::before {
          top: -2px; 
          border-radius: 0 0 10px 10px; 
        }
        .label-sticker::after {
          bottom: -2px; 
          border-radius: 10px 10px 0 0; 
        }
      `}</style>

      {/* Cabeçalho Principal */}
      <Card style={{ marginBottom: 20, borderRadius: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }} bodyStyle={{ padding: '16px 24px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={3} style={{ margin: 0 }}>🏷️ Sistema de Rotulagem</Title>
          </Col>
          <Col>
            <Space>
              {queue.length > 0 && (
                <Button danger icon={<ClearOutlined />} onClick={clearQueue}>
                  Limpar Tudo
                </Button>
              )}
              <Button 
                type="primary" 
                icon={<PrinterOutlined />} 
                onClick={handlePrint} 
                disabled={queue.length === 0}
                style={{ backgroundColor: queue.length === 0 ? undefined : '#27ae60' }}
              >
                Baixar .PRN ({queue.length})
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Grid Layout Principal de 3 Colunas */}
      <Row gutter={20}>
        
        {/* Coluna 1: Painel de Configuração */}
        <Col xs={24} md={7}>
          <Card 
            title="➕ Configurar Item" 
            bordered={false} 
            style={{ borderRadius: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 20 }}
          >
            {/* Sistema de Busca Aprimorado com Filtros */}
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>🔍 Buscar Produto (Nome ou SKU)</Text>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: 8 }}>
                <AutoComplete
                  value={searchTerm}
                  options={autoCompleteOptions}
                  style={{ width: '100%' }}
                  onSearch={(text) => setSearchTerm(text)}
                  onSelect={handleSelectProduct}
                  placeholder="Digite nome ou SKU (mín. 2 letras)..."
                  notFoundContent={isLoading ? "Buscando..." : "Nenhum produto encontrado"}
                />
              </div>

              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Itens no catálogo: <strong style={{ color: searchResultCount > 0 ? '#1677ff' : '#999' }}>{searchResultCount}</strong>
                </Text>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {searchTerm.length >= 2 ? (searchResultCount > 0 ? 'Resultados ativos' : 'Sem resultados') : 'Lista carregada'}
                </Text>
              </div>

              {/* Filtro secundário opcional para refinar busca por categoria se houver resultados */}
              {availableCategories.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: '11px' }}>Filtrar por Categoria na Busca:</Text>
                  <Select 
                    size="small"
                    value={selectedCategoryFilter} 
                    onChange={setSelectedCategoryFilter}
                    style={{ width: '100%', marginTop: 2 }}
                  >
                    <Select.Option value="ALL">Todas as categorias</Select.Option>
                    {availableCategories.map(cat => (
                      <Select.Option key={cat} value={cat}>{cat}</Select.Option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={12}>
                <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>Qtd de Cópias</Text>
                <Input 
                  type="number" 
                  min={1} 
                  value={quantity} 
                  onChange={(e) => setQuantity(Number(e.target.value))} 
                />
              </Col>
              <Col span={12}>
                <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>Tamanho</Text>
                <Select value={selectedSize} onChange={setSelectedSize} style={{ width: '100%' }}>
                  <Select.Option value="105x27">105 x 27 mm</Select.Option>
                  <Select.Option value="60x40">60 x 40 mm</Select.Option>
                </Select>
              </Col>
            </Row>

            <div style={{ marginBottom: 16 }}>
              <Checkbox checked={isPromo} onChange={(e) => setIsPromo(e.target.checked)}>
                🔥 Etiqueta de Promoção
              </Checkbox>
            </div>

            {/* Campos Avançados */}
            <Collapse 
              ghost 
              items={[
                {
                  key: '1',
                  label: '⚙️ Campos Avançados (Lote, Validade...)',
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      <div>
                        <Text type="secondary" style={{ fontSize: '11px' }}>Data de Validade</Text>
                        <Input 
                          type="date" 
                          value={expiryDate} 
                          onChange={(e) => setExpiryDate(e.target.value)} 
                        />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: '11px' }}>Identificador de Lote</Text>
                        <Input 
                          placeholder="Ex: LOTE0192" 
                          value={batch} 
                          onChange={(e) => setBatch(e.target.value)} 
                        />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: '11px' }}>Unidade de Medida</Text>
                        <Select 
                          value={unit} 
                          onChange={setUnit} 
                          style={{ width: '100%' }}
                          placeholder="Selecione unidade"
                        >
                          <Select.Option value="">Sem unidade</Select.Option>
                          <Select.Option value="UN">Unidade (UN)</Select.Option>
                          <Select.Option value="KG">Quilo (KG)</Select.Option>
                          <Select.Option value="CX">Caixa (CX)</Select.Option>
                          <Select.Option value="PCT">Pacote (PCT)</Select.Option>
                        </Select>
                      </div>
                    </Space>
                  )
                }
              ]}
              style={{ marginBottom: 16 }}
            />

            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={addToQueue} 
              disabled={!selectedProduct}
              block
              size="large"
            >
              Incluir na Pilha
            </Button>
          </Card>
        </Col>

        {/* Coluna 2: Tabela de Itens na Fila */}
        <Col xs={24} md={10}>
          <Card 
            title="📋 Itens na Fila (Aguardando Impressão)" 
            bordered={false} 
            style={{ borderRadius: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}
          >
            <Table 
              dataSource={queue} 
              columns={queueColumns} 
              rowKey="id" 
              pagination={{ pageSize: 5 }}
              locale={{ emptyText: 'A fila está vazia.' }}
              size="small"
            />
          </Card>
        </Col>

        {/* Coluna 3: Preview da Fita (Estilo mantido 100% idêntico) */}
        <Col xs={24} md={7}>
          <Card 
            title="🎞️ Visualização da Fita (Preview)" 
            bordered={false} 
            style={{ borderRadius: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}
          >
            <div className="preview-scroll">
              {queue.length === 0 && <div style={{ color: '#aaa' }}>Aguardando itens...</div>}
              {queue.map((item, index) => (
                <div key={item.id} className="label-sticker">
                  {/* Indicador de Ordem no Rolo */}
                  <div style={{ position: 'absolute', left: '-30px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{index + 1}º</div>

                  {/* TAG de Promoção */}
                  {item.isPromo && <div className="promo-badge">OFERTA</div>}

                  {/* LINHA 1: Nome do Produto */}
                  <div className="label-row-1">{sanitize(item.name)}</div>

                  {/* LINHA 2: Preço em Destaque */}
                  <div className="label-row-2">
                    <span className="label-price-symbol">R$</span>
                    <span className="label-price-value">
                      {item.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  {/* LINHA 3: SKU / Detalhes Logísticos */}
                  <div className="label-row-3">
                    <strong>COD:</strong> {item.sku}{item.unit ? ` | ${item.unit}` : ''}{item.batch ? ` | LOTE: ${item.batch}` : ''}{item.expiryDate ? ` | VAL: ${item.expiryDate}` : ''}
                  </div>

                  {/* LINHA 4: Código de Barras Simulado */}
                  <div className="label-row-4">
                    <div className="barcode-sim"></div>
                    <div style={{ fontSize: '8px', textAlign: 'center', letterSpacing: '2px' }}>{String(item.gtin || item.sku || '').replace(/\D/g, '') || '0000000000000'}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

      </Row>
    </div>
  );
};

export default StockLabelingForm;