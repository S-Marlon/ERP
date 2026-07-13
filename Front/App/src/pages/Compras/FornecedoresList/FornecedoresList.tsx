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
  Select, 
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
  TeamOutlined, 
  EnvironmentOutlined, 
  PhoneOutlined, 
  MailOutlined,
  FileTextOutlined,
  DollarCircleOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

interface FornecedorAggregate {
  id_pessoa: number;
  tipo_pessoa: 'PF' | 'PJ';
  nome_razao: string;
  nome_fantasia?: string;
  documento: string;
  status: 'ATIVO' | 'INATIVO';
  email: string;
  telefone: string;
  cidade: string;
  estado: string;
  inscricao_estadual?: string;
}

export default function Fornecedores() {
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [tipoPessoaModal, setTipoPessoaModal] = useState<'PJ' | 'PF'>('PJ');

  const [fornecedores, setFornecedores] = useState<FornecedorAggregate[]>([
    {
      id_pessoa: 101,
      tipo_pessoa: 'PJ',
      nome_razao: 'Distribuidora Global de Ferro e Aço S.A.',
      nome_fantasia: 'Global Metais',
      documento: '12.345.678/0001-99',
      status: 'ATIVO',
      email: 'compras@globalferro.com.br',
      telefone: '(11) 4002-8922',
      cidade: 'Guarulhos',
      estado: 'SP',
      inscricao_estadual: '111.222.333.444'
    },
    {
      id_pessoa: 102,
      tipo_pessoa: 'PJ',
      nome_razao: 'FORNECEDOR GENERICO - COMPRAS SPOT',
      nome_fantasia: 'Mercado Livre / Varejo',
      documento: '99.999.999/0001-99',
      status: 'ATIVO',
      email: 'compras.spot@suaempresa.com',
      telefone: '(11) 99999-9999',
      cidade: 'Interna',
      estado: 'SP'
    },
    {
      id_pessoa: 103,
      tipo_pessoa: 'PF',
      nome_razao: 'Carlos Eduardo Santos (Freteiro Autônomo)',
      documento: '333.444.555-66',
      status: 'ATIVO',
      email: 'cadu.fretes@gmail.com',
      telefone: '(47) 99122-3344',
      cidade: 'Joinville',
      estado: 'SC'
    }
  ]);

  const [fornecedorAtivo, setFornecedorAtivo] = useState<FornecedorAggregate | null>(fornecedores[0]);

  const fornecedoresFiltrados = useMemo(() => {
    const termo = searchTerm.toLowerCase();
    return AcademicFilter(fornecedores, termo);
  }, [fornecedores, searchTerm]);

  function AcademicFilter(list: FornecedorAggregate[], term: string) {
    return list.filter(f => 
      f.nome_razao.toLowerCase().includes(term) || 
      f.documento.includes(term)
    );
  }

  const handleReload = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); message.info('Lista sincronizada com core_pessoas.'); }, 500);
  };

  const handleCreateFornecedor = (values: any) => {
    const novo: FornecedorAggregate = {
      id_pessoa: Math.floor(Math.random() * 900) + 200,
      tipo_pessoa: values.tipo_pessoa,
      nome_razao: values.tipo_pessoa === 'PJ' ? values.razao_social : values.nome_pf,
      nome_fantasia: values.nome_fantasia,
      documento: values.tipo_pessoa === 'PJ' ? values.cnpj : values.cpf,
      status: 'ATIVO',
      email: values.email,
      telefone: values.telefone,
      cidade: values.cidade || 'Não informada',
      estado: values.estado || 'UF',
      inscricao_estadual: values.inscricao_estadual
    };

    setFornecedores([novo, ...fornecedores]);
    setFornecedorAtivo(novo);
    setIsModalOpen(false);
    form.resetFields();
    message.success('Fornecedor registrado no banco!');
  };

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      
      <Sider width={350} theme="light" style={{ borderRight: '1px solid #e8e8e8', padding: '16px' }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
          <Col><Title level={4} style={{ margin: 0 }}>Fornecedores</Title></Col>
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
            dataSource={fornecedoresFiltrados}
            loading={loading}
            renderItem={(item) => (
              <List.Item
                onClick={() => setFornecedorAtivo(item)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '8px',
                  backgroundColor: fornecedorAtivo?.id_pessoa === item.id_pessoa ? '#e6f7ff' : 'transparent',
                  border: fornecedorAtivo?.id_pessoa === item.id_pessoa ? '1px solid #91d5ff' : '1px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar style={{ backgroundColor: item.tipo_pessoa === 'PJ' ? '#722ed1' : '#fa8c16' }}>
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
                      <Text type="secondary">{item.cidade} - {item.estado}</Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </Sider>

      <Content style={{ padding: '24px', overflowY: 'auto', height: '100vh' }}>
        {fornecedorAtivo ? (
          <>
            <Card bordered={false} style={{ marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Space size="middle" align="center">
                    <TeamOutlined style={{ fontSize: '32px', color: '#1677ff', padding: '8px', backgroundColor: '#e6f7ff', borderRadius: '8px' }} />
                    <div>
                      <Title level={3} style={{ margin: 0 }}>{fornecedorAtivo.nome_razao}</Title>
                      <Text type="secondary">{fornecedorAtivo.nome_fantasia ? `Nome Fantasia: ${fornecedorAtivo.nome_fantasia}` : 'Cadastro Homologado'}</Text>
                    </div>
                  </Space>
                </Col>
                <Col>
                  <Space>
                    <Tag icon={<EnvironmentOutlined />}>{fornecedorAtivo.estado}</Tag>
                    <Text type="secondary" code>ID_CORE: {fornecedorAtivo.id_pessoa}</Text>
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
                  label: (<span><FileTextOutlined /> Geral</span>),
                  children: (
                    <Card bordered={false}>
                      <Descriptions title="Estrutura Cadastral Core" bordered column={{ xs: 1, sm: 2 }}>
                        <Descriptions.Item label="Razão Social / Nome">{fornecedorAtivo.nome_razao}</Descriptions.Item>
                        <Descriptions.Item label="Documento Oficial">{fornecedorAtivo.documento}</Descriptions.Item>
                        <Descriptions.Item label="Tipo Entidade"><Tag color={fornecedorAtivo.tipo_pessoa === 'PJ' ? 'purple' : 'orange'}>{fornecedorAtivo.tipo_pessoa === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física (Autônomo/Produtor)'}</Tag></Descriptions.Item>
                        <Descriptions.Item label="Insc. Estadual">{fornecedorAtivo.inscricao_estadual || 'Não se aplica / Isento'}</Descriptions.Item>
                        <Descriptions.Item label="E-mail principal"><span><MailOutlined /> {fornecedorAtivo.email}</span></Descriptions.Item>
                        <Descriptions.Item label="Telefone Comercial"><span><PhoneOutlined /> {fornecedorAtivo.telefone}</span></Descriptions.Item>
                        <Descriptions.Item label="Localização">{fornecedorAtivo.cidade} - {fornecedorAtivo.estado}</Descriptions.Item>
                        <Descriptions.Item label="Status Operacional"><Tag color={fornecedorAtivo.status === 'ATIVO' ? 'green' : 'red'}>{fornecedorAtivo.status}</Tag></Descriptions.Item>
                      </Descriptions>
                    </Card>
                  ),
                },
                {
                  key: 'produtos',
                  label: (<span><DollarCircleOutlined /> Catálogo e Preços</span>),
                  children: (
                    <Card bordered={false} title="Vínculos e Acordos Comerciais">
                      <Table
                        size="small"
                        pagination={false}
                        locale={{ emptyText: 'Nenhum item amarrado a este fornecedor.' }}
                        columns={[
                          { title: 'SKU Interno', dataIndex: 'sku' },
                          { title: 'Descrição no ERP', dataIndex: 'desc' },
                          { title: 'Preço Acordado', dataIndex: 'preco' }
                        ]}
                        dataSource={fornecedorAtivo.id_pessoa === 101 ? [
                          { key: '1', sku: 'FER-CHAL-02', desc: 'Chapa de Aço Galvanizado 2mm', preco: 'R$ 340,00' }
                        ] : []}
                      />
                    </Card>
                  ),
                },
                {
                  key: 'historico',
                  label: (<span><HistoryOutlined /> Histórico de Entradas</span>),
                  children: (
                    <Card bordered={false} title="Documentos Fiscais de Entrada Recentes">
                      <Table
                        size="small"
                        pagination={false}
                        locale={{ emptyText: 'Nenhum lançamento no ledger fiscal.' }}
                        columns={[
                          { title: 'Número Doc / Chave', dataIndex: 'nf' },
                          { title: 'Data Lançamento', dataIndex: 'data' },
                          { title: 'Valor Total', dataIndex: 'valor' }
                        ]}
                        dataSource={fornecedorAtivo.id_pessoa === 101 ? [
                          { key: '1', nf: 'NF-e Nº 002.391', data: '12/05/2026', valor: 'R$ 14.200,00' }
                        ] : []}
                      />
                    </Card>
                  ),
                },
                {
                  key: 'qualidade',
                  label: (<span><SafetyCertificateOutlined /> Compliance</span>),
                  children: (
                    <Empty description="Sem restrições ou bloqueios fiscais de compras para este registro." />
                  ),
                }
              ]}
            />
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
            <Empty description="Selecione um registro na esteira esquerda para detalhar" />
          </div>
        )}
      </Content>

      <Modal
        title="Cadastrar Fornecedor (Esteira de Compras)"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={650}
        okText="Confirmar Cadastro"
        cancelText="Voltar"
        destroyOnClose
      >
        <Divider style={{ margin: '12px 0' }} />
        
        <Form form={form} layout="vertical" initialValues={{ tipo_pessoa: 'PJ' }} onFinish={handleCreateFornecedor}>
          
          <Form.Item name="tipo_pessoa" label="Modelo de Entidade Jurídica">
            <Radio.Group onChange={(e) => setTipoPessoaModal(e.target.value)} buttonStyle="solid">
              <Radio.Button value="PJ">Pessoa Jurídica (Empresas/Distribuidores)</Radio.Button>
              <Radio.Button value="PF">Pessoa Física (Autônomos/Produtores)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {tipoPessoaModal === 'PF' && (
            <Alert
              message="Dica do Processo Operacional"
              description="Para compras recorrentes de varejo (Mercado Livre, Shopee, Varejo Spot), utilize o cadastro do 'FORNECEDOR GENÉRICO'. Use Pessoa Física apenas para prestadores de serviços recorrentes ou produtores homologados."
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
              icon={<InfoCircleOutlined />}
            />
          )}

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
                  <Form.Item name="nome_pf" label="Nome Completo (CPF)" rules={[{ required: true, message: 'Campo obrigatório' }]}>
                    <Input placeholder="Nome do profissional autônomo" />
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

          <Divider orientation="left" style={{ fontSize: '11px', color: '#bfbfbf' }}>Canais de Contato & Localidade</Divider>

          <Divider orientation="left" style={{ fontSize: '11px', color: '#bfbfbf' }}>Canais de Contato & Localidade</Divider>

<Row gutter={16}>
  <Col span={12}>
    <Form.Item 
      name="email" 
      label="E-mail Principal" 
      dependencies={['telefone']}
      rules={[
        { type: 'email', message: 'Insira um e-mail válido' },
        ({ getFieldValue }) => ({
          validator(_, value) {
            if (value || getFieldValue('telefone')) {
              return Promise.resolve();
            }
            return Promise.reject(new Error('Preencha ao menos o E-mail ou o Telefone!'));
          },
        }),
      ]}
    >
      <Input placeholder="contato@fornecedor.com" />
    </Form.Item>
  </Col>
  
  <Col span={12}>
    <Form.Item 
      name="telefone" 
      label="Telefone / WhatsApp" 
      dependencies={['email']}
      rules={[
        ({ getFieldValue }) => ({
          validator(_, value) {
            if (value || getFieldValue('email')) {
              return Promise.resolve();
            }
            return Promise.reject(new Error('Preencha ao menos o Telefone ou o E-mail!'));
          },
        }),
      ]}
    >
      <Input placeholder="(00) 00000-0000" />
    </Form.Item>
  </Col>
  
  <Col span={16}>
    <Form.Item name="cidade" label="Cidade">
      <Input placeholder="Ex: Campinas" />
    </Form.Item>
  </Col>
  
  <Col span={8}>
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