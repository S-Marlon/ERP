import React, { useState } from 'react';
import { ModalNovoPedido } from './ModalNovoPedido';
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
  Badge,
  message
} from 'antd';
import { 
  ShoppingCartOutlined, 
  CheckCircleOutlined, 
  SyncOutlined, 
  FileDoneOutlined, 
  SearchOutlined, 
  FilterOutlined, 
  EyeOutlined,
  PrinterOutlined,
  SendOutlined,
  LockOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface PedidoVenda {
  key: string;
  idPedido: number;
  numeroPedido: string;
  cliente: string;
  cnpjCpf: string;
  valorTotal: number;
  condicaoPagamento: string;
  dataPedido: string;
  statusCiclo: 'DIGITADO' | 'AGUARDANDO_CREDITO' | 'APROVADO' | 'SEPARADO' | 'FATURADO' | 'ENTREGUE';
  temNFe: boolean;
}

export const VendasFaturamento: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Lista de pedidos dinâmica para refletir inclusões
  const [pedidos, setPedidos] = useState<PedidoVenda[]>([
    {
      key: '1',
      idPedido: 9821,
      numeroPedido: 'PED-9821',
      cliente: 'Comercial Alvorada Ltda',
      cnpjCpf: '12.345.678/0001-99',
      valorTotal: 13500.00,
      condicaoPagamento: '30/60/90 Dias',
      dataPedido: '15/08/2026',
      statusCiclo: 'AGUARDANDO_CREDITO',
      temNFe: false,
    },
    {
      key: '2',
      idPedido: 9750,
      numeroPedido: 'PED-9750',
      cliente: 'Distribuidora São Paulo S.A.',
      cnpjCpf: '98.765.432/0001-10',
      valorTotal: 12850.50,
      condicaoPagamento: '30 Dias',
      dataPedido: '01/08/2026',
      statusCiclo: 'FATURADO',
      temNFe: true,
    },
    {
      key: '3',
      idPedido: 9612,
      numeroPedido: 'PED-9612',
      cliente: 'Supermercados Bella Vista',
      cnpjCpf: '45.123.789/0001-55',
      valorTotal: 2300.00,
      condicaoPagamento: 'À Vista / PIX',
      dataPedido: '10/07/2026',
      statusCiclo: 'ENTREGUE',
      temNFe: true,
    },
    {
      key: '4',
      idPedido: 9902,
      numeroPedido: 'PED-9902',
      cliente: 'Auto Peças Rodoserv Ltda',
      cnpjCpf: '11.222.333/0001-88',
      valorTotal: 5400.00,
      condicaoPagamento: '15/30 Dias',
      dataPedido: '02/09/2026',
      statusCiclo: 'DIGITADO',
      temNFe: false,
    }
  ]);

  // Helper para renderizar a Tag de acordo com o status do ciclo de vida
  const renderStatusTag = (status: string) => {
    switch (status) {
      case 'DIGITADO':
        return <Tag color="default">Digitado</Tag>;
      case 'AGUARDANDO_CREDITO':
        return <Tag color="warning" icon={<SyncOutlined spin />}>Aguardando Crédito</Tag>;
      case 'APROVADO':
        return <Tag color="processing">Aprovado (Reserva Ativa)</Tag>;
      case 'SEPARADO':
        return <Tag color="cyan">Separado no Estoque</Tag>;
      case 'FATURADO':
        return <Tag color="purple" icon={<FileDoneOutlined />}>Faturado (NF-e Emitida)</Tag>;
      case 'ENTREGUE':
        return <Tag color="success" icon={<CheckCircleOutlined />}>Entregue</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // Função chamada quando o modal salvar o novo pedido
  const handleSaveNovoPedido = (dadosNovoPedido: any) => {
    const novoRegistro: PedidoVenda = {
      key: String(Date.now()),
      idPedido: Math.floor(Math.random() * 10000),
      numeroPedido: `PED-${Math.floor(Math.random() * 10000)}`,
      cliente: 'Cliente Selecionado (Mock)', 
      cnpjCpf: '00.000.000/0001-00',
      valorTotal: dadosNovoPedido.valorTotal,
      condicaoPagamento: dadosNovoPedido.condicaoPagamento,
      dataPedido: new Date().toLocaleDateString('pt-BR'),
      statusCiclo: dadosNovoPedido.statusCiclo,
      temNFe: false,
    };

    setPedidos([novoRegistro, ...pedidos]);
    message.success('Pedido adicionado à listagem com sucesso!');
  };

  const colunas = [
    {
      title: 'Pedido',
      key: 'numeroPedido',
      render: (_: any, record: PedidoVenda) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.numeroPedido}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>ID: {record.idPedido}</Text>
        </Space>
      ),
    },
    {
      title: 'Cliente / CNPJ',
      key: 'cliente',
      render: (_: any, record: PedidoVenda) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.cliente}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.cnpjCpf}</Text>
        </Space>
      ),
    },
    {
      title: 'Valor Total',
      dataIndex: 'valorTotal',
      key: 'valorTotal',
      render: (val: number) => <Text strong style={{ color: '#262626' }}>R$ {val.toFixed(2)}</Text>,
    },
    {
      title: 'Condição',
      dataIndex: 'condicaoPagamento',
      key: 'condicaoPagamento',
      render: (val: string) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: 'Data',
      dataIndex: 'dataPedido',
      key: 'dataPedido',
    },
    {
      title: 'Status do Ciclo',
      dataIndex: 'statusCiclo',
      key: 'statusCiclo',
      render: (status: string) => renderStatusTag(status),
    },
    {
      title: 'NF-e',
      key: 'nfe',
      render: (_: any, record: PedidoVenda) => (
        record.temNFe ? 
          <Badge status="success" text="Emitida (SEFAZ)" /> : 
          <Badge status="default" text="Pendente" />
      ),
    },
    {
      title: 'Ações de Faturamento',
      key: 'acoes',
      render: () => (
        <Space size="small">
          <Tooltip title="Módulo em construção: Visualizar Itens e Detalhes">
            <Button size="small" icon={<EyeOutlined />} disabled />
          </Tooltip>
          <Tooltip title="Módulo em construção: Analisar e Liberar Crédito">
            <Button size="small" icon={<LockOutlined />} disabled />
          </Tooltip>
          <Tooltip title="Módulo em construção: Emitir Nota Fiscal (NF-e)">
            <Button size="small" type="primary" ghost icon={<SendOutlined />} disabled>Emitir NF-e</Button>
          </Tooltip>
          <Tooltip title="Módulo em construção: Imprimir DANFE / Boleto">
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
          <Title level={3} style={{ margin: 0 }}>📦 Vendas & Faturamento (Pedidos)</Title>
          <Text type="secondary">Controle do ciclo de vida de pedidos, análise de crédito, estoque e faturamento fiscal.</Text>
        </div>
        <Space>
          <Button 
            type="primary" 
            icon={<ShoppingCartOutlined />} 
            onClick={() => setIsModalOpen(true)}
          >
            Novo Pedido Faturado
          </Button>
        </Space>
      </div>

      {/* Cards de Indicadores do Faturamento */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card bordered={false} style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
            <Statistic 
              title="Aguardando Análise de Crédito" 
              value={1} 
              valueStyle={{ color: '#faad14' }}
              prefix={<SyncOutlined />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
            <Statistic 
              title="Pedidos Aprovados (Em Separação)" 
              value={2} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<ShoppingCartOutlined />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
            <Statistic 
              title="Faturados no Mês (NF-e)" 
              value={12850.50} 
              precision={2} 
              valueStyle={{ color: '#52c41a' }}
              prefix={<FileDoneOutlined />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
            <Statistic 
              title="Total de Pedidos do Período" 
              value={pedidos.length} 
              valueStyle={{ color: '#262626' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filtros */}
      <Card bordered={false} style={{ marginBottom: '16px', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input 
              placeholder="Pesquisar por número do pedido ou cliente..." 
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              disabled
            />
          </Col>
          <Col span={6}>
            <Select 
              defaultValue="TODOS" 
              style={{ width: '100%' }} 
              disabled 
              options={[
                { value: 'TODOS', label: 'Todos os Status do Ciclo' },
                { value: 'CREDITO', label: 'Aguardando Crédito' },
                { value: 'APROVADO', label: 'Aprovados' },
                { value: 'FATURADO', label: 'Faturados' },
              ]}
            />
          </Col>
          <Col span={6}>
            {/* Espaço reservado para filtro de datas */}
          </Col>
          <Col span={4} style={{ textAlign: 'right' }}>
            <Button icon={<FilterOutlined />} disabled>Filtrar</Button>
          </Col>
        </Row>
      </Card>

      {/* Tabela de Pedidos */}
      <Card bordered={false} style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
        <Table 
          columns={colunas} 
          dataSource={pedidos} 
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      </Card>

      {/* Modal de Novo Pedido Faturado */}
      <ModalNovoPedido 
        visible={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveNovoPedido} 
      />
    </div>
  );
};