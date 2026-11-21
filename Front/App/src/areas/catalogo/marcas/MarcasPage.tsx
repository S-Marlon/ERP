import React, { useState, useEffect, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Button,
  Input,
  Select,
  Table,
  Tag,
  Space,
  Breadcrumb,
  Avatar,
  Statistic,
  Dropdown,
  MenuProps,
  Modal,
  Form,
  Switch,
  Upload,
  Segmented,
  Tooltip,
  message
} from 'antd';
import {
  TagsOutlined,
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  EditOutlined,
  ShoppingOutlined,
  ExportOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  UploadOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

// 🌐 Importando o service e os tipos de marcas
import { 
  getMarcas, 
  createMarca, 
  atualizarMarca, 
  Marca, 
  CreateMarcaPayload 
} from './services/comercialMarcas.service'; // Ajuste o caminho conforme a estrutura do seu projeto
import { ProdutosDaMarcaDrawer } from './ProdutosDaMarcaDrawer';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// --- Estilos Consistentes ---
const styles = {
  container: {
    padding: '24px',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  headerCard: {
    marginBottom: '20px',
    borderRadius: '8px',
  },
  statCard: {
    borderRadius: '8px',
    height: '100%',
  },
  filterCard: {
    marginBottom: '16px',
    borderRadius: '8px',
  },
  gridCard: {
    borderRadius: '8px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
  },
  tableCard: {
    borderRadius: '8px',
  },
};

export const MarcasPage: React.FC = () => {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [form] = Form.useForm();
  // Produtos da marca (gaveta) e edição (o mesmo modal do cadastro)
  const [marcaProdutos, setMarcaProdutos] = useState<Marca | null>(null);
  const [editando, setEditando] = useState<Marca | null>(null);
  const abrirEdicao = (m: Marca) => {
    setEditando(m);
    form.setFieldsValue({ nome: m.nome, site: m.site, status: m.status === 'Ativo', descricao: m.descricao, codigo: m.codigo });
    setIsModalVisible(true);
  };

  const tenantId = 1; // Você pode puxar do seu contexto de autenticação/tenant atual

  // 🔄 Buscar marcas do backend
  const carregarMarcas = useCallback(async () => {
    try {
      setLoading(true);
      const dados = await getMarcas(tenantId, searchText, statusFilter || '');
      setMarcas(dados);
    } catch (error: any) {
      message.error(error.message || 'Erro ao carregar marcas.');
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => {
    carregarMarcas();
  }, [carregarMarcas]);

  const alternarStatus = async (m: Marca) => {
    try {
      await atualizarMarca(m.id, { nome: m.nome, codigo: m.codigo, site: m.site, descricao: m.descricao, status: m.status === 'Ativo' ? 'Inativo' : 'Ativo' });
      message.success(m.status === 'Ativo' ? `${m.nome} inativada.` : `${m.nome} ativada.`);
      carregarMarcas();
    } catch (e: any) { message.error(e.message || 'Erro ao mudar o status.'); }
  };

  // Menu de ações da linha/card
  const getActionMenuItems = (record: Marca): MenuProps['items'] => [
    {
      key: 'edit',
      label: 'Editar Marca',
      icon: <EditOutlined />,
      onClick: () => abrirEdicao(record),
    },
    {
      key: 'products',
      label: 'Ver Produtos Vinc.',
      icon: <ShoppingOutlined />,
      onClick: () => setMarcaProdutos(record),
    },
    { type: 'divider' },
    {
      key: 'toggleStatus',
      label: record.status === 'Ativo' ? 'Inativar' : 'Ativar',
      icon: record.status === 'Ativo' ? <StopOutlined /> : <CheckCircleOutlined />,
      danger: record.status === 'Ativo',
      onClick: () => alternarStatus(record),
    },
  ];

  // Colunas da Tabela
  const columns: ColumnsType<Marca> = [
    {
      title: 'Marca',
      dataIndex: 'nome',
      key: 'nome',
      sorter: (a, b) => a.nome.localeCompare(b.nome),
      render: (_, record) => (
        <Space size="middle">
          <Avatar style={{ backgroundColor: '#722ed1' }} icon={<TagsOutlined />}>
            {record.nome.charAt(0)}
          </Avatar>
          <div>
            <Text strong>{record.nome}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.codigo || 'Sem código ERP'}
              </Text>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Website',
      dataIndex: 'site',
      key: 'site',
      render: (site?: string | null) =>
        site ? (
          <a href={site} target="_blank" rel="noreferrer">
            <GlobalOutlined style={{ marginRight: 6 }} />
            {site.replace('https://', '').replace('http://', '')}
          </a>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Produtos Atrelados',
      dataIndex: 'qtdProdutos',
      key: 'qtdProdutos',
      sorter: (a, b) => (a.qtdProdutos || 0) - (b.qtdProdutos || 0),
      render: (qtd: number = 0, record: Marca) => (
        <a onClick={() => setMarcaProdutos(record)}><Tag color={qtd > 0 ? 'blue' : 'default'} style={{ cursor: 'pointer' }}>{qtd} produtos</Tag></a>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: Marca['status']) => (
        <Tag color={status === 'Ativo' ? 'green' : 'red'}>{status}</Tag>
      ),
    },
    {
      title: 'Ações',
      key: 'acoes',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Dropdown menu={{ items: getActionMenuItems(record) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  // Submissão do cadastro na API
  const handleCreateSubmit = () => {
    form.validateFields().then(async (values) => {
      try {
        setConfirmLoading(true);
        const payload: CreateMarcaPayload = {
          nome: values.nome,
          site: values.site || null,
          status: values.status ? 'Ativo' : 'Inativo',
          descricao: values.descricao || null,
          logoUrl: values.logoUrl || null,
        };

        if (editando) {
          await atualizarMarca(editando.id, { nome: payload.nome, codigo: values.codigo || null, site: payload.site, descricao: payload.descricao, status: payload.status || 'Ativo' });
          message.success('Marca salva.');
          setEditando(null);
        } else {
          await createMarca(payload, tenantId);
          message.success('Marca cadastrada com sucesso!');
        }
        setIsModalVisible(false);
        form.resetFields();
        carregarMarcas(); // Recarrega a listagem do backend
      } catch (error: any) {
        message.error(error.message || 'Erro ao cadastrar marca.');
      } finally {
        setConfirmLoading(false);
      }
    });
  };

  return (
    <div style={styles.container}>
      {/* Breadcrumb */}
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>Dashboard</Breadcrumb.Item>
        <Breadcrumb.Item>Catálogos</Breadcrumb.Item>
        <Breadcrumb.Item>Marcas</Breadcrumb.Item>
      </Breadcrumb>

      {/* Cabeçalho */}
      <Card style={styles.headerCard}>
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Title level={2} style={{ margin: 0 }}>
              Gestão de Marcas
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              Cadastre e organize as marcas dos produtos comercializados na plataforma.
            </Paragraph>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Space>
              <Button icon={<ExportOutlined />}>Exportar</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => { setEditando(null); form.resetFields(); setIsModalVisible(true); }}
              >
                Nova Marca
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Estatísticas Dinâmicas */}
      <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
        <Col xs={12} sm={8}>
          <Card style={styles.statCard} styles={{ body: { padding: '16px 24px' } }}>
            <Statistic
              title="Marcas Cadastradas"
              value={marcas.length}
              prefix={<TagsOutlined style={{ color: '#722ed1', marginRight: 8 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card style={styles.statCard} styles={{ body: { padding: '16px 24px' } }}>
            <Statistic
              title="Marcas Ativas"
              value={marcas.filter((m) => m.status === 'Ativo').length}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card style={styles.statCard} styles={{ body: { padding: '16px 24px' } }}>
            <Statistic
              title="Produtos Vinculados"
              value={marcas.reduce((acc, m) => acc + (m.qtdProdutos || 0), 0)}
              prefix={<ShoppingOutlined style={{ color: '#1890ff', marginRight: 8 }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filtros e Alternador */}
      <Card style={styles.filterCard} styles={{ body: { padding: '16px' } }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} sm={16} md={12}>
            <Space style={{ width: '100%' }}>
              <Input
                placeholder="Buscar por nome ou código..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
              <Select
                style={{ width: 140 }}
                placeholder="Status"
                allowClear
                value={statusFilter}
                onChange={(val) => setStatusFilter(val || null)}
              >
                <Option value="Ativo">Ativos</Option>
                <Option value="Inativo">Inativos</Option>
              </Select>
            </Space>
          </Col>

          <Col>
            <Segmented
              options={[
                { value: 'grid', icon: <AppstoreOutlined /> },
                { value: 'table', icon: <UnorderedListOutlined /> },
              ]}
              value={viewMode}
              onChange={(val) => setViewMode(val as 'grid' | 'table')}
            />
          </Col>
        </Row>
      </Card>

      {/* Conteúdo: Grid ou Tabela */}
      {viewMode === 'grid' ? (
        <Row gutter={[16, 16]}>
          {marcas.map((marca) => (
            <Col xs={24} sm={12} md={8} lg={6} key={marca.id}>
              <Card
                hoverable
                style={styles.gridCard}
                actions={[
                  <Tooltip title="Ver Produtos" key="products">
                    <ShoppingOutlined onClick={() => setMarcaProdutos(marca)} />
                  </Tooltip>,
                  <Tooltip title="Editar" key="edit">
                    <EditOutlined onClick={() => abrirEdicao(marca)} />
                  </Tooltip>,
                  <Dropdown menu={{ items: getActionMenuItems(marca) }} trigger={['click']} key="more">
                    <MoreOutlined />
                  </Dropdown>,
                ]}
              >
                <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Avatar size={48} style={{ backgroundColor: '#722ed1' }}>
                    {marca.nome.charAt(0)}
                  </Avatar>
                  <Tag color={marca.status === 'Ativo' ? 'green' : 'red'}>
                    {marca.status}
                  </Tag>
                </Space>

                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {marca.codigo || 'Sem código'}
                  </Text>
                  <Title level={4} style={{ margin: 0 }}>
                    {marca.nome}
                  </Title>
                  <Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2 }}
                    style={{ fontSize: '13px', marginTop: 4, minHeight: 40 }}
                  >
                    {marca.descricao || 'Sem descrição cadastrada.'}
                  </Paragraph>
                </div>

                <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                  <a style={{ fontSize: '12px' }} onClick={() => setMarcaProdutos(marca)}>
                    <ShoppingOutlined style={{ marginRight: 4 }} />
                    {marca.qtdProdutos || 0} produtos vinculados · ver
                  </a>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card style={styles.tableCard} styles={{ body: { padding: 0 } }}>
          <Table 
            columns={columns} 
            dataSource={marcas} 
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }} 
          />
        </Card>
      )}

      {/* Modal de Nova Marca */}
      <Modal
        title={editando ? `Editar marca · ${editando.nome}` : 'Cadastrar Nova Marca'}
        open={isModalVisible}
        onOk={handleCreateSubmit}
        confirmLoading={confirmLoading}
        onCancel={() => { setIsModalVisible(false); setEditando(null); }}
        okText="Salvar Marca"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="nome"
            label="Nome da Marca"
            rules={[{ required: true, message: 'Informe o nome da marca' }]}
          >
            <Input placeholder="Ex: Nike, Samsung, Dell" />
          </Form.Item>

          <Form.Item name="codigo" label="Código (opcional)">
            <Input maxLength={10} placeholder="Ex.: EBR" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="site" label="Website Oficial">
                <Input placeholder="https://..." />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="status" label="Status" valuePropName="checked" initialValue={true}>
                <Switch checkedChildren="Ativo" unCheckedChildren="Inativo" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="logo" label="Logotipo da Marca">
            <Upload maxCount={1} listType="picture">
              <Button icon={<UploadOutlined />}>Fazer Upload da Logo</Button>
            </Upload>
          </Form.Item>

          <Form.Item name="descricao" label="Descrição / Observações">
            <TextArea rows={3} placeholder="Breve resumo da marca ou linha de produtos..." />
          </Form.Item>
        </Form>
      </Modal>
      <ProdutosDaMarcaDrawer marca={marcaProdutos} marcas={marcas} onFechar={() => setMarcaProdutos(null)} onMudou={carregarMarcas} />
    </div>
  );
};

export default MarcasPage;