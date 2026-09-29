import React, { useState } from 'react';
import {
  Card,
  Tabs,
  Form,
  Input,
  InputNumber,
  Select,
  Table,
  Button,
  Row,
  Col,
  Statistic,
  Badge,
  Alert,
  Modal,
  Space,
  Divider,
  Tooltip,
  Tag,
  Switch,
  TableColumnsType,
  Typography
} from 'antd';
import {
  DollarOutlined,
  CalculatorOutlined,
  GlobalOutlined,
  LineChartOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  LockOutlined,
  ShoppingOutlined,
  BranchesOutlined,
  DeleteOutlined,
  PlusOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import ProductCommercialSalesConfig from './ProductCommercialSalesConfig';

const { Text } = Typography;

interface PricingSimulationRecord {
  key: string;
  channel: string;
  tableType: string;
  suggestedPrice: number;
  practicedPrice: number;
  margin: number;
  netProfit: number;
  status: 'healthy' | 'warning' | 'danger';
}

interface WholesaleTierRecord {
  key: string;
  minQuantity: number;
  maxQuantity: number;
  unitPrice: number;
  discountPercent: number;
}

export const ProductPricingModule: React.FC = () => {
  const [form] = Form.useForm();
  const [enableFraction, setEnableFraction] = useState(true);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);

  const [costData] = useState({
    purchaseCost: 100.0,
    taxesIn: 18.0,
    freightAndAccessory: 5.0,
    markup: 1.5,
    operationalExpenseRate: 12.0,
    taxOut: 10.0,
    marketplaceFee: 16.0,
  });

  // Estado para faixas de atacado por volume (Gatilhos de Quantidade)
  const [wholesaleTiers, setWholesaleTiers] = useState<WholesaleTierRecord[]>([
    { key: '1', minQuantity: 1, maxQuantity: 9, unitPrice: 185.00, discountPercent: 0 },
    { key: '2', minQuantity: 10, maxQuantity: 49, unitPrice: 165.00, discountPercent: 10 },
    { key: '3', minQuantity: 50, maxQuantity: 9999, unitPrice: 145.00, discountPercent: 20 },
  ]);

  const addWholesaleTier = () => {
    const newTier: WholesaleTierRecord = {
      key: String(wholesaleTiers.length + 1),
      minQuantity: 0,
      maxQuantity: 0,
      unitPrice: 0,
      discountPercent: 0,
    };
    setWholesaleTiers([...wholesaleTiers, newTier]);
  };

  const removeWholesaleTier = (key: string) => {
    setWholesaleTiers(wholesaleTiers.filter(item => item.key !== key));
  };

  // Cálculos dinâmicos básicos
  const realCost = costData.purchaseCost - costData.taxesIn + costData.freightAndAccessory;
  const grossPrice = realCost * costData.markup;
  const totalDeductionsPercent = costData.taxOut + costData.operationalExpenseRate + costData.marketplaceFee;
  const netMargin = ((grossPrice - realCost - (grossPrice * (totalDeductionsPercent / 100))) / grossPrice) * 100;

  const channelsDataSource: PricingSimulationRecord[] = [
    {
      key: '1',
      channel: 'Varejo Físico',
      tableType: 'Tabela Padrão',
      suggestedPrice: 185.00,
      practicedPrice: 185.00,
      margin: 28.5,
      netProfit: 52.72,
      status: 'healthy',
    },
    {
      key: '2',
      channel: 'E-commerce (Mercado Livre)',
      tableType: 'Marketplace Premium',
      suggestedPrice: 210.00,
      practicedPrice: 199.90,
      margin: 14.2,
      netProfit: 28.38,
      status: 'warning',
    },
    {
      key: '3',
      channel: 'Atacado / Distribuição',
      tableType: 'Volume > 10 un',
      suggestedPrice: 150.00,
      practicedPrice: 145.00,
      margin: 8.1,
      netProfit: 11.74,
      status: 'danger',
    },
  ];

  const columns: TableColumnsType<PricingSimulationRecord> = [
    {
      title: 'Canal de Venda',
      dataIndex: 'channel',
      key: 'channel',
      render: (text) => <a>{text}</a>,
    },
    {
      title: 'Tabela Vinculada',
      dataIndex: 'tableType',
      key: 'tableType',
    },
    {
      title: 'Preço Praticado',
      dataIndex: 'practicedPrice',
      key: 'practicedPrice',
      render: (val) => `R$ ${val.toFixed(2)}`,
    },
    {
      title: 'Margem Líquida',
      dataIndex: 'margin',
      key: 'margin',
      render: (val) => (
        <Tag color={val > 20 ? 'green' : val > 10 ? 'orange' : 'red'}>
          {val.toFixed(1)}%
        </Tag>
      ),
    },
    {
      title: 'Lucro Unitário',
      dataIndex: 'netProfit',
      key: 'netProfit',
      render: (val) => `R$ ${val.toFixed(2)}`,
    },
    {
      title: 'Status (Health Check)',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        if (status === 'healthy') return <Badge status="success" text="Saudável" />;
        if (status === 'warning') return <Badge status="warning" text="Atenção" />;
        return <Badge status="error" text="Prejuízo/Piso" />;
      },
    },
  ];

  const wholesaleColumns: TableColumnsType<WholesaleTierRecord> = [
    {
      title: 'Qtd Mínima',
      dataIndex: 'minQuantity',
      key: 'minQuantity',
      render: (val) => <InputNumber min={1} defaultValue={val} style={{ width: '100%' }} />,
    },
    {
      title: 'Qtd Máxima',
      dataIndex: 'maxQuantity',
      key: 'maxQuantity',
      render: (val) => <InputNumber min={1} defaultValue={val} style={{ width: '100%' }} />,
    },
    {
      title: 'Preço Unitário (R$)',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (val) => <InputNumber prefix="R$" min={0} precision={2} defaultValue={val} style={{ width: '100%' }} />,
    },
    {
      title: 'Desconto (%)',
      dataIndex: 'discountPercent',
      key: 'discountPercent',
      render: (val) => <InputNumber suffix="%" min={0} max={100} defaultValue={val} style={{ width: '100%' }} />,
    },
    {
      title: 'Ações',
      key: 'action',
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeWholesaleTier(record.key)}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh' }}>
      <Row gutter={[16, 16]}>
        {/* CABEÇALHO E INTELIGÊNCIA EXECUTIVA */}
        <Col span={24}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <h2>Módulo Central de Precificação Inteligente</h2>
                <p style={{ color: '#8c8c8c', margin: 0 }}>
                  Gestão integrada de custos, fracionamento, canais de atacado/varejo e margens em tempo real.
                </p>
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<CalculatorOutlined />}>
                    Reajuste em Massa por Lote
                  </Button>
                  <Button onClick={() => setApprovalModalVisible(true)} icon={<LockOutlined />}>
                    Alçadas de Desconto / Piso
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* PAINEL DE METRIZES RÁPIDAS (DASHBOARD) */}
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="Custo Real de Aquisição (CMV + Frete - Impostos)"
              value={realCost}
              precision={2}
              prefix="R$ "
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="Preço Sugerido (Markup Aplicado)"
              value={grossPrice}
              precision={2}
              prefix="R$ "
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="Margem de Contribuição Média"
              value={netMargin}
              precision={1}
              suffix="%"
              valueStyle={{ color: netMargin < 15 ? '#faad14' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="Curva ABC Rentabilidade"
              value="Classe A"
              valueStyle={{ color: '#1890ff' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>

        {/* CORPO PRINCIPAL COM ABAS PARA AS ESPECIFICAÇÕES */}
        <Col span={24}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Tabs
              defaultActiveKey="1"
              items={[
                {
                  key: '1',
                  label: (
                    <span>
                      <DollarOutlined /> 1. Custos de Aquisição
                    </span>
                  ),
                  children: (
                    <Form form={form} layout="vertical" initialValues={costData}>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item label="Último Preço de Compra / CMV" name="purchaseCost">
                            <InputNumber style={{ width: '100%' }} prefix="R$" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="Créditos Fiscais de Entrada (ICMS-ST/PIS/COFINS)" name="taxesIn">
                            <InputNumber style={{ width: '100%' }} prefix="R$" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="Despesas Acessórias (Frete/Seguro Rateado)" name="freightAndAccessory">
                            <InputNumber style={{ width: '100%' }} prefix="R$" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Form>
                  ),
                },
                {
                  key: '2',
                  label: (
                    <span>
                      <ShoppingOutlined /> 2. Fracionamento e Atacado
                    </span>
                  ),
                  children: (
                   <ProductCommercialSalesConfig></ProductCommercialSalesConfig>
                  ),
                },
                {
                  key: '3',
                  label: (
                    <span>
                      <GlobalOutlined /> 3, 4 & 5. Canais e Tributos
                    </span>
                  ),
                  children: (
                    <div>
                      <Alert
                        message="Simulador de Impacto Tributário e Despesas Operacionais em tempo real"
                        description="O sistema cruza automaticamente o NCM do produto com o regime tributário da empresa e aloca o markup rate fixo."
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                      />
                      <Table
                        dataSource={channelsDataSource}
                        columns={columns}
                        pagination={false}
                        bordered
                      />
                    </div>
                  ),
                },
                {
                  key: '4',
                  label: (
                    <span>
                      <LineChartOutlined /> 6 & 7. Insights e Auditoria
                    </span>
                  ),
                  children: (
                    <div>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Card type="inner" title="Recomendações Automáticas de Inteligência">
                            <p>
                              <Badge status="warning" /> <b>Atenção:</b> A embalagem de atacado deste item está operando com margem abaixo de 10%. Sugere-se elevar o preço piso para R$ 155,00.
                            </p>
                            <p>
                              <Badge status="success" /> <b>Dica de Ouro:</b> Este produto possui alta conversão no E-commerce. Utilize-o como produto âncora em campanhas de tráfego pago.
                            </p>
                          </Card>
                        </Col>
                        <Col span={12}>
                          <Card type="inner" title="Trilha de Auditoria Recente">
                            <p style={{ fontSize: 13, marginBottom: 8 }}>
                              <HistoryOutlined /> Há 2 horas por <b>Carlos Gerente</b>: Alteração de Markup de 1.4 para 1.5.
                            </p>
                            <p style={{ fontSize: 13, marginBottom: 8 }}>
                              <HistoryOutlined /> Ontem por <b>Integração XML Fornecedor</b>: Atualização automática de Custo de Compra (R$ 95,00 $\rightarrow$ R$ 100,00).
                            </p>
                          </Card>
                        </Col>
                      </Row>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        
      </Row>

      {/* Modal de Alçada de Aprovação */}
      <Modal
        title="Gestão de Alçadas e Trava de Preço Piso"
        open={approvalModalVisible}
        onOk={() => setApprovalModalVisible(false)}
        onCancel={() => setApprovalModalVisible(false)}
      >
        <p>Quando um vendedor tenta aplicar um desconto que fure o <b>Preço Piso de Segurança</b>, o ERP gera instantaneamente uma chave de autorização via PIN ou envia uma notificação push para o painel do Gerente.</p>
        <Input.Password placeholder="Insira a senha de liberação gerencial do supervisor..." />
      </Modal>
    </div>
  );
};

export default ProductPricingModule;