import React, { useState } from 'react';
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
  Space,
  Modal,
  Form,
  Input,
  message
} from 'antd';
import { 
  FileTextOutlined, 
  TeamOutlined, 
  LockOutlined, 
  ShoppingOutlined, 
  DollarCircleOutlined, 
  CarOutlined,
  PlusOutlined,
  FileSyncOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function ComprasDashboard() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 🔌 Ações Prontas
  const handleNovaNFe = () => {
    navigate('/compras/entrada-nfe');
  };

  const handleGerenciarFornecedores = () => {
    navigate('/compras/fornecedores'); 
  };

  const handleCriarRequisicao = () => {
    setIsModalOpen(true);
  };

  const handleOkRequisicao = () => {
    form.validateFields().then(values => {
      console.log('Nova Requisição:', values);
      message.success('Requisição de compra criada com sucesso!');
      setIsModalOpen(false);
      form.resetFields();
    }).catch(info => {
      console.log('Validate Failed:', info);
    });
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
          <Text type="secondary">Painel de controle unificado para requisições, recebimento de cargas e gestão de fornecedores.</Text>
        </Col>
        <Col>
          <Tag color="blue" style={{ padding: '4px 8px', fontWeight: 'bold' }}>AMBIENTE: PRODUÇÃO</Tag>
        </Col>
      </Row>

      <Divider />

      {/* ⚡ Seção de Operações Ativas e Prontas */}
      <Title level={4} style={{ marginBottom: '16px' }}>Partições Operacionais Ativas</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
        
        {/* Card 1: Nova Requisição de Compra */}
        <Col xs={24} md={8}>
          <Card 
            title={<span><ShoppingOutlined /> Requisições Internas</span>} 
            bordered={false}
            style={{ borderLeft: '6px solid #faad14', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: '100%' }}
          >
            <Paragraph>Solicite materiais ou insumos internamente para aprovação dos gestores de centros de custo.</Paragraph>
            
            <a href="/compras/ListaCompras">
              <Button type="default" icon={<PlusOutlined />}  block>
                Nova Requisição de Compra
              </Button>
            </a>
          </Card>
        </Col>

        {/* Card 2: Entrada de Nota */}
        <Col xs={24} md={8}>
          <Card 
            title={<span><FileTextOutlined /> Recebimento de Cargas</span>} 
            bordered={false}
            style={{ borderLeft: '6px solid #1677ff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: '100%' }}
          >
            <Paragraph>Inicie a esteira de suprimentos importando o arquivo XML diretamente da NF-e do fornecedor.</Paragraph>
            <Button type="primary" icon={<FileTextOutlined />} onClick={handleNovaNFe} block>
              Dar Entrada em NF-e (XML)
            </Button>
          </Card>
        </Col>

        {/* Card 3: Visão de Fornecedores */}
        <Col xs={24} md={8}>
          <Card 
            title={<span><TeamOutlined /> Cadastro Master de Fornecedores</span>} 
            bordered={false}
            style={{ borderLeft: '6px solid #52c41a', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: '100%' }}
          >
            <Paragraph>Visualize parceiros ativos, analise documentos fiscais e realize novos cadastros de PJ/PF.</Paragraph>
            <Button type="default" icon={<TeamOutlined />} onClick={handleGerenciarFornecedores} block>
              Gerenciar Fornecedores
            </Button>
          </Card>
        </Col>
      </Row>

      {/* 📊 Indicadores Rápidos */}
      <Title level={4} style={{ marginBottom: '16px' }}>Indicadores de Compras</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} size="small" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <Statistic title="Pedidos em Aberto" value={12} prefix={<ShoppingOutlined />} />
            <Text type="secondary" style={{ fontSize: '11px' }}>Aguardando faturamento</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} size="small" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <Statistic title="Total Comprado (Mês)" value={45200.00} precision={2} prefix={<DollarCircleOutlined />} />
            <Text type="secondary" style={{ fontSize: '11px' }}>Fechamento parcial</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} size="small" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <Statistic title="Fornecedores Homologados" value={84} prefix={<TeamOutlined />} />
            <Text type="secondary" style={{ fontSize: '11px' }}>Sincronizado com Core</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} size="small" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <Statistic title="Aguardando Entrega" value={5} prefix={<CarOutlined />} />
            <Text type="secondary" style={{ fontSize: '11px' }}>Logística em trânsito</Text>
          </Card>
        </Col>
      </Row>

      {/* 🚧 Pipeline e Recursos do Roadmap (Bloqueados) */}
      <Title level={4} style={{ marginBottom: '16px' }}>Roadmap de Engenharia (Pipeline Compras)</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
        <Col xs={24} sm={8}>
          <Card style={lockedCardStyle} title="Motor de Cotações (RFQ)" size="small">
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
            <Paragraph style={{ fontSize: '12px', margin: 0 }}>Métricas inteligentes calculando o tempo exato de entrega vs. ruptura.</Paragraph>
          </Card>
        </Col>
      </Row>

      {/* 📄 Tabela Informativa Provisória */}
      <Card title="Últimas Ordens de Compra Registradas" bordered={false}>
        <Table 
          dataSource={dataSource} 
          columns={columns} 
          pagination={false} 
          size="small"
        />
      </Card>

      {/* Modal de Exemplo para Nova Requisição */}
      <Modal
        title="Criar Requisição Interna de Compra"
        open={isModalOpen}
        onOk={handleOkRequisicao}
        onCancel={() => setIsModalOpen(false)}
        okText="Salvar Requisição"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" name="form_requisicao">
          <Form.Item 
            name="item" 
            label="Item / Insumo Desejado" 
            rules={[{ required: true, message: 'Informe o item desejado!' }]}
          >
            <Input placeholder="Ex: Bobina de Papel Térmico / Luvas de Procedimento" />
          </Form.Item>
          <Form.Item 
            name="quantidade" 
            label="Quantidade" 
            rules={[{ required: true, message: 'Informe a quantidade!' }]}
          >
            <Input type="number" placeholder="Ex: 50" />
          </Form.Item>
          <Form.Item 
            name="justificativa" 
            label="Justificativa / Centro de Custo"
          >
            <Input.TextArea placeholder="Informe o motivo da compra ou centro de custo responsável" />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
}