import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Button, 
  Card, 
  Table, 
  Tag, 
  Row, 
  Col, 
  Statistic, 
  Typography, 
  Divider, 
  Space 
} from 'antd';
import { 
  FileTextOutlined, 
  TeamOutlined, 
  LockOutlined, 
  ShoppingOutlined, 
  DollarCircleOutlined, 
  CarOutlined,
  ArrowRightOutlined,
  ContainerOutlined,
  PieChartOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function ComprasDashboard() {
  const navigate = useNavigate();

  // 🔌 Ações Prontas
  const handleNovaNFe = () => {
    navigate('/compras/entrada-nfe');
  };

  const handleGerenciarFornecedores = () => {
    navigate('/compras/fornecedores'); // Rota correta mapeada para o módulo de Pessoas/CRM
  };

  // 📝 Dados Fictícios para a Tabela de Demonstração
  const dataSource = [
    {
      key: '1',
      codigo: '#00124',
      fornecedor: 'Distribuidora Fictícia Ltda',
      data: '05/06/2026',
      status: 'PENDENTE',
      valor: 'R$ 1.250,00',
    },
    {
      key: '2',
      codigo: '#00123',
      fornecedor: 'Indústria de Alimentos Exemplo',
      data: '04/06/2026',
      status: 'RECEBIDO',
      valor: 'R$ 14.800,00',
    },
  ];

  const columns = [
    { title: 'Cód.', dataIndex: 'codigo', key: 'codigo' },
    { title: 'Fornecedor', dataIndex: 'fornecedor', key: 'fornecedor' },
    { title: 'Data', dataIndex: 'data', key: 'data' },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'RECEBIDO' ? 'success' : 'warning'}>{status}</Tag>
      )
    },
    { title: 'Valor', dataIndex: 'valor', key: 'valor' },
  ];

  // 🔒 Estilo reutilizável para simular o bloqueio de módulos futuros
  const lockedCardStyle: React.CSSProperties = {
    position: 'relative',
    opacity: 0.4,
    cursor: 'not-allowed',
    userSelect: 'none',
    overflow: 'hidden'
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    fontWeight: 'bold',
    color: '#555'
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      
      {/* 🖥️ Cabeçalho do Módulo */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>Módulo de Suprimentos & Compras</Title>
          <Text type="secondary">Painel de controle técnico para recebimento de cargas, notas fiscais e visões de fornecedores.</Text>
        </Col>
        <Col>
          <Tag color="blue" style={{ padding: '4px 8px', fontWeight: 'bold' }}>AMBIENTE: PRODUÇÃO</Tag>
        </Col>
      </Row>

      <Divider />

      {/* ⚡ Seção de Operações Ativas e Prontas */}
      <Title level={4} style={{ marginBottom: '16px' }}>Partições Ativas do Banco de Dados</Title>
      <Row gap={[16, 16]} gutter={16} style={{ marginBottom: '32px' }}>
        
        {/* Card 1: Entrada de Nota */}
        <Col xs={24} md={12}>
          <Card 
            title={<span><FileTextOutlined /> Recebimento de Cargas</span>} 
            bordered={false}
            style={{ borderLeft: '6px solid #1677ff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
          >
            <Paragraph>Inicie a esteira de suprimentos importando o arquivo XML diretamente da NF-e emitida pelo fornecedor.</Paragraph>
            <Button type="primary" icon={<FileTextOutlined />} onClick={handleNovaNFe} block>
              Dar Entrada em NF-e (XML)
            </Button>
          </Card>
        </Col>

        {/* Card 2: Visão de Fornecedores */}
        <Col xs={24} md={12}>
          <Card 
            title={<span><TeamOutlined /> Cadastro Master de Fornecedores</span>} 
            bordered={false}
            style={{ borderLeft: '6px solid #52c41a', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
          >
            <Paragraph>Visualize a lista de parceiros ativos/inativos, analise documentos e realize novos cadastros de PJ/PF.</Paragraph>
            <Button type="default" icon={<TeamOutlined />} onClick={handleGerenciarFornecedores} block>
              Gerenciar Fornecedores (Core Pessoas)
            </Button>
          </Card>
        </Col>
      </Row>

      {/* 📊 Indicadores Rápidos (Com aspecto demonstrativo/Aguardando Backend) */}
      <Title level={4} style={{ marginBottom: '16px' }}>Indicadores de Compras (Demonstrativo)</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ opacity: 0.7 }} size="small">
            <Statistic title="Pedidos em Aberto" value={12} prefix={<ShoppingOutlined />} />
            <Text type="secondary" style={{ fontSize: '11px' }}>Aguardando fila API</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ opacity: 0.7 }} size="small">
            <Statistic title="Total Comprado (Mês)" value={45200.00} precision={2} prefix={<DollarCircleOutlined />} />
            <Text type="secondary" style={{ fontSize: '11px' }}>Aguardando fila API</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ opacity: 0.7 }} size="small">
            <Statistic title="Fornecedores Homologados" value={84} prefix={<TeamOutlined />} />
            <Text type="secondary" style={{ fontSize: '11px' }}>Sincronizado com Core</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ opacity: 0.7 }} size="small">
            <Statistic title="Aguardando Entrega" value={5} prefix={<CarOutlined />} />
            <Text type="secondary" style={{ fontSize: '11px' }}>Fila logística pendente</Text>
          </Card>
        </Col>
      </Row>

      {/* 🚧 Pipeline e Recursos do Roadmap (Bloqueados) */}
      <Title level={4} style={{ marginBottom: '16px' }}>Roadmap de Engenharia (Pipeline Compras)</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
        
        <Col xs={24} sm={8}>
          <Card style={lockedCardStyle} title="Motor de Cotações Inteligente" size="small">
            <div style={overlayStyle}>
              <LockOutlined style={{ fontSize: '20px', marginBottom: '4px' }} />
              <span style={{ fontSize: '12px' }}>BACKLOG V3</span>
            </div>
            <Paragraph style={{ fontSize: '12px', margin: 0 }}>Disparo automático de planilhas de preço para múltiplos fornecedores simultâneos.</Paragraph>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card style={lockedCardStyle} title="Controle de Ordens de Compra (O.C)" size="small">
            <div style={overlayStyle}>
              <LockOutlined style={{ fontSize: '20px', marginBottom: '4px' }} />
              <span style={{ fontSize: '12px' }}>PLANEJADO</span>
            </div>
            <Paragraph style={{ fontSize: '12px', margin: 0 }}>Workflow completo de autorização de compras por alçada e centro de custo.</Paragraph>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card style={lockedCardStyle} title="Dashboard de Curva ABC / Lead Time" size="small">
            <div style={overlayStyle}>
              <LockOutlined style={{ fontSize: '20px', marginBottom: '4px' }} />
              <span style={{ fontSize: '12px' }}>ESTUDO DE REQUISITO</span>
            </div>
            <Paragraph style={{ fontSize: '12px', margin: 0 }}>Métricas inteligentes calculando o tempo exato de entrega do fornecedor vs. ruptura.</Paragraph>
          </Card>
        </Col>

      </Row>

      {/* 📄 Tabela Informativa Provisória */}
      <Card title="Últimas Ordens de Compra Registradas" bordered={false} style={{ opacity: 0.7 }}>
        <Table 
          dataSource={dataSource} 
          columns={columns} 
          pagination={false} 
          size="small"
        />
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>⚠️ Amostra estática baseada nas definições de schema do banco de dados.</Text>
        </div>
      </Card>

    </div>
  );
}