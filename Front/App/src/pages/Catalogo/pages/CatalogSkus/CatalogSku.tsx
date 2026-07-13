import React, { useState } from 'react';
import { 
  Table, 
  Card, 
  Tag, 
  Input, 
  Button, 
  Space, 
  Breadcrumb, 
  Typography, 
  Row, 
  Col, 
  Statistic, 
  Badge,
  Alert,
  Select,
  Radio
} from 'antd';
import { 
  AppstoreOutlined, 
  SearchOutlined, 
  PlusOutlined, 
  DatabaseOutlined,
  DownOutlined,
  RightOutlined,
  ShoppingCartOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  ClusterOutlined,
  UserOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ProductDetailsDrawer from './ProductDetailsDrawer';
import CreateProductModal from './CreateProductModal'; 

const { Title, Text } = Typography;

interface SkuChildType {
  key: string;
  idSku: string;
  variacao: string; 
  marca: string;    
  estoque: number;
  preco: number;
  status: 'Ativo' | 'Inativo' | 'Sem Estoque';
}

interface ItemParentType {
  key: string;
  codItem: string;
  nomeItem: string;
  skus: SkuChildType[];
}

// Tipos de filtros baseados nos cards
type FilterType = 'all' | 'activeSkus' | 'noStock' | 'criticalStock';

export default function CatalogSku() {
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all'); // NOVO: Estado do filtro inteligente
  const [expandedRowKeys, setExpandedRowKeys] = useState<readonly React.Key[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);


  // 1. Novos estados de controle (adicione no topo do componente)
const [selectedSupplier, setSelectedSupplier] = useState<string | undefined>(undefined);
const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
const [selectedStructure, setSelectedStructure] = useState<string | undefined>(undefined); // 'familia' | 'individual'

  const [creationBatch, setCreationBatch] = useState<ItemParentType[]>([]);
  const [showBatchPanel, setShowBatchPanel] = useState(false);

  const [products, setProducts] = useState<ItemParentType[]>([
    {
      key: 'ITM-CORREIA-V',
      codItem: 'ITM-CORREIA-V',
      nomeItem: 'Correia Industrial Perfil V',
      skus: Array.from({ length: 4 }, (_, i) => {
        const marcas = ['Goodyear', 'Gates'];
        const marcaId = marcas[i % 2];
        const numeracao = 20 + i;
        // Mockando um com estoque 0 para testar o filtro inteligente
        const estoqueSimulado = i === 0 ? 0 : i === 1 ? 3 : Math.floor(Math.random() * 50) + 10;
        return {
          key: `SKU-V${numeracao}-${marcaId}`,
          idSku: `SKU-V${numeracao}-${marcaId.substring(0,3).toUpperCase()}`,
          variacao: `Nº ${numeracao} - Perfil V`,
          marca: marcaId,
          estoque: estoqueSimulado,
          preco: 45.90 + numeracao,
          status: estoqueSimulado === 0 ? 'Sem Estoque' : 'Ativo'
        };
      })
    },
    {
      key: 'ITM-1001',
      codItem: 'ITM-1001',
      nomeItem: 'Camiseta Básica Algodão',
      skus: [
        { key: 'SKU-1001-M', idSku: 'SKU-1001-M', variacao: 'Preto / M', marca: 'Própria', estoque: 0, preco: 79.90, status: 'Sem Estoque' },
      ]
    }
  ]);

  const handleUpdateProduct = async (id: string, updatedFields: any) => {
    console.log("Atualizando id:", id, "com os dados:", updatedFields);
  };

  const toggleExpand = (rowKey: React.Key) => {
    const isExpanded = expandedRowKeys.includes(rowKey);
    setExpandedRowKeys(isExpanded ? expandedRowKeys.filter(key => key !== rowKey) : [...expandedRowKeys, rowKey]);
  };

  const openNewSkuModal = () => setIsModalVisible(true);

  const handleSaveProduct = async (payload: any) => {
    setModalLoading(true);
    try {
      const marcasFornecedores: Record<number, string> = { 101: 'Ebara', 102: 'Gates', 103: 'SKF' };
      const marcaDetectada = marcasFornecedores[payload.fornecedor_id] || 'Genérico';

      const novoSkuSimulado: SkuChildType = {
        key: `SKU-${payload.codItem}-01`,
        idSku: `SKU-${payload.codItem}-BASE`,
        variacao: payload.familia_id ? 'Variação Inicial (Grade)' : 'Única',
        marca: marcaDetectada,
        estoque: 0,
        preco: payload.financeiro?.preco_venda || 0,
        status: 'Ativo'
      };

      const novoItemPai: ItemParentType = {
        key: payload.codItem,
        codItem: payload.codItem,
        nomeItem: payload.nome,
        skus: [novoSkuSimulado] 
      };

      setCreationBatch(prev => [novoItemPai, ...prev]);
      setShowBatchPanel(true);
      setIsModalVisible(false);
    } catch (error) {
      console.error(error);
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmEntireBatch = () => {
    setModalLoading(true);
    setTimeout(() => {
      setProducts(prev => [...creationBatch, ...prev]);
      setCreationBatch([]); 
      setShowBatchPanel(false);
      setModalLoading(false);
    }, 800);
  };

  const removeItemFromBatch = (key: string) => {
    setCreationBatch(prev => prev.filter(item => item.key !== key));
  };

 const parentColumns: ColumnsType<ItemParentType> = [
    {
      title: 'Tipo',
      key: 'tipoItem',
      width: '120px',
      render: (_, record) => {
        const isFamily = record.skus.length > 1;
        return isFamily ? (
          <Tag color="purple" icon={<ClusterOutlined />}>Família</Tag>
        ) : (
          <Tag color="default" icon={<UserOutlined />}>Individual</Tag>
        );
      },
    },
    {
      title: 'Item Base (Código)',
      dataIndex: 'codItem',
      key: 'codItem',
      render: (text) => <Text code style={{ fontSize: '13px', fontWeight: 'bold' }}>{text}</Text>,
    },
    {
      title: 'Imagem',
      dataIndex: 'imagemUrl',
      key: 'imagemProduto',
      render: (url) => (
        <img 
          src={url || 'https://placehold.co/40'} 
          alt="Produto" 
          style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} 
        />
      ),
    },
    {
      title: 'Nome do Produto',
      dataIndex: 'nomeItem',
      key: 'nomeItem',
      render: (text) => <Text strong>{text}</Text>,
    },
     {
      title: 'Grade Cadastrada',
      dataIndex: 'skus',
      key: 'skus_count',
      render: (skus: SkuChildType[]) => {
        const isFamily = skus.length > 1;
        return isFamily ? (
          <Tag color="blue">{skus.length} variações</Tag>
        ) : (
          <Tag color="cyan">Produto Único</Tag>
        );
      },
    },
    {
      title: 'Estoque Total',
      key: 'estoqueTotal',
      render: (_, record) => {
        const total = record.skus.reduce((acc, sku) => acc + sku.estoque, 0);
        return <Text strong>{total}</Text>;
      },
    },
    {
      title: 'Preço Custo (Médio)',
      key: 'precoCustoMedio',
      render: (_, record) => {
        if (record.skus.length === 0) return 'R$ 0,00';
        const totalPreco = record.skus.reduce((acc, sku) => acc + sku.preco, 0);
        const media = totalPreco / record.skus.length;
        return `R$ ${media.toFixed(2)}`;
      },
    }, {
      title: 'Preço Venda (Médio)',
      key: 'precoVendaMedio',
      render: (_, record) => {
        if (record.skus.length === 0) return 'R$ 0,00';
        const totalPreco = record.skus.reduce((acc, sku) => acc + sku.preco, 0);
        const media = totalPreco / record.skus.length;
        return `R$ ${media.toFixed(2)}`;
      },
    },
    {
      title: 'Status Geral',
      key: 'statusGeral',
      render: (_, record) => {
        const hasAtivo = record.skus.some(sku => sku.status === 'Ativo');
        const hasInativo = record.skus.some(sku => sku.status === 'Inativo');
        const hasSemEstoque = record.skus.some(sku => sku.status === 'Sem Estoque');

        if (hasAtivo) return <Tag color="green">Ativo</Tag>;
        if (hasInativo) return <Tag color="red">Inativo</Tag>;
        if (hasSemEstoque) return <Tag color="orange">Sem Estoque</Tag>;
        return <Tag color="gray">Desconhecido</Tag>;
      },
    },
   
    {
      title: 'Ações',
      key: 'action',
      width: '220px',
      render: (_, record) => {
        const isExpanded = expandedRowKeys.includes(record.key);
        const isFamily = record.skus.length > 1;
        return (
          <Space size="middle">
            <Button 
              type="default" 
              size="small"
              icon={isExpanded ? <DownOutlined /> : <RightOutlined />}
              onClick={() => toggleExpand(record.key)}
              disabled={!isFamily} // Desabilita sanfona para itens individuais
            >
              {isFamily ? (isExpanded ? 'Fechar Grade' : 'Ver SKUs') : 'Sem Grade'}
            </Button>
            <Button 
              type="link" 
              size="small" 
              onClick={() => {
                setSelectedProduct(record);
                setIsDrawerVisible(true);
              }}
            >
              Editar
            </Button>
          </Space>
        );
      },
    },
  ];

  const expandedRowRender = (parentRecord: ItemParentType) => {
    const childColumns: ColumnsType<SkuChildType> = [
      { title: 'Código SKU', dataIndex: 'idSku', key: 'idSku' },
      { title: 'Especificação / Tamanho', dataIndex: 'variacao', key: 'variacao' },
      { title: 'Preço Praticado', dataIndex: 'preco', key: 'preco', render: (v) => `R$ ${v.toFixed(2)}` },
      { 
        title: 'Físico Disponível', 
        dataIndex: 'estoque', 
        key: 'estoque',
        render: (estoque) => (
          <span style={{ fontWeight: estoque === 0 ? 'bold' : 'normal', color: estoque === 0 ? '#cf1322' : 'inherit' }}>
            {estoque} {estoque === 0 && '(Esgotado)'}
          </span>
        )
      }
    ];
    return <Table columns={childColumns} dataSource={parentRecord.skus} pagination={false} size="small" bordered />;
  };

  // LÓGICA DE FILTRAGEM REESCRITA (Combina a busca por texto + Filtro Inteligente do Card)

  const filteredData = products.filter(item => {
   // Busca por Texto
    const matchesSearch = item.nomeItem.toLowerCase().includes(searchText.toLowerCase()) ||
                          item.codItem.toLowerCase().includes(searchText.toLowerCase());
    if (!matchesSearch) return false;

    // Filtro do Card Superior (Mecanismo anterior)
    if (selectedFilter === 'noStock' && !item.skus.some(sku => sku.estoque === 0)) return false;
    if (selectedFilter === 'criticalStock' && !item.skus.some(sku => sku.estoque > 0 && sku.estoque <= 5)) return false;
    if (selectedFilter === 'activeSkus' && !item.skus.some(sku => sku.estoque > 0)) return false;

    // NOVO: Filtro de Fornecedor (Validando nos SKUs ou no Item Pai se houver)
    if (selectedSupplier && !item.skus.some(sku => sku.marca.toLowerCase() === selectedSupplier.toLowerCase())) return false;

    // NOVO: Filtro de Categoria (Assumindo campo 'categoria' no Item Pai)
    // Nota: Adicione 'categoria?: string' na interface ItemParentType se necessário
    if (selectedCategory && (item as any).categoria !== selectedCategory) return false;

    // NOVO: Filtro de Famílias / Estrutura
    if (selectedStructure === 'familia' && item.skus.length <= 1) return false;
    if (selectedStructure === 'individual' && item.skus.length > 1) return false;

    return true;
});


// Função utilitária para limpar todos os filtros de uma vez
const handleClearAllFilters = () => {
  setSelectedFilter('all');
  setSelectedSupplier(undefined);
  setSelectedCategory(undefined);
  setSelectedStructure(undefined);
};


  // Função auxiliar para injetar estilo de botão/clicável nos cards
  const getCardStyle = (filterType: FilterType, activeColor: string) => ({
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: selectedFilter === filterType ? `2px solid ${activeColor}` : '2px solid transparent',
    boxShadow: selectedFilter === filterType ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
    transform: selectedFilter === filterType ? 'translateY(-2px)' : 'none',
  });

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>

<Button


      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>Catálogo</Breadcrumb.Item>
        <Breadcrumb.Item>Gerenciador de Catálogo</Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Title level={2} style={{ margin: 0, display: 'flex', alignItem: 'center' }}>
            <AppstoreOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
            Gerenciador de Catálogo
          </Title>
        </Col>
        <Col>
          <Space size="middle">
            <Badge count={creationBatch.length} status="processing">
              <Button 
                type={creationBatch.length > 0 ? "dashed" : "default"} 
                icon={<ShoppingCartOutlined />} 
                onClick={() => setShowBatchPanel(!showBatchPanel)}
                disabled={creationBatch.length === 0}
              >
                Fila de Criação
              </Button>
            </Badge>
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openNewSkuModal}>
              Adicionar Novo à Fila
            </Button>
          </Space>
        </Col>
      </Row>

      {showBatchPanel && creationBatch.length > 0 && (
        <Card 
          title="📋 Itens Aguardando Confirmação (Rascunho de Lote)" 
          style={{ marginBottom: 24, border: '2px dashed #1890ff', background: '#e6f7ff' }}
          extra={
            <Button 
              type="primary" 
              loading={modalLoading}
              icon={<CheckCircleOutlined />} 
              onClick={handleConfirmEntireBatch}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              Salvar Todos Permanentemente ({creationBatch.length})
            </Button>
          }
        >
          <Alert 
            message="Esses produtos abaixo estão temporariamente salvos na sua sessão. Você pode conferir os códigos duplicados antes de persistir no banco de dados." 
            type="info" 
            showIcon 
            style={{ marginBottom: 16 }}
          />
          <Table
            size="small"
            pagination={false}
            dataSource={creationBatch}
            columns={[
              { title: 'Cód Item Base', dataIndex: 'codItem', key: 'codItem', render: (t) => <Text code>{t}</Text> },
              { title: 'Nome do Produto', dataIndex: 'nomeItem', key: 'nomeItem' },
              { title: 'Preço Inicial', key: 'preco', render: (_, r) => `R$ ${r.skus[0]?.preco.toFixed(2)}` },
              {
                title: 'Ações',
                key: 'remove',
                width: '100px',
                render: (_, record) => (
                  <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={() => removeItemFromBatch(record.key)}
                  >
                    Remover
                  </Button>
                )
              }
            ]}
          />
        </Card>
      )}

      {/* SEÇÃO DE CARDS ATUALIZADOS PARA FILTROS INTELIGENTES */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={4}>
          <Card 
            hoverable 
            bodyStyle={{ padding: '16px' }}
            style={getCardStyle('all', '#1890ff')} 
            onClick={() => setSelectedFilter('all')}
          >
            <Statistic title="Todos os Produtos" value={products.length} prefix={<DatabaseOutlined style={{ color: '#1890ff' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card 
            hoverable 
            bodyStyle={{ padding: '16px' }}
            style={getCardStyle('activeSkus', '#52c41a')} 
            onClick={() => setSelectedFilter('activeSkus')}
          >
            <Statistic title="SKUs com Estoque" value={4820} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card 
            hoverable 
            bodyStyle={{ padding: '16px' }}
            style={getCardStyle('noStock', '#ff4d4f')} 
            onClick={() => setSelectedFilter('noStock')}
          >
            <Statistic title="Sem Estoque (Filtro)" value={14} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card 
            hoverable 
            bodyStyle={{ padding: '16px' }}
            style={getCardStyle('criticalStock', '#fa8c16')} 
            onClick={() => setSelectedFilter('criticalStock')}
          >
            <Statistic title="Estoque Crítico (Filtro)" value={32} valueStyle={{ color: '#fa8c16' }} suffix={<span style={{ fontSize: '12px', color: '#8c8c8c' }}>un</span>} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card hoverable bodyStyle={{ padding: '16px' }} style={{ cursor: 'not-allowed', opacity: 0.7 }}>
            <Statistic title="Compras Spot" value={8} valueStyle={{ color: '#722ed1' }} suffix={<span style={{ fontSize: '12px', color: '#8c8c8c' }}>itens</span>} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card hoverable bodyStyle={{ padding: '16px' }} style={{ cursor: 'not-allowed', opacity: 0.7 }}>
            <Statistic title="Sem Fornecedor" value={19} valueStyle={{ color: '#022340' }} suffix={<span style={{ fontSize: '12px', color: '#8c8c8c' }}>itens</span>} />
          </Card>
        </Col>
      </Row>

      {/* LISTAGEM OFICIAL DO SISTEMA */}
      <Card 
  bordered={false} 
  title="📦 Catálogo Definitivo"
  extra={
    (selectedFilter !== 'all' || selectedSupplier || selectedCategory || selectedStructure) && (
      <Button 
        type="dashed" 
        danger 
        icon={<ClearOutlined />} 
        onClick={handleClearAllFilters}
      >
        Limpar Todos os Filtros
      </Button>
    )
  }
>
  {/* Linha de Filtros Avançados */}
  <Row style={{ marginBottom: '16px' }} gutter={[12, 12]} align="middle">
    {/* Input de Busca Principal */}
    <Col xs={24} sm={24} md={6}>
      <Input 
        placeholder="Buscar por Nome ou Código..." 
        prefix={<SearchOutlined />} 
        value={searchText} 
        onChange={(e) => setSearchText(e.target.value)} 
        allowClear 
      />
    </Col>

    
    {/* Filtro Inteligente: Famílias de Produtos (Agora como Botões) */}
<Col xs={24} sm={24} md={7}> {/* Aumentei levemente para md={7} para os ícones e textos caberem confortavelmente lado a lado */}
  <Radio.Group 
    buttonStyle="solid" 
    value={selectedStructure || 'all_structures'} // Se for undefined, marca o botão "Todos"
    onChange={(e) => {
      const val = e.target.value;
      setSelectedStructure(val === 'all_structures' ? undefined : val);
    }}
    style={{ width: '100%', display: 'flex' }}
  >
    <Radio.Button value="all_structures" style={{ flex: 1, textAlign: 'center' }}>
      <UnorderedListOutlined style={{ marginRight: '6px' }} /> Todos
    </Radio.Button>
    <Radio.Button value="familia" style={{ flex: 1, textAlign: 'center' }}>
      <ClusterOutlined style={{ marginRight: '6px' }} /> Famílias
    </Radio.Button>
    <Radio.Button value="individual" style={{ flex: 1, textAlign: 'center' }}>
      <UserOutlined style={{ marginRight: '6px' }} /> Individuais
    </Radio.Button>
  </Radio.Group>
</Col>

    {/* Filtro Inteligente: Fornecedor/Marca */}
    <Col xs={24} sm={12} md={4}>
      <Select
        style={{ width: '100%' }}
        placeholder="Filtrar por Marca/Fornecedor"
        allowClear
        value={selectedSupplier}
        onChange={(value) => setSelectedSupplier(value)}
        options={[
          { value: 'Goodyear', label: 'Goodyear' },
          { value: 'Gates', label: 'Gates' },
          { value: 'Própria', label: 'Marca Própria' },
        ]}
      />
    </Col>

    {/* Filtro Inteligente: Categoria */}
    <Col xs={24} sm={12} md={4}>
      <Select
        style={{ width: '100%' }}
        placeholder="Filtrar por Categoria"
        allowClear
        value={selectedCategory}
        onChange={(value) => setSelectedCategory(value)}
        options={[
          { value: 'Industrial', label: 'Industrial' },
          { value: 'Vestuário', label: 'Vestuário' },
          { value: 'Automotivo', label: 'Automotivo' },
        ]}
      />
    </Col>

  </Row>

  {/* Linha das Tags de Feedback de Filtros Ativos */}
  {(selectedFilter !== 'all' || selectedSupplier || selectedCategory || selectedStructure) && (
    <Row style={{ marginBottom: '16px' }}>
      <Col span={24}>
        <Space size="small" wrap>
          <Text type="secondary" style={{ fontSize: '13px' }}>Filtros ativos:</Text>
          
          {selectedFilter !== 'all' && (
            <Tag color="blue" closable onClose={() => setSelectedFilter('all')}>
              Status: <strong>{selectedFilter === 'noStock' ? 'Sem Estoque' : selectedFilter === 'criticalStock' ? 'Estoque Crítico' : 'SKUs Ativos'}</strong>
            </Tag>
          )}

          {selectedSupplier && (
            <Tag color="purple" closable onClose={() => setSelectedSupplier(undefined)}>
              Marca: <strong>{selectedSupplier}</strong>
            </Tag>
          )}

          {selectedCategory && (
            <Tag color="orange" closable onClose={() => setSelectedCategory(undefined)}>
              Categoria: <strong>{selectedCategory}</strong>
            </Tag>
          )}

          {selectedStructure && (
            <Tag color="magenta" closable onClose={() => setSelectedStructure(undefined)}>
              Estrutura: <strong>{selectedStructure === 'familia' ? 'Família' : 'Individual'}</strong>
            </Tag>
          )}
        </Space>
      </Col>
    </Row>
  )}

  {/* Tabela de Resultados */}
  <Table 
    columns={parentColumns} 
    dataSource={filteredData} 
    pagination={{ pageSize: 10 }}
    expandable={{
      expandedRowRender,
      expandedRowKeys,
      onExpandedRowsChange: (keys) => setExpandedRowKeys(keys),
      showExpandColumn: false,
    }}
  />
</Card>

      <CreateProductModal open={isModalVisible} onClose={() => setIsModalVisible(false)} onSave={handleSaveProduct} loading={modalLoading} />
      <ProductDetailsDrawer visible={isDrawerVisible} product={selectedProduct} onClose={() => setIsDrawerVisible(false)} onSave={handleUpdateProduct} />
    </div>
  );
}