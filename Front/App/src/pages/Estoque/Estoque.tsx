// src/pages/EstoquePage.tsx
import React, { useState, useContext } from "react";
import { 
  Row, 
  Col, 
  Card, 
  Statistic, 
  Button, 
  Space, 
  Typography, 
  Breadcrumb, 
  Table, 
  Input, 
  Select, 
  Radio, 
  Tag, 
  Tooltip,
  Progress,
  Badge
} from "antd";
import { 
  DashboardOutlined,
  PlusOutlined,
  FolderOutlined,
  TagsOutlined,
  FileTextOutlined,
  BarChartOutlined,
  BarcodeOutlined,
  SearchOutlined,
  ClearOutlined,
  ArrowUpOutlined,
  ClusterOutlined,
  UnorderedListOutlined,
  BoxPlotOutlined,
  AlertOutlined
} from "@ant-design/icons";
import { ProductContext } from "../../context/ProductContext";
import { Product } from "../../types/types";

const { Title, Text } = Typography;

// Tipos para os filtros inteligentes dos Cards superiores
type StockFilterType = 'all' | 'critical' | 'noStock' | 'surplus';
type StructureFilterType = 'all' | 'family' | 'individual';

export default function EstoquePage() {
  // Consumindo o contexto atual do seu ERP
  const { products } = useContext(ProductContext)!;

  // 1. ESTADOS DOS FILTROS INTELIGENTES
  const [searchText, setSearchText] = useState("");
  const [stockCardFilter, setStockCardFilter] = useState<StockFilterType>('all');
  const [structureFilter, setStructureFilter] = useState<StructureFilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);

  // 2. CÁLCULOS DOS CARDS DE MÉTRICAS (MOCK SUCESSOR COM BASE NOS SEUS PRODUTOS)
  const totalStockValue = products.reduce((acc, p) => acc + ((p as any).quantidade * (p as any).preco || 0), 0) || 142580.40;
  const criticalItemsCount = products.filter(p => (p as any).quantidade <= 5 && (p as any).quantidade > 0).length || 8;
  const noStockItemsCount = products.filter(p => (p as any).quantidade === 0).length || 3;

  // 3. EVENTO PARA LIMPAR FILTROS
  const handleClearAllFilters = () => {
    setSearchText("");
    setStockCardFilter('all');
    setStructureFilter('all');
    setSelectedCategory(undefined);
    setSelectedGroup(undefined);
  };

  // 4. MOTOR DE FILTRAGEM COMBINADA (INTELIGENTE)
  const filteredProducts = products.filter(product => {
    // Busca por Texto (Nome ou Código)
    const matchesSearch = product.nome?.toLowerCase().includes(searchText.toLowerCase()) ||
                          product.id?.toString().includes(searchText);
    if (!matchesSearch) return false;

    // Filtro por Categoria e Grupo
    if (selectedCategory && (product as any).categoria !== selectedCategory) return false;
    if (selectedGroup && (product as any).grupo !== selectedGroup) return false;

    // Filtro por Estrutura (Botões de Rádio)
    const isFamily = (product as any).skus?.length > 1;
    if (structureFilter === 'family' && !isFamily) return false;
    if (structureFilter === 'individual' && isFamily) return false;

    // Filtro dos Cards Superiores
    const currentStock = (product as any).quantidade || 0;
    if (stockCardFilter === 'critical' && (currentStock > 5 || currentStock === 0)) return false;
    if (stockCardFilter === 'noStock' && currentStock > 0) return false;
    if (stockCardFilter === 'surplus' && currentStock < 100) return false;

    return true;
  });

  // Configuração das Colunas da Grid Principal
  const columns = [
    {
      title: 'Cód / SKU Base',
      dataIndex: 'id',
      key: 'id',
      render: (id: any) => <Text code strong>{id}</Text>
    },
    {
      title: 'Nome do Produto',
      dataIndex: 'nome',
      key: 'nome',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Categoria',
      dataIndex: 'categoria',
      key: 'categoria',
      render: (cat: string) => <Tag color="blue">{cat || 'Geral'}</Tag>
    },
    {
      title: 'Qtd. Físico',
      dataIndex: 'quantidade',
      key: 'quantidade',
      render: (qtd: number) => {
        const val = qtd ?? 0;
        let color = '#52c41a';
        if (val === 0) color = '#ff4d4f';
        else if (val <= 5) color = '#fa8c16';
        return <Text style={{ color, fontWeight: 'bold' }}>{val} un</Text>;
      }
    },
    {
      title: 'Preço Venda',
      dataIndex: 'preco',
      key: 'preco',
      render: (preco: number) => `R$ ${(preco || 0).toFixed(2)}`
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: Product) => {
        const qtd = (record as any).quantidade || 0;
        if (qtd === 0) return <Badge status="error" text="Sem Estoque" />;
        if (qtd <= 5) return <Badge status="warning" text="Crítico" />;
        return <Badge status="success" text="Saudável" />;
      }
    }
  ];

  // Estilos inline utilitários para os cards selecionáveis
  const getCardStyle = (type: StockFilterType, activeColor: string) => ({
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: stockCardFilter === type ? `2px solid ${activeColor}` : '2px solid transparent',
    boxShadow: stockCardFilter === type ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
    transform: stockCardFilter === type ? 'translateY(-2px)' : 'none',
  });

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      
      {/* 1. NAVEGAÇÃO / BREADCRUMB */}
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>ERP Central</Breadcrumb.Item>
        <Breadcrumb.Item>Estoque</Breadcrumb.Item>
        <Breadcrumb.Item>Dashboard Global</Breadcrumb.Item>
      </Breadcrumb>

      {/* 2. HEADER DA PÁGINA */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
            <DashboardOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
            Cockpit de Gestão de Estoque
          </Title>
          <Text type="secondary">Visão geral em tempo real, auditoria e inteligência de compras</Text>
        </Col>
      </Row>

      {/* Substitua os botões do Menu Operacional Avançado por esta estrutura limpa de links para o futuro */}
<Row gutter={[12, 12]}>
  <Col xs={24} sm={12} md={6} lg={4}>
    {/* Nota: Mudamos de Novo Produto para Nova Movimentação, já que produto é no Catálogo */}
    <Button type="primary" block icon={<PlusOutlined />} href="/estoque/movimentacao/novo">Ajuste de Saldo</Button>
  </Col>
  <Col xs={24} sm={12} md={6} lg={4}>
    <Button block icon={<ClusterOutlined />} href="/estoque/depositos">Múltiplos Depósitos</Button>
  </Col>
  <Col xs={24} sm={12} md={6} lg={4}>
    <Button type="dashed" danger block icon={<FileTextOutlined />} href="/estoque/notas/importar-xml">Importar XML (NF-e)</Button>
  </Col>
  <Col xs={24} sm={12} md={6} lg={4}>
    <Button block icon={<FileTextOutlined />} href="/estoque/notas">Histórico de Notas</Button>
  </Col>
  <Col xs={24} sm={12} md={6} lg={4}>
    <Button block icon={<BarChartOutlined />} href="/estoque/analise-abc">Curva ABC & Giro</Button>
  </Col>
  <Col xs={24} sm={12} md={6} lg={4}>
    <Button block icon={<BarcodeOutlined />} href="/estoque/etiquetagem">Etiquetagem térmica</Button>
  </Col>
</Row>

      {/* 3. MENU DE AÇÕES RÁPIDAS (Seus botões antigos refatorados de forma corporativa e moderna) */}
      <Card title="⚡ Menu Operacional Avançado" size="small" style={{ marginBottom: '24px' }} bodyStyle={{ padding: '16px' }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6} lg={3}>
            <Button type="primary" block icon={<PlusOutlined />} href="/Estoque/consulta">Novo Produto</Button>
          </Col>
          <Col xs={24} sm={12} md={6} lg={3}>
            <Button block icon={<ClusterOutlined />} href="/Estoque/grupos">Ver Grupos</Button>
          </Col>
          <Col xs={24} sm={12} md={6} lg={3}>
            <Button block icon={<FolderOutlined />} href="/Estoque/categorias">Categorias</Button>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Button type="dashed" danger block icon={<FileTextOutlined />} href="/Estoque/gerenciamento">Entrada de Nota (NF-e)</Button>
          </Col>
          <Col xs={24} sm={12} md={6} lg={3}>
            <Button block icon={<FileTextOutlined />} href="/Estoque/notas">Notas Fiscais</Button>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Button block icon={<BarChartOutlined />} href="/Estoque/operacoes">Relatórios & Análise</Button>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Button block icon={<BarcodeOutlined />} href="/Estoque/etiquetagem">Etiquetagem</Button>
          </Col>
        </Row>
      </Card>

      {/* 4. CARDS DE KPI DE ALTA PERFORMANCE (Filtros Inteligentes) */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={getCardStyle('all', '#1890ff')} onClick={() => setStockCardFilter('all')}>
            <Statistic 
              title="Patrimônio Total Armazenado" 
              value={totalStockValue} 
              precision={2} 
              prefix="R$" 
              valueStyle={{ color: '#1890ff' }}
            />
            <Progress percent={100} size="small" status="active" showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={getCardStyle('critical', '#fa8c16')} onClick={() => setStockCardFilter('critical')}>
            <Statistic 
              title="Itens em Estoque Crítico" 
              value={criticalItemsCount} 
              prefix={<AlertOutlined />} 
              valueStyle={{ color: '#fa8c16' }}
            />
            <Text type="danger" style={{ fontSize: '12px' }}>Abaixo do ponto de pedido</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={getCardStyle('noStock', '#ff4d4f')} onClick={() => setStockCardFilter('noStock')}>
            <Statistic 
              title="Ruptura de Estoque (Zerados)" 
              value={noStockItemsCount} 
              valueStyle={{ color: '#ff4d4f' }}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>Vendas bloqueadas no canal</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={getCardStyle('surplus', '#722ed1')} onClick={() => setStockCardFilter('surplus')}>
            <Statistic 
              title="Excesso de Capital Parado" 
              value={2} 
              valueStyle={{ color: '#722ed1' }} 
              suffix="itens"
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>Giro abaixo da média esperada</Text>
          </Card>
        </Col>
      </Row>

      {/* 5. LISTAGEM CENTRAL COM FILTRAGEM MULTI-NÍVEL */}
      <Card 
        title="📋 Auditoria e Inventário Geral" 
        bordered={false}
        extra={
          (searchText || stockCardFilter !== 'all' || structureFilter !== 'all' || selectedCategory || selectedGroup) && (
            <Button type="dashed" danger icon={<ClearOutlined />} onClick={handleClearAllFilters}>
              Resetar Painel de Filtros
            </Button>
          )
        }
      >
        {/* Barra Integrada de Filtros Avançados */}
        <Row gutter={[12, 12]} style={{ marginBottom: '24px' }} align="middle">
          <Col xs={24} sm={24} md={6}>
            <Input 
              placeholder="Buscar por Nome ou Cód. Item..." 
              prefix={<SearchOutlined />} 
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          
          <Col xs={24} sm={12} md={5}>
            <Select 
              style={{ width: '100%' }} 
              placeholder="Filtrar Categoria" 
              allowClear
              value={selectedCategory}
              onChange={(v) => setSelectedCategory(v)}
              options={[
                { value: 'Industrial', label: 'Industrial' },
                { value: 'Vestuário', label: 'Vestuário' },
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={5}>
            <Select 
              style={{ width: '100%' }} 
              placeholder="Filtrar por Grupo" 
              allowClear
              value={selectedGroup}
              onChange={(v) => setSelectedGroup(v)}
              options={[
                { value: 'Ferramentas', label: 'Ferramentas' },
                { value: 'Textil', label: 'Têxtil' },
              ]}
            />
          </Col>

          {/* Botões do Tipo de Estrutura do Item */}
          <Col xs={24} sm={24} md={8}>
            <Radio.Group 
              buttonStyle="solid" 
              style={{ width: '100%', display: 'flex' }}
              value={structureFilter}
              onChange={(e) => setStructureFilter(e.target.value)}
            >
              <Radio.Button value="all" style={{ flex: 1, textAlign: 'center' }}><UnorderedListOutlined /> Todos</Radio.Button>
              <Radio.Button value="family" style={{ flex: 1, textAlign: 'center' }}><ClusterOutlined /> Famílias</Radio.Button>
              <Radio.Button value="individual" style={{ flex: 1, textAlign: 'center' }}><BoxPlotOutlined /> Individuais</Radio.Button>
            </Radio.Group>
          </Col>
        </Row>

        {/* Feedback Dinâmico por Tags das Operações Ativas */}
        {(stockCardFilter !== 'all' || structureFilter !== 'all' || selectedCategory || selectedGroup) && (
          <div style={{ marginBottom: '16px' }}>
            <Space size="small" wrap>
              <Text type="secondary">Segmentação Atual:</Text>
              {stockCardFilter !== 'all' && (
                <Tag color="orange" closable onClose={() => setStockCardFilter('all')}>
                  Estoque: <strong>{stockCardFilter}</strong>
                </Tag>
              )}
              {structureFilter !== 'all' && (
                <Tag color="purple" closable onClose={() => setStructureFilter('all')}>
                  Estrutura: <strong>{structureFilter === 'family' ? 'Com Grade' : 'Sem Grade'}</strong>
                </Tag>
              )}
              {selectedCategory && (
                <Tag color="blue" closable onClose={() => setSelectedCategory(undefined)}>
                  Categoria: <strong>{selectedCategory}</strong>
                </Tag>
              )}
            </Space>
          </div>
        )}

        {/* Tabela de Produtos Consolidada */}
        <Table 
          dataSource={filteredProducts} 
          columns={columns} 
          rowKey="id"
          pagination={{ pageSize: 8, showSizeChanger: true }}
          bordered
          size="middle"
        />
      </Card>
    </div>
  );
}