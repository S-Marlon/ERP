import React, { useState } from 'react';
import { 
  Table, 
  Card, 
  Statistic, 
  Row, 
  Col, 
  Tag, 
  Button, 
  Input, 
  Select, 
  Space, 
  Typography, 
  Tooltip,
  DatePicker
} from 'antd';
import { 
  DollarOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  WarningOutlined, 
  SearchOutlined, 
  FilterOutlined, 
  PrinterOutlined, 
  EyeOutlined,
  FileTextOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface TituloFaturado {
  key: string;
  idTitulo: number;
  numeroPedido: string;
  cliente: string;
  cnpjCpf: string;
  valorTotal: number;
  parcela: string;
  dataEmissao: string;
  dataVencimento: string;
  status: 'PENDENTE' | 'VENCIDO' | 'PAGO';
}

export const FinanceiroContasReceber: React.FC = () => {
  const [searchText, setSearchText] = useState('');

  // Dados fictícios estruturados para demonstrar o cenário de faturamento
  const dadosIniciais: TituloFaturado[] = [
    {
      key: '1',
      idTitulo: 1045,
      numeroPedido: 'PED-9821',
      cliente: 'Comercial Alvorada Ltda',
      cnpjCpf: '12.345.678/0001-99',
      valorTotal: 4500.00,
      parcela: '01/03',
      dataEmissao: '15/08/2026',
      dataVencimento: '15/09/2026',
      status: 'PENDENTE',
    },
    {
      key: '2',
      idTitulo: 1046,
      numeroPedido: 'PED-9821',
      cliente: 'Comercial Alvorada Ltda',
      cnpjCpf: '12.345.678/0001-99',
      valorTotal: 4500.00,
      parcela: '02/03',
      dataEmissao: '15/08/2026',
      dataVencimento: '15/10/2026',
      status: 'PENDENTE',
    },
    {
      key: '3',
      idTitulo: 1032,
      numeroPedido: 'PED-9750',
      cliente: 'Distribuidora São Paulo S.A.',
      cnpjCpf: '98.765.432/0001-10',
      valorTotal: 12850.50,
      parcela: '01/01',
      dataEmissao: '01/08/2026',
      dataVencimento: '30/08/2026',
      status: 'VENCIDO',
    },
    {
      key: '4',
      idTitulo: 1010,
      numeroPedido: 'PED-9612',
      cliente: 'Supermercados Bella Vista',
      cnpjCpf: '45.123.789/0001-55',
      valorTotal: 2300.00,
      parcela: '01/01',
      dataEmissao: '10/07/2026',
      dataVencimento: '10/08/2026',
      status: 'PAGO',
    }
  ];

  const colunas = [
    {
      title: 'ID / Pedido',
      key: 'pedido',
      render: (_: any, record: TituloFaturado) => (
        <Space direction="vertical" size={0}>
          <Text strong>Título #{record.idTitulo}</Text>
          <Tag color="blue" style={{ marginTop: 2 }}>{record.numeroPedido}</Tag>
        </Space>
      ),
    },
    {
      title: 'Cliente',
      key: 'cliente',
      render: (_: any, record: TituloFaturado) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.cliente}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.cnpjCpf}</Text>
        </Space>
      ),
    },
    {
      title: 'Parcela',
      dataIndex: 'parcela',
      key: 'parcela',
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: 'Valor (R$)',
      dataIndex: 'valorTotal',
      key: 'valorTotal',
      render: (val: number) => <Text strong style={{ color: '#262626' }}>R$ {val.toFixed(2)}</Text>,
    },
    {
      title: 'Emissão',
      dataIndex: 'dataEmissao',
      key: 'dataEmissao',
    },
    {
      title: 'Vencimento',
      dataIndex: 'dataVencimento',
      key: 'dataVencimento',
      render: (val: string, record: TituloFaturado) => (
        <Text type={record.status === 'VENCIDO' ? 'danger' : undefined} strong={record.status === 'VENCIDO'}>
          {val}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'geekblue';
        if (status === 'PAGO') color = 'success';
        if (status === 'VENCIDO') color = 'error';
        if (status === 'PENDENTE') color = 'warning';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Ações',
      key: 'acoes',
      render: () => (
        <Space size="small">
          {/* 🔒 Botões desativados conforme planejado */}
          <Tooltip title="Módulo em construção: Visualizar Detalhes">
            <Button size="small" icon={<EyeOutlined />} disabled />
          </Tooltip>
          <Tooltip title="Módulo em construção: Baixar Título (Receber)">
            <Button size="small" type="primary" ghost disabled>Baixar</Button>
          </Tooltip>
          <Tooltip title="Módulo em construção: Imprimir Boleto/Carnê">
            <Button size="small" icon={<PrinterOutlined />} disabled />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* Cabeçalho da Página */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>💰 Financeiro - Contas a Receber</Title>
          <Text type="secondary">Gestão de títulos gerados por pedidos faturados e prazos de pagamento.</Text>
        </div>
       <Space>
  <Button 
    type="primary" 
    icon={<FileTextOutlined />} 
  >
    <a href='/financeiro/faturamento'>Novo Lançamento Manual</a>
  </Button>
  
  <Button 
    icon={<DollarOutlined />} 
    disabled
  >
    Receber Pagamento
  </Button>
  
  <Button 
    icon={<PrinterOutlined />} 
    disabled
  >
    Imprimir Relatório
  </Button>
</Space>
      </div>

      {/* Cards de Indicadores (KPIs) */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card bordered={false} style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
            <Statistic 
              title="Total a Receber (Em Aberto)" 
              value={19250.50} 
              precision={2} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<DollarOutlined />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
            <Statistic 
              title="Títulos Vencidos" 
              value={12850.50} 
              precision={2} 
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
            <Statistic 
              title="Recebido no Mês" 
              value={2300.00} 
              precision={2} 
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
            <Statistic 
              title="Previsão Próximos 7 Dias" 
              value={9000.00} 
              precision={2} 
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />} 
            />
          </Card>
        </Col>
      </Row>

      {/* Barra de Filtros e Pesquisa */}
      <Card bordered={false} style={{ marginBottom: '16px', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input 
              placeholder="Pesquisar por cliente, pedido ou CNPJ..." 
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              disabled // Será ativado quando ligarmos a busca
            />
          </Col>
          <Col span={6}>
            <Select 
              defaultValue="TODOS" 
              style={{ width: '100%' }} 
              disabled 
              options={[
                { value: 'TODOS', label: 'Todos os Status' },
                { value: 'PENDENTE', label: 'Pendentes' },
                { value: 'VENCIDO', label: 'Vencidos' },
                { value: 'PAGO', label: 'Pagos' },
              ]}
            />
          </Col>
          <Col span={6}>
            <RangePicker style={{ width: '100%' }} disabled />
          </Col>
          <Col span={4} style={{ textAlign: 'right' }}>
            <Button icon={<FilterOutlined />} disabled>Filtrar</Button>
          </Col>
        </Row>
      </Card>

      {/* Tabela de Títulos Faturados */}
      <Card bordered={false} style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
        <Table 
          columns={colunas} 
          dataSource={dadosIniciais} 
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      </Card>
    </div>
  );
};