import React, { useState, useMemo } from 'react';
import { 
  Layout, 
  Input, 
  List, 
  Avatar, 
  Tag, 
  Button, 
  Typography, 
  Tabs, 
  Card, 
  Row, 
  Col, 
  Descriptions, 
  Table, 
  Modal, 
  Form, 
  Radio, 
  Select, Dropdown,
  message,
  Divider,
  Empty,
  Space,
  Alert
} from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined, 
  ReloadOutlined, 
  UserOutlined, 
  EnvironmentOutlined, 
  PhoneOutlined, 
  MailOutlined,
  FileTextOutlined,
  DollarCircleOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  CalculatorOutlined,
  EllipsisOutlined,
  InfoCircleOutlined,
  HomeOutlined,
  ShopOutlined
} from '@ant-design/icons';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

interface Endereco {
  tipo: 'COBRANCA' | 'ENTREGA' | 'PRINCIPAL';
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

interface ClienteAggregate {
  id_pessoa: number;
  tipo_pessoa: 'PF' | 'PJ';
  nome_razao: string;
  nome_fantasia?: string;
  documento: string;
  status: 'ATIVO' | 'INATIVO';
  email: string;
  telefone: string;
  enderecos: Endereco[];
  inscricao_estadual?: string;
}

export default function Clientes() {
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [tipoPessoaModal, setTipoPessoaModal] = useState<'PJ' | 'PF'>('PJ');

  const [clientes, setClientes] = useState<ClienteAggregate[]>([
    {
      id_pessoa: 201,
      tipo_pessoa: 'PJ',
      nome_razao: 'Indústria Metalúrgica Robust S.A.',
      nome_fantasia: 'Robust Indústria',
      documento: '45.123.789/0001-10',
      status: 'ATIVO',
      email: 'financeiro@robust.com.br',
      telefone: '(19) 3876-5432',
      inscricao_estadual: '689.123.456.112',
      enderecos: [
        { tipo: 'PRINCIPAL', logradouro: 'Av. Industrial', numero: '1500', bairro: 'Distrito Industrial', cidade: 'Campinas', estado: 'SP', cep: '13069-000' },
        { tipo: 'ENTREGA', logradouro: 'Rua dos Galpões', numero: '300', bairro: 'Cachoeira', cidade: 'Campinas', estado: 'SP', cep: '13069-120' }
      ]
    },
    {
      id_pessoa: 202,
      tipo_pessoa: 'PF',
      nome_razao: 'Marcos Vinícius de Oliveira',
      documento: '111.222.333-44',
      status: 'ATIVO',
      email: 'marcos.vini@outlook.com',
      telefone: '(11) 98877-6655',
      enderecos: [
        { tipo: 'PRINCIPAL', logradouro: 'Rua das Flores', numero: '88', bairro: 'Centro', cidade: 'Atibaia', estado: 'SP', cep: '12940-000' }
      ]
    }
  ]);

  const [clienteAtivo, setClienteAtivo] = useState<ClienteAggregate | null>(clientes[0]);

  const clientesFiltrados = useMemo(() => {
    const termo = searchTerm.toLowerCase();
    return AcademicFilter(clientes, termo);
  }, [clientes, searchTerm]);

  function AcademicFilter(list: ClienteAggregate[], term: string) {
    return list.filter(c => 
      c.nome_razao.toLowerCase().includes(term) || 
      c.documento.includes(term)
    );
  }

  const handleReload = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); message.info('Lista sincronizada com core_pessoas.'); }, 500);
  };

  const handleCreateCliente = (values: any) => {
    const novoEndereco: Endereco = {
      tipo: 'PRINCIPAL',
      logradouro: values.logradouro || 'Não informado',
      numero: values.numero || 'S/N',
      bairro: values.bairro || 'Geral',
      cidade: values.cidade || 'Não informada',
      estado: values.estado || 'SP',
      cep: values.cep || '00000-000'
    };

    const novo: ClienteAggregate = {
      id_pessoa: Math.floor(Math.random() * 900) + 500,
      tipo_pessoa: values.tipo_pessoa,
      nome_razao: values.tipo_pessoa === 'PJ' ? values.razao_social : values.nome_pf,
      nome_fantasia: values.nome_fantasia,
      documento: values.tipo_pessoa === 'PJ' ? values.cnpj : values.cpf,
      status: 'ATIVO',
      email: values.email,
      telefone: values.telefone,
      inscricao_estadual: values.inscricao_estadual,
      enderecos: [novoEndereco]
    };

    setClientes([novo, ...clientes]);
    setClienteAtivo(novo);
    setIsModalOpen(false);
    form.resetFields();
    message.success('Cliente cadastrado com sucesso!');
  };

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      
      <Sider width={350} theme="light" style={{ borderRight: '1px solid #e8e8e8', padding: '16px' }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
          <Col><Title level={4} style={{ margin: 0 }}>Clientes</Title></Col>
          <Col>
            <Button type="primary" shape="circle" icon={<PlusOutlined />} onClick={() => { setTipoPessoaModal('PJ'); setIsModalOpen(true); }} />
          </Col>
        </Row>

        <Input
          placeholder="Filtrar por nome ou documento..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginBottom: '16px' }}
          allowClear
          addonAfter={<Button type="text" size="small" icon={<ReloadOutlined />} onClick={handleReload} loading={loading} />}
        />

        <div style={{ overflowY: 'auto', height: 'calc(100vh - 140px)' }}>
          <List
            dataSource={clientesFiltrados}
            loading={loading}
            renderItem={(item) => (
              <List.Item
                onClick={() => setClienteAtivo(item)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '8px',
                  backgroundColor: clienteAtivo?.id_pessoa === item.id_pessoa ? '#e6f7ff' : 'transparent',
                  border: clienteAtivo?.id_pessoa === item.id_pessoa ? '1px solid #91d5ff' : '1px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar style={{ backgroundColor: item.tipo_pessoa === 'PJ' ? '#13c2c2' : '#faad14' }}>
                      {item.tipo_pessoa}
                    </Avatar>
                  }
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ maxWidth: '170px' }} ellipsis>{item.nome_razao}</Text>
                      <Tag color={item.status === 'ATIVO' ? 'success' : 'error'} style={{ marginRight: 0, fontSize: '10px' }}>
                        {item.status}
                      </Tag>
                    </div>
                  }
                  description={
                    <div style={{ fontSize: '12px' }}>
                      <div>{item.documento}</div>
                      <Text type="secondary">{item.enderecos[0]?.cidade} - {item.enderecos[0]?.estado}</Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </Sider>

      <Content style={{ padding: '24px', overflowY: 'auto', height: '100vh' }}>
        {clienteAtivo ? (
          <>
            <Card bordered={false} style={{ marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <Row justify="space-between" align="middle">
                
                {/* Lado Esquerdo: Identificação do Cliente */}
                <Col>
                  <Space size="middle" align="center">
                    <UserOutlined style={{ fontSize: '32px', color: '#13c2c2', padding: '8px', backgroundColor: '#e6fffb', borderRadius: '8px' }} />
                    <div>
                      <Title level={3} style={{ margin: 0 }}>{clienteAtivo.nome_razao}</Title>
                      <Text type="secondary">{clienteAtivo.nome_fantasia ? `Nome Fantasia: ${clienteAtivo.nome_fantasia}` : 'Carteira de Clientes Ativa'}</Text>
                    </div>
                  </Space>
                </Col>

                {/* Lado Direito: Tags e Botões de Ação Rápida */}
                <Col>
                  <Space direction="vertical" align="end" size="small">
                    <Space>
                      <Tag icon={<EnvironmentOutlined />}>{clienteAtivo.enderecos[0]?.estado}</Tag>
                      <Text type="secondary" code>ID_CORE: {clienteAtivo.id_pessoa}</Text>
                    </Space>
                    
                    {/* Barra de Ações Rápidas */}
                    <Space>
                      <Button 
                        icon={<CalculatorOutlined />} 
                        onClick={() => message.info(`Iniciando orçamento para ${clienteAtivo.nome_razao}...`)}
                      >
                        Orçamento
                      </Button>

                      <a href='/pedidos'>
                      <Button 
                        type="primary" 
                        icon={<ShoppingCartOutlined />} 
                        
                      >
                        Pedidos
                      </Button>
                      </a>
                      <Dropdown 
                        menu={{ 
                          items: [
                            { key: '1', label: 'Imprimir Ficha Cadastral' },
                            { key: '2', label: 'Bloquear Cliente', danger: true }
                          ] 
                        }} 
                        trigger={['click']}
                      >
                        <Button icon={<EllipsisOutlined />} />
                      </Dropdown>
                    </Space>
                  </Space>
                </Col>

              </Row>
            </Card>

            <Tabs
              type="card"
              defaultActiveKey="geral"
              items={[
                {
                  key: 'geral',
                  label: (<span><FileTextOutlined /> Geral & Endereços</span>),
                  children: (
                    <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
                      <Card bordered={false}>
                        <Descriptions title="Estrutura Cadastral do Cliente" bordered column={{ xs: 1, sm: 2 }}>
                          <Descriptions.Item label="Razão Social / Nome">{clienteAtivo.nome_razao}</Descriptions.Item>
                          <Descriptions.Item label="Documento Oficial">{clienteAtivo.documento}</Descriptions.Item>
                          <Descriptions.Item label="Tipo Entidade"><Tag color={clienteAtivo.tipo_pessoa === 'PJ' ? 'cyan' : 'orange'}>{clienteAtivo.tipo_pessoa === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}</Tag></Descriptions.Item>
                          <Descriptions.Item label="Insc. Estadual">{clienteAtivo.inscricao_estadual || 'Não se aplica / Isento'}</Descriptions.Item>
                          <Descriptions.Item label="E-mail principal"><span><MailOutlined /> {clienteAtivo.email}</span></Descriptions.Item>
                          <Descriptions.Item label="Telefone de Contato"><span><PhoneOutlined /> {clienteAtivo.telefone}</span></Descriptions.Item>
                          <Descriptions.Item label="Status Comercial"><Tag color={clienteAtivo.status === 'ATIVO' ? 'green' : 'red'}>{clienteAtivo.status}</Tag></Descriptions.Item>
                        </Descriptions>
                      </Card>

                      <Card bordered={false} title="Endereços Vinculados (Cobrança e Entrega)">
                        <Row gutter={16}>
                          {clienteAtivo.enderecos.map((end, idx) => (
                            <Col span={12} key={idx}>
                              <Card type="inner" title={<Space><ShopOutlined /> {end.tipo}</Space>} size="small">
                                <p><strong>Logradouro:</strong> {end.logradouro}, nº {end.numero}</p>
                                <p><strong>Bairro:</strong> {end.bairro}</p>
                                <p><strong>Cidade/UF:</strong> {end.cidade} - {end.estado}</p>
                                <p><strong>CEP:</strong> {end.cep}</p>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      </Card>
                    </Space>
                  ),
                },
                {
                  key: 'historico',
                  label: (<span><HistoryOutlined /> Histórico de Vendas</span>),
                  children: (
                    <Card bordered={false} title="Pedidos e Faturamento Recentes">
                      <Table
                        size="small"
                        pagination={false}
                        locale={{ emptyText: 'Nenhum pedido faturado para este cliente.' }}
                        columns={[
                          { title: 'Pedido / NF', dataIndex: 'pedido' },
                          { title: 'Data Faturamento', dataIndex: 'data' },
                          { title: 'Valor Total', dataIndex: 'valor' }
                        ]}
                        dataSource={clienteAtivo.id_pessoa === 201 ? [
                          { key: '1', pedido: 'PED-9821 / NF 012.441', data: '20/06/2026', valor: 'R$ 8.450,00' }
                        ] : []}
                      />
                    </Card>
                  ),
                },
                {
                  key: 'precos',
                  label: (<span><DollarCircleOutlined /> Tabela de Preços Especiais</span>),
                  children: (
                    <Card bordered={false} title="Condições Comerciais Diferenciadas e Descontos por SKU">
                      <Table
                        size="small"
                        pagination={false}
                        locale={{ emptyText: 'Nenhum preço especial configurado. O cliente utiliza a tabela padrão.' }}
                        columns={[
                          { title: 'SKU Produto', dataIndex: 'sku' },
                          { title: 'Descrição', dataIndex: 'desc' },
                          { title: 'Preço Especial Acordado', dataIndex: 'preco_especial' }
                        ]}
                        dataSource={clienteAtivo.id_pessoa === 201 ? [
                          { key: '1', sku: 'FER-CHAL-02', desc: 'Chapa de Aço Galvanizado 2mm', preco_especial: 'R$ 310,00 (Desconto de Contract)' }
                        ] : []}
                      />
                    </Card>
                  ),
                },
                {
                  key: 'compliance',
                  label: (<span><SafetyCertificateOutlined /> Crédito & Limites</span>),
                  children: (
                    <Empty description="Limite de crédito liberado e sem restrições financeiras ativas." />
                  ),
                }
              ]}
            />
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
            <Empty description="Selecione um cliente na esteira esquerda para detalhar" />
          </div>
        )}
      </Content>

      <Modal
        title="Cadastrar Novo Cliente"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={650}
        okText="Confirmar Cadastro"
        cancelText="Voltar"
        destroyOnClose
      >
        <Divider style={{ margin: '12px 0' }} />
        
        <Form form={form} layout="vertical" initialValues={{ tipo_pessoa: 'PJ' }} onFinish={handleCreateCliente}>
          
          <Form.Item name="tipo_pessoa" label="Modelo de Entidade Jurídica">
            <Radio.Group onChange={(e) => setTipoPessoaModal(e.target.value)} buttonStyle="solid">
              <Radio.Button value="PJ">Pessoa Jurídica (Empresas)</Radio.Button>
              <Radio.Button value="PF">Pessoa Física (Consumidor Final)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Row gutter={16}>
            {tipoPessoaModal === 'PJ' ? (
              <>
                <Col span={14}>
                  <Form.Item name="razao_social" label="Razão Social" rules={[{ required: true, message: 'Campo obrigatório' }]}>
                    <Input placeholder="Nome empresarial" />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item name="cnpj" label="CNPJ" rules={[{ required: true, message: 'Campo obrigatório' }]}>
                    <Input placeholder="00.000.000/0000-00" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="nome_fantasia" label="Nome Fantasia">
                    <Input placeholder="Nome comercial" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="inscricao_estadual" label="Inscrição Estadual (I.E.)">
                    <Input placeholder="Isento ou numérico" />
                  </Form.Item>
                </Col>
              </>
            ) : (
              <>
                <Col span={14}>
                  <Form.Item name="nome_pf" label="Nome Completo" rules={[{ required: true, message: 'Campo obrigatório' }]}>
                    <Input placeholder="Nome do cliente" />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item name="cpf" label="CPF" rules={[{ required: true, message: 'Campo obrigatório' }]}>
                    <Input placeholder="000.000.000-00" />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>

          <Divider orientation="left" style={{ fontSize: '11px', color: '#bfbfbf' }}>Canais de Contato</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="E-mail Principal" rules={[{ type: 'email', message: 'Insira um e-mail válido' }]}>
                <Input placeholder="cliente@empresa.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="telefone" label="Telefone / WhatsApp">
                <Input placeholder="(00) 00000-0000" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: '11px', color: '#bfbfbf' }}>Endereço Principal</Divider>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="logradouro" label="Logradouro (Rua, Av, etc)">
                <Input placeholder="Ex: Av. Brasil" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="numero" label="Número">
                <Input placeholder="Ex: 1200" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="bairro" label="Bairro">
                <Input placeholder="Ex: Centro" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="cidade" label="Cidade">
                <Input placeholder="Ex: Campinas" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="estado" label="UF">
                <Select placeholder="UF">
                  <Select.Option value="SP">SP</Select.Option>
                  <Select.Option value="RJ">RJ</Select.Option>
                  <Select.Option value="MG">MG</Select.Option>
                  <Select.Option value="SC">SC</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Modal>

    </Layout>
  );
}