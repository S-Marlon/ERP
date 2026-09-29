import React, { useState } from 'react';
import { 
  Layout, 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Badge, 
  Typography, 
  Statistic, 
  Row, 
  Col, 
  Tooltip 
} from 'antd';
import { 
  ShoppingCartOutlined, 
  PrinterOutlined, 
  VideoCameraOutlined, 
  CheckCircleOutlined, 
  InboxOutlined, 
  BarcodeOutlined, 
  SettingOutlined, 
  ReloadOutlined 
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Content } = Layout;

// Interface de Exemplo para os Pedidos
interface Pedido {
  key: string;
  idPedido: string;
  cliente: string;
  itens: string;
  status: 'Aguardando Empacotamento' | 'Empacotando' | 'Enviado';
  valor: string;
}

export default function EcommerceScreen() {
  const [loading, setLoading] = useState<boolean>(false);

  // Dados fictícios para simular a fila da bancada
  const pedidosDataSource: Pedido[] = [
    { key: '1', idPedido: '#9821', cliente: 'Lucas Silva', itens: '1x Smartphone (Original)', status: 'Aguardando Empacotamento', valor: 'R$ 1.500,00' },
    { key: '2', idPedido: '#9822', cliente: 'Mariana Souza', itens: '2x Perfume Importado', status: 'Aguardando Empacotamento', valor: 'R$ 450,00' },
    { key: '3', idPedido: '#9823', cliente: 'Carlos Alberto', itens: '1x Relógio de Pulso', status: 'Empacotando', valor: 'R$ 890,00' },
  ];

  const colunasTabela = [
    {
      title: 'Pedido',
      dataIndex: 'idPedido',
      key: 'idPedido',
      render: (text: string) => <a>{text}</a>,
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente',
      key: 'cliente',
    },
    {
      title: 'Itens (Validação)',
      dataIndex: 'itens',
      key: 'itens',
    },
    {
      title: 'Valor',
      dataIndex: 'valor',
      key: 'valor',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = status === 'Enviado' ? 'green' : status === 'Empacotando' ? 'processing' : 'orange';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Ações na Bancada',
      key: 'acoes',
      render: (_: any, record: Pedido) => (
        <Space size="middle">
          {/* Função Ativa: Impressão de Etiqueta */}
          <Tooltip title="Imprimir Etiqueta de Envio">
            <Button type="primary" ghost icon={<PrinterOutlined />} size="small">
              Etiqueta
            </Button>
          </Tooltip>

          {/* Função Ativa: Iniciar Gravação/Validação por Vídeo */}
          <Tooltip title="Iniciar gravação da câmera para validação">
            <Button 
              type="primary" 
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }} 
              icon={<VideoCameraOutlined />} 
              size="small"
            >
              Gravar / Empacotar
            </Button>
          </Tooltip>

          {/* FUNÇÃO FUTURA (INATIVA / CINZA): Leitor de código de barras automatizado */}
          <Tooltip title="[Futuro] Validação automática por código de barras">
            <Button disabled icon={<BarcodeOutlined />} size="small">
              Conferir SKU
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <Content>
        {/* Cabeçalho da Tela */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              <ShoppingCartOutlined /> Central de Expedição (Bancada)
            </Title>
            <Text type="secondary">Gerencie o fluxo de embalagem, etiquetas e valide seus envios em vídeo.</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => setLoading(true)}>Atualizar Fila</Button>
            
            {/* FUNÇÃO FUTURA (INATIVA): Configurações avançadas do e-commerce */}
            <Button disabled icon={<SettingOutlined />}>Configurações</Button>
          </Space>
        </div>

        {/* Cards de Métricas Rápidas */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card bordered={false}>
              <Statistic title="Pedidos na Fila para Embalar" value={12} prefix={<InboxOutlined />} />
            </Card>
          </Col>
          <Col span={8}>
            <Card bordered={false}>
              <Statistic title="Empacotados Hoje" value={34} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col span={8}>
            {/* FUNÇÃO FUTURA (INATIVA): Estatísticas de devolução */}
            <Card bordered={false} style={{ opacity: 0.6 }}>
              <Tooltip title="[Futuro] Métrica de controle de contestações e devoluções">
                <Statistic title="Taxa de Devoluções (Futuro)" value="0.0%" valueStyle={{ color: '#8c8c8c' }} />
              </Tooltip>
            </Card>
          </Col>
        </Row>

        {/* Tabela Principal de Pedidos da Bancada */}
        <Card title="Fila de Separação e Empacotamento" bordered={false}>
          <Table 
            dataSource={pedidosDataSource} 
            columns={colunasTabela} 
            loading={loading}
            pagination={{ pageSize: 5 }}
          />
        </Card>
      </Content>
    </Layout>
  );
}