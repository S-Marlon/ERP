import React, { useState, useEffect, useCallback } from 'react';
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
  Radio,
  message,
  Image,
  Avatar
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
  UnorderedListOutlined,
  ReloadOutlined,
  PictureOutlined,
  ImportOutlined
} from '@ant-design/icons';

import type { ColumnsType } from 'antd/es/table';

import { ItemParentType, SkuChildType } from './CatalogSku.types';
import { getProdutos, updateProduto, saveProdutosLote } from './CatalogSku.service';
import ProductDetailsDrawer from './ProductDetailsDrawer';
import CreateProductModal from './CreateProductModal'; 

const { Title, Text } = Typography;

type FilterType = 'all' | 'activeSkus' | 'noStock' | 'criticalStock';

export default function CatalogSku() {
  const [products, setProducts] = useState<ItemParentType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Filtros e Seletores de Interface
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [expandedRowKeys, setExpandedRowKeys] = useState<readonly React.Key[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ItemParentType | null>(null);

  const [selectedSupplier, setSelectedSupplier] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedStructure, setSelectedStructure] = useState<string | undefined>(undefined);

  // Rascunho / Lote
  const [creationBatch, setCreationBatch] = useState<ItemParentType[]>([]);
  const [showBatchPanel, setShowBatchPanel] = useState(false);

  // Helper para determinar se o item pertence a uma Família ou é Solto/Individual
// Helper preciso para determinar se o registro é uma Família Mestre
const checkIsFamily = (record: ItemParentType): boolean => {
  const isFamKey = String(record.id_item).startsWith('FAM-');
  const hasMultipleSkus = (record.skus || []).length > 1;

  // Se tem a chave de família ou tem múltiplos SKUs agrupados dentro dele
  return isFamKey || hasMultipleSkus;
};

  // 1. CARREGAR DADOS DO SERVIÇO DE API
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProdutos();
      setProducts(data);
    } catch (error: any) {
      message.error(error.message || 'Falha ao carregar os produtos do servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // 2. SALVAR ATUALIZAÇÃO VIA API
  const handleUpdateProduct = async (idItem: string | number, updatedFields: any) => {
    try {
      await updateProduto(idItem, updatedFields);
      message.success('Produto atualizado com sucesso!');
      setIsDrawerVisible(false);
      fetchProducts();
    } catch (error: any) {
      message.error(error.message || 'Erro ao salvar alterações no servidor.');
    }
  };

  // 3. ENFILEIRAR ITEM LOCALMENTE NO RASCUNHO
  const handleSaveProduct = async (payload: any) => {
    const tempId = Date.now();
    const novoItemPai: ItemParentType = {
      key: String(tempId),
      id_item: tempId,
      sku: payload.sku || payload.codItem,
      nome_item: payload.nome || payload.nome_item,
      tipo_recurso: 'PRODUTO',
      status: 'ATIVO',
      familia_id: payload.familia_id || null,
      categoria_id: payload.categoria_id || null,
      skus: [
        {
          key: `${tempId}-0`,
          id_item: tempId,
          sku: payload.sku || payload.codItem,
          variacao: 'Principal',
          marca: payload.marca || 'Própria',
          estoque: payload.estoque_inicial || 0,
          preco_venda: payload.financeiro?.preco_venda || 0,
          custo_gerencial: payload.financeiro?.custo_gerencial || 0,
          status: 'ATIVO'
        }
      ]
    };

    setCreationBatch(prev => [novoItemPai, ...prev]);
    setShowBatchPanel(true);
    setIsModalVisible(false);
    message.info('Item adicionado à fila de criação.');
  };

  // 4. DISPARAR GRAVAÇÃO EM LOTE VIA API
  const handleConfirmEntireBatch = async () => {
    setModalLoading(true);
    try {
      await saveProdutosLote(creationBatch);
      message.success(`${creationBatch.length} produtos salvos com sucesso no banco!`);
      setCreationBatch([]);
      setShowBatchPanel(false);
      fetchProducts();
    } catch (error: any) {
      message.error(error.message || 'Erro ao persistir o lote no banco de dados.');
    } finally {
      setModalLoading(false);
    }
  };

  const removeItemFromBatch = (key: string) => {
    setCreationBatch(prev => prev.filter(item => item.key !== key));
  };

  const toggleExpand = (rowKey: React.Key) => {
    const isExpanded = expandedRowKeys.includes(rowKey);
    setExpandedRowKeys(isExpanded ? expandedRowKeys.filter(k => k !== rowKey) : [...expandedRowKeys, rowKey]);
  };

  // COLUNAS DA TABELA MESTRE
 const parentColumns: ColumnsType<ItemParentType> = [
  {
    title: 'Estrutura / Variações',
    key: 'estrutura_variacoes',
    width: '180px',
    render: (_, record) => {
      const isFamily = checkIsFamily(record);
      const skus: SkuChildType[] = record.skus || [];

      return (
        <Space size="small" wrap>
          {isFamily ? (
            <>
              <Tag color="purple" icon={<ClusterOutlined />}>
                Família
              </Tag>
              <Tag color="blue">
                {skus.length} {skus.length === 1 ? 'variação' : 'variações'}
              </Tag>
            </>
          ) : (
            <Tag color="default" icon={<UserOutlined />}>
              Individual
            </Tag>
          )}
        </Space>
      );
    },
  },
  {
    title: 'SKU Master',
    dataIndex: 'sku',
    key: 'sku',
    render: (text) => <Text code style={{ fontSize: '13px', fontWeight: 'bold' }}>{text}</Text>,
  },
 
  


{
  title: 'Imagem',
  key: 'imagem',
  width: '70px',
  render: (_, record) => {
    const imgSrc = record.skus?.[0]?.imagem_url;

    return (
      <Avatar
        shape="square"
        size={48}
        src={imgSrc}
        icon={<PictureOutlined style={{ color: '#bfbfbf' }} />} // Ícone cinza quando não tem imagem
        style={{
          backgroundColor: '#f5f5f5', // Fundo cinza suave
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
        }}
      />
    );
  },
},




  {
    title: 'Nome do Produto',
    dataIndex: 'nome_item',
    key: 'nome_item',
    render: (text) => <Text strong>{text}</Text>,
  },
  {
    title: 'Categoria',
    key: 'categoria',
    render: (_, record) => {
      return <Text>{record.categoria_id ? `Categoria ${record.categoria_id}` : '-'}</Text>;
    }
  },
  {
    title: 'Marca',
    key: 'marca',
    render: (_, record) => {
      const skus = record.skus || [];
      if (skus.length === 0) return <Text type="secondary">-</Text>;

      // Extrai marcas únicas e remove valores vazios
      const marcasUnicas = Array.from(new Set(skus.map(s => s.marca).filter(Boolean)));

      if (marcasUnicas.length === 0) return <Text type="secondary">-</Text>;
      
      // Retorna as marcas separadas por vírgula (ex: "Nike, Adidas" ou apenas "Puma")
      return <Text>{marcasUnicas.join(', ')}</Text>;
    },
  },
  
  {
    title: 'Custo Gerencial',
    key: 'precoCustoMedio',
    render: (_, record) => {
      const skus = record.skus || [];
      if (skus.length === 0) return 'R$ 0,00';

      const custos = skus.map(s => s.custo_gerencial || 0);
      const minCusto = Math.min(...custos);
      const maxCusto = Math.max(...custos);

      // Se o menor for igual ao maior (ou se for individual), mostra apenas um valor
      if (minCusto === maxCusto) {
        return `R$ ${minCusto.toFixed(2)}`;
      }

      // Se houver variação de custo
      return `(R$ ${minCusto.toFixed(2)}) - (R$ ${maxCusto.toFixed(2)})`;
    },
  },
  {
    title: 'Preço Venda',
    key: 'precoVendaMedio',
    render: (_, record) => {
      const skus = record.skus || [];
      if (skus.length === 0) return 'R$ 0,00';

      const precios = skus.map(s => s.preco_venda || 0);
      const minPreco = Math.min(...precios);
      const maxPreco = Math.max(...precios);

      // Se o menor for igual ao maior (ou se for individual), mostra apenas um valor
      if (minPreco === maxPreco) {
        return `R$ ${minPreco.toFixed(2)}`;
      }

      // Se houver variação de preço
      return `(R$ ${minPreco.toFixed(2)}) - (R$ ${maxPreco.toFixed(2)})`;
    },
  },

  {
    title: 'Estoque Total',
    key: 'estoqueTotal',
    render: (_, record) => {
      const isFamily = checkIsFamily(record);
      const skus = record.skus || [];
      const total = skus.reduce((acc, sku) => acc + (sku.estoque || 0), 0);

      if (!isFamily && skus.length > 0) {
        const estoque = skus[0].estoque;
        return (
          <Text strong style={{ color: estoque === 0 ? '#cf1322' : 'inherit' }}>
            {estoque} {estoque === 0 && '(Esgotado)'}
          </Text>
        );
      }

      return <Text strong>{total}</Text>;
    },
  },
  {
    title: 'Status',
    key: 'statusGeral',
    render: (_, record) => {
      const skus = record.skus || [];
      const hasAtivo = skus.some(sku => sku.status === 'ATIVO');
      const hasSemEstoque = skus.some(sku => sku.status === 'Sem Estoque');

      if (hasAtivo) return <Tag color="green">Ativo</Tag>;
      if (hasSemEstoque) return <Tag color="orange">Sem Estoque</Tag>;
      return <Tag color="red">Inativo</Tag>;
    },
  },
  {
    title: 'Ações',
    key: 'action',
    width: '150px',
    render: (_, record) => {
      const isFamily = checkIsFamily(record);
      const isExpanded = expandedRowKeys.includes(record.key);
      const hasSkus = (record.skus || []).length > 0;

      return (
        <Space size="middle">
          {isFamily && (
            <Button 
              type="default" 
              size="small"
              icon={isExpanded ? <DownOutlined /> : <RightOutlined />}
              onClick={() => toggleExpand(record.key)}
              disabled={!hasSkus}
            >
              {isExpanded ? 'Fechar' : 'Ver SKUs'}
            </Button>
          )}

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
  }
];

  // SUBTABELA DE SKUS
  const expandedRowRender = (parentRecord: ItemParentType) => {
    const childColumns: ColumnsType<SkuChildType> = [
      { title: 'Código SKU', dataIndex: 'sku', key: 'sku' },
      { title: 'Produto', dataIndex: 'nome_item', key: 'nome_item' },
      { title: 'Especificação', dataIndex: 'variacao', key: 'variacao' },
      { title: 'Marca', dataIndex: 'marca', key: 'marca' },
      { title: 'Preço Venda', dataIndex: 'preco_venda', key: 'preco_venda', render: (v) => `R$ ${v.toFixed(2)}` },
      { 
        title: 'Estoque', 
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

  // FILTRAGEM LOCAL
  // FILTRAGEM LOCAL
const filteredData = React.useMemo(() => {
  return products.filter(item => {
    // 1. Busca textual (Nome ou SKU)
    const matchesSearch = 
      item.nome_item?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchText.toLowerCase());
    
    if (!matchesSearch) return false;

    const skus = item.skus || [];

    // 2. Filtro de estoque
    if (selectedFilter === 'noStock' && !skus.some(sku => sku.estoque === 0)) return false;
    if (selectedFilter === 'criticalStock' && !skus.some(sku => sku.estoque > 0 && sku.estoque <= 5)) return false;
    if (selectedFilter === 'activeSkus' && !skus.some(sku => sku.estoque > 0)) return false;

    // 3. Filtros Select
    if (selectedSupplier && !skus.some(sku => sku.marca?.toLowerCase() === selectedSupplier.toLowerCase())) return false;
    if (selectedCategory && String(item.categoria_id) !== selectedCategory) return false;

    // 4. Estrutura (Família vs Individual)
    const isFamily = checkIsFamily(item);

    if (selectedStructure === 'familia' && !isFamily) return false;
    if (selectedStructure === 'individual' && isFamily) return false;

    return true;
  });
}, [products, searchText, selectedFilter, selectedSupplier, selectedCategory, selectedStructure]);

  const handleClearAllFilters = () => {
  setSelectedFilter('all');
  setSelectedSupplier(undefined);
  setSelectedCategory(undefined);
  setSelectedStructure(undefined);
  setSearchText('');
  setExpandedRowKeys([]); // 👈 Adicione isso para evitar travamentos de renderização
};

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item onClick={() => window.history.back()} style={{ cursor: 'pointer' }}>Voltar</Breadcrumb.Item>
        <Breadcrumb.Item>Catálogo</Breadcrumb.Item>
        <Breadcrumb.Item>Gerenciador de Catálogo</Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
            <AppstoreOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
            Gerenciador de Catálogo
          </Title>
        </Col>
        <Col>
          <Space size="middle">
            <Button type="default" icon={<ImportOutlined />} onClick={() => message.info('Funcionalidade de importação ainda não implementada.')}>
              importar Json
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchProducts} loading={loading}>
              Atualizar
            </Button>
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
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setIsModalVisible(true)}>
              Adicionar Novo
            </Button>
          </Space>
        </Col>
      </Row>

      {/* PAINEL DE BATCH */}
      {showBatchPanel && creationBatch.length > 0 && (
        <Card 
          title="📋 Itens Aguardando Confirmação" 
          style={{ marginBottom: 24, border: '2px dashed #1890ff', background: '#e6f7ff' }}
          extra={
            <Button 
              type="primary" 
              loading={modalLoading}
              icon={<CheckCircleOutlined />} 
              onClick={handleConfirmEntireBatch}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              Salvar Todos no Banco ({creationBatch.length})
            </Button>
          }
        >
          <Alert 
            message="Produtos temporários na fila. Clique para persistir no banco de dados." 
            type="info" 
            showIcon 
            style={{ marginBottom: 16 }}
          />
          <Table
            size="small"
            pagination={false}
            dataSource={creationBatch}
            columns={[
              { title: 'SKU Master', dataIndex: 'sku', key: 'sku', render: (t) => <Text code>{t}</Text> },
              { title: 'Nome do Produto', dataIndex: 'nome_item', key: 'nome_item' },
              { title: 'Preço Venda', key: 'preco', render: (_, r) => `R$ ${(r.skus[0]?.preco_venda || 0).toFixed(2)}` },
              {
                title: 'Ações',
                key: 'remove',
                width: '100px',
                render: (_, record) => (
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeItemFromBatch(record.key)}>
                    Remover
                  </Button>
                )
              }
            ]}
          />
        </Card>
      )}

      {/* KPI CARDS */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable bodyStyle={{ padding: '16px' }} onClick={() => setSelectedFilter('all')}>
            <Statistic title="Total no Catálogo" value={products.length} prefix={<DatabaseOutlined style={{ color: '#1890ff' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable bodyStyle={{ padding: '16px' }} onClick={() => setSelectedFilter('activeSkus')}>
            <Statistic title="Itens com Estoque" value={products.filter(p => p.skus?.some(s => s.estoque > 0)).length} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable bodyStyle={{ padding: '16px' }} onClick={() => setSelectedFilter('noStock')}>
            <Statistic title="Sem Estoque" value={products.filter(p => p.skus?.some(s => s.estoque === 0)).length} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable bodyStyle={{ padding: '16px' }} onClick={() => setSelectedFilter('criticalStock')}>
            <Statistic title="Estoque Crítico (≤ 5)" value={products.filter(p => p.skus?.some(s => s.estoque > 0 && s.estoque <= 5)).length} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
      </Row>

      {/* LISTAGEM */}
      <Card 
        bordered={false} 
        title="📦 Catálogo Definitivo"
        extra={
          (selectedFilter !== 'all' || selectedSupplier || selectedCategory || selectedStructure || searchText) && (
            <Button type="dashed" danger icon={<ClearOutlined />} onClick={handleClearAllFilters}>
              Limpar Filtros
            </Button>
          )
        }
      >
        <Row style={{ marginBottom: '16px' }} gutter={[12, 12]} align="middle">
          <Col xs={24} sm={24} md={6}>
            <Input 
              placeholder="Buscar por Nome ou SKU..." 
              prefix={<SearchOutlined />} 
              value={searchText} 
              onChange={(e) => setSearchText(e.target.value)} 
              allowClear 
            />
          </Col>

          <Col xs={24} sm={24} md={7}>
            <Radio.Group 
              buttonStyle="solid" 
              value={selectedStructure || 'all_structures'} 
              onChange={(e) => {
                const val = e.target.value;
                setSelectedStructure(val === 'all_structures' ? undefined : val);
                setExpandedRowKeys([]); // 👈 LIMPE AS LINHAS EXPANDIDAS AQUI
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

          <Col xs={24} sm={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filtrar Categoria"
              allowClear
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value)}
              options={[
                { value: '7', label: 'Mangueiras (Cat 7)' },
                { value: '6', label: 'Correias (Cat 6)' },
              ]}
            />
          </Col>
        </Row>

        <Table 
  rowKey={(record) => record.key || `${record.id_item}-${record.sku}`} // 👈 Garante uma chave 100% única
  columns={parentColumns} 
  dataSource={filteredData} 
  loading={loading}
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