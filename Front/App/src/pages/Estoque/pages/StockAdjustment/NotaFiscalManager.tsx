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
  Tabs, 
  Modal, 
  message, 
  Badge,
  Steps
} from 'antd';
import { 
  FileTextOutlined, 
  SearchOutlined, 
  PlusOutlined, 
  PrinterOutlined, 
  SendOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined, 
  ReloadOutlined,
  CloudUploadOutlined,
  EyeOutlined
} from '@ant-design/icons';

import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

// Tipagem base para as Notas Fiscais
interface NotaFiscalType {
  key: string;
  id_nf: number;
  numero: string | null;
  serie: string;
  tipo: 'NFe' | 'NFSe'; // Produto ou Serviço
  cliente: string;
  documentoCliente: string;
  valorTotal: number;
  dataEmissao: string;
  status: 'RASCUNHO' | 'AUTORIZADA' | 'REJEITADA' | 'CANCELADA';
  chaveAcesso?: string;
}

export default function NotaFiscalManager() {
  const [activeTab, setActiveTab] = useState('1');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados de modais e ações
  const [isEmitirModalVisible, setIsEmitirModalVisible] = useState(false);
  const [selectedNf, setSelectedNf] = useState<NotaFiscalType | null>(null);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);

  // Dados Mockados Iniciais do Núcleo
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscalType[]>([
    {
      key: '1',
      id_nf: 1001,
      numero: '000.012.450',
      serie: '1',
      tipo: 'NFe',
      cliente: 'Auto Mecânica São José Ltda',
      documentoCliente: '45.123.789/0001-10',
      valorTotal: 1450.00,
      dataEmissao: '2026-06-05 14:20',
      status: 'AUTORIZADA',
      chaveAcesso: '35260645123789000110550010000124501198234567'
    },
    {
      key: '2',
      id_nf: 1002,
      numero: null,
      serie: '1',
      tipo: 'NFe',
      cliente: 'Frota Express Transportes',
      documentoCliente: '12.987.456/0001-99',
      valorTotal: 3890.50,
      dataEmissao: '2026-06-05 15:00',
      status: 'RASCUNHO'
    },
    {
      key: '3',
      id_nf: 1003,
      numero: null,
      serie: '2',
      tipo: 'NFSe',
      cliente: 'João Carlos da Silva',
      documentoCliente: '321.654.987-12',
      valorTotal: 600.00,
      dataEmissao: '2026-06-04 10:15',
      status: 'REJEITADA'
    }
  ]);

  const handleTransmitirSefaz = (record: NotaFiscalType) => {
    setLoading(true);
    setTimeout(() => {
      setNotasFiscais(prev => prev.map(item => {
        if (item.id_nf === record.id_nf) {
          return {
            ...item,
            status: 'AUTORIZADA',
            numero: `000.012.${Math.floor(100 + Math.random() * 900)}`,
            chaveAcesso: `352606451237890001105500100001${Math.floor(100000 + Math.random() * 900000)}`
          };
        }
        return item;
      }));
      setLoading(false);
      message.success(`NF-e #${record.id_nf} autorizada com sucesso pela SEFAZ!`);
    }, 1500);
  };

  const handleImprimirDanfe = (record: NotaFiscalType) => {
    if (record.status !== 'AUTORIZADA') {
      message.warning('Apenas notas autorizadas podem gerar DANFE para impressão.');
      return;
    }
    message.loading({ content: 'Gerando PDF da DANFE...', key: 'print' });
    setTimeout(() => {
      message.success({ content: 'DANFE gerada com sucesso! Abrindo visualização...', key: 'print', duration: 2 });
      // Aqui integraria com window.open(urlPdfDanfe)
    }, 1000);
  };

  const columns: ColumnsType<NotaFiscalType> = [
    {
      title: 'NF / Série',
      key: 'numero',
      render: (_, record) => (
        record.numero ? (
          <Text strong code>{record.numero} (Série {record.serie})</Text>
        ) : (
          <Tag color="default">Rascunho / Sem Número</Tag>
        )
      )
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      render: (tipo) => <Tag color={tipo === 'NFe' ? 'blue' : 'purple'}>{tipo}</Tag>
    },
    {
      title: 'Cliente / Tomador',
      dataIndex: 'cliente',
      key: 'cliente',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '11px' }}>{record.documentoCliente}</Text>
        </div>
      )
    },
    {
      title: 'Valor Total',
      dataIndex: 'valorTotal',
      key: 'valorTotal',
      render: (val) => <Text strong>R$ {val.toFixed(2)}</Text>
    },
    {
      title: 'Data Emissão',
      dataIndex: 'dataEmissao',
      key: 'dataEmissao'
    },
    {
      title: 'Status SEFAZ',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors: Record<string, { color: string; icon: React.ReactNode }> = {
          AUTORIZADA: { color: 'success', icon: <CheckCircleOutlined /> },
          RASCUNHO: { color: 'default', icon: <ClockCircleOutlined /> },
          REJEITADA: { color: 'error', icon: <CloseCircleOutlined /> },
          CANCELADA: { color: 'warning', icon: <CloseCircleOutlined /> }
        };
        const config = colors[status] || { color: 'default', icon: null };
        return <Tag icon={config.icon} color={config.color}>{status}</Tag>;
      }
    },
    {
      title: 'Ações Fiscais',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="text" 
            icon={<EyeOutlined />} 
            onClick={() => {
              setSelectedNf(record);
              setIsDetailsModalVisible(true);
            }}
          >
            Detalhes
          </Button>

          {record.status === 'RASCUNHO' || record.status === 'REJEITADA' ? (
            <Button 
              type="primary" 
              size="small" 
              icon={<SendOutlined />} 
              loading={loading}
              onClick={() => handleTransmitirSefaz(record)}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              Transmitir
            </Button>
          ) : (
            <Button 
              type="default" 
              size="small" 
              icon={<PrinterOutlined />} 
              onClick={() => handleImprimirDanfe(record)}
            >
              Imprimir DANFE
            </Button>
          )}
        </Space>
      )
    }
  ];

  const filteredData = notasFiscais.filter(item => {
    const matchesSearch = 
      item.cliente.toLowerCase().includes(searchText.toLowerCase()) ||
      (item.numero && item.numero.includes(searchText)) ||
      item.documentoCliente.includes(searchText);

    if (!matchesSearch) return false;

    if (activeTab === '2' && item.status !== 'RASCUNHO') return false;
    if (activeTab === '3' && item.status !== 'AUTORIZADA') return false;
    if (activeTab === '4' && item.status !== 'REJEITADA') return false;

    return true;
  });

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>Início</Breadcrumb.Item>
        <Breadcrumb.Item>Fiscal</Breadcrumb.Item>
        <Breadcrumb.Item>Núcleo de Notas Fiscais</Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
            <FileTextOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
            Núcleo de Emissão de Notas Fiscais
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => message.info('Sincronizado com a SEFAZ.')}>
              Sincronizar
            </Button>
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setIsEmitirModalVisible(true)}>
              Gerar Nova NF
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Cards de Indicadores Rápidos */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card bodyStyle={{ padding: '16px' }}>
            <Statistic title="Total Emitidas (Mês)" value={124} prefix={<FileTextOutlined style={{ color: '#1890ff' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bodyStyle={{ padding: '16px' }}>
            <Statistic title="Autorizadas" value={118} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bodyStyle={{ padding: '16px' }}>
            <Statistic title="Rascunhos Pendentes" value={notasFiscais.filter(n => n.status === 'RASCUNHO').length} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bodyStyle={{ padding: '16px' }}>
            <Statistic title="Rejeitadas / Erros" value={notasFiscais.filter(n => n.status === 'REJEITADA').length} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      {/* Aba de Navegação do Núcleo */}
      <Card bordered={false}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            { key: '1', label: 'Todas as Notas' },
            { key: '2', label: `Rascunhos (${notasFiscais.filter(n => n.status === 'RASCUNHO').length})` },
            { key: '3', label: 'Autorizadas / Emitidas' },
            { key: '4', label: 'Rejeitadas' },
          ]}
          style={{ marginBottom: '16px' }}
        />

        <Row style={{ marginBottom: '16px' }} gutter={12}>
          <Col xs={24} sm={12} md={8}>
            <Input 
              placeholder="Buscar por cliente, CNPJ/CPF ou número..." 
              prefix={<SearchOutlined />} 
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
        </Row>

        <Table 
          columns={columns} 
          dataSource={filteredData} 
          pagination={{ pageSize: 8 }}
          rowKey="key"
        />
      </Card>

      {/* Modal de Detalhes / Chave / XML */}
      <Modal
        title={`Detalhes da Nota Fiscal #${selectedNf?.id_nf}`}
        open={isDetailsModalVisible}
        onCancel={() => setIsDetailsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailsModalVisible(false)}>
            Fechar
          </Button>,
          selectedNf?.status === 'AUTORIZADA' && (
            <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => handleImprimirDanfe(selectedNf)}>
              Imprimir DANFE
            </Button>
          )
        ]}
        width={650}
      >
        {selectedNf && (
          <div>
            <p><strong>Cliente:</strong> {selectedNf.cliente} ({selectedNf.documentoCliente})</p>
            <p><strong>Tipo:</strong> {selectedNf.tipo} | <strong>Série:</strong> {selectedNf.serie}</p>
            <p><strong>Valor Total:</strong> R$ {selectedNf.valorTotal.toFixed(2)}</p>
            <p><strong>Status Atual:</strong> <Tag color="blue">{selectedNf.status}</Tag></p>
            {selectedNf.chaveAcesso && (
              <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', marginTop: '12px' }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>Chave de Acesso SEFAZ:</Text>
                <br />
                <Text code style={{ fontSize: '12px' }}>{selectedNf.chaveAcesso}</Text>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal de Nova Emissão de NF */}
      <Modal
        title="Assistente de Geração de Nota Fiscal"
        open={isEmitirModalVisible}
        onCancel={() => setIsEmitirModalVisible(false)}
        onOk={() => {
          setIsEmitirModalVisible(false);
          message.success('Rascunho de NF gerado com sucesso!');
        }}
        okText="Salvar como Rascunho"
        width={700}
      >
        <Steps
          current={0}
          items={[
            { title: 'Cliente' },
            { title: 'Itens / SKUs' },
            { title: 'Tributação' },
            { title: 'Revisão' },
          ]}
          style={{ marginBottom: '24px' }}
        />
        <p>Selecione um cliente cadastrado ou importe os dados do pedido de venda / catálogo para gerar a pré-nota fiscal.</p>
      </Modal>
    </div>
  );
}