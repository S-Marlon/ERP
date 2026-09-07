import React, { useState, useMemo, useEffect } from 'react';
import { getClientes, createCliente } from './Utils/cliente.service'; 
import Swal from 'sweetalert2';
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
  Dropdown,
  message,
  Divider,
  Empty,
  Space,
  Checkbox,
  Switch,
  Tooltip
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
  ShopOutlined,
  DeleteOutlined,
  BankOutlined,
  PaperClipOutlined
} from '@ant-design/icons';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

interface Endereco {
  tipo: 'PRINCIPAL' | 'COBRANCA' | 'ENTREGA' | 'COMERCIAL';
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  principal?: number;
}

interface Telefone {
  tipo: 'CELULAR' | 'FIXO' | 'WHATSAPP' | 'RECADO';
  telefone: string;
  nome_contato?: string;
  whatsapp?: number;
  principal?: number;
}

interface EmailItem {
  email: string;
  tipo: 'PESSOAL' | 'FINANCEIRO' | 'COMERCIAL';
  principal?: number;
}

interface ClienteAggregate {
  id_pessoa: number;
  tipo_pessoa: 'PF' | 'PJ';
  nome_razao: string;
  nome_fantasia?: string;
  documento: string; // CPF ou CNPJ
  status: 'ATIVO' | 'INATIVO';
  observacoes?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  rg?: string;
  emails: EmailItem[];
  telefones: Telefone[];
  enderecos: Endereco[];
}

export default function Clientes() {
  const [form] = Form.useForm();

  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [tipoPessoaModal, setTipoPessoaModal] = useState<'PJ' | 'PF'>('PJ');

  const [clientes, setClientes] = useState<ClienteAggregate[]>([]);
  const [clienteAtivo, setClienteAtivo] = useState<ClienteAggregate | null>(null);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const data = await getClientes(1); 
      setClientes(data || []);
      if (data && data.length > 0) {
        setClienteAtivo(data[0]);
      } else {
        setClienteAtivo(null);
      }
    } catch (error: any) {
      console.error("Erro ao buscar clientes:", error);
      message.error(error.message || 'Não foi possível carregar a lista de clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const termo = searchTerm.toLowerCase();
    return clientes.filter(c => 
      (c.nome_razao && c.nome_razao.toLowerCase().includes(termo)) || 
      (c.documento && c.documento.includes(termo)) ||
      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(termo))
    );
  }, [clientes, searchTerm]);

  const maskCPF_CNPJ = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length <= 11) {
      return v.replace(/(\d{3})(\d)/, '$1.$2')
              .replace(/(\d{3})(\d)/, '$1.$2')
              .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      return v.replace(/^(\d{2})(\d)/, '$1.$2')
              .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
              .replace(/\.(\d{3})(\d)/, '.$1/$2')
              .replace(/(\d{4})(\d)/, '$1-$2')
              .substring(0, 18);
    }
  };

  const maskCEP = (value: string) => {
    return value.replace(/\D/g, '')
                .replace(/^(\d{5})(\d)/, '$1-$2')
                .substring(0, 9);
  };

  const handleReload = async () => {
    await fetchClientes();
    message.success('Lista sincronizada com sucesso!');
  };

  const buscarCepApi = async (cepLimpo: string, index: number) => {
    if (!cepLimpo || cepLimpo.replace(/\D/g, '').length < 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo.replace(/\D/g, '')}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        const enderecosAtuais = form.getFieldValue('enderecos') || [];
        enderecosAtuais[index] = {
          ...enderecosAtuais[index],
          logradouro: data.logradouro,
          bairro: data.bairro,
          cidade: data.localidade,
          estado: data.uf,
        };
        form.setFieldsValue({ enderecos: enderecosAtuais });
        message.success('CEP encontrado com sucesso!');
      } else {
        message.warning('CEP não encontrado.');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  const handleCreateCliente = async (values: any) => {
    const dadosParaEnviar = {
      ...values,
      tipo_pessoa: tipoPessoaModal,
      emails: values.emails || [],
      telefones: values.telefones || [],
      enderecos: values.enderecos || [],
      observacoes: values.observacoes || null
    };

    try {
      await createCliente(dadosParaEnviar, 1);
      Swal.fire('Sucesso!', 'Cliente cadastrado com sucesso.', 'success');
      setIsModalOpen(false);
      form.resetFields();
      fetchClientes(); 
    } catch (error: any) {
      Swal.fire('Erro', error.message || 'Não foi possível cadastrar o cliente.', 'error');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      {/* SIDER / LISTA ESQUERDA */}
      <Sider width={360} theme="light" style={{ borderRight: '1px solid #e8e8e8', padding: '16px' }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
          <Col><Title level={4} style={{ margin: 0 }}>Clientes & Parceiros</Title></Col>
          <Col>
            <Button 
              type="primary" 
              shape="circle" 
              icon={<PlusOutlined />} 
              onClick={() => { 
                setTipoPessoaModal('PJ'); 
                form.resetFields();
                form.setFieldsValue({ 
                  tipo_pessoa: 'PJ',
                  enderecos: [{ tipo: 'PRINCIPAL' }],
                  telefones: [{ tipo: 'CELULAR' }],
                  emails: [{ tipo: 'PESSOAL' }]
                });
                setIsModalOpen(true); 
              }} 
            />
          </Col>
        </Row>

        <Input
          placeholder="Filtrar por nome, fantasia ou documento..."
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
                      <Text strong style={{ maxWidth: '180px' }} ellipsis>{item.nome_razao}</Text>
                      <Tag color={item.status === 'ATIVO' ? 'success' : 'error'} style={{ marginRight: 0, fontSize: '10px' }}>
                        {item.status}
                      </Tag>
                    </div>
                  }
                  description={
                    <div style={{ fontSize: '12px' }}>
                      <div>{item.documento}</div>
                      <Text type="secondary">{item.enderecos?.[0]?.cidade || 'Sem cidade'} - {item.enderecos?.[0]?.estado || ''}</Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </Sider>

      {/* CONTEÚDO PRINCIPAL / DETALHES DO CLIENTE */}
      <Content style={{ padding: '24px', overflowY: 'auto', height: '100vh' }}>
        {clienteAtivo ? (
          <>
            <Card bordered={false} style={{ marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Space size="middle" align="center">
                    <UserOutlined style={{ fontSize: '32px', color: '#13c2c2', padding: '8px', backgroundColor: '#e6fffb', borderRadius: '8px' }} />
                    <div>
                      <Title level={3} style={{ margin: 0 }}>{clienteAtivo.nome_razao}</Title>
                      <Text type="secondary">{clienteAtivo.nome_fantasia ? `Fantasia: ${clienteAtivo.nome_fantasia}` : 'Cadastro Geral de Pessoa'}</Text>
                    </div>
                  </Space>
                </Col>

                <Col>
                  <Space direction="vertical" align="end" size="small">
                    <Space>
                      <Tag icon={<EnvironmentOutlined />}>{clienteAtivo.enderecos?.[0]?.estado || 'BR'}</Tag>
                      <Text type="secondary" code>ID: {clienteAtivo.id_pessoa}</Text>
                    </Space>
                    <Space>
                      <Button icon={<CalculatorOutlined />} onClick={() => message.info(`Orçamento para ${clienteAtivo.nome_razao}`)}>Orçamento</Button>
                      <Button type="primary" icon={<ShoppingCartOutlined />}>Pedidos</Button>
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
                  label: (<span><FileTextOutlined /> Geral & Cadastros</span>),
                  children: (
                    <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
                      <Card bordered={false} title="Dados Principais e Fiscais">
                        <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
                          <Descriptions.Item label="Razão Social / Nome" span={2}>{clienteAtivo.nome_razao}</Descriptions.Item>
                          <Descriptions.Item label="Nome Fantasia">{clienteAtivo.nome_fantasia || '-'}</Descriptions.Item>
                          <Descriptions.Item label="Tipo Entidade"><Tag color={clienteAtivo.tipo_pessoa === 'PJ' ? 'cyan' : 'orange'}>{clienteAtivo.tipo_pessoa}</Tag></Descriptions.Item>
                          <Descriptions.Item label="Documento">{clienteAtivo.documento}</Descriptions.Item>
                          <Descriptions.Item label="Inscrição Estadual">{clienteAtivo.inscricao_estadual || 'Isento / Não se aplica'}</Descriptions.Item>
                          <Descriptions.Item label="Inscrição Municipal">{clienteAtivo.inscricao_municipal || '-'}</Descriptions.Item>
                          <Descriptions.Item label="Status"><Tag color={clienteAtivo.status === 'ATIVO' ? 'green' : 'red'}>{clienteAtivo.status}</Tag></Descriptions.Item>
                        </Descriptions>
                      </Card>

                      {/* BLOCO DE CONTATOS: EMAILS E TELEFONES */}
                      <Row gutter={16}>
                        <Col span={12}>
                          <Card bordered={false} title={<Space><MailOutlined /> E-mails Cadastrados</Space>} size="small" style={{ height: '100%' }}>
                            {clienteAtivo.emails && clienteAtivo.emails.length > 0 ? (
                              clienteAtivo.emails.map((e, i) => (
                                <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
                                  <Text strong>{e.email}</Text> <Tag>{e.tipo}</Tag> {e.principal ? <Tag color="blue">Principal</Tag> : null}
                                </div>
                              ))
                            ) : <Text type="secondary">Nenhum e-mail secundário cadastrado.</Text>}
                          </Card>
                        </Col>
                        <Col span={12}>
                          <Card bordered={false} title={<Space><PhoneOutlined /> Telefones & Contatos</Space>} size="small" style={{ height: '100%' }}>
                            {clienteAtivo.telefones && clienteAtivo.telefones.length > 0 ? (
                              clienteAtivo.telefones.map((t, i) => (
                                <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
                                  <Text strong>{t.telefone}</Text> <Tag>{t.tipo}</Tag> {t.whatsapp ? <Tag color="success">WhatsApp</Tag> : null}
                                  {t.nome_contato && <div style={{ fontSize: '12px' }}><Text type="secondary">Ref: {t.nome_contato}</Text></div>}
                                </div>
                              ))
                            ) : <Text type="secondary">Nenhum telefone secundário cadastrado.</Text>}
                          </Card>
                        </Col>
                      </Row>

                      {/* ENDEREÇOS */}
                      <Card bordered={false} title={<Space><ShopOutlined /> Endereços Vinculados</Space>}>
                        <Row gutter={16}>
                          {clienteAtivo.enderecos && clienteAtivo.enderecos.map((end, idx) => (
                            <Col span={12} key={idx} style={{ marginBottom: 12 }}>
                              <Card type="inner" title={<Space><EnvironmentOutlined /> {end.tipo}</Space>} size="small">
                                <p><strong>Logradouro:</strong> {end.logradouro}, nº {end.numero} {end.complemento ? `(${end.complemento})` : ''}</p>
                                <p><strong>Bairro:</strong> {end.bairro}</p>
                                <p><strong>Cidade/UF:</strong> {end.cidade} - {end.estado}</p>
                                <p><strong>CEP:</strong> {end.cep}</p>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      </Card>

                      {/* OBSERVAÇÕES OPERACIONAIS */}
                    {/* OBSERVAÇÕES OPERACIONAIS */}
<Card bordered={false} title="Observações Operacionais / Internas" size="small">
  <Text style={{ whiteSpace: 'pre-wrap', display: 'block' }}>
    {clienteAtivo.observacoes || 'Nenhuma observação registrada para este cliente.'}
  </Text>
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
                        dataSource={[]}
                      />
                    </Card>
                  ),
                },
                {
                  key: 'financeiro',
                  label: (<span><BankOutlined /> Financeiro & Faturas (Futuro)</span>),
                  children: (
                    <Empty description="Módulo Financeiro em integração (Contas a Receber, Boletos e Inadimplência)." />
                  ),
                },
                {
                  key: 'documentos',
                  label: (<span><PaperClipOutlined /> Documentos & Anexos</span>),
                  children: (
                    <Empty description="Nenhum contrato ou documento fiscal anexado no storage." />
                  ),
                },
                {
                  key: 'precos',
                  label: (<span><DollarCircleOutlined /> Tabela de Preços</span>),
                  children: (
                    <Card bordered={false} title="Condições Comerciais Diferenciadas">
                      <Empty description="O cliente utiliza a tabela de preços padrão do sistema." />
                    </Card>
                  ),
                },
              ]}
            />
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
            <Empty description="Selecione um cliente na esteira esquerda para detalhar" />
          </div>
        )}
      </Content>

      {/* MODAL DE CADASTRO COMPLETO (COM SEÇÕES SECUNDÁRIAS) */}
   

<Modal
title={
<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
<span style={{ fontSize: '18px', fontWeight: 600 }}>Cadastrar Novo Cliente</span>
<Text type="secondary" style={{ fontSize: '13px', fontWeight: 400 }}>
Preencha as informações cadastrais completas, contatos, endereços e dados fiscais para emissão de notas.
</Text>
</div>
}
open={isModalOpen}
onCancel={() => setIsModalOpen(false)}
onOk={() => form.submit()}
width={1100}
okText="Confirmar Cadastro"
cancelText="Voltar"
destroyOnClose
centered
styles={{
body: { maxHeight: '75vh', overflowY: 'auto', paddingRight: '8px' }
}}
>
<Form 
form={form} 
layout="vertical" 
initialValues={{ 
tipo_pessoa: 'PJ',
indicador_ie: '1',
consumidor_final: true,
telefones: [{}],
emails: [{}],
enderecos: [{}]
}} 
onFinish={handleCreateCliente}
style={{ marginTop: 16 }}
>
<Row gutter={16}>

{/* ================= COLUNA DA ESQUERDA ================= */}
<Col span={14}>

{/* BLOCO 1: DADOS PRINCIPAIS E FISCAIS DO CLIENTE */}
<div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: 16 }}>
<Form.Item name="tipo_pessoa" label={<span style={{ fontWeight: 600 }}>Modelo de Entidade Jurídica</span>} style={{ marginBottom: 16 }}>
<Radio.Group 
onChange={(e) => setTipoPessoaModal(e.target.value)} 
buttonStyle="solid"
style={{ width: '100%', display: 'flex' }}
>
<Radio.Button value="PJ" style={{ flex: 1, textAlign: 'center' }}>Pessoa Jurídica</Radio.Button>
<Radio.Button value="PF" style={{ flex: 1, textAlign: 'center' }}>Pessoa Física</Radio.Button>
</Radio.Group>
</Form.Item>

<Row gutter={12}>
{tipoPessoaModal === 'PJ' ? (
<>
<Col span={14}>
<Form.Item name="razao_social" label="Razão Social" rules={[{ required: true, message: 'Obrigatório' }]} style={{ marginBottom: 12 }}>
<Input placeholder="Nome empresarial oficial" />
</Form.Item>
</Col>
<Col span={10}>
<Form.Item label="CNPJ" name="documento" rules={[{ required: true, message: 'Informe o documento' }]} style={{ marginBottom: 12 }}>
<Input 
placeholder="00.000.000/0000-00" 
onChange={(e) => {
const masked = maskCPF_CNPJ(e.target.value);
form.setFieldsValue({ documento: masked });
}} 
/>
</Form.Item>
</Col>
<Col span={12}>
<Form.Item name="nome_fantasia" label="Nome Fantasia / Unidade" style={{ marginBottom: 12 }}>
<Input placeholder="Ex: Filial Região" />
</Form.Item>
</Col>

{/* CAMPOS FISCAIS ESSENCIAIS PARA PJ */}
<Col span={12}>
<Form.Item name="indicador_ie" label="Indicador de Inscrição Estadual" rules={[{ required: true, message: 'Obrigatório' }]} style={{ marginBottom: 12 }}>
<Select placeholder="Selecione o perfil fiscal">
<Select.Option value="1">1 - Contribuinte de ICMS</Select.Option>
<Select.Option value="2">2 - Contribuinte Isento</Select.Option>
<Select.Option value="9">9 - Não Contribuinte</Select.Option>
</Select>
</Form.Item>
</Col>

<Col span={12}>
<Form.Item name="inscricao_estadual" label="Inscrição Estadual (I.E.)" style={{ marginBottom: 12 }}>
<Input placeholder="Número ou Isento" />
</Form.Item>
</Col>

<Col span={12}>
<Form.Item name="inscricao_municipal" label="Inscrição Municipal" style={{ marginBottom: 12 }}>
<Input placeholder="Ex: 1234567" />
</Form.Item>
</Col>

<Col span={12}>
<Form.Item name="cnae" label="CNAE Principal" rules={[{ len: 7, message: 'CNAE deve ter 7 dígitos' }]} style={{ marginBottom: 12 }}>
<Input placeholder="Ex: 6201501" />
</Form.Item>
</Col>

<Col span={12}>
<Form.Item label="Consumidor Final" name="consumidor_final" style={{ marginBottom: 12 }}>
<Select>
<Select.Option value={true}>Sim (Consumidor Final)</Select.Option>
<Select.Option value={false}>Não (Revenda / Industrialização)</Select.Option>
</Select>
</Form.Item>
</Col>

<Col span={12}>
<Form.Item label="Inscrição Suframa" name="inscricao_suframa" style={{ marginBottom: 12 }}>
<Input placeholder="Opcional (ZFM)" />
</Form.Item>
</Col>

<Col span={12}>
<Form.Item label="Tomador é Órgão Público?" name="orgao_publico" valuePropName="checked" style={{ marginBottom: 0 }}>
<Switch />
</Form.Item>
</Col>

<Col span={12}>
<Form.Item label="Exigir Retenções Federais" name="retem_impostos" valuePropName="checked" style={{ marginBottom: 0 }}>
<Switch />
</Form.Item>
</Col>
</>
) : (
<>
<Col span={14}>
<Form.Item name="nome_pf" label="Nome Completo" rules={[{ required: true, message: 'Obrigatório' }]} style={{ marginBottom: 0 }}>
<Input placeholder="Nome do cliente" />
</Form.Item>
</Col>
<Col span={10}>
<Form.Item label="CPF" name="documento" rules={[{ required: true, message: 'Informe o documento' }]} style={{ marginBottom: 0 }}>
<Input 
placeholder="000.000.000-00" 
onChange={(e) => {
const masked = maskCPF_CNPJ(e.target.value);
form.setFieldsValue({ documento: masked });
}} 
/>
</Form.Item>
</Col>
</>
)}
</Row>
</div>

{/* BLOCO 2: ENDEREÇOS (Com CEP corrigido para o array dinâmico) */}
<div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: 16 }}>
<Divider orientation="left" style={{ fontSize: '13px', color: '#096dd9', fontWeight: 600, marginTop: 0 }}>
<EnvironmentOutlined style={{ marginRight: 6 }} /> Endereços (Fiscal / Entrega)
</Divider>

<Form.List name="enderecos">
{(fields, { add, remove }) => (
<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
{fields.map(({ key, name, ...restField }) => (
<div key={key} style={{ background: '#ffffff', padding: '12px', borderRadius: '6px', border: '1px solid #d9d9d9', position: 'relative' }}>
<Row gutter={8}>
<Col span={20}>
<Form.Item {...restField} name={[name, 'tag']} label="Identificação / Apelido" style={{ marginBottom: 6 }}>
<Input placeholder="Ex: Matriz (Fiscal) ou CD Entrega" />
</Form.Item>
</Col>
<Col span={4} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', paddingBottom: 6 }}>
{fields.length > 1 && (
<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(name)} />
)}
</Col>

{/* FLAGS / BOOLS DE PAPEL DO ENDEREÇO */}
<Col span={24} style={{ marginBottom: 8, display: 'flex', gap: 16, background: '#f8fafc', padding: '6px 8px', borderRadius: '4px' }}>
<Form.Item {...restField} name={[name, 'is_principal']} valuePropName="checked" style={{ marginBottom: 0 }}>
<Checkbox style={{ fontSize: '11px' }}>Principal / Fiscal</Checkbox>
</Form.Item>
<Form.Item {...restField} name={[name, 'is_cobranca']} valuePropName="checked" style={{ marginBottom: 0 }}>
<Checkbox style={{ fontSize: '11px' }}>Cobrança</Checkbox>
</Form.Item>
<Form.Item {...restField} name={[name, 'is_entrega']} valuePropName="checked" style={{ marginBottom: 0 }}>
<Checkbox style={{ fontSize: '11px' }}>Entrega</Checkbox>
</Form.Item>
</Col>

{/* CEP DINÂMICO CORRIGIDO */}
<Col span={8}>
<Form.Item {...restField} name={[name, 'cep']} label="CEP" style={{ marginBottom: 8 }}>
<Input 
  placeholder="00000-000"
  onChange={(e) => {
    const masked = maskCEP(e.target.value);
    const enderecosAtuais = form.getFieldValue('enderecos') || [];
    enderecosAtuais[name] = { ...enderecosAtuais[name], cep: masked };
    form.setFieldsValue({ enderecos: enderecosAtuais });

    const numerosCep = masked.replace(/\D/g, '');
    if (numerosCep.length === 8) {
      buscarCepApi(numerosCep, name); // Passa o índice correto aqui
    }
  }}
/>
</Form.Item>
</Col>
<Col span={12}>
<Form.Item {...restField} name={[name, 'logradouro']} label="Logradouro" style={{ marginBottom: 8 }}>
<Input placeholder="Av. Brasil" />
</Form.Item>
</Col>
<Col span={4}>
<Form.Item {...restField} name={[name, 'numero']} label="Número" style={{ marginBottom: 8 }}>
<Input placeholder="1200" />
</Form.Item>
</Col>

<Col span={10}>
<Form.Item {...restField} name={[name, 'bairro']} label="Bairro" style={{ marginBottom: 0 }}>
<Input placeholder="Centro" />
</Form.Item>
</Col>
<Col span={10}>
<Form.Item {...restField} name={[name, 'cidade']} label="Cidade" style={{ marginBottom: 0 }}>
<Input placeholder="Campinas" />
</Form.Item>
</Col>
<Col span={4}>
<Form.Item {...restField} name={[name, 'estado']} label="UF" style={{ marginBottom: 0 }}>
<Select placeholder="UF">
<Select.Option value="SP">SP</Select.Option>
<Select.Option value="RJ">RJ</Select.Option>
<Select.Option value="MG">MG</Select.Option>
<Select.Option value="SC">SC</Select.Option>
<Select.Option value="RS">RS</Select.Option>
</Select>
</Form.Item>
</Col>
</Row>
</div>
))}
<Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block size="small">
Adicionar Outro Endereço
</Button>
</div>
)}
</Form.List>
</div>

</Col>

{/* ================= COLUNA DA DIREITA (E-MAILS E TELEFONES) ================= */}
<Col span={10}>
<div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', height: '100%' }}>

{/* E-mails Dinâmicos */}
<Divider orientation="left" style={{ fontSize: '13px', color: '#096dd9', fontWeight: 600, marginTop: 0 }}>
<MailOutlined style={{ marginRight: 6 }} /> E-mails
</Divider>
<Form.List name="emails">
{(fields, { add, remove }) => (
<div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
{fields.map(({ key, name, ...restField }) => (
<div key={key} style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
<Row gutter={4} align="middle">
<Col span={11}>
<Form.Item {...restField} name={[name, 'tag']} style={{ marginBottom: 4 }}>
<Input placeholder="Tag (Ex: Financeiro)" size="small" />
</Form.Item>
</Col>
<Col span={10}>
<Form.Item {...restField} name={[name, 'email']} style={{ marginBottom: 4 }}>
<Input placeholder="email@empresa.com" size="small" />
</Form.Item>
</Col>
<Col span={3} style={{ textAlign: 'center' }}>
{fields.length > 1 && (
<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(name)} />
)}
</Col>
<Col span={24}>
<Form.Item {...restField} name={[name, 'is_principal']} valuePropName="checked" style={{ marginBottom: 0 }}>
<Checkbox style={{ fontSize: '12px' }}>E-mail principal para NF/Boleto</Checkbox>
</Form.Item>
</Col>
</Row>
</div>
))}
<Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block size="small">
Adicionar E-mail
</Button>
</div>
)}
</Form.List>

{/* Telefones Dinâmicos */}
<Divider orientation="left" style={{ fontSize: '13px', color: '#096dd9', fontWeight: 600, marginTop: 0 }}>
<PhoneOutlined style={{ marginRight: 6 }} /> Telefones / WhatsApp
</Divider>
<Form.List name="telefones">
{(fields, { add, remove }) => (
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
{fields.map(({ key, name, ...restField }) => (
<div key={key} style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
<Row gutter={4} align="middle">
<Col span={11}>
<Form.Item {...restField} name={[name, 'tag']} style={{ marginBottom: 4 }}>
<Input placeholder="Tag (Ex: Comercial)" size="small" />
</Form.Item>
</Col>
<Col span={10}>
<Form.Item {...restField} name={[name, 'telefone']} style={{ marginBottom: 4 }}>
<Input placeholder="(00) 00000-0000" size="small" />
</Form.Item>
</Col>
<Col span={3} style={{ textAlign: 'center' }}>
{fields.length > 1 && (
<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(name)} />
)}
</Col>
<Col span={24}>
<Form.Item {...restField} name={[name, 'is_principal']} valuePropName="checked" style={{ marginBottom: 0 }}>
<Checkbox style={{ fontSize: '12px' }}>Telefone principal / WhatsApp</Checkbox>
</Form.Item>
</Col>
</Row>
</div>
))}
<Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block size="small">
Adicionar Telefone
</Button>
</div>
)}
</Form.List>

</div>
</Col>

</Row>

{/* ================= BLOCO FINAL: OBSERVAÇÕES OPERACIONAIS ================= */}
<div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: 16 }}>
<Divider orientation="left" style={{ fontSize: '13px', color: '#096dd9', fontWeight: 600, marginTop: 0 }}>
<FileTextOutlined style={{ marginRight: 6 }} /> Observações Operacionais
</Divider>
<Form.Item name="observacoes" label="Regras Especiais / Exigências do Cliente" style={{ marginBottom: 0 }}>
<Input.TextArea rows={2} placeholder="Ex: Exige Ordem de Compra obrigatória na NF. Enviar boleto e XML imediatamente." />
</Form.Item>
</div>

</Form>
</Modal>

    </Layout>
  );
}






























